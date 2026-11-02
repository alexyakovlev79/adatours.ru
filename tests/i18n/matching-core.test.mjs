import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../../scripts/i18n/matching-core.mjs';

const SOURCE='a'.repeat(40);
const HASH='b'.repeat(64);
const NOW='2026-10-29T10:00:00.000Z';
const toy=(n=48,selected=5)=>({
 schemaVersion:1,repositoryCommit:SOURCE,observedAt:'2026-10-28T00:00:00.000Z',
 generation:{sourceManifestSha256:HASH},counts:{activeTours:n},
 matches:Array.from({length:n},(_,i)=>({
  entityId:'tour_sample_'+i,ruContentPath:'src/content/tours/sample-'+i+'.md',
  ruTitle:'Sample '+i,ruStatus:'approved',durationDays:3,
  selectedSource:null,candidates:{2027:[],2026:[]}
 }))
});
const make=(n=48,pilot=5)=>{
 const c=toy(n,pilot);
 const manifest=m.createMatchManifest(c,{pilotEntityIds:c.matches.slice(0,pilot).map(x=>x.entityId)});
 return {manifest,...m.seedMatchQueue(manifest,NOW)};
};
const first=(x)=>Object.values(x).flatMap(s=>s.items).find(r=>r.status==='queued');
const desc=(mf,id)=>mf.jobs.find(j=>j.jobId===id);
const lease=(job,generation)=>({jobId:job.jobId,ownerId:'alex-agent',token:'lease-123',generation,now:'2026-10-29T10:05:00.000Z'});

test('seed partitions 358 unique active Tours across 16 shards',()=>{
 const {manifest,index,shards,packets}=make(358,5);
 assert.equal(manifest.jobCount,358);
 assert.equal(index.counts.queued,5);
 assert.equal(index.counts.held,353);
 assert.equal(Object.keys(shards).length,16);
 const ids=Object.values(shards).flatMap(s=>s.items.map(x=>x.jobId));
 assert.equal(new Set(ids).size,358);
 for(const [shardId,p] of Object.entries(packets)){
  assert.equal(p.shardId,shardId);
  assert.ok(p.jobs.every(j=>m.shardFor(j.jobId)===shardId));
 }
});
test('matching starts with pilot only and cannot pick held tasks',()=>{
 const q=make(8,0);
 assert.equal(m.pickShard(q.index,NOW),null);
 assert.ok(Object.values(q.shards).flatMap(s=>s.items).every(x=>x.status==='held'));
});
test('one worker claims one job and exact replay returns its own lease',()=>{
 const q=make(1,1),sh=Object.values(q.shards).find(s=>s.items.length);
 const args={ownerId:'alex-agent',token:'lease-123',now:NOW};
 const a=m.claimMatch(sh,args);
 assert.equal(a.status,'claimed');assert.equal(a.job.generation,1);
 const b=m.claimMatch(a.shard,args);
 assert.equal(b.status,'resumed');assert.equal(b.job.jobId,a.job.jobId);
});
test('renew extends lease and rejects wrong owner',()=>{
 const q=make(1,1),sh=Object.values(q.shards).find(s=>s.items.length);
 const a=m.claimMatch(sh,{ownerId:'alex-agent',token:'lease-123',now:NOW});
 const row=a.job, l=lease(row,row.generation);
 const r=m.renewMatch(a.shard,l);
 assert.ok(r.expiresAt>a.job.lease.expiresAt);
 assert.throws(()=>m.renewMatch(r.shard,{...l,token:'wrong-token'}),/Lease/);
});
test('expired lease is recycled; fenced previous owner cannot submit',()=>{
 const q=make(1,1),sh=Object.values(q.shards).find(s=>s.items.length);
 const a=m.claimMatch(sh,{ownerId:'alex-agent',token:'lease-123',now:NOW});
 const b=m.claimMatch(a.shard,{ownerId:'another-agent',token:'other-lease',now:'2026-10-29T11:31:00.000Z'});
 assert.equal(b.status,'claimed');
 assert.equal(b.job.generation,2);
 assert.throws(()=>m.renewMatch(b.shard,lease(a.job,a.job.generation)),/Lease/);
});
test('checkpoint stored once and collision rejected',()=>{
 const q=make(1,1),sh=Object.values(q.shards).find(s=>s.items.length);
 const a=m.claimMatch(sh,{ownerId:'alex-agent',token:'lease-123',now:NOW});
 const args={...lease(a.job,a.job.generation),checkpointId:'part-0001',checkpointBlobSha:'1234567890'};
 const one=m.checkpointMatch(a.shard,args);assert.equal(one.status,'saved');
 assert.equal(m.checkpointMatch(one.shard,args).status,'already_saved');
 assert.throws(()=>m.checkpointMatch(one.shard,{...args,checkpointBlobSha:'different'}),/collision/);
});
test('2027 new price rows allowed with explicit basis and locator',()=>{
 const q=make(1,1),job=q.manifest.jobs[0];
 const result={entityId:job.entityId,sourceFingerprint:job.sourceFingerprint,
 outcome:'selected_2027',checkedYears:[2027],
 selectedSource:{driveFileId:'good2027wordid',sourceYearFolder:2027,sourceSha256:HASH,modifiedTime:NOW},
 evidence:['Route and order agree on all four main stops','Word and RU tour both have the same duration'],
 dayAlignment:[{day:1,sourceRef:'word/document.xml#p0002'}],
 priceAmendments:[{amount:1908,currency:'USD',priceBasis:'per_person',sourceLocator:'word/document.xml#tbl0002'}]};
 assert.equal(m.validateMatchResult(result,job),true);
 assert.throws(()=>m.validateMatchResult({...result,priceAmendments:[{amount:1,currency:'USD',sourceLocator:'p'}]},job),/Price amendment/);
});
test('2026 is permitted only after confirmed search in 2027',()=>{
 const q=make(1,1),job=q.manifest.jobs[0];
 const x={entityId:job.entityId,sourceFingerprint:job.sourceFingerprint,
 outcome:'selected_2026',selectedSource:{driveFileId:'good2026wordid',sourceYearFolder:2026,sourceSha256:HASH,modifiedTime:NOW},
 evidence:['Route and duration found in English 2026','No matching programme in English 2027'],
 dayAlignment:[{day:1,sourceRef:'word/document.xml#p0001'}]};
 assert.throws(()=>m.validateMatchResult(x,job),/2027 absence/);
 assert.equal(m.validateMatchResult({...x,checkedYears:[2027,2026]},job),true);
 assert.throws(()=>m.validateMatchResult({...x,checkedYears:[2027],priceAmendments:[]},job),/Price amendments/);
});
test('AI-only eligibility cannot be based just on empty filename candidates',()=>{
 const q=make(1,1),job=q.manifest.jobs[0];
 const x={entityId:job.entityId,sourceFingerprint:job.sourceFingerprint,
 outcome:'not_found_both',selectedSource:null,evidence:['2027 title and itinerary candidates checked','2026 and quarantined candidates checked']};
 assert.throws(()=>m.validateMatchResult(x,job),/No-match requires/);
 assert.equal(m.validateMatchResult({...x,checkedYears:[2027,2026],quarantinedCandidatesChecked:true},job),true);
});
test('completion is idempotent even after lost response and guards changes',()=>{
 const q=make(1,1),job=q.manifest.jobs[0],sh=q.shards[m.shardFor(job.jobId)];
 const a=m.claimMatch(sh,{ownerId:'alex-agent',token:'lease-123',now:NOW});
 const result={entityId:job.entityId,sourceFingerprint:job.sourceFingerprint,
 outcome:'not_found_both',selectedSource:null,checkedYears:[2027,2026],quarantinedCandidatesChecked:true,
 evidence:['2027 English programme candidates checked','2026 English and quarantine candidates checked']};
 const args={...lease(a.job,a.job.generation),submissionId:'submit-001',resultBlobSha:'git-blob-001',
   resultPath:'data/i18n/matching/v1/results/mock.json',result,job};
 const c=m.completeMatch(a.shard,args);assert.equal(c.status,'saved');
 assert.equal(m.completeMatch(c.shard,args).status,'already_saved');
 assert.throws(()=>m.completeMatch(c.shard,{...args,resultBlobSha:'other-blob'}),/duplicate/);
 assert.throws(()=>m.completeMatch(a.shard,{...args,job:{...job,sourceFingerprint:'changed'}}),/identity/);
});
test('index summaries remain consistent under 20 independent worker leases',()=>{
 let q=make(64,64),index=q.index;const shards=structuredClone(q.shards);
 for(let i=0;i<20;i++){
  const shardId=m.pickShard(index,NOW);
  assert.ok(shardId);
  const c=m.claimMatch(shards[shardId],{ownerId:'worker-'+i,token:'token-'+i,now:NOW});
  assert.equal(c.status,'claimed');shards[shardId]=c.shard;
  index=m.rebuildIndex(index,shardId,c.shard,NOW);
 }
 assert.equal(index.counts.leased,20);assert.equal(index.counts.queued,44);
 assert.equal(Object.values(index.counts).reduce((a,b)=>a+b,0),64);
});
test('retryable task remains blocked until its due time',()=>{
 const q=make(1,1),job=q.manifest.jobs[0],sh=q.shards[m.shardFor(job.jobId)];
 const a=m.claimMatch(sh,{ownerId:'alex-agent',token:'lease-123',now:NOW});
 const f=m.failMatch(a.shard,{...lease(a.job,a.job.generation),status:'retryable'});
 assert.equal(f.shard.items[0].status,'retryable');
 assert.equal(m.reclaimExpired(f.shard,'2026-10-29T10:05:30Z').shard.items[0].status,'retryable');
 assert.equal(m.reclaimExpired(f.shard,'2026-10-29T10:07:01Z').shard.items[0].status,'queued');
});


test('changing a price does not authorize a Word 2026 rollback',()=>{
  const q=make(1,1),job=q.manifest.jobs[0];
  const result={entityId:job.entityId,sourceFingerprint:job.sourceFingerprint,
   outcome:'selected_2026',selectedSource:{driveFileId:'old2026file',sourceYearFolder:2026,sourceSha256:HASH,modifiedTime:NOW},
   checkedYears:[2027,2026], evidence:['2027 edition contains no matching programme','2026 edition has matching days and stops'],
   dayAlignment:[{day:1,sourceRef:'word/document.xml#p0030'}],
   priceAmendments:[{amount:35,currency:'USD',priceBasis:'per_person',sourceLocator:'word/document.xml#tbl0004'}]};
  assert.throws(()=>m.validateMatchResult(result,job),/Price amendments require 2027/);
});


test('repeated expired leases become a recorded terminal failure after five attempts',()=>{
 let q=make(1,1),sh=Object.values(q.shards).find(v=>v.items.length);
 for(let n=0;n<5;n++){
  const a=m.claimMatch(sh,{ownerId:'owner-'+n,token:'lease-'+n,now:'2026-10-29T10:00:00.000Z'});
  assert.equal(a.status,'claimed');
  const next=m.reclaimExpired(a.shard,'2026-10-29T12:00:00.000Z');
  sh=next.shard;
 }
 assert.equal(sh.items[0].status,'failed_final');
 assert.equal(sh.items[0].attempts,5);
 assert.equal(m.claimMatch(sh,{ownerId:'owner-z',token:'token-z',now:'2026-10-29T13:00:00.000Z'}).status,'empty_or_busy');
});
test('repeated retryable failures stop after bounded attempts',()=>{
 let q=make(1,1),sh=Object.values(q.shards).find(v=>v.items.length);
 for(let n=0;n<5;n++){
  const a=m.claimMatch(sh,{ownerId:'owner-'+n,token:'lease-'+n,now:'2026-10-29T10:00:00.000Z'});
  const f=m.failMatch(a.shard,{jobId:a.job.jobId,ownerId:'owner-'+n,token:'lease-'+n,generation:a.job.generation,now:'2026-10-29T10:10:00.000Z',status:'retryable'});
  sh=m.reclaimExpired(f.shard,'2026-10-29T14:00:00.000Z').shard;
 }
 assert.equal(sh.items[0].status,'failed_final');
 assert.equal(sh.items[0].lastFailure,'retry_attempt_limit');
});
