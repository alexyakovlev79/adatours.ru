/** GitHub CAS dispatcher for the NEW v2 EN bulk queue.
 * Worker namespace cannot approve, publish or touch main. Every source file
 * is rechecked against canonical main before a claim/submit.
 */
const REPO='alexyakovlev79/adatours.ru';
const BRANCH='i18n/translation-mass-staging';
const ROOT='data/i18n/translation-mass/v2',LIMIT=8;
const clean=x=>JSON.stringify(x,null,2)+'\n';
const unwrap=r=>{if(r?.isError)throw Error(JSON.stringify(r));return r?.result||r?.structuredContent||r};
const valid=s=>typeof s==='string'&&/^[a-zA-Z0-9_.:-]{3,200}$/.test(s);
const restricted=/rate.?limit|429|retry.?after|secondary limit|too many requests/i;
const denied=/\b40[13]\b|forbidden|permission denied|unauthori[sz]ed|bad credentials/i;
const conflict=/non.fast.forward|expected.sha|409|422|reference|conflict|mismatch|changed/i;
// Connector GraphQL failures and lost replies are transport failures, not
// evidence that Word/Drive is unavailable. Never turn them into job failures.
const transient=/GithubGraphQLAPIError|RemoteProtocolError|Server disconnected|Transport closed|internal (?:server )?error|something went wrong|bad gateway|service unavailable|gateway timeout|\b50[0234]\b|ECONNRESET|ETIMEDOUT|fetch failed|network error|response lost/i;
const safe=s=>s.replace(/[^A-Za-z0-9_.-]/g,'_').slice(0,190);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const nowValue=s=>{if(!Number.isFinite(Date.parse(s)))throw Error('Exact UTC timestamp required');return s};
async function getHead(tools){
 const x=JSON.parse(unwrap(await tools.mcp__GitHub__fetch({
  url:'https://api.github.com/repos/'+REPO+'/git/ref/heads/'+BRANCH})).content);
 return x.object.sha;
}
async function read(tools,path,sha){
 return JSON.parse(unwrap(await tools.mcp__GitHub__fetch_file({
  repository_full_name:REPO,path,ref:sha})).content);
}
async function createReceipt(tools,data){
 return unwrap(await tools.mcp__GitHub__create_blob({
  repository_full_name:REPO,content:clean(data),encoding:'utf-8'})).sha;
}
async function commitCas(tools,head,files,message){
 const parent=JSON.parse(unwrap(await tools.mcp__GitHub__fetch({
  url:'https://api.github.com/repos/'+REPO+'/git/commits/'+head})).content);
 const tree=unwrap(await tools.mcp__GitHub__create_tree({
  repository_full_name:REPO,base_tree_sha:parent.tree.sha,
  tree_elements:files.map(f=>({path:f.path,type:'blob',mode:'100644',
   ...(f.sha?{sha:f.sha}:{content:clean(f.data)})}))})).sha;
 const next=unwrap(await tools.mcp__GitHub__create_commit({
  repository_full_name:REPO,parent_sha:head,tree_sha:tree,message})).sha;
 try{
  const updated=unwrap(await tools.mcp__GitHub__update_ref({
   repository_full_name:REPO,branch_name:BRANCH,expected_sha:head,sha:next,force:false}));
  if(!updated.success)throw Error('Branch CAS move was not confirmed: response lost');
 }catch(error){
  // A mutation can have succeeded even when its response is lost. Confirm
  // the head before attempting another CAS; later descendants are reconciled
  // by replaying the same operation against its immutable receipt.
  if(!restricted.test(String(error))&&transient.test(String(error))&&
     await getHead(tools)===next)return next;
  throw error;
 }
 return next;
}
async function currentRu(tools,job){
 if(!job?.source?.contentPath?.startsWith('src/content/tours/'))return false;
 const f=unwrap(await tools.mcp__GitHub__fetch_file({
  repository_full_name:REPO,path:job.source.contentPath,ref:'main'}));
 return f.sha===job.source.sourceBlobSha;
}
export async function runEnMassTranslation(tools,core,args={}){
 const action=args.action;
 if(!['status','claim','renew','checkpoint','submit','release','fail','reap'].includes(action))
  throw Error('Unsupported worker action');
 if(action!=='status'&&(!valid(args.ownerId)||!valid(args.token)))
  throw Error('Stable ownerId/token required');
 for(let attempt=0;attempt<LIMIT;attempt++){
  const time=nowValue(args.now||new Date().toISOString());
  try{
   const head=await getHead(tools);
   const index=await read(tools,ROOT+'/index.json',head);
   if(index.schemaVersion!==2||index.pilotOnly!==false||index.publicationEnabled!==false)
    throw Error('Unexpected bulk queue publication gate');
   if(action==='status'){
    let owner=null;
    // The worker needs its own confirmed Git progress to enforce a 10-job
    // chain after a successful submit, including on a replay after timeout.
    if(args.ownerId!==undefined||args.token!==undefined){
     if(!valid(args.ownerId)||!valid(args.token))throw Error('Stable ownerId/token required');
     const assigned=index.ownerAssignments?.[args.ownerId];
     if(assigned&&assigned.token!==args.token)
      return{status:'owner_token_conflict',head};
     const completed=new Set(assigned?.completedJobIds||[]);
     const unfinished=(assigned?.jobIds||[]).filter(id=>!completed.has(id));
     owner={completed:completed.size,
      assigned:assigned?.jobIds?.length||0,
      activeJobId:index.activeOwners?.[args.ownerId]?.jobId||null,
      resumeCandidateJobId:unfinished.at(-1)||null,
      maxJobsPerOwner:index.maxJobsPerOwner};
    }
    return{status:'snapshot',head,branch:BRANCH,
     stage:index.stage,enabled:index.dispatcherEnabled,
     translationMassLaunchAllowed:index.translationMassLaunchAllowed,
     counts:index.counts,stageCounts:index.stageCounts,
     activeOwners:Object.keys(index.activeOwners||{}).length,
     jobCount:index.jobCount,tourCount:index.tourCount,
     sourceCommit:index.sourceCommit,...(owner?{owner}:{})};
   }
   if(index.dispatcherEnabled!==true||index.translationMassLaunchAllowed!==true)
    return{status:'gate_closed',branch:BRANCH,head,stage:index.stage};
   const assignments=index.ownerAssignments||{};
   const mine=assignments[args.ownerId];
   if(mine&&mine.token!==args.token)return{status:'owner_token_conflict',head};
   const owners=index.activeOwners||{};
   const active=owners[args.ownerId],nowMs=Date.parse(time);
   if(action==='claim'&&!active&&(mine?.completedJobIds?.length||0)>=index.maxJobsPerOwner)
    return{status:'owner_quota_reached',head,completed:mine.completedJobIds.length};
   let sid;
   if(action==='claim'&&active&&Date.parse(active.expiresAt)>nowMs){
    if(active.token!==args.token)return{status:'owner_token_conflict',head};
    sid=core.massShard(active.jobId);
   }else if(action==='claim'&&args.jobId){
    if(!valid(args.jobId))throw Error('Unsafe explicit jobId');
    sid=core.massShard(args.jobId);
   }else if(action==='claim'||action==='reap'){
    sid=core.massIndexShard(index,time,action==='claim'?args.ownerId:null);
   }else{
    if(!valid(args.jobId))throw Error('Exact jobId required');
    sid=core.massShard(args.jobId);
   }
   if(!sid)return{status:'busy_or_empty',head,counts:index.counts,
    stageCounts:index.stageCounts?.[index.stage]};
   const statePath=ROOT+'/state/'+sid+'.json';
   const stateFile=unwrap(await tools.mcp__GitHub__fetch_file({
    repository_full_name:REPO,path:statePath,ref:head}));
   const shard=JSON.parse(stateFile.content);
   const sourcePackets=action==='reap'?null:
    await read(tools,ROOT+'/jobs/'+sid+'.json',head);
   if(shard.shardId!==sid||sourcePackets&&sourcePackets.shardId!==sid)
    throw Error('Mixed shard snapshots');
   const nextIndex=JSON.parse(JSON.stringify(index));
   nextIndex.activeOwners=nextIndex.activeOwners||{};
   nextIndex.ownerAssignments=nextIndex.ownerAssignments||{};
   for(const [owner,v] of Object.entries(nextIndex.activeOwners))
    if(Date.parse(v.expiresAt)<=nowMs)delete nextIndex.activeOwners[owner];
   let transition,job=null,extra=null;
   if(action==='reap'){
    const value=core.massReap(shard,time);
    if(!value.restored)return{status:'nothing_to_reap',head};
    transition={shard:value.shard,status:'reaped',restored:value.restored};
   }else if(action==='claim'){
    transition=core.massClaim(shard,{ownerId:args.ownerId,token:args.token,
     now:time,stage:index.stage,jobId:args.jobId||null});
    if(transition.item&&args.jobId&&transition.item.jobId!==args.jobId)
     return{status:'requested_job_not_available',head};
    if(!transition.item){
     if(args.jobId&&!transition.restored)
      return{status:'requested_job_not_available',head,jobId:args.jobId};
     if(!transition.restored)return{status:'busy_or_empty',head,counts:index.counts,
      stageCounts:index.stageCounts?.[index.stage]};
    }else{
     job=sourcePackets.jobs.find(j=>j.jobId===transition.item.jobId);
     if(!job||job.sourceFingerprint!==transition.item.sourceFingerprint)
      throw Error('Job source fingerprint drift');
     if(transition.status==='resumed'&&!transition.restored)
      return{status:'resumed',head,jobId:job.jobId,source:job,
       lease:transition.item.lease,generation:transition.item.generation,
       checkpoint:transition.item.checkpoint||null};
     if(!(await currentRu(tools,job))){
      const f=core.massFail(transition.shard,{
       jobId:job.jobId,ownerId:args.ownerId,token:args.token,
       generation:transition.item.generation,now:time,failureStatus:'stale_source'});
      transition={...f,status:'stale_source'};
     }else{
      nextIndex.activeOwners[args.ownerId]={jobId:job.jobId,token:args.token,
       expiresAt:transition.item.lease.expiresAt,generation:transition.item.generation};
      const a=nextIndex.ownerAssignments[args.ownerId]||{
       token:args.token,jobIds:[],completedJobIds:[]};
      if(!a.jobIds.includes(job.jobId))a.jobIds.push(job.jobId);
      nextIndex.ownerAssignments[args.ownerId]=a;
     }
    }
   }else{
    job=sourcePackets.jobs.find(j=>j.jobId===args.jobId);
    if(!job||shard.items.find(j=>j.jobId===job.jobId)?.sourceFingerprint!==
     job.sourceFingerprint)throw Error('Missing or modified immutable job');
    if(action!=='release'&&!(await currentRu(tools,job)))
     return{status:'stale_source',head,jobId:job.jobId};
    const common={jobId:job.jobId,ownerId:args.ownerId,token:args.token,
     generation:args.generation,now:time};
    if(action==='renew')transition=core.massRenew(shard,common);
    if(action==='release')transition=core.massRelease(shard,common);
    if(action==='fail')transition=core.massFail(shard,{
     ...common,failureStatus:args.failureStatus});
    if(action==='checkpoint'){
     if(!valid(args.checkpointId)||typeof args.checkpoint!=='object'||
        JSON.stringify(args.checkpoint).length>80000)
      throw Error('Invalid checkpoint / size');
     // Checkpoints are self-contained in their shard. Avoid the hot global
     // index and multi-step tree/commit/ref sequence on each four blocks.
     transition=core.massCheckpoint(shard,{...common,
      checkpointId:args.checkpointId,payload:args.checkpoint});
    }
    if(action==='submit'){
     if(!valid(args.submissionId)||!args.result||
       JSON.stringify(args.result).length>130000)throw Error('Invalid submission');
     const sha=await createReceipt(tools,args.result);
     transition=core.massSubmit(shard,{...common,job,result:args.result,
      submissionId:args.submissionId,blobSha:sha,
      resultPath:ROOT+'/results/'+safe(job.jobId)+'/'+safe(args.submissionId)+'.json'});
     if(transition.status==='saved_for_review'){
      extra={path:ROOT+'/results/'+safe(job.jobId)+'/'+safe(args.submissionId)+'.json',sha};
      const a=nextIndex.ownerAssignments[args.ownerId];
      if(a&&!a.completedJobIds.includes(job.jobId))a.completedJobIds.push(job.jobId);
     }
    }
    if(action==='renew'&&nextIndex.activeOwners[args.ownerId]?.jobId===job.jobId)
     nextIndex.activeOwners[args.ownerId].expiresAt=transition.expiresAt;
    if(['release','submit','fail'].includes(action)&&
       nextIndex.activeOwners[args.ownerId]?.jobId===job.jobId)
     delete nextIndex.activeOwners[args.ownerId];
   }
   if(['already_saved','already_released','already_failed'].includes(transition.status))
    return{status:transition.status,head,jobId:args.jobId};
   if(action==='checkpoint'){
    const written=unwrap(await tools.mcp__GitHub__update_file({
     repository_full_name:REPO,path:statePath,branch:BRANCH,sha:stateFile.sha,
     content:clean(transition.shard),
     message:'i18n: checkpoint '+job.jobId+' (shard CAS) [skip ci]'}));
    if(!written.commit_sha)throw Error('Checkpoint CAS commit not confirmed');
    return{status:'checkpoint_saved',commit:written.commit_sha,
     branch:BRANCH,jobId:job.jobId,checkpointPath:statePath,
     checkpointId:args.checkpointId,checkpointStorage:'inline-v1',
     counts:index.counts};
   }
   const next=core.massRebuildIndex(nextIndex,sid,transition.shard,time);
   const updates=[{path:ROOT+'/index.json',data:next},
    {path:ROOT+'/state/'+sid+'.json',data:transition.shard}];
   if(extra)updates.push(extra);
   const commit=await commitCas(tools,head,updates,
    'i18n: '+action+' '+(job?.jobId||sid)+' (mass CAS) [skip ci]');
   return{status:transition.status,commit,branch:BRANCH,
    jobId:job?.jobId||args.jobId||null,
    lease:transition.item?.lease||null,generation:transition.item?.generation,
    source:action==='claim'&&job?job:null,
    checkpoint:action==='claim'&&transition.item?transition.item.checkpoint||null:null,
    counts:next.counts};
  }catch(e){
   if(restricted.test(String(e)))return{status:'rate_limited',retryAfterMs:60000,
    reason:String(e).slice(0,180)};
   if(denied.test(String(e)))throw e;
   if(!conflict.test(String(e))&&transient.test(String(e)))return{status:'transport_retryable',action,
    jobId:args.jobId||null,retryable:true,retryAfterMs:5000,
    reason:String(e).slice(0,250)};
   if(!conflict.test(String(e)))throw e;
   if(attempt===LIMIT-1)
    return{status:'cas_contention',action,jobId:args.jobId||null,
     retryable:true,retryAfterMs:3000,
     reason:String(e).slice(0,250)};
   await delay(Math.min(250*2**attempt,2500)+Math.floor(Math.random()*200));
  }
 }
}

