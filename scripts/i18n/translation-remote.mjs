/**
 * EN translation PILOT remote CAS adapter, separate from matching & main.
 * Run through connected GitHub tools with a pure translation-core.mjs API.
 * No publication/approval action is exposed to a worker.
 *
 * Requires an independently seeded data/i18n/translation/v1 index on an
 * explicitly allowlisted branch. Same ownerId/token on all retries.
 */
const REPO='alexyakovlev79/adatours.ru';
const ROOT='data/i18n/translation/v1';
const ALLOWED=new Set(['i18n/translation-smoke-20261030','i18n/translation-staging']);
const MAX_ATTEMPTS=3;
const ok=r=>{if(r?.isError)throw Error(JSON.stringify(r));return r?.result||r?.structuredContent||r;};
const clean=x=>JSON.stringify(x,null,2)+'\n';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_.:-]{3,200}$/.test(x);
const nowValue=x=>{if(!Number.isFinite(Date.parse(x)))throw Error('Exact UTC now required');return x;};
const retryConflict=e=>/non.fast.forward|expected.sha|422|409|reference|conflict|mismatch|changed/i.test(String(e));
const limited=e=>/rate.?limit|429|retry.?after|secondary limit|too many requests/i.test(String(e));
async function head(tools,branch){
 const a=JSON.parse(ok(await tools.mcp__GitHub__fetch({
  url:'https://api.github.com/repos/'+REPO+'/git/ref/heads/'+branch})).content);
 return a.object.sha;
}
async function read(tools,path,ref){
 return JSON.parse(ok(await tools.mcp__GitHub__fetch_file({
  repository_full_name:REPO,path,ref})).content);
}
async function writeCas(tools,branch,expected,updates,tag){
 const base=JSON.parse(ok(await tools.mcp__GitHub__fetch({
  url:'https://api.github.com/repos/'+REPO+'/git/commits/'+expected})).content);
 const tree=ok(await tools.mcp__GitHub__create_tree({
  repository_full_name:REPO,base_tree_sha:base.tree.sha,
  tree_elements:updates.map(f=>({path:f.path,type:'blob',mode:'100644',
   ...(f.sha?{sha:f.sha}:{content:clean(f.value)})}))})).sha;
 const commit=ok(await tools.mcp__GitHub__create_commit({
  repository_full_name:REPO,tree_sha:tree,parent_sha:expected,message:tag})).sha;
 const moved=ok(await tools.mcp__GitHub__update_ref({
  repository_full_name:REPO,branch_name:branch,expected_sha:expected,sha:commit,force:false}));
 if(moved.success!==true)throw Error('CAS ref was not updated');
 return commit;
}
const safePath=x=>x.replace(/[^A-Za-z0-9_.-]/g,'_').slice(0,190);
async function checkLiveRu(tools,job){
 const src=job?.source;
 if(!src?.ruContentPath?.startsWith('src/content/tours/')||
    !/^[a-f0-9]{40}$/.test(src.ruGitBlobSha||''))throw Error('Missing source Git receipt');
 const a=ok(await tools.mcp__GitHub__fetch_file({
  repository_full_name:REPO,path:src.ruContentPath,ref:'main'}));
 return a.sha===src.ruGitBlobSha;
}
export async function runEnTranslation(tools,core,args={}){
 const branch=args.branch||'i18n/translation-smoke-20261030';
 if(!ALLOWED.has(branch))throw Error('EN pilot branch not allowlisted');
 const action=args.action;
 if(!['status','claim','renew','checkpoint','submit','release','fail','reap'].includes(action))
  throw Error('Unsupported translator action (workers cannot approve/publish)');
 const time=nowValue(args.now||new Date().toISOString());
 if(action!=='status'&&(!id(args.ownerId)||!id(args.token)))
  throw Error('Stable ownerId/token required');
 const idxPath=ROOT+'/index.json', nowMs=Date.parse(time);
 for(let attempt=0;attempt<MAX_ATTEMPTS;attempt++){
  try{
   const sha=await head(tools,branch),index=await read(tools,idxPath,sha);
   if(action==='status')return{status:'snapshot',branch,head:sha,counts:index.counts,
    pilotOnly:index.pilotOnly,enabled:index.dispatcherEnabled,
    publicationEnabled:index.publicationEnabled,updatedAt:index.updatedAt,
    activeOwners:Object.keys(index.activeOwners||{}).length};
   if(index.dispatcherEnabled!==true||index.pilotOnly!==true||
      index.publicationEnabled!==false||index.translationMassLaunchAllowed!==false)
    return{status:'gate_closed',head:sha,branch};
   const assignments=index.ownerAssignments||{},mine=assignments[args.ownerId];
   if(mine&&mine.token!==args.token)return{status:'owner_token_conflict',branch};
   const owners=index.activeOwners||{},active=owners[args.ownerId];
   if(action==='claim'&&mine?.jobIds?.length>=6&&!active)
    return{status:'worker_quota_reached',completed:mine.completedJobIds?.length||0};
   let sid;
   if(action==='claim'){
    if(active&&Date.parse(active.expiresAt)>nowMs){
     if(active.token!==args.token)return{status:'owner_token_conflict',branch};
     sid=core.translationShardFor(active.jobId);
    }else if(args.jobId){
     if(!id(args.jobId))throw Error('Invalid explicit pilot jobId');
     sid=core.translationShardFor(args.jobId);
    }else sid=core.pickTranslationShard(index,time);
   }else if(action==='reap'){
    sid=core.pickTranslationShard(index,time);
   }else{
    if(!id(args.jobId))throw Error('Exact jobId required');
    sid=core.translationShardFor(args.jobId);
   }
   if(!sid)return{status:'busy_or_empty',head:sha,counts:index.counts};
   const shard=await read(tools,ROOT+'/state/'+sid+'.json',sha);
   const packet=await read(tools,ROOT+'/jobs/'+sid+'.json',sha);
   const effective=index;
   effective.activeOwners=effective.activeOwners||{};
   effective.ownerAssignments=effective.ownerAssignments||{};
   for(const [owner,lease] of Object.entries(effective.activeOwners))
    if(Date.parse(lease.expiresAt)<=nowMs)delete effective.activeOwners[owner];
   let transition,job=null,extra=null;
   if(action==='reap'){
    const x=core.reapTranslation(shard,time);
    if(!x.restored)return{status:'nothing_to_reap',head:sha};
    transition={shard:x.shard,status:'reaped',restored:x.restored};
   }else if(action==='claim'){
    transition=core.claimTranslation(shard,{ownerId:args.ownerId,token:args.token,now:time});
    if(transition.item&&args.jobId&&transition.item.jobId!==args.jobId)
     throw Error('Requested pilot job differs from shard claim; refusing wrong assignment');
    if(!transition.item){
     if(!transition.restored)return{status:transition.status,head:sha,counts:index.counts};
    }else{
     job=packet.jobs.find(j=>j.jobId===transition.item.jobId);
     if(!job||job.sourceFingerprint!==transition.item.sourceFingerprint)
      throw Error('Source packet/lease mismatch');
     if(!(await checkLiveRu(tools,job))){
      const x=core.failTranslation(transition.shard,{
       jobId:transition.item.jobId,ownerId:args.ownerId,token:args.token,
       generation:transition.item.generation,now:time,status:'stale_source'});
      transition={...x,status:'stale_source'};
     }else{
      effective.activeOwners[args.ownerId]={jobId:job.jobId,token:args.token,
       expiresAt:transition.item.lease.expiresAt,generation:transition.item.generation};
      const entry=effective.ownerAssignments[args.ownerId]||{
       token:args.token,jobIds:[],completedJobIds:[]};
      if(!entry.jobIds.includes(job.jobId))entry.jobIds.push(job.jobId);
      effective.ownerAssignments[args.ownerId]=entry;
     }
    }
   }else{
    job=packet.jobs.find(j=>j.jobId===args.jobId);
    if(!job)throw Error('Job missing in immutable packet');
    if(action!=='release'&&!(await checkLiveRu(tools,job)))
     return{status:'stale_source',jobId:job.jobId};
    const common={jobId:args.jobId,ownerId:args.ownerId,
     token:args.token,generation:args.generation,now:time};
    if(action==='renew')transition=core.renewTranslation(shard,common);
    if(action==='release')transition=core.releaseTranslation(shard,common);
    if(action==='fail')transition=core.failTranslation(shard,{...common,
     status:args.failureStatus,reason:args.reason});
    if(action==='checkpoint'){
     if(!id(args.checkpointId)||!args.checkpoint||
        JSON.stringify(args.checkpoint).length>50000)throw Error('Invalid checkpoint payload');
     const path=ROOT+'/checkpoints/'+safePath(job.jobId)+'/'+safePath(args.checkpointId)+'.json';
     const value=clean(args.checkpoint);
     const blob=ok(await tools.mcp__GitHub__create_blob({repository_full_name:REPO,
      content:value,encoding:'utf-8'})).sha;
     transition=core.checkpointTranslation(shard,{...common,
      checkpointId:args.checkpointId,blobSha:blob});
     if(transition.status==='saved')extra={path,sha:blob};
    }
    if(action==='submit'){
     if(!id(args.submissionId)||!args.result||
        JSON.stringify(args.result).length>110000)throw Error('Invalid result payload');
     const path=ROOT+'/results/'+safePath(job.jobId)+'/'+safePath(args.submissionId)+'.json';
     const content=clean(args.result);
     const blob=ok(await tools.mcp__GitHub__create_blob({repository_full_name:REPO,
      content,encoding:'utf-8'})).sha;
     transition=core.submitTranslation(shard,{...common,job,
      submissionId:args.submissionId,blobSha:blob,resultPath:path,
      result:args.result});
     if(transition.status==='saved_for_review'){
      extra={path,sha:blob};
      const row=effective.ownerAssignments[args.ownerId];
      if(row&&!row.completedJobIds.includes(job.jobId))row.completedJobIds.push(job.jobId);
     }
    }
    if(action==='renew'&&effective.activeOwners[args.ownerId]?.jobId===job.jobId)
     effective.activeOwners[args.ownerId].expiresAt=transition.expiresAt;
    if(['submit','release','fail'].includes(action)&&
      effective.activeOwners[args.ownerId]?.jobId===job.jobId)
     delete effective.activeOwners[args.ownerId];
   }
   if(transition.status==='already_saved')return{status:'already_saved',head:sha,jobId:args.jobId};
   if(!transition.shard)throw Error('No CAS shard transition');
   const next=core.rebuildTranslationIndex(effective,sid,transition.shard,time);
   const updates=[{path:idxPath,value:next},
    {path:ROOT+'/state/'+sid+'.json',value:transition.shard}];
   if(extra)updates.push(extra);
   const commit=await writeCas(tools,branch,sha,updates,
    'i18n: '+action+' '+(job?.jobId||sid)+' (translation pilot CAS) [skip ci]');
   return{status:transition.status,commit,branch,jobId:job?.jobId||args.jobId||null,
    lease:transition.item?.lease||null,generation:transition.item?.generation,
    source:action==='claim'&&job?job:null,counts:next.counts};
  }catch(e){
   if(limited(e))return{status:'rate_limited',retryAfterMs:60000,reason:String(e).slice(0,240)};
   if(attempt===MAX_ATTEMPTS-1||!retryConflict(e))throw e;
  }
 }
}
