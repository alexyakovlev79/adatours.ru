/** Pure state machine for EN translation pilots. Remote CAS is a separate gate. */
export const TRANSLATION_LEASE_MS=90*60000;
export const TRANSLATION_HEARTBEAT_MS=20*60000;
export const TRANSLATION_SHARD_COUNT=16;
const STATES=['queued','leased','review','ready','retryable','blocked_external','stale_source','failed_final'];
const clone=x=>JSON.parse(JSON.stringify(x));
const check=(ok,s)=>{if(!ok)throw Error('Translation dispatcher: '+s);};
const time=x=>{let n=Date.parse(x);check(Number.isFinite(n),'invalid timestamp');return n;};
const until=(now,ms)=>new Date(time(now)+ms).toISOString();
const isId=x=>typeof x==='string'&&/^[A-Za-z0-9_.:-]{3,200}$/.test(x);
const isHash=x=>typeof x==='string'&&/^[a-f0-9]{40,64}$/.test(x);
const isSha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const zero=()=>Object.fromEntries(STATES.map(s=>[s,0]));
export function shardForTranslation(jobId){
 let h=2166136261;for(let i=0;i<jobId.length;i++){h^=jobId.charCodeAt(i);h=Math.imul(h,16777619);}
 return((h>>>0)%TRANSLATION_SHARD_COUNT).toString(16).padStart(2,'0');
}
export function validateTranslationJob(job){
 check(job&&isId(job.jobId)&&isId(job.entityId)&&job.entityType==='tour'&&
  job.locale==='en'&&job.stage==='word_2027'&&isSha(job.sourceFingerprint)&&
  job.source&&isId(job.source.driveFileId)&&isSha(job.source.wordSha256)&&
  isSha(job.source.ruSha256)&&Array.isArray(job.blocks)&&job.blocks.length>0&&job.blocks.length<=8,
  'invalid job or >8 blocks');
 const ids=new Set();
 for(const b of job.blocks){
  check(isId(b.blockId)&&isId(b.field)&&!ids.has(b.blockId),'invalid/duplicate block ID');
  ids.add(b.blockId);
  check(b.mode==='word_span'||b.mode==='ai_gap','unknown source mode');
  if(b.mode==='word_span')check(Array.isArray(b.paragraphs)&&b.paragraphs.length>0&&
   b.paragraphs.every(p=>/^word\/document\.xml#p\d{4}$/.test(p.ref)&&isSha(p.textSha256)),
   'missing Word paragraph hashes');
  else check(typeof b.reason==='string'&&b.reason.length>=16,'missing AI gap evidence');
 }
 return true;
}
export function seedTranslationPilot(jobs,now='2026-10-30T00:00:00.000Z'){
 check(Array.isArray(jobs)&&jobs.length>=3&&jobs.length<=8,'pilot count 3–8 required');
 const shards={},packets={},seen=new Set(),owners=new Map();
 for(let i=0;i<16;i++){let k=i.toString(16).padStart(2,'0');
  shards[k]={schemaVersion:1,shardId:k,items:[]};packets[k]={schemaVersion:1,shardId:k,jobs:[]};}
 for(const job of jobs){
  validateTranslationJob(job);check(!seen.has(job.jobId),'duplicate job');seen.add(job.jobId);
  const blocks=owners.get(job.entityId)||new Set();
  for(const b of job.blocks){check(!blocks.has(b.blockId),'block owned by two packets');blocks.add(b.blockId);}
  owners.set(job.entityId,blocks);
  const sid=shardForTranslation(job.jobId);packets[sid].jobs.push(clone(job));
  shards[sid].items.push({jobId:job.jobId,sourceFingerprint:job.sourceFingerprint,
   status:'queued',generation:0,attempts:0,lease:null,checkpoint:null,submission:null,
   review:null,nextAttemptAt:null});
 }
 const index={schemaVersion:1,version:'en-pilot-20261030-v1',jobCount:jobs.length,
  stage:'word_2027',pilotOnly:true,dispatcherEnabled:false,
  translationMassLaunchAllowed:false,publicationEnabled:false,updatedAt:now,
  counts:zero(),shards:{}};
 for(const [k,s]of Object.entries(shards)){s.items.sort((a,b)=>a.jobId.localeCompare(b.jobId));
  index.shards[k]=summarizeTranslationShard(s);}
 index.counts=zero();for(const v of Object.values(index.shards))for(const st of STATES)index.counts[st]+=v.counts[st];
 return{index,shards,packets,manifest:{schemaVersion:1,version:index.version,
  stage:index.stage,jobCount:jobs.length,activeTourOwners:owners.size,
  maxBlocksPerPacket:8,leaseMinutes:90,heartbeatMinutes:20,
  status:'PREPARED_DISABLED',jobs:jobs.map(j=>({jobId:j.jobId,entityId:j.entityId,
   fingerprint:j.sourceFingerprint,blockIds:j.blocks.map(b=>b.blockId)}))}};
}
export function summarizeTranslationShard(shard){
 check(shard?.schemaVersion===1&&Array.isArray(shard.items),'bad state shard');
 const counts=zero();let earliestExpiryAt=null,earliestRetryAt=null;
 for(const r of shard.items){
  check(Object.hasOwn(counts,r.status),'invalid state');counts[r.status]++;
  if(r.status==='leased'&&r.lease?.expiresAt&&(!earliestExpiryAt||r.lease.expiresAt<earliestExpiryAt))earliestExpiryAt=r.lease.expiresAt;
  if(r.status==='retryable'&&r.nextAttemptAt&&(!earliestRetryAt||r.nextAttemptAt<earliestRetryAt))earliestRetryAt=r.nextAttemptAt;
 }
 return{counts,earliestExpiryAt,earliestRetryAt};
}
export function rebuildTranslationIndex(index,sid,shard,now){
 check(index?.schemaVersion===1&&Object.hasOwn(index.shards,sid),'bad index');
 const next=clone(index);next.shards[sid]=summarizeTranslationShard(shard);
 next.counts=zero();for(const x of Object.values(next.shards))
  for(const st of STATES)next.counts[st]+=x.counts[st];
 check(Object.values(next.counts).reduce((a,b)=>a+b,0)===next.jobCount,'index drift');
 next.updatedAt=now;return next;
}
export function pickTranslationShard(index,now){
 check(index?.dispatcherEnabled===true&&index.pilotOnly===true,'dispatcher disabled');
 const ms=time(now);
 return Object.entries(index.shards).filter(([,x])=>x.counts.queued>0||
  (x.counts.leased>0&&x.earliestExpiryAt&&time(x.earliestExpiryAt)<=ms)||
  (x.counts.retryable>0&&x.earliestRetryAt&&time(x.earliestRetryAt)<=ms))
 .sort((a,b)=>Number(b[1].counts.queued>0)-Number(a[1].counts.queued>0)||
  a[0].localeCompare(b[0]))[0]?.[0]??null;
}
export function reapTranslation(shard,now){
 const next=clone(shard);let restored=0;
 for(const r of next.items){
  if(r.status==='leased'&&r.lease&&time(r.lease.expiresAt)<=time(now)){
   r.status=++r.attempts>=5?'failed_final':'queued';r.lease=null;restored++;
  }else if(r.status==='retryable'&&r.nextAttemptAt&&time(r.nextAttemptAt)<=time(now)){
   r.status='queued';r.nextAttemptAt=null;restored++;
  }
 }
 return{shard:next,restored};
}
export function claimTranslation(shard,{ownerId,token,now}){
 check(isId(ownerId)&&isId(token),'invalid owner/token');
 const result=reapTranslation(shard,now),next=result.shard;
 const mine=next.items.find(x=>x.status==='leased'&&x.lease?.ownerId===ownerId);
 if(mine){check(mine.lease.token===token,'owner token conflict');
  return{shard:next,status:'resumed',item:clone(mine),restored:result.restored};}
 const r=next.items.find(x=>x.status==='queued');
 if(!r)return{shard:next,status:'empty_or_busy',item:null,restored:result.restored};
 r.status='leased';r.generation++;
 r.lease={ownerId,token,claimedAt:now,expiresAt:until(now,TRANSLATION_LEASE_MS)};
 return{shard:next,status:'claimed',item:clone(r),restored:result.restored};
}
function owned(shard,args){
 const r=shard.items.find(x=>x.jobId===args.jobId);check(r,'unknown job');
 check(r.status==='leased'&&r.generation===args.generation&&
  r.lease?.ownerId===args.ownerId&&r.lease?.token===args.token&&
  time(r.lease.expiresAt)>time(args.now),'lease ownership/expiry mismatch');
 return r;
}
export function renewTranslation(shard,args){
 const next=clone(shard),r=owned(next,args);r.lease.expiresAt=until(args.now,TRANSLATION_LEASE_MS);
 return{shard:next,status:'renewed',expiresAt:r.lease.expiresAt};
}
export function checkpointTranslation(shard,args){
 check(isId(args.checkpointId)&&isHash(args.blobSha),'bad checkpoint receipt');
 const next=clone(shard),r=owned(next,args);
 if(r.checkpoint?.id===args.checkpointId){check(r.checkpoint.blobSha===args.blobSha,'checkpoint collision');
  return{shard:next,status:'already_saved'};}
 r.checkpoint={id:args.checkpointId,blobSha:args.blobSha,at:args.now};
 return{shard:next,status:'saved'};
}
export function validateTranslationReview(result,job){
 validateTranslationJob(job);
 check(result?.jobId===job.jobId&&result.entityId===job.entityId&&
  result.sourceFingerprint===job.sourceFingerprint&&result.locale==='en'&&
  result.state==='review'&&result.releaseEligible===false&&
  Array.isArray(result.blocks)&&result.blocks.length===job.blocks.length,'wrong result/coverage');
 const expected=new Map(job.blocks.map(x=>[x.blockId,x])),seen=new Set();
 for(const b of result.blocks){
  const src=expected.get(b.blockId);
  check(src&&!seen.has(b.blockId)&&src.field===b.field&&src.mode===b.mode,'misowned EN block');
  seen.add(b.blockId);
  check(typeof b.text==='string'&&b.text.trim()&&!/[\u0400-\u052f]/u.test(b.text),
   'missing EN or Cyrillic content');
  if(b.mode==='word_span')check(b.provenance?.kind==='word_exact'&&
   b.provenance.documentSha256===job.source.wordSha256&&
   JSON.stringify(b.provenance.paragraphs)===JSON.stringify(src.paragraphs),
   'source Word paragraph evidence differs');
  else check(b.provenance?.kind==='ai_translation'&&isId(b.provenance.runId)&&
   typeof b.provenance.model==='string'&&b.provenance.model.length>2,'AI provenance missing');
 }
 return true;
}
export function submitTranslation(shard,args){
 check(isId(args.submissionId)&&isHash(args.blobSha)&&typeof args.resultPath==='string'&&
 args.resultPath.includes('/results/'),'bad submission receipt');
 const next=clone(shard),r=next.items.find(x=>x.jobId===args.jobId);check(r,'unknown job');
 if(r.submission?.id===args.submissionId){
  check(r.submission.blobSha===args.blobSha,'conflicting duplicate submit');
  return{shard:next,status:'already_saved'};
 }
 owned(next,args);validateTranslationReview(args.result,args.job);
 check(r.sourceFingerprint===args.job.sourceFingerprint,'stale source');
 r.status='review';r.lease=null;r.submission={id:args.submissionId,blobSha:args.blobSha,
  resultPath:args.resultPath,at:args.now};
 return{shard:next,status:'saved_for_review'};
}
export function approveTranslation(shard,args){
 const next=clone(shard),r=next.items.find(x=>x.jobId===args.jobId);
 check(r?.status==='review'&&r.submission?.blobSha===args.blobSha,'QA must read exact review hash');
 check(isId(args.reviewerId)&&args.checks&&
 ['word','meaning','facts','voice','structure','relations'].every(x=>args.checks[x]===true),
 'independent QA checks not confirmed');
 r.status='ready';r.review={reviewerId:args.reviewerId,at:args.now,
  acceptedBlobSha:args.blobSha,checks:clone(args.checks)};
 return{shard:next,status:'ready'};
}
export function failTranslation(shard,args){
 const next=clone(shard),r=owned(next,args);
 check(['retryable','blocked_external','stale_source','failed_final'].includes(args.status),'bad failure');
 r.lease=null;r.attempts++;r.status=args.status==='retryable'&&r.attempts>=5?'failed_final':args.status;
 r.nextAttemptAt=r.status==='retryable'?until(args.now,Math.min(1800000,60000*2**r.attempts)):null;
 return{shard:next,status:r.status};
}
export function releaseTranslation(shard,args){
 const next=clone(shard),r=owned(next,args);r.status='queued';r.lease=null;
 return{shard:next,status:'released'};
}
