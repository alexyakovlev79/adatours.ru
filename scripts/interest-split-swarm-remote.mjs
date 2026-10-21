/* GitHub connector adapter for Ada Tours interest-split SEO swarm.
   Loads no code from user data; uses explicit repo/branch and non-force CAS. */
const REPO='alexyakovlev79/adatours.ru';
const BRANCH='feature/split-nature-wildlife-seo-swarm-20261021';
const ROOT='data/migrations/interest-split-20261020/swarm';
const API='https://api.github.com/repos/'+REPO;
const unwrap=r=>{if(r?.isError)throw Error(JSON.stringify(r));return r?.result??r?.structuredContent??r;};
async function file(tools,path,ref=BRANCH) {
  return unwrap(await tools.mcp__GitHub__fetch_file({repository_full_name:REPO,path,ref}));
}
async function head(tools) {
  return JSON.parse(unwrap(await tools.mcp__GitHub__fetch({url:API+'/git/ref/heads/'+BRANCH})).content).object.sha;
}
async function treeOf(tools,sha) {
  return JSON.parse(unwrap(await tools.mcp__GitHub__fetch({url:API+'/git/commits/'+sha})).content).tree.sha;
}
async function manifestOf(tools) {
  const m=JSON.parse((await file(tools,ROOT+'/manifest.json')).content);
  if(m.branch!==BRANCH||m.repository!==REPO||m.shardCount!==16||m.schemaVersion!==1)throw Error('Swarm manifest mismatch');
  return m;
}
function brief(x) {
  return {id:x.id,url:x.url,path:x.path,lane:x.lane,status:x.status,
    attempts:x.attempts,leaseUntil:x.leaseUntil,decision:x.decision||null};
}
async function claim(tools,core,request,manifest) {
  const {ownerId,token}=request;core.checkIdentity(ownerId,token);
  const limit=request.limit??manifest.batchSize;
  const start=Number.isInteger(request.lane)?request.lane:core.hashString(ownerId)%manifest.shardCount;
  if(start<0||start>=manifest.shardCount)throw Error('Invalid lane');
  const scan=Math.min(4,Number.isInteger(request.scan)?request.scan:4);
  const scanned=[];
  for(let offset=0;offset<scan;offset++) {
    const lane=(start+offset)%manifest.shardCount, path=core.shardPath(lane);
    scanned.push(lane);
    for(let attempt=0;attempt<3;attempt++) {
      const previous=await file(tools,path),state=JSON.parse(previous.content);
      const selection=core.take(state,{ownerId,token,limit,nowMs:Date.now(),leaseMinutes:manifest.leaseMinutes});
      if(!selection.selected.length)break;
      if(selection.resumed) return {status:'resumed',branch:BRANCH,lane,selected:selection.selected.map(brief),scanned};
      try {
        const write=unwrap(await tools.mcp__GitHub__update_file({
          repository_full_name:REPO,path,branch:BRANCH,sha:previous.sha,
          content:JSON.stringify(state,null,2)+'\n',
          message:'chore(interest-swarm): reserve '+selection.selected.map(x=>x.id).join(',')+' [skip ci]'
        }));
        return {status:'reserved',branch:BRANCH,lane,selected:selection.selected.map(brief),
          commit:write.commit_sha,scanned};
      }catch(error) {
        const now=JSON.parse((await file(tools,path)).content);
        const mine=now.items.filter(x=>x.ownerId===ownerId&&x.token===token&&core.activeLease(x,Date.now()));
        if(mine.length)return{status:'resumed_after_write',branch:BRANCH,lane,selected:mine.map(brief),scanned};
        if(attempt===2)throw Error('CAS claim contention on lane '+lane+': '+String(error));
      }
    }
  }
  return {status:'scan_more',branch:BRANCH,scanned,nextLane:(start+scan)%manifest.shardCount,
    instruction:'No free task in scanned lanes. Call claim with the same ownerId and a NEW token at nextLane; check all 16 lanes before declaring empty.'};
}
async function leaseChange(tools,core,request,manifest,kind) {
  const lane=request.lane,path=core.shardPath(lane);
  if(!Number.isInteger(lane)||lane<0||lane>=manifest.shardCount)throw Error('Invalid lane');
  for(let attempt=0;attempt<3;attempt++) {
    const prior=await file(tools,path),state=JSON.parse(prior.content);
    const args={ownerId:request.ownerId,token:request.token,ids:request.ids,nowMs:Date.now(),leaseMinutes:manifest.leaseMinutes};
    const result=kind==='renew'?core.refresh(state,args):core.release(state,args);
    try{
      const write=unwrap(await tools.mcp__GitHub__update_file({
        repository_full_name:REPO,path,branch:BRANCH,sha:prior.sha,
        content:JSON.stringify(state,null,2)+'\n',message:'chore(interest-swarm): '+kind+' '+result.map(x=>x.id).join(',')+' [skip ci]'
      }));
      return {status:kind==='renew'?'renewed':'released',lane,selected:result.map(brief),commit:write.commit_sha};
    }catch(error){if(attempt===2)throw Error('Lease update CAS conflict: '+String(error));}
  }
}
async function externalLocks(tools,urls,nowMs) {
  const endpoints=[
    ['seo-geo/staging','data/seo-geo/claims.json'],
    ['seo-geo/voice-rewrite-staging','data/seo-geo/voice-rewrite/claims.json']
  ];
  const blockers=[];
  for(const [ref,path] of endpoints) {
    const raw=JSON.parse((await file(tools,path,ref)).content);
    for(const url of urls) {
      const lock=raw.claims?.[url];
      if(lock && Date.parse(lock.expiresAt)>nowMs)
        blockers.push({url,ref,ownerId:lock.ownerId,expiresAt:lock.expiresAt});
    }
  }
  return blockers;
}
async function submit(tools,core,request,manifest) {
  core.validateSubmitArgs(request);
  const lane=request.lane;
  if(!Number.isInteger(lane)||lane<0||lane>=manifest.shardCount)throw Error('Provide shard lane');
  const requestIds=request.items.map(x=>x.id),path=core.shardPath(lane);
  const urlById=new Map();
  // Do not modify a file under an unrelated active SEO writer/voice-rewrite claim.
  let prepared=new Map();
  for(let attempt=0;attempt<4;attempt++) {
    const oldHead=await head(tools),prior=await file(tools,path,oldHead),state=JSON.parse(prior.content);
    const existing=requestIds.map(id=>state.items.find(x=>x.id===id));
    if(existing.every(x=>x&&['done','review'].includes(x.status)&&x.checkedBy===request.ownerId&&x.token===request.token)) {
      return {status:'already_saved',branch:BRANCH,lane,results:existing.map(brief),head:oldHead};
    }
    const mine=core.requireLease(state,{ownerId:request.ownerId,token:request.token,ids:requestIds,nowMs:Date.now()});
    const locks=await externalLocks(tools,mine.map(x=>x.url),Date.now());
    if(locks.length)return {status:'external_claim_blocked',blockers:locks,lane,
      instruction:'Do not alter these articles. Renew own lease if appropriate or release; coordinate external active SEO writer first.'};
    const elements=[],results=[];
    for(let i=0;i<mine.length;i++) {
      const item=mine[i],job=request.items[i];urlById.set(job.id,item.url);
      if(item.id!==job.id||item.lane!==lane)throw Error('Task order or shard mismatch');
      if(!item.path.startsWith('data/seo-geo/articles/')||!item.path.endsWith('/index.md')||item.path.includes('..'))throw Error('Unsafe task article path');
      if(job.decision==='review') {
        results.push({id:item.id,decision:'review',note:job.note,sourceSha:null,resultSha:null});
        continue;
      }
      const current=await file(tools,item.path,oldHead);
      if(current.sha!==job.expectedSha) {
        return {status:'source_changed',lane,id:item.id,url:item.url,
          currentSha:current.sha,expectedSha:job.expectedSha,
          instruction:'Keep local edits; compare with the latest article and review/submit an updated exact patch. No overwrite performed.'};
      }
      const revised=core.applyEdits(current.content,job.edits);
      core.checkArticleInvariant(current.content,revised,item);
      if(job.decision==='edited'&&revised===current.content)throw Error('Edited article unchanged: '+item.id);
      if(job.decision==='confirmed'&&revised!==current.content)throw Error('Confirmed article was modified: '+item.id);
      let resultSha=current.sha;
      if(revised!==current.content) {
        const cacheKey=item.id+':'+job.expectedSha+':'+JSON.stringify(job.edits);
        if(prepared.has(cacheKey))resultSha=prepared.get(cacheKey);
        else{
          resultSha=unwrap(await tools.mcp__GitHub__create_blob({
            repository_full_name:REPO,encoding:'utf-8',content:revised
          })).sha;
          prepared.set(cacheKey,resultSha);
        }
        elements.push({path:item.path,mode:'100644',type:'blob',sha:resultSha});
      }
      results.push({id:item.id,decision:job.decision,note:job.note,sourceSha:current.sha,resultSha});
    }
    core.finish(state,{ownerId:request.ownerId,token:request.token,results,nowMs:Date.now()});
    elements.push({path,mode:'100644',type:'blob',content:JSON.stringify(state,null,2)+'\n'});
    const baseTree=await treeOf(tools,oldHead);
    const newTree=unwrap(await tools.mcp__GitHub__create_tree({repository_full_name:REPO,base_tree_sha:baseTree,tree_elements:elements})).sha;
    const newCommit=unwrap(await tools.mcp__GitHub__create_commit({
      repository_full_name:REPO,parent_sha:oldHead,tree_sha:newTree,
      message:'content(interest-swarm): verify '+requestIds.join(',')+' [skip ci]'
    })).sha;
    try {
      const moved=unwrap(await tools.mcp__GitHub__update_ref({
        repository_full_name:REPO,branch_name:BRANCH,sha:newCommit,expected_sha:oldHead,force:false
      }));
      if(!moved.success)throw Error('Branch ref rejected');
      return {status:'saved',lane,commit:newCommit,results:results.map(r=>({...r,url:urlById.get(r.id)})),
        instruction:'This is only a staging commit, not a production deploy.'};
    }catch(error) {
      const checked=JSON.parse((await file(tools,path)).content);
      const done=requestIds.map(id=>checked.items.find(x=>x.id===id));
      if(done.every(x=>x&&['done','review'].includes(x.status)&&x.checkedBy===request.ownerId&&x.token===request.token))
        return {status:'saved_after_uncertain_response',lane,results:done.map(brief)};
      if(attempt===3)throw Error('Concurrent commit CAS contention; work not lost, reuse SAME ownerId/token/patches: '+String(error));
    }
  }
}
async function requeueReview(tools,core,request,manifest) {
  const lane=request.lane,path=core.shardPath(lane);
  if(!Number.isInteger(lane)||lane<0||lane>=manifest.shardCount)throw Error('Invalid lane');
  for(let attempt=0;attempt<3;attempt++) {
    const previous=await file(tools,path),state=JSON.parse(previous.content);
    const row=core.reopenReview(state,{id:request.id,expectedCompletedAt:request.expectedCompletedAt,
      reason:request.reason,nowMs:Date.now()});
    try {
      const write=unwrap(await tools.mcp__GitHub__update_file({repository_full_name:REPO,
        path,branch:BRANCH,sha:previous.sha,content:JSON.stringify(state,null,2)+'\n',
        message:'chore(interest-swarm): requeue reviewed '+row.id+' [skip ci]'}));
      return {status:'requeued',lane,id:row.id,commit:write.commit_sha};
    }catch(error) { if(attempt===2)throw Error('Review CAS contention: '+String(error)); }
  }
}
async function status(tools,core,request,manifest) {
  const from=request.from??0,count=Math.min(4,request.count??4);
  if(!Number.isInteger(from)||from<0||from>=manifest.shardCount)throw Error('Invalid status start');
  const arr=await Promise.all(Array.from({length:count},(_,i)=>from+i).filter(x=>x<manifest.shardCount).map(async lane=>
    JSON.parse((await file(tools,core.shardPath(lane))).content)));
  const totals=core.summarize(arr);
  return {status:'partial_status',from,through:from+arr.length-1,nextFrom:from+arr.length<manifest.shardCount?from+arr.length:null,...totals,overallTotal:manifest.taskCount};
}
export async function runInterestSplitSwarm(tools,core,request) {
  const manifest=await manifestOf(tools);
  if(!request||!request.action)throw Error('Specify action claim/renew/release/submit/status');
  if(request.action==='status')return status(tools,core,request,manifest);
  if(manifest.status!=='active')return{status:'closed',reason:manifest.status};
  if(request.action==='claim')return claim(tools,core,request,manifest);
  if(request.action==='renew'||request.action==='release')return leaseChange(tools,core,request,manifest,request.action);
  if(request.action==='submit')return submit(tools,core,request,manifest);
  if(request.action==='requeue_review')return requeueReview(tools,core,request,manifest);
  throw Error('Unknown swarm action '+request.action);
}
