/** Matching queue: deterministic, side-effect-free state transitions.
 * A dispatcher must persist (shard + index + result) in ONE GitHub Git tree CAS.
 * This is NOT the translation dispatcher and cannot publish content.
 */
export const MATCH_STATE_VERSION = 1;
export const MATCH_SHARD_COUNT = 16;
export const MATCH_LEASE_MS = 90 * 60 * 1000;
export const MATCH_MAX_ATTEMPTS = 5;
const STATES = ['held','queued','leased','ready','retryable','blocked_external','stale_source','failed_final'];
const HEX64 = /^[0-9a-f]{64}$/i;
const safe = (s) => typeof s === 'string' && /^[A-Za-z0-9_.:-]{2,180}$/.test(s);
const clone = (x) => JSON.parse(JSON.stringify(x));
const requireOk = (ok, message) => { if (!ok) throw new Error(message); };
const iso = (value) => { const n = Date.parse(value); requireOk(Number.isFinite(n), 'Invalid ISO time'); return n; };
const stamp = (ms) => new Date(ms).toISOString();
const fnv = (value) => { let h = 2166136261; for(let i=0;i<value.length;i++){ h ^= value.charCodeAt(i); h = Math.imul(h,16777619); } return h>>>0; };
export function shardFor(jobId) { return (fnv(jobId) % MATCH_SHARD_COUNT).toString(16).padStart(2,'0'); }
export function matchingJobId(entityId) { requireOk(safe(entityId),'Invalid entityId');return 'match:'+entityId; }
export function createMatchManifest(candidateData,{pilotEntityIds=[]}={}) {
 requireOk(candidateData?.schemaVersion===1 && Array.isArray(candidateData.matches),'Invalid candidate registry');
 requireOk(Array.isArray(pilotEntityIds),'Invalid pilot IDs');
 const pilotSet=new Set(pilotEntityIds);
 requireOk(pilotSet.size===pilotEntityIds.length,'Duplicate pilot IDs');
 const rows=candidateData.matches.filter(x=>x.ruStatus!=='archived');
 const entities=new Set();
 const jobs=rows.map(row=>{
   requireOk(safe(row.entityId)&&typeof row.ruContentPath==='string'&&row.ruContentPath.startsWith('src/content/tours/')&&row.ruContentPath.endsWith('.md'),'Invalid Tour identity/path');
   requireOk(!entities.has(row.entityId),'Duplicate Tour');entities.add(row.entityId);
   const jobId=matchingJobId(row.entityId);
   const selected=row.selectedSource??null;
   return {jobId,entityId:row.entityId,ruContentPath:row.ruContentPath,
     ruTitle:row.ruTitle,ruStatus:row.ruStatus,durationDays:row.durationDays??null,
     sourceFingerprint:'git:'+candidateData.repositoryCommit+':'+candidateData.generation.sourceManifestSha256+':'+row.entityId,
     selectedSource:selected,candidates:clone(row.candidates),pilot:pilotSet.has(row.entityId)};
 }).sort((a,b)=>a.jobId.localeCompare(b.jobId,'en'));
 for(const id of pilotSet)requireOk(entities.has(id),'Pilot Tour not active: '+id);
 requireOk(jobs.length===candidateData.counts.activeTours,'Active Tour count mismatch');
 return {schemaVersion:MATCH_STATE_VERSION,version:'matching-20261029-v1',sourceCommit:candidateData.repositoryCommit,
   englishProgrammeManifestHash:candidateData.generation.sourceManifestSha256,
   sourceInventoryObservedAt:candidateData.observedAt,
   jobCount:jobs.length,pilotJobCount:pilotSet.size,policy:'Word 2027 first; 2026 only if no confirmed 2027 source; AI-only only after both years and quarantine search. Confident match authorizes EN Word content and 2027 price amendments for shared RU/EN. No obligatory human review for differences from old RU.',
   jobs};
}
export function summaryForShard(shard) {
 requireOk(shard.schemaVersion===MATCH_STATE_VERSION && Array.isArray(shard.items),'Invalid matching shard');
 const counts=Object.fromEntries(STATES.map(s=>[s,0]));let earliestExpiryAt=null,earliestRetryAt=null;
 for(const item of shard.items){
   requireOk(STATES.includes(item.status),'Unknown status');
   counts[item.status]++;
   if(item.status==='leased' && item.lease?.expiresAt && (!earliestExpiryAt || item.lease.expiresAt<earliestExpiryAt)) earliestExpiryAt=item.lease.expiresAt;
   if(item.status==='retryable' && item.nextAttemptAt && (!earliestRetryAt || item.nextAttemptAt<earliestRetryAt)) earliestRetryAt=item.nextAttemptAt;
 }
 return {counts,earliestExpiryAt,earliestRetryAt};
}
export function rebuildIndex(index, shardId, shard, now) {
 requireOk(index.schemaVersion===MATCH_STATE_VERSION && Object.hasOwn(index.shards,shardId),'Bad matching index');
 const next=clone(index);
 next.shards[shardId]=summaryForShard(shard);
 next.counts=Object.fromEntries(STATES.map(status=>[status,Object.values(next.shards).reduce((n,s)=>n+(s.counts[status]||0),0)]));
 next.updatedAt=now;
 requireOk(Object.values(next.counts).reduce((a,b)=>a+b,0)===next.jobCount,'Index total disagrees with manifest');
 return next;
}
export function seedMatchQueue(manifest, now='2026-10-29T00:00:00.000Z') {
 requireOk(manifest.schemaVersion===MATCH_STATE_VERSION && manifest.jobCount===manifest.jobs.length,'Invalid manifest');
 const shards={},packets={};
 for(let i=0;i<MATCH_SHARD_COUNT;i++){const k=i.toString(16).padStart(2,'0');shards[k]={schemaVersion:1,shardId:k,items:[]};packets[k]={schemaVersion:1,shardId:k,jobs:[]};}
 for(const job of manifest.jobs){
   const shardId=shardFor(job.jobId);
   packets[shardId].jobs.push(job);
   shards[shardId].items.push({jobId:job.jobId,sourceFingerprint:job.sourceFingerprint,
     status:job.pilot?'queued':'held',generation:0,attempts:0,lease:null,
     submission:null,checkpoint:null,nextAttemptAt:null});
 }
 for(const s of Object.values(shards))s.items.sort((a,b)=>a.jobId.localeCompare(b.jobId,'en'));
 const index={schemaVersion:1,manifestVersion:manifest.version,jobCount:manifest.jobCount,pilotJobCount:manifest.pilotJobCount,
  pilotOnly:true,matchingEnabled:true,translationEnabled:false,updatedAt:now,
  counts:Object.fromEntries(STATES.map(s=>[s,0])),shards:Object.fromEntries(Object.entries(shards).map(([id,shard])=>[id,summaryForShard(shard)]))};
 const result=Object.keys(shards).reduce((v,k)=>rebuildIndex(v,k,shards[k],now),index);
 return {index:result,shards,packets};
}
export function pickShard(index,now) {
 requireOk(index.matchingEnabled===true,'Matching gate closed');
 const ms=iso(now);
 const possibilities=Object.entries(index.shards).filter(([,s])=>s.counts.queued>0 ||
     (s.counts.retryable>0&&s.earliestRetryAt&&iso(s.earliestRetryAt)<=ms) ||
     (s.counts.leased>0&&s.earliestExpiryAt&&iso(s.earliestExpiryAt)<=ms));
 if(!possibilities.length)return null;
 possibilities.sort((a,b)=> (b[1].counts.queued>0)-(a[1].counts.queued>0) ||
   a[1].counts.leased-b[1].counts.leased || a[0].localeCompare(b[0]));
 return possibilities[0][0];
}
export function reclaimExpired(shard, now) {
 const next=clone(shard);const ms=iso(now);let count=0;
 for(const item of next.items) {
   if(item.status==='leased'&&item.lease&&iso(item.lease.expiresAt)<=ms) {
     item.lease=null;item.attempts++;
     item.status=item.attempts>=MATCH_MAX_ATTEMPTS?'failed_final':'queued';
     if(item.status==='failed_final')item.lastFailure='lease_expired_retry_limit';
     count++;
   } else if(item.status==='retryable'&&item.nextAttemptAt&&iso(item.nextAttemptAt)<=ms) {
     item.status='queued';item.nextAttemptAt=null;count++;
   }
 }
 return {shard:next,reclaimed:count};
}
export function claimMatch(shard, {ownerId,token,now,limit=1}) {
 requireOk(safe(ownerId)&&safe(token),'Invalid owner/token');requireOk(limit===1,'One matching job per claim');
 const rec=reclaimExpired(shard,now);const next=rec.shard;
 const already=next.items.find(x=>x.status==='leased' && x.lease?.ownerId===ownerId&&x.lease?.token===token);
 if(already)return {shard:next,job:clone(already),status:'resumed',reclaimed:rec.reclaimed};
 const row=next.items.find(x=>x.status==='queued');
 if(!row)return {shard:next,job:null,status:'empty_or_busy',reclaimed:rec.reclaimed};
 row.status='leased';row.generation++;row.lease={ownerId,token,claimedAt:now,
   expiresAt:stamp(iso(now)+MATCH_LEASE_MS)};
 return {shard:next,job:clone(row),status:'claimed',reclaimed:rec.reclaimed};
}
function owned(shard,jobId,{ownerId,token,generation,now}) {
 const item=shard.items.find(x=>x.jobId===jobId);
 requireOk(!!item,'Unknown job');
 requireOk(item.status==='leased'&&item.generation===generation&&
   item.lease?.ownerId===ownerId&&item.lease?.token===token,'Lease is not owned by caller');
 requireOk(iso(item.lease.expiresAt)>iso(now),'Lease expired');
 return item;
}
export function renewMatch(shard,args) {
 const next=clone(shard);const item=owned(next,args.jobId,args);
 item.lease.expiresAt=stamp(iso(args.now)+MATCH_LEASE_MS);
 return {shard:next,expiresAt:item.lease.expiresAt};
}
export function checkpointMatch(shard,args) {
 requireOk(safe(args.checkpointId)&&safe(args.checkpointBlobSha),'Invalid checkpoint ID or blob receipt');
 const next=clone(shard),item=owned(next,args.jobId,args);
 if(item.checkpoint && item.checkpoint.checkpointId===args.checkpointId) {
   requireOk(item.checkpoint.blobSha===args.checkpointBlobSha,'Checkpoint collision');
   return {shard:next,status:'already_saved'};
 }
 item.checkpoint={checkpointId:args.checkpointId,blobSha:args.checkpointBlobSha,at:args.now};
 return {shard:next,status:'saved'};
}
export function validateMatchResult(result,job) {
 requireOk(result && typeof result==='object' && !Array.isArray(result),'Missing result');
 requireOk(result.entityId===job.entityId && result.sourceFingerprint===job.sourceFingerprint,'Source identity changed');
 requireOk(['selected_2027','selected_2026','not_found_both'].includes(result.outcome),'Invalid matching outcome');
 requireOk(Array.isArray(result.evidence)&&result.evidence.length>=2&&result.evidence.every(x=>typeof x==='string'&&x.trim().length>=15),'Insufficient semantic match evidence');
 if(result.outcome==='not_found_both'){
  requireOk(result.selectedSource==null,'No-match result cannot select Word');
  requireOk(result.checkedYears?.includes(2027)&&result.checkedYears?.includes(2026)&&result.quarantinedCandidatesChecked===true,
    'No-match requires 2027/2026 and quarantine evidence');
 }else{
  const year=result.outcome==='selected_2027'?2027:2026;
  const source=result.selectedSource;
  requireOk(source && source.sourceYearFolder===year && safe(source.driveFileId)&&HEX64.test(source.sourceSha256),'Verified DOCX identity and SHA-256 required');
  requireOk(typeof source.modifiedTime==='string'&&iso(source.modifiedTime)>0,'Document modification time required');
  requireOk(Array.isArray(result.dayAlignment)&&result.dayAlignment.length>0&&
   result.dayAlignment.every(x=>Number.isInteger(x.day)&&x.day>0&&typeof x.sourceRef==='string'&&x.sourceRef.length>3),
   'Need semantic day-to-source correspondence');
 }
 if(result.outcome==='selected_2026')requireOk(result.checkedYears?.includes(2027),'2026 requires recorded 2027 absence');
 if(result.priceAmendments!==undefined) {
  requireOk(result.outcome==='selected_2027'&&Array.isArray(result.priceAmendments),'Price amendments require 2027');
  for(const row of result.priceAmendments)
    requireOk(Number.isFinite(row.amount)&&row.amount>=0&&typeof row.currency==='string'&&
      typeof row.priceBasis==='string'&&typeof row.sourceLocator==='string'&&row.sourceLocator.length>3,
      'Price amendment must preserve value, currency, price basis, source locator');
 }
 return true;
}
export function completeMatch(shard,args) {
 requireOk(safe(args.submissionId)&&safe(args.resultBlobSha),'Invalid submit receipt');
 const next=clone(shard);
 const item=next.items.find(x=>x.jobId===args.jobId);
 requireOk(item,'Unknown job');
 if(item.submission?.submissionId===args.submissionId) {
   requireOk(item.submission.blobSha===args.resultBlobSha,'Conflicting duplicate submit');
   return {shard:next,status:'already_saved',item:clone(item)};
 }
 owned(next,args.jobId,args);
 validateMatchResult(args.result,args.job);
 item.status='ready';item.submission={submissionId:args.submissionId,blobSha:args.resultBlobSha,
   resultPath:args.resultPath,savedAt:args.now};
 item.lease=null;item.nextAttemptAt=null;
 return {shard:next,status:'saved',item:clone(item)};
}
export function failMatch(shard,args) {
 const next=clone(shard),item=owned(next,args.jobId,args);
 requireOk(['retryable','blocked_external','stale_source','failed_final'].includes(args.status),'Invalid failure status');
 item.status=args.status;item.lease=null;item.attempts++;
 if(item.status==='retryable' && item.attempts>=MATCH_MAX_ATTEMPTS){
   item.status='failed_final';item.lastFailure='retry_attempt_limit';
 }
 item.nextAttemptAt=item.status==='retryable'?stamp(iso(args.now)+Math.min(1800000,60000*Math.pow(2,Math.min(item.attempts,5)))):null;
 return {shard:next,status:item.status};
}
export function releaseMatch(shard,args) {
 const next=clone(shard),item=owned(next,args.jobId,args);
 item.status='queued';item.lease=null;return {shard:next,status:'released'};
}
