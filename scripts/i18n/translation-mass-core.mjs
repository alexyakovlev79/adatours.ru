/** EN bulk worker core: pure CAS transitions for a separately seeded v2 queue.
 * An independent GitHub adapter must pin the expected head and source receipt.
 * No worker operation can approve, publish or mutate Russian commercial data.
 */
export const LEASE_MS=90*60000,RENEW_CADENCE_MS=20*60000,MAX_ATTEMPTS=5;
const STATES=['held','queued','leased','review','ready','retryable','blocked_external','stale_source','failed_final'];
const STAGES=['word_2027','word_2026','ai_only'];
const copy=x=>JSON.parse(JSON.stringify(x));
const check=(condition,message)=>{if(!condition)throw Error('EN mass CAS: '+message)};
const valid=s=>typeof s==='string'&&/^[a-zA-Z0-9_.:-]{3,200}$/.test(s);
const date=s=>{const t=Date.parse(s);check(Number.isFinite(t),'bad time');return t};
const offset=(s,ms)=>new Date(date(s)+ms).toISOString();
export function massIndexShard(index,now){
 check(index?.schemaVersion===2&&index.dispatcherEnabled===true&&
  index.translationMassLaunchAllowed===true&&
  index.publicationEnabled===false&&!index.pilotOnly,'gate closed');
 const stage=index.stage;
 check(STAGES.includes(stage),'invalid stage');
 const nowMs=date(now);
 const options=Object.entries(index.shards).filter(([,v])=>{
  const c=v.stages[stage];
  return c.queued>0||(c.leased>0&&v.earliestExpiryAt&&date(v.earliestExpiryAt)<=nowMs)||
   (c.retryable>0&&v.earliestRetryAt&&date(v.earliestRetryAt)<=nowMs);
 });
 return options.sort((a,b)=>b[1].stages[stage].queued-a[1].stages[stage].queued||
  a[0].localeCompare(b[0]))[0]?.[0]??null;
}
export function massShardSummary(shard){
 check(shard?.schemaVersion===2&&Array.isArray(shard.items),'bad shard');
 const counts=Object.fromEntries(STAGES.map(stage=>[stage,
  Object.fromEntries(STATES.map(s=>[s,0]))]));
 let earliestExpiryAt=null,earliestRetryAt=null;
 for(const item of shard.items){
  check(STAGES.includes(item.stage)&&STATES.includes(item.status),'unknown item status');
  counts[item.stage][item.status]++;
  if(item.status==='leased'&&item.lease?.expiresAt)
   earliestExpiryAt=earliestExpiryAt&&earliestExpiryAt<item.lease.expiresAt?
    earliestExpiryAt:item.lease.expiresAt;
  if(item.status==='retryable'&&item.nextAttemptAt)
   earliestRetryAt=earliestRetryAt&&earliestRetryAt<item.nextAttemptAt?
    earliestRetryAt:item.nextAttemptAt;
 }
 return {count:shard.items.length,stages:counts,earliestExpiryAt,earliestRetryAt};
}
export function massRebuildIndex(index,sid,shard,now){
 check(index?.schemaVersion===2&&Object.hasOwn(index.shards,sid),'bad index');
 const next=copy(index);
 next.shards[sid]=massShardSummary(shard);
 next.stageCounts=Object.fromEntries(STAGES.map(st=>[st,
  Object.fromEntries(STATES.map(s=>[s,0]))]));
 next.counts=Object.fromEntries(STATES.map(s=>[s,0]));
 for(const value of Object.values(next.shards))for(const stage of STAGES)
  for(const status of STATES)next.stageCounts[stage][status]+=value.stages[stage][status]||0;
 for(const stage of STAGES)for(const status of STATES)
  next.counts[status]+=next.stageCounts[stage][status];
 check(Object.values(next.counts).reduce((x,y)=>x+y,0)===next.jobCount,
  'status counts do not reconcile');
 next.updatedAt=now;
 return next;
}
export function massReap(shard,now){
 const out=copy(shard);let restored=0;
 for(const x of out.items){
  if(x.status==='leased'&&x.lease&&date(x.lease.expiresAt)<=date(now)){
   x.status=++x.attempts>=MAX_ATTEMPTS?'failed_final':'queued';
   x.lease=null;restored++;
  }else if(x.status==='retryable'&&x.nextAttemptAt&&date(x.nextAttemptAt)<=date(now)){
   x.status='queued';x.nextAttemptAt=null;restored++;
  }
 }
 return {shard:out,restored};
}
export function massClaim(shard,{stage,ownerId,token,now}){
 check(STAGES.includes(stage)&&valid(ownerId)&&valid(token),'invalid claim');
 const reaped=massReap(shard,now),out=reaped.shard;
 const mine=out.items.find(x=>x.status==='leased'&&x.lease?.ownerId===ownerId);
 if(mine){check(mine.lease.token===token,'owner token conflict');
  return{status:'resumed',shard:out,item:copy(mine),restored:reaped.restored};}
 const item=out.items.find(x=>x.status==='queued'&&x.stage===stage);
 if(!item)return{status:'empty_or_busy',shard:out,item:null,restored:reaped.restored};
 item.status='leased';item.generation++;
 item.lease={ownerId,token,claimedAt:now,expiresAt:offset(now,LEASE_MS)};
 return{status:'claimed',shard:out,item:copy(item),restored:reaped.restored};
}
function owned(shard,{jobId,ownerId,token,generation,now}){
 const item=shard.items.find(x=>x.jobId===jobId);
 check(item&&item.status==='leased'&&item.generation===generation&&
  item.lease?.ownerId===ownerId&&item.lease?.token===token&&
  date(item.lease.expiresAt)>date(now),'lease ownership / expiry mismatch');
 return item;
}
export function massRenew(shard,args){
 const out=copy(shard),item=owned(out,args);
 item.lease.expiresAt=offset(args.now,LEASE_MS);
 return{shard:out,status:'renewed',expiresAt:item.lease.expiresAt};
}
export function massCheckpoint(shard,args){
 check(valid(args.checkpointId)&&/^[a-f0-9]{40}$/.test(args.blobSha),
  'invalid checkpoint receipt');
 const out=copy(shard),item=owned(out,args);
 if(item.checkpoint?.id===args.checkpointId){
  check(item.checkpoint.blobSha===args.blobSha,'checkpoint hash collision');
  return{shard:out,status:'already_saved'};
 }
 item.checkpoint={id:args.checkpointId,blobSha:args.blobSha,at:args.now};
 return{shard:out,status:'checkpoint_saved'};
}
export function validateMassResult(job,result){
 check(job?.schemaVersion===2&&result?.jobId===job.jobId&&
  result.sourceFingerprint===job.sourceFingerprint&&
  result.stableId===job.stableId&&result.locale==='en'&&
  result.status==='review'&&result.releaseEligible===false,
  'job identity / release gate mismatch');
 check(Array.isArray(result.blocks)&&result.blocks.length===job.blocks.length,
  'missing or excess translated blocks');
 const expected=new Map(job.blocks.map(b=>[b.blockId,b]));
 const seen=new Set();
 for(const block of result.blocks){
  const source=expected.get(block.blockId);
  check(source&&!seen.has(block.blockId)&&source.field===block.field,
   'incorrect block owner');
  seen.add(block.blockId);
  check(typeof block.text==='string'&&block.text.trim()&&
   !/[\u0400-\u052F]/u.test(block.text),'untranslated or empty EN block');
  check(block.sourceTextSha256===source.ruTextSha256,'source text fingerprint mismatch');
  const prov=block.provenance;
  if(job.stage==='ai_only'){
   check(prov?.kind==='ai_translation'&&valid(prov.runId)&&
    typeof prov.model==='string'&&prov.model.length>=3,'AI source attribution');
  }else if(prov?.kind==='word_exact'){
   check(prov.fileId===job.source.selectedWord.fileId&&
    prov.documentSha256===job.source.selectedWord.sha256&&
    Array.isArray(prov.paragraphs)&&prov.paragraphs.length>0&&
    prov.paragraphs.every(p=>typeof p.ref==='string'&&/^[a-f0-9]{64}$/.test(p.textSha256)),
    'Word source/paragraph evidence mismatch');
  }else{
   check(prov?.kind==='ai_translation'&&valid(prov.runId)&&
    typeof prov.model==='string'&&prov.model.length>=3&&
    typeof prov.wordAbsenceReason==='string'&&prov.wordAbsenceReason.trim().length>=16,
    'Word-first gap must be evidenced');
  }
 }
 return true;
}
export function massSubmit(shard,args){
 check(valid(args.submissionId)&&/^[a-f0-9]{40}$/.test(args.blobSha)&&
  typeof args.resultPath==='string'&&args.resultPath.includes('/results/'),
  'invalid result receipt');
 const out=copy(shard),item=out.items.find(x=>x.jobId===args.jobId);
 check(item,'unknown job');
 if(item.submission?.id===args.submissionId){
  check(item.submission.blobSha===args.blobSha,'duplicate submit collision');
  return{shard:out,status:'already_saved'};
 }
 owned(out,args);
 check(item.sourceFingerprint===args.job.sourceFingerprint,'changed source');
 validateMassResult(args.job,args.result);
 item.status='review';item.lease=null;
 item.submission={id:args.submissionId,blobSha:args.blobSha,
  resultPath:args.resultPath,at:args.now};
 return{shard:out,status:'saved_for_review'};
}
export function massApprove(shard,args){
 const out=copy(shard),item=out.items.find(x=>x.jobId===args.jobId);
 check(item?.status==='review'&&item.submission?.blobSha===args.blobSha,
  'QA must read and verify exact result blob');
 check(valid(args.reviewerId)&&['word','meaning','facts','voice','structure','relations']
  .every(k=>args.checks?.[k]===true),'independent QA incomplete');
 item.status='ready';item.review={reviewerId:args.reviewerId,at:args.now,
  acceptedBlobSha:args.blobSha,checks:copy(args.checks)};
 return{shard:out,status:'ready'};
}
export function massRelease(shard,args){
 const out=copy(shard),item=owned(out,args);item.status='queued';item.lease=null;
 return{shard:out,status:'released'};
}
export function massFail(shard,args){
 check(['retryable','blocked_external','stale_source','failed_final'].includes(args.failureStatus),
  'invalid failure status');
 const out=copy(shard),item=owned(out,args);item.lease=null;item.attempts++;
 item.status=args.failureStatus==='retryable'&&item.attempts>=MAX_ATTEMPTS?
  'failed_final':args.failureStatus;
 item.nextAttemptAt=item.status==='retryable'?
  offset(args.now,Math.min(1800000,60000*2**item.attempts)):null;
 return{shard:out,status:item.status};
}
