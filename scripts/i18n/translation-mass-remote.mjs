/** Ada Tours EN translations: the same short claim -> finish -> next cycle as SEO/GEO.
 * One existing queue, one atomic Git commit per claim/finish. No worker cap,
 * extra routing, parallel queues, or edits to published content.
 */
const REPO='alexyakovlev79/adatours.ru';
const BRANCH='i18n/translation-mass-staging';
const ROOT='data/i18n/translation-mass/v2';
const CAS_ATTEMPTS=2;
const clean=x=>JSON.stringify(x,null,2)+'\n';
const un=r=>{if(r?.isError)throw Error(JSON.stringify(r));return r?.result||r?.structuredContent||r};
const valid=x=>typeof x==='string'&&/^[a-zA-Z0-9_.:-]{3,200}$/.test(x);
const limited=/rate.?limit|429|retry.?after|secondary limit|too many requests|resource.exhausted/i;
const conflict=/non.fast.forward|expected.sha|409|422|reference|conflict|mismatch|changed/i;
const transient=/GithubGraphQLAPIError|RemoteProtocolError|Server disconnected|Transport closed|internal (?:server )?error|something went wrong|bad gateway|service unavailable|gateway timeout|\b50[0234]\b|ECONNRESET|ETIMEDOUT|fetch failed|network error|response lost/i;
const safe=x=>x.replace(/[^A-Za-z0-9_.-]/g,'_').slice(0,190);
const currentTime=x=>{const s=x||new Date().toISOString();if(!Number.isFinite(Date.parse(s)))throw Error('Invalid timestamp');return s};
const statusOfOwner=(index,ownerId)=>{
 const a=index.ownerAssignments?.[ownerId];
 const completed=new Set(a?.completedJobIds||[]);
 return{completed:completed.size,assigned:a?.jobIds?.length||0,
  activeJobId:index.activeOwners?.[ownerId]?.jobId||null,
  resumeCandidateJobId:(a?.jobIds||[]).filter(id=>!completed.has(id)).at(-1)||null,
  maxJobsPerOwner:index.maxJobsPerOwner};
};
const read=async(tools,path,ref)=>un(await tools.mcp__GitHub__fetch_file({
 repository_full_name:REPO,path,ref}));
async function head(tools){
 const x=un(await tools.mcp__GitHub__fetch({
  url:`https://api.github.com/repos/${REPO}/git/ref/heads/${BRANCH}`}));
 return JSON.parse(x.content).object.sha;
}
async function currentRu(tools,job){
 const p=job?.source?.contentPath;
 if(!p?.startsWith('src/content/tours/')&&!p?.startsWith('src/content/excursions/'))return false;
 const f=await read(tools,p,'main');
 return f.sha===job.source.sourceBlobSha;
}
async function commit(tools,headSha,files,message){
 const info=JSON.parse(un(await tools.mcp__GitHub__fetch({
  url:`https://api.github.com/repos/${REPO}/git/commits/${headSha}`})).content);
 const tree=un(await tools.mcp__GitHub__create_tree({repository_full_name:REPO,
  base_tree_sha:info.tree.sha,tree_elements:files.map(f=>({
   path:f.path,mode:'100644',type:'blob',
   ...(f.sha?{sha:f.sha}:{content:clean(f.data)})}))})).sha;
 const next=un(await tools.mcp__GitHub__create_commit({repository_full_name:REPO,
  parent_sha:headSha,tree_sha:tree,message})).sha;
 try{
  const updated=un(await tools.mcp__GitHub__update_ref({repository_full_name:REPO,
   branch_name:BRANCH,expected_sha:headSha,sha:next,force:false}));
  if(!updated.success)throw Error('Unconfirmed CAS ref update');
 }catch(e){
  // Exactly one read on uncertain acknowledgement. Never make a second effect
  // until the original SHA is resolved.
  if(!limited.test(String(e))&&transient.test(String(e))&&await head(tools)===next)
   return next;
  throw e;
 }
 return next;
}
const resultFor=(index,ownerId)=>({owner:statusOfOwner(index,ownerId)});
export async function runEnMassTranslation(tools,core,args={}){
 const action=args.action;
 if(!['status','claim','renew','checkpoint','submit','release','fail','reap'].includes(action))
  throw Error('Unsupported worker action');
 if(action!=='status'&&(!valid(args.ownerId)||!valid(args.token)))
  throw Error('Stable ownerId/token required');
 for(let attempt=0;attempt<CAS_ATTEMPTS;attempt++){
  const now=currentTime(args.now);
  try{
   const base=await head(tools);
   const index=JSON.parse((await read(tools,ROOT+'/index.json',base)).content);
   if(index.schemaVersion!==2||index.pilotOnly!==false||index.publicationEnabled!==false)
    throw Error('Unexpected translation queue gate');
   const assigned=index.ownerAssignments?.[args.ownerId];
   if(action==='status'){
    if(args.ownerId!==undefined||args.token!==undefined){
     if(!valid(args.ownerId)||!valid(args.token))throw Error('Invalid owner credentials');
     if(assigned&&assigned.token!==args.token)return{status:'owner_token_conflict',head:base};
    }
    return{status:'snapshot',head:base,branch:BRANCH,stage:index.stage,
     enabled:index.dispatcherEnabled,translationMassLaunchAllowed:index.translationMassLaunchAllowed,
     counts:index.counts,stageCounts:index.stageCounts,jobCount:index.jobCount,
     activeOwners:Object.keys(index.activeOwners||{}).length,
     ...(args.ownerId?resultFor(index,args.ownerId):{})};
   }
   if(!index.dispatcherEnabled||!index.translationMassLaunchAllowed)
    return{status:'gate_closed',head:base,stage:index.stage};
   if(assigned&&assigned.token!==args.token)return{status:'owner_token_conflict',head:base};
   const active=index.activeOwners?.[args.ownerId];
   const activeValid=active&&Date.parse(active.expiresAt)>Date.parse(now);
   const owner=statusOfOwner(index,args.ownerId);
   if(action==='claim'&&!activeValid&&owner.completed>=10)
    return{status:'cycle_limit_reached',completed:owner.completed,owner,head:base};
   if(action==='claim'&&!activeValid&&owner.completed>=index.maxJobsPerOwner)
    return{status:'owner_quota_reached',completed:owner.completed,owner,head:base};
   const requested=action==='claim'?(activeValid?active.jobId:
    args.jobId||(args.skipResume?null:owner.resumeCandidateJobId)):null;
   let sid;
   if(action==='claim'&&requested){
    if(!valid(requested))throw Error('Unsafe target jobId');
    sid=core.massShard(requested);
   }else if(action==='claim'||action==='reap')sid=core.massIndexShard(index,now,
    action==='claim'?args.ownerId:null);
   else{
    if(!valid(args.jobId))throw Error('Exact jobId required');
    sid=core.massShard(args.jobId);
   }
   if(!sid)return{status:'busy_or_empty',head:base,
    counts:index.counts,stageCounts:index.stageCounts?.[index.stage],owner};
   const statePath=`${ROOT}/state/${sid}.json`;
   const stateFile=await read(tools,statePath,base);
   const shard=JSON.parse(stateFile.content);
   if(shard.shardId!==sid)throw Error('Wrong state shard');
   const needJob=['claim','submit','fail'].includes(action);
   const packets=needJob?JSON.parse((await read(tools,`${ROOT}/jobs/${sid}.json`,base)).content):null;
   if(packets&&packets.shardId!==sid)throw Error('Wrong job shard');
   const jobFor=id=>packets?.jobs.find(j=>j.jobId===id);
   let transition,job=null,extra=null;
   const nextIndex=JSON.parse(JSON.stringify(index));
   nextIndex.activeOwners=nextIndex.activeOwners||{};
   nextIndex.ownerAssignments=nextIndex.ownerAssignments||{};
   for(const [id,lease] of Object.entries(nextIndex.activeOwners))
    if(Date.parse(lease.expiresAt)<=Date.parse(now))delete nextIndex.activeOwners[id];
   if(action==='reap'){
    const outcome=core.massReap(shard,now);
    if(!outcome.restored)return{status:'nothing_to_reap',head:base};
    transition={shard:outcome.shard,status:'reaped',restored:outcome.restored};
   }else if(action==='claim'){
    transition=core.massClaim(shard,{stage:index.stage,ownerId:args.ownerId,
     token:args.token,now,jobId:requested||null});
    if(transition.item&&requested&&transition.item.jobId!==requested)
     return{status:'requested_job_not_available',head:base,owner};
    if(!transition.item){
     if(requested&&!transition.restored)
      return{status:'requested_job_not_available',head:base,jobId:requested,owner};
     if(!transition.restored)return{status:'busy_or_empty',head:base,
      stageCounts:index.stageCounts?.[index.stage],owner};
    }else{
     job=jobFor(transition.item.jobId);
     if(!job||job.sourceFingerprint!==transition.item.sourceFingerprint)
      throw Error('Immutable source mismatch');
     if(transition.status==='resumed'&&!transition.restored){
      if(!(await currentRu(tools,job)))return{status:'stale_source',head:base,jobId:job.jobId};
      return{status:'resumed',head:base,jobId:job.jobId,source:job,
       lease:transition.item.lease,generation:transition.item.generation,
       checkpoint:transition.item.checkpoint||null,owner};
     }
     if(!(await currentRu(tools,job))){
      const bad=core.massFail(transition.shard,{jobId:job.jobId,ownerId:args.ownerId,
       token:args.token,generation:transition.item.generation,now,
       failureStatus:'stale_source'});
      transition={...bad,status:'stale_source'};
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
    const item=shard.items.find(row=>row.jobId===args.jobId);
    if(!item)throw Error('Unknown jobId');
    job=jobFor(args.jobId);
    if(job&&job.sourceFingerprint!==item.sourceFingerprint)
     throw Error('Immutable source mismatch');
    const common={jobId:args.jobId,ownerId:args.ownerId,token:args.token,
     generation:args.generation,now};
    if(action==='submit'&&item.submission?.id===args.submissionId){
     if(!assigned?.jobIds?.includes(args.jobId))throw Error('Unowned stored result');
     const saved=await read(tools,item.submission.resultPath,base);
     if(clean(JSON.parse(saved.content))!==clean(args.result))
      throw Error('Submission ID payload collision');
     return{status:'already_saved',head:base,jobId:args.jobId,owner,
      receipt:{resultPath:item.submission.resultPath,blobSha:item.submission.blobSha}};
    }
    if(action==='renew')transition=core.massRenew(shard,common);
    if(action==='checkpoint'){
     if(!valid(args.checkpointId)||!args.checkpoint||
        JSON.stringify(args.checkpoint).length>80000)throw Error('Invalid checkpoint');
     transition=core.massCheckpoint(shard,{...common,checkpointId:args.checkpointId,
      payload:args.checkpoint});
    }
    if(action==='release')transition=core.massRelease(shard,common);
    if(action==='fail')transition=core.massFail(shard,{
     ...common,failureStatus:args.failureStatus});
    if(action==='submit'){
     if(!valid(args.submissionId)||!args.result||
        JSON.stringify(args.result).length>130000||!job)
      throw Error('Invalid result');
     core.massRenew(shard,common); // validation only: no remote side effect
     core.validateMassResult(job,args.result);
     if(!(await currentRu(tools,job)))return{status:'stale_source',head:base,jobId:job.jobId};
     const blob=un(await tools.mcp__GitHub__create_blob({
      repository_full_name:REPO,content:clean(args.result),encoding:'utf-8'})).sha;
     const resultPath=`${ROOT}/results/${safe(job.jobId)}/${safe(args.submissionId)}.json`;
     transition=core.massSubmit(shard,{...common,job,result:args.result,
      submissionId:args.submissionId,blobSha:blob,resultPath});
     if(transition.status==='saved_for_review'){
      extra={path:resultPath,sha:blob};
      const a=nextIndex.ownerAssignments[args.ownerId]||{
       token:args.token,jobIds:[],completedJobIds:[]};
      if(a.token!==args.token)throw Error('Owner token mismatch');
      if(!a.jobIds.includes(job.jobId))a.jobIds.push(job.jobId);
      if(!a.completedJobIds.includes(job.jobId))a.completedJobIds.push(job.jobId);
      nextIndex.ownerAssignments[args.ownerId]=a;
     }
    }
    if(action==='renew'&&nextIndex.activeOwners[args.ownerId]?.jobId===args.jobId)
     nextIndex.activeOwners[args.ownerId].expiresAt=transition.expiresAt;
    if(['submit','release','fail'].includes(action)&&
       nextIndex.activeOwners[args.ownerId]?.jobId===args.jobId)
     delete nextIndex.activeOwners[args.ownerId];
   }
   if(['already_saved','already_released','already_failed'].includes(transition.status))
    return{status:transition.status,head:base,jobId:args.jobId,owner};
   if(action==='checkpoint'){
    const saved=un(await tools.mcp__GitHub__update_file({
     repository_full_name:REPO,path:statePath,branch:BRANCH,
     sha:stateFile.sha,content:clean(transition.shard),
     message:`i18n: checkpoint ${args.jobId} [skip ci]`}));
    if(!saved.commit_sha)throw Error('Checkpoint write unconfirmed');
    return{status:'checkpoint_saved',commit:saved.commit_sha,jobId:args.jobId,
     checkpointPath:statePath,checkpointId:args.checkpointId,owner};
   }
   const next=core.massRebuildIndex(nextIndex,sid,transition.shard,now);
   const files=[{path:`${ROOT}/index.json`,data:next},{path:statePath,data:transition.shard}];
   if(extra)files.push(extra);
   const sha=await commit(tools,base,files,
    `i18n: ${action} ${job?.jobId||sid} (CAS) [skip ci]`);
   return{status:transition.status,commit:sha,branch:BRANCH,
    jobId:job?.jobId||args.jobId||null,source:action==='claim'?job:null,
    generation:transition.item?.generation,lease:transition.item?.lease,
    checkpoint:transition.item?.checkpoint||null,
    counts:next.counts,stageCounts:next.stageCounts?.[next.stage],
    ...resultFor(next,args.ownerId)};
  }catch(error){
   const message=String(error);
   if(limited.test(message))return{status:'rate_limited',retryable:true,
    retryAfterMs:3600000,reason:message.slice(0,240)};
   if(transient.test(message)&&!conflict.test(message))
    return{status:'transport_retryable',retryable:true,
     retryAfterMs:30000,reason:message.slice(0,240)};
   if(!conflict.test(message))throw error;
   if(attempt===CAS_ATTEMPTS-1)return{status:'cas_contention',retryable:true,
    retryAfterMs:30000,reason:message.slice(0,240)};
  }
 }
}
