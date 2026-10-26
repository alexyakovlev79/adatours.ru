/** GitHub connector worker adapter: 16 small CAS shards; no changes to main/content. */
const REPO='alexyakovlev79/adatours.ru',BRANCH='feature/destination-taxonomy-swarm-20261026';
const ROOT='data/migrations/destination-taxonomy-20261026/swarm',API='https://api.github.com/repos/'+REPO;
const unwrap=r=>{if(r?.isError)throw Error(JSON.stringify(r));return r?.result??r?.structuredContent??r;};
const tool=(tools,name)=>{const fn=tools['mcp__GitHub__'+name]??tools['mcp__codex_apps__github_'+name];if(typeof fn!=='function')throw Error('Missing GitHub connector '+name);return fn;};
const file=async(tools,path,ref=BRANCH)=>unwrap(await tool(tools,'fetch_file')({repository_full_name:REPO,path,ref}));
const get=async(tools,url)=>JSON.parse(unwrap(await tool(tools,'fetch')({url})).content);
const head=async tools=>(await get(tools,API+'/git/ref/heads/'+BRANCH)).object.sha;
const tree=async(tools,sha)=>(await get(tools,API+'/git/commits/'+sha)).tree.sha;
const encode=x=>JSON.stringify(x,null,2)+'\n';
async function manifestOf(tools) {
 const manifest=JSON.parse((await file(tools,ROOT+'/manifest.json')).content);
 if(manifest.schemaVersion!==1||manifest.branch!==BRANCH||manifest.repository!==REPO||manifest.shardCount!==16||manifest.leaseMinutes!==90||manifest.packetSize!==20||!Array.isArray(manifest.packets)||manifest.packets.length<1)throw Error('Unexpected taxonomy manifest');
 return manifest;
}
const brief=p=>({id:p.id,shard:p.shard,status:p.status,generation:p.generation,lease:p.lease||null,ready:p.ready||0,review:p.review||0,resultPath:p.resultPath||null});
async function frozenJob(tools,core,manifest,packetId,ref=BRANCH){
 const meta=manifest.packets.find(x=>x.id===packetId);if(!meta)throw Error('Unknown packet '+packetId);
 const job=core.validateJob(JSON.parse((await file(tools,core.jobPath(packetId),ref)).content));
 if(job.sourceFingerprint!==meta.sourceFingerprint||job.records.length!==meta.count)throw Error('Immutable job changed');
 return job;
}
async function claim(tools,core,r,m){
 core.checkIdentity(r.ownerId,r.token);
 const start=r.shard??(parseInt(core.hash(r.ownerId),16)%16),scan=Math.min(4,r.scan??2);
 if(!Number.isInteger(start)||start<0||start>=16||!Number.isInteger(scan)||scan<1)throw Error('Invalid claim search');
 const shards=r.packetId?[m.packets.find(x=>x.id===r.packetId)?.shard]:Array.from({length:scan},(_,i)=>(start+i)%16);
 if(shards.some(x=>!Number.isInteger(x)))throw Error('Unknown packet');
 for(const shardNumber of shards){
  const path=core.shardPath(shardNumber);
  for(let attempt=0;attempt<3;attempt++){
   const old=await file(tools,path),state=JSON.parse(old.content);
   const p=core.take(state,{ownerId:r.ownerId,token:r.token,nowMs:Date.now(),leaseMinutes:90,packetId:r.packetId});
   if(!p.item)break;
   if(p.resumed)return{status:'resumed',packet:brief(p.item),job:await frozenJob(tools,core,m,p.item.id)};
   try{
    const w=unwrap(await tool(tools,'update_file')({repository_full_name:REPO,path,branch:BRANCH,sha:old.sha,content:encode(state),message:'chore(taxonomy): claim '+p.item.id+' [skip ci]'}));
    return{status:'reserved',packet:brief(p.item),job:await frozenJob(tools,core,m,p.item.id),commit:w.commit_sha};
   }catch(e){
    const observed=JSON.parse((await file(tools,path)).content);
    const mine=observed.items.find(x=>x.id===p.item.id&&core.active(x,Date.now())&&x.lease.ownerId===r.ownerId&&x.lease.token===r.token);
    if(mine)return{status:'resumed_after_uncertain_write',packet:brief(mine),job:await frozenJob(tools,core,m,mine.id)};
    if(attempt===2)throw Error('CAS claim failed, keep same owner/token: '+String(e));
   }
  }
 }
 return{status:r.packetId?'unavailable':'scan_more',nextShard:(start+scan)%16,scanned:shards,instruction:'Scan remaining shards with same owner and a new token only after a complete unsuccessful pass; busy is not exhausted.'};
}
async function changeLease(tools,core,r,m){
 const meta=m.packets.find(x=>x.id===r.packetId);if(!meta)throw Error('Unknown packet');
 const path=core.shardPath(meta.shard);
 for(let attempt=0;attempt<3;attempt++){
  const old=await file(tools,path),state=JSON.parse(old.content);
  const req={...r,nowMs:Date.now()};
  const p=r.action==='renew'?core.renew(state,req):r.action==='release'?core.release(state,req):
    core.requeueReview(state,{...req,nowMs:Date.now()});
  try{
   const w=unwrap(await tool(tools,'update_file')({repository_full_name:REPO,path,branch:BRANCH,sha:old.sha,content:encode(state),message:'chore(taxonomy): '+r.action+' '+r.packetId+' [skip ci]'}));
   return{status:r.action==='renew'?'renewed':r.action==='release'?'released':'requeued',packet:brief(p),commit:w.commit_sha};
  }catch(e){if(attempt===2)throw Error('CAS lease update failed: '+String(e));}
 }
}
async function submit(tools,core,r,m){
 const meta=m.packets.find(x=>x.id===r.packetId);if(!meta)throw Error('Unknown packet');
 const job=await frozenJob(tools,core,m,r.packetId),path=core.shardPath(meta.shard);
 const records=core.validateResults(job,r.records),checksum=core.recordChecksum(job,records);
 for(let attempt=0;attempt<4;attempt++){
  const oldHead=await head(tools),old=await file(tools,path,oldHead),state=JSON.parse(old.content);
  const p=state.items.find(x=>x.id===r.packetId);
  if(p?.status==='completed'){
    if(p.submissionId===r.submissionId&&p.recordChecksum===checksum)return{status:'already_saved',packet:brief(p),commit:oldHead};
    throw Error('Packet already completed by another submission');
  }
  const result=core.finish(state,job,{...r,records,nowMs:Date.now()});
  const doc={schemaVersion:1,packetId:r.packetId,sourceCommit:m.sourceCommit,sourceCatalogSha:m.sourceCatalogSha,
   sourceFingerprint:job.sourceFingerprint,generation:p.generation,ownerId:r.ownerId,submissionId:r.submissionId,
   recordChecksum:checksum,records:result.records,submittedAt:p.completedAt};
  const elements=[{path,mode:'100644',type:'blob',content:encode(state)},
    {path:p.resultPath,mode:'100644',type:'blob',content:encode(doc)}];
  const nextTree=unwrap(await tool(tools,'create_tree')({repository_full_name:REPO,base_tree_sha:await tree(tools,oldHead),tree_elements:elements}));
  const commit=unwrap(await tool(tools,'create_commit')({repository_full_name:REPO,parent_sha:oldHead,tree_sha:nextTree.sha,
    message:'data(taxonomy): classify '+r.packetId+' [skip ci]'}));
  try{
   const written=unwrap(await tool(tools,'update_ref')({repository_full_name:REPO,branch_name:BRANCH,sha:commit.sha,expected_sha:oldHead,force:false}));
   if(!written.success)throw Error('CAS ref rejected');
   return{status:'saved',packet:brief(p),commit:commit.sha,ready:p.ready,review:p.review};
  }catch(e){
   const latest=JSON.parse((await file(tools,path)).content).items.find(x=>x.id===r.packetId);
   if(latest?.status==='completed'&&latest.submissionId===r.submissionId&&latest.recordChecksum===checksum)
     return{status:'saved_after_uncertain_response',packet:brief(latest)};
   if(attempt===3)throw Error('Concurrent commit conflict: retry SAME owner/token/submissionId and records: '+String(e));
  }
 }
}
async function status(tools,core,r,m){
 const from=r.from??0,count=Math.min(4,r.count??4);
 if(!Number.isInteger(from)||from<0||from>=16||!Number.isInteger(count)||count<1)throw Error('Invalid status from/count');
 const states=await Promise.all(Array.from({length:Math.min(count,16-from)},(_,i)=>from+i).map(async n=>JSON.parse((await file(tools,core.shardPath(n))).content)));
 return{status:'partial_status',from,nextFrom:from+states.length<16?from+states.length:null,sourceCount:m.destinationCount,
  ...core.summarize(states,Date.now())};
}
export async function runDestinationTaxonomySwarm(tools,core,request){
 if(!request?.action)throw Error('Specify swarm action');
 const m=await manifestOf(tools);
 if(request.action==='status')return status(tools,core,request,m);
 if(m.status!=='active')return{status:'closed',reason:m.status};
 if(request.action==='claim')return claim(tools,core,request,m);
 if(['renew','release','requeue_review'].includes(request.action))return changeLease(tools,core,request,m);
 if(request.action==='submit')return submit(tools,core,request,m);
 throw Error('Unknown taxonomy action '+request.action);
}
