/** Connector adapter. Writes only the staging packet paths, never main or product code. */
const REPOSITORY='alexyakovlev79/adatours.ru';
const BRANCH='feature/mobile-hero-swarm-20261023';
const ROOT='data/media/hero-mobile-swarm-20261023';
const API='https://api.github.com/repos/'+REPOSITORY;
const json=value=>JSON.stringify(value,null,2)+'\n';
function unwrap(value){if(value?.isError)throw Error(JSON.stringify(value));return value?.result??value?.structuredContent??value;}
function method(tools,name){const found=tools['mcp__codex_apps__github_'+name]??tools['mcp__GitHub__'+name];if(typeof found!=='function')throw Error('GitHub connector tool missing: '+name);return found.bind(tools);}
async function file(tools,path,ref=BRANCH){return unwrap(await method(tools,'fetch_file')({repository_full_name:REPOSITORY,path,ref}));}
async function api(tools,suffix){const value=unwrap(await method(tools,'fetch')({url:API+suffix}));return typeof value.content==='string'?JSON.parse(value.content):value;}
const head=async tools=>(await api(tools,'/git/ref/heads/'+BRANCH)).object.sha;
const treeOf=async(tools,sha)=>(await api(tools,'/git/commits/'+sha)).tree.sha;
function validateManifest(manifest){
  if(manifest?.schemaVersion!==1||manifest.repository!==REPOSITORY||manifest.branch!==BRANCH||manifest.root!==ROOT||manifest.leaseMinutes!==60||manifest.batchSize!==10||!Array.isArray(manifest.packets)||!manifest.packets.length)throw Error('Swarm manifest mismatch');
  const ids=new Set();
  for(const meta of manifest.packets){if(!/^b\d{3,5}$/.test(meta.id??'')||ids.has(meta.id)||meta.path!==`${ROOT}/packets/${meta.id}.json`||meta.jobsPath!==`${ROOT}/jobs/${meta.id}.json`||!Array.isArray(meta.assetIds)||meta.assetIds.length<1||meta.assetIds.length>10)throw Error('Invalid frozen packet metadata');ids.add(meta.id);}
  return manifest;
}
const manifestOf=async tools=>validateManifest(JSON.parse((await file(tools,ROOT+'/manifest.json')).content));
function metadata(manifest,id){const item=manifest.packets.find(p=>p.id===id);if(!item)throw Error('Packet absent from frozen manifest: '+id);return item;}
function validateState(core,state,meta){core.validatePacket(state);if(state.id!==meta.id||core.canonical(state.assetIds??state.jobs?.map(j=>j.id))!==core.canonical(meta.assetIds)||state.jobsPath!==meta.jobsPath)throw Error('Packet differs from frozen manifest');return state;}
async function jobsFor(tools,core,meta,ref=BRANCH){
  const raw=await file(tools,meta.jobsPath,ref);
  if(meta.jobsBlobSha&&raw.sha!==meta.jobsBlobSha)throw Error('Frozen jobs blob changed');
  if(meta.jobsSha256&&core.sha256(raw.content)!==meta.jobsSha256)throw Error('Frozen jobs checksum changed');
  const doc=JSON.parse(raw.content);
  if(doc.schemaVersion!==1||doc.id!==meta.id||!Array.isArray(doc.jobs)||core.canonical(doc.jobs.map(j=>j.id))!==core.canonical(meta.assetIds))throw Error('Frozen job document mismatch');
  return doc.jobs;
}
const brief=state=>({id:state.id,status:state.status,generation:state.generation,lease:state.lease??null,assetIds:state.assetIds,progress:state.progress??[],receipt:state.receipt??{version:1,assets:[]}});
async function claim(tools,core,request,manifest){
  core.checkIdentity(request.ownerId,request.token);
  if(request.pass!==undefined&&(!Number.isSafeInteger(request.pass)||request.pass<1||request.pass>manifest.maxPasses))throw Error('Worker pass exceeds configured maxPasses');
  const metas=manifest.packets,start=request.cursor??(core.hashString(request.ownerId)%metas.length);
  if(!Number.isSafeInteger(start)||start<0||start>=metas.length)throw Error('Invalid packet cursor');
  const selected=request.packetId?[metadata(manifest,request.packetId)]:Array.from({length:metas.length},(_,i)=>metas[(start+i)%metas.length]);
  const scanned=[],busy=[];
  for(const meta of selected){
    scanned.push(meta.id);
    for(let attempt=0;attempt<4;attempt++){
      const previous=await file(tools,meta.path),state=validateState(core,JSON.parse(previous.content),meta);
      const now=Date.now(),selection=core.take(state,{ownerId:request.ownerId,token:request.token,nowMs:now,leaseMinutes:manifest.leaseMinutes});
      if(!selection.packet){if(core.activeLease(state,now))busy.push({id:state.id,expiresAt:state.lease.expiresAt});break;}
      if(selection.resumed){const jobs=await jobsFor(tools,core,meta);return{status:'resumed',branch:BRANCH,packet:{...brief(state),jobs},scanned};}
      try{
        const saved=unwrap(await method(tools,'update_file')({repository_full_name:REPOSITORY,path:meta.path,branch:BRANCH,sha:previous.sha,content:json(core.stateRecord(state)),message:'chore(hero-swarm): reserve '+meta.id+' [skip ci]'}));
        const jobs=await jobsFor(tools,core,meta);
        return{status:'reserved',branch:BRANCH,packet:{...brief(state),jobs},commit:saved.commit_sha,scanned};
      }catch(error){
        const observed=validateState(core,JSON.parse((await file(tools,meta.path)).content),meta);
        if(core.activeLease(observed,Date.now())&&observed.lease.ownerId===request.ownerId&&observed.lease.token===request.token){const jobs=await jobsFor(tools,core,meta);return{status:'resumed_after_uncertain_write',branch:BRANCH,packet:{...brief(observed),jobs},scanned};}
        if(attempt===3&&request.packetId)throw Error('Packet claim contention; reread before retry: '+String(error));
      }
    }
  }
  return{status:request.packetId?'unavailable':busy.length?'busy':'exhausted',branch:BRANCH,scanned,busy,instruction:busy.length?'All packets scanned: active reservations remain. Do not claim the queue is complete.':'All frozen packets were checked; use status to separate ready results from review/retry/stale sources.'};
}
async function changeLease(tools,core,request,manifest){
  const meta=metadata(manifest,request.packetId);
  for(let attempt=0;attempt<5;attempt++){
    const previous=await file(tools,meta.path),state=validateState(core,JSON.parse(previous.content),meta),args={...request,nowMs:Date.now()};
    if(request.action==='renew')core.renew(state,args);
    else if(request.action==='release')core.release(state,args);
    else core.requeue(state,args);
    try{
      const write=unwrap(await method(tools,'update_file')({repository_full_name:REPOSITORY,path:meta.path,branch:BRANCH,sha:previous.sha,content:json(core.stateRecord(state)),message:'chore(hero-swarm): '+request.action+' '+meta.id+' [skip ci]'}));
      return{status:request.action==='renew'?'renewed':request.action==='release'?'released':'requeued',branch:BRANCH,packet:brief(state),commit:write.commit_sha};
    }catch(error){
      const observed=validateState(core,JSON.parse((await file(tools,meta.path)).content),meta);
      if(request.action==='release'&&observed.status==='queued'&&observed.generation===request.generation)return{status:'released_after_uncertain_write',packet:brief(observed)};
      if(request.action==='requeue'&&observed.status==='queued'&&observed.generation===request.expectedGeneration&&observed.history?.some(x=>x.reason===request.reason))return{status:'requeued_after_uncertain_write',packet:brief(observed)};
      if(attempt===4)throw Error('Lease compare-and-swap conflict; reread packet: '+String(error));
    }
  }
}
async function submit(tools,core,request,manifest){
  const meta=metadata(manifest,request.packetId);
  for(let attempt=0;attempt<8;attempt++){
    const oldHead=await head(tools),previous=await file(tools,meta.path,oldHead),state=validateState(core,JSON.parse(previous.content),meta);
    const prior=core.previousSubmission(state,request);if(prior.alreadySaved)return{status:'already_saved',branch:BRANCH,packet:brief(state),head:oldHead};
    state.jobs=await jobsFor(tools,core,meta,oldHead);
    core.saveResults(state,{...request,nowMs:Date.now()});
    const record=core.stateRecord(state),resultDocument={schemaVersion:1,packetId:meta.id,sourceCommit:manifest.sourceCommit,packetGeneration:state.generation,submissionId:request.submissionId,results:state.progress,savedAt:state.updatedAt};
    const elements=[
      {path:meta.path,mode:'100644',type:'blob',content:json(record)},
      {path:`${ROOT}/results/${meta.id}.json`,mode:'100644',type:'blob',content:json(resultDocument)},
      {path:`${ROOT}/receipts/${meta.id}.json`,mode:'100644',type:'blob',content:json(state.receipt)}
    ];
    const baseTree=await treeOf(tools,oldHead);
    const tree=unwrap(await method(tools,'create_tree')({repository_full_name:REPOSITORY,base_tree_sha:baseTree,tree_elements:elements}));
    const commit=unwrap(await method(tools,'create_commit')({repository_full_name:REPOSITORY,parent_sha:oldHead,tree_sha:tree.sha,message:'media(hero-swarm): '+request.action+' '+meta.id+' [skip ci]'}));
    try{
      const moved=unwrap(await method(tools,'update_ref')({repository_full_name:REPOSITORY,branch_name:BRANCH,sha:commit.sha,expected_sha:oldHead,force:false}));
      if(moved.success===false)throw Error('Branch head compare-and-swap rejected');
      return{status:request.action==='checkpoint'?'checkpoint_saved':'saved',branch:BRANCH,packet:brief(record),commit:commit.sha,instruction:'Saved on staging only. A master publication is required before these images appear on the site.'};
    }catch(error){
      const checked=validateState(core,JSON.parse((await file(tools,meta.path)).content),meta),saved=core.previousSubmission(checked,request);
      if(saved.alreadySaved)return{status:'saved_after_uncertain_response',branch:BRANCH,packet:brief(checked),commit:commit.sha};
      if(attempt===7)throw Error('Concurrent branch updates; local work remains valid. Retry SAME submissionId and payload: '+String(error));
    }
  }
}
async function status(tools,core,request,manifest){
  const start=request.from??0,count=request.count??12;
  if(!Number.isSafeInteger(start)||start<0||start>=manifest.packets.length||!Number.isSafeInteger(count)||count<1||count>30)throw Error('Status needs valid from/count (1–30 packets)');
  const rows=await Promise.all(manifest.packets.slice(start,start+count).map(async meta=>validateState(core,JSON.parse((await file(tools,meta.path)).content),meta)));
  return{status:start===0&&rows.length===manifest.packets.length?'status':'partial_status',branch:BRANCH,from:start,through:start+rows.length-1,nextFrom:start+rows.length<manifest.packets.length?start+rows.length:null,overallPackets:manifest.packets.length,...core.summarize(rows,Date.now())};
}
export async function runMobileHeroSwarm(tools,core,request){
  if(!request?.action)throw Error('Specify claim, renew, release, checkpoint, submit, status or requeue');
  const manifest=await manifestOf(tools);
  if(request.action==='status')return status(tools,core,request,manifest);
  if(manifest.status!=='active')return{status:'closed',reason:manifest.status};
  if(request.action==='claim')return claim(tools,core,request,manifest);
  if(['renew','release','requeue'].includes(request.action))return changeLease(tools,core,request,manifest);
  if(['checkpoint','submit'].includes(request.action))return submit(tools,core,request,manifest);
  throw Error('Unknown mobile hero swarm action '+request.action);
}
