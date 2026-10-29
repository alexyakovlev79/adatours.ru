/** GitHub-connector CAS dispatcher for the EN Word MATCHING queue only.
 * Source tree is read from one ref SHA, writes require expected branch SHA.
 * Never call this for translation or production deployments.
 *
 * Work entry in Code Mode:
 *  const core = new Function(coreSource.replace(/^export /gm,'') +
 *    ';return {shardFor,pickShard,claimMatch,renewMatch,checkpointMatch,completeMatch,failMatch,releaseMatch,rebuildIndex};')();
 *  const run = new Function(remoteSource.replace(/^export /gm,'') +
 *    ';return runEnMatching;')();
 *  await run(tools,core,{action:'claim',ownerId:'...',token:'...'});
 */
const REPO='alexyakovlev79/adatours.ru';
const BRANCH='i18n/matching-staging';
const ROOT='data/i18n/matching/v1';
function un(r) { if(r?.isError) throw new Error(JSON.stringify(r));return r?.result||r?.structuredContent||r; }
const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9_.:-]{2,180}$/.test(x);
const format=v=>JSON.stringify(v,null,2)+'\n';
async function head(tools,branch) {
 const x=JSON.parse(un(await tools.mcp__GitHub__fetch({url:'https://api.github.com/repos/'+REPO+'/git/ref/heads/'+branch})).content);
 return x.object.sha;
}
async function jsonFile(tools,path,sha) {
 const r=un(await tools.mcp__GitHub__fetch_file({repository_full_name:REPO,path,ref:sha}));
 return JSON.parse(r.content);
}
async function blob(tools,content) {
 return un(await tools.mcp__GitHub__create_blob({repository_full_name:REPO,content,encoding:'utf-8'})).sha;
}
async function update(tools,{baseHead,files,message}) {
 const obj=JSON.parse(un(await tools.mcp__GitHub__fetch({url:'https://api.github.com/repos/'+REPO+'/git/commits/'+baseHead})).content);
 const t=un(await tools.mcp__GitHub__create_tree({repository_full_name:REPO,base_tree_sha:obj.tree.sha,
   tree_elements:files.map(f=>({path:f.path,type:'blob',mode:'100644',...(f.sha?{sha:f.sha}:{content:f.content})}))})).sha;
 const c=un(await tools.mcp__GitHub__create_commit({repository_full_name:REPO,parent_sha:baseHead,tree_sha:t,message})).sha;
 const r=un(await tools.mcp__GitHub__update_ref({repository_full_name:REPO,branch_name:BRANCH,sha:c,force:false,expected_sha:baseHead}));
 if(r.success!==true)throw new Error('CAS update did not succeed');
 return c;
}
function hotRateLimit(e){return /rate.limit|too many|429|403|retry.after|secondary limit/i.test(String(e));}
function retryableContention(e){return /expected.sha|conflict|reference update|non.fast.forward|422|409|changed|mismatch/i.test(String(e));}
function pathFor(kind,shardId) {return ROOT+'/'+kind+'/'+shardId+'.json';}
async function readSnapshot(tools, core, sha, args) {
 const index=await jsonFile(tools,ROOT+'/index.json',sha);
 let sid;
 if(args.action==='claim'){
   if(index.matchingEnabled!==true)return {index,closed:true};
   const mine=index.activeOwners?.[args.ownerId];
   if(mine) {
     if(mine.token!==args.token)return {index,ownedByOtherToken:true};
     sid=core.shardFor(mine.jobId);
   } else sid=core.pickShard(index,args.now);
 }else if(args.action==='reap'){
   const nowMs=Date.parse(args.now);
   const eligible=Object.entries(index.shards).filter(([,s])=>
     (s.earliestExpiryAt&&Date.parse(s.earliestExpiryAt)<=nowMs)||
     (s.earliestRetryAt&&Date.parse(s.earliestRetryAt)<=nowMs));
   sid=eligible.sort((a,b)=>a[0].localeCompare(b[0]))[0]?.[0]??null;
 }else{
   if(!validId(args.jobId))throw new Error('jobId required');
   sid=core.shardFor(args.jobId);
 }
 if(sid===null||sid===undefined)return {index,empty:true};
 const [shard,packet]=await Promise.all([
   jsonFile(tools,pathFor('state',sid),sha),
   jsonFile(tools,pathFor('jobs',sid),sha)
 ]);
 if(shard.shardId!==sid || packet.shardId!==sid)throw new Error('Shard mismatch');
 return {index,sid,shard,packet};
}
function pickJob(packet,jobId) {
 const job=packet.jobs.find(j=>j.jobId===jobId);
 if(!job)throw new Error('Job descriptor missing: '+jobId);
 return job;
}
function touchIndex(core,index,sid,shard,now) {
 const next=core.rebuildIndex(index,sid,shard,now);
 if(!next.activeOwners)next.activeOwners={};
 return next;
}
function requireOwner(args){
 if(!validId(args.ownerId)||!validId(args.token))throw new Error('ownerId/token required');
}
function argsForLease(args) {
 return {jobId:args.jobId,ownerId:args.ownerId,token:args.token,generation:args.generation,now:args.now};
}
async function checkSourceUnchanged(tools,job) {
 const baseline=job.sourceFingerprint.split(':')[1];
 if(!/^[0-9a-f]{40}$/.test(baseline))throw new Error('Bad source SHA');
 const [base,current]=await Promise.all([
   tools.mcp__GitHub__fetch_file({repository_full_name:REPO,path:job.ruContentPath,ref:baseline}),
   tools.mcp__GitHub__fetch_file({repository_full_name:REPO,path:job.ruContentPath,ref:'main'})
 ]);
 if(un(base).sha!==un(current).sha)throw new Error('stale_source: RU Tour changed since immutable matching snapshot');
}
function immutableResultPath(args) {
 if(!validId(args.submissionId))throw new Error('Stable submissionId required');
 return ROOT+'/results/'+args.jobId.replace(':','--')+'/'+args.submissionId+'.json';
}
export async function runEnMatching(tools,core,args={}) {
 if(!['claim','renew','checkpoint','complete','release','fail','status','reap'].includes(args.action))throw new Error('Unsupported matching action');
 if(args.branch && args.branch!==BRANCH)throw new Error('Wrong matching branch');
 const now=args.now||new Date().toISOString();
 if(args.action==='status') {
   const sha=await head(tools,BRANCH);
   const idx=await jsonFile(tools,ROOT+'/index.json',sha);
   return {status:'snapshot',head:sha,pilotOnly:idx.pilotOnly,matchingEnabled:idx.matchingEnabled,
     translationEnabled:idx.translationEnabled,counts:idx.counts,pilotJobCount:idx.pilotJobCount,
     updatedAt:idx.updatedAt,activeOwners:idx.activeOwners||{},earliestExpiryAt:Object.values(idx.shards).map(s=>s.earliestExpiryAt).filter(Boolean).sort()[0]||null};
 }
 if(args.action!=='reap')requireOwner(args);
 for(let attempt=0;attempt<3;attempt++){
   const baseHead=await head(tools,BRANCH);
   const snap=await readSnapshot(tools,core,baseHead,{...args,now});
   if(snap.closed)return {status:'gate_closed',matchingEnabled:false,head:baseHead};
   if(snap.ownedByOtherToken)return {status:'active_owner_has_other_token',head:baseHead};
   if(snap.empty)return {status:'empty_or_busy',head:baseHead,counts:snap.index.counts};
   const {sid,packet,shard,index}=snap;
   let mutation,outcome='saved',job=null,extra=[];
   if(args.action==='claim') {
     const c=core.claimMatch(shard,{ownerId:args.ownerId,token:args.token,now,limit:1});
     mutation=c;outcome=c.status;
     if(!c.job)return {status:'empty_or_busy',head:baseHead,counts:index.counts};
     if(c.status==='resumed')return {status:'resumed',head:baseHead,jobId:c.job.jobId,
       job:pickJob(packet,c.job.jobId),lease:c.job.lease,generation:c.job.generation};
     job=pickJob(packet,c.job.jobId);
     if(c.job.sourceFingerprint!==job.sourceFingerprint)throw new Error('Job source fingerprint changed');
   } else if(args.action==='reap'){
     const c=core.reclaimExpired(shard,now);
     mutation=c;outcome=c.reclaimed?'reclaimed':'no_expired';
   } else {
     if(!validId(args.jobId))throw new Error('Missing jobId');
     job=pickJob(packet,args.jobId);
     const lease=argsForLease({...args,now});
     if(args.action==='renew')mutation=core.renewMatch(shard,lease);
     if(args.action==='release')mutation=core.releaseMatch(shard,lease);
     if(args.action==='fail')mutation=core.failMatch(shard,{...lease,status:args.failureStatus});
     if(args.action==='checkpoint') {
       if(!validId(args.checkpointId))throw new Error('Invalid checkpointId');
       const checkpointText=format({schemaVersion:1,jobId:job.jobId,sourceFingerprint:job.sourceFingerprint,checkpointId:args.checkpointId,partial:args.partial});
       const id=await blob(tools,checkpointText);
       const path=ROOT+'/checkpoints/'+job.jobId.replace(':','--')+'/'+args.checkpointId+'.json';
       mutation=core.checkpointMatch(shard,{...lease,checkpointId:args.checkpointId,checkpointBlobSha:id});
       if(mutation.status==='saved')extra.push({path,sha:id});
       outcome=mutation.status;
     }
     if(args.action==='complete') {
       const resultText=format({schemaVersion:1,jobId:job.jobId,result:args.result});
       const id=await blob(tools,resultText);
       const path=immutableResultPath(args);
       mutation=core.completeMatch(shard,{...lease,submissionId:args.submissionId,resultBlobSha:id,
         resultPath:path,result:args.result,job});
       if(mutation.status==='saved') {
         await checkSourceUnchanged(tools,job);
         extra.push({path,sha:id});
       }
       outcome=mutation.status;
     }
   }
   if(outcome==='already_saved')return {status:'already_saved',head:baseHead,jobId:job?.jobId};
   if(outcome==='no_expired')return {status:outcome,head:baseHead};
   const nextIndex=touchIndex(core,index,sid,mutation.shard,now);
   if(args.action==='claim')nextIndex.activeOwners[args.ownerId]={token:args.token,jobId:job.jobId,expiresAt:mutation.job.lease.expiresAt};
   if(args.action==='renew' && nextIndex.activeOwners[args.ownerId])nextIndex.activeOwners[args.ownerId].expiresAt=mutation.expiresAt;
   if(['release','fail','complete'].includes(args.action)) {
     const own=nextIndex.activeOwners[args.ownerId];
     if(own?.jobId===args.jobId && own.token===args.token)delete nextIndex.activeOwners[args.ownerId];
   }
   if(args.action==='reap') {
     for(const [owner,own] of Object.entries(nextIndex.activeOwners)) {
       const item=mutation.shard.items.find(row=>row.jobId===own.jobId);
       if(item && item.status!=='leased')delete nextIndex.activeOwners[owner];
     }
   }
   const files=[
      {path:pathFor('state',sid),content:format(mutation.shard)},
      {path:ROOT+'/index.json',content:format(nextIndex)},...extra
   ];
   try {
      const sha=await update(tools,{baseHead,files,
        message:'[skip ci] i18n-match '+args.action+' '+(job?.jobId||sid)});
      return {status:outcome,head:sha,jobId:job?.jobId,
        ...(args.action==='claim'?{job,lease:mutation.job.lease,generation:mutation.job.generation}:{}),
        counts:nextIndex.counts};
   }catch(e){
      if(hotRateLimit(e))throw e;
      if(attempt===2 || !retryableContention(e))throw e;
      // On CAS contention re-read fresh state; never reuse an old lease/version.
   }
 }
 throw new Error('CAS retry exhausted');
}
