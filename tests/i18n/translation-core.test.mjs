import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {seedTranslationPilot,claimTranslation,renewTranslation,checkpointTranslation,
 submitTranslation,reapTranslation,approveTranslation,failTranslation,releaseTranslation,
 pickTranslationShard,rebuildTranslationIndex,validateTranslationReview}
 from '../../scripts/i18n/translation-core.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex'),at='2026-10-30T10:00:00Z';
function j(id='tour_test',n=1){
 return{jobId:'en:tour:'+id+':p'+n,entityId:id,entityType:'tour',locale:'en',
 stage:'word_2027',sourceFingerprint:sha(id+n),source:{driveFileId:'f123',wordSha256:sha('word'),
 ruSha256:sha('ru')},blocks:[{blockId:'tour:title:'+n,field:'title',mode:'word_span',
 paragraphs:[{ref:'word/document.xml#p0002',textSha256:sha('title')}]}]};
}
const jobs=[j('tour_alpha'),j('tour_beta'),j('tour_gamma')];
const sample=()=>seedTranslationPilot(jobs);
const readyResult=job=>({jobId:job.jobId,entityId:job.entityId,sourceFingerprint:job.sourceFingerprint,
 locale:'en',state:'review',releaseEligible:false,blocks:job.blocks.map(b=>({blockId:b.blockId,
 field:b.field,mode:b.mode,text:'English title',provenance:{kind:'word_exact',
 documentSha256:job.source.wordSha256,paragraphs:b.paragraphs}}))});
test('pilot is safely disabled and sharded index reconciles',()=>{
 const x=sample();assert.equal(x.index.jobCount,3);assert.equal(x.index.dispatcherEnabled,false);
 assert.equal(x.index.counts.queued,3);assert.equal(x.index.publicationEnabled,false);
 assert.throws(()=>pickTranslationShard(x.index,at),/dispatcher disabled/);
});
test('two workers cannot claim one job in same shard',()=>{
 const x=sample();let s={schemaVersion:1,shardId:'a',items:[...Object.values(x.shards).flatMap(v=>v.items)]};
 const one=claimTranslation(s,{ownerId:'worker-a',token:'token-a',now:at});
 const two=claimTranslation(one.shard,{ownerId:'worker-b',token:'token-b',now:at});
 assert.notEqual(one.item.jobId,two.item.jobId);
});
test('resume, heartbeat, checkpoint replay and lost submit response are idempotent',()=>{
 const x=sample();const [sid]=Object.entries(x.shards).filter(([,v])=>v.items.length);
 const first=claimTranslation(x.shards[sid],{ownerId:'worker-a',token:'token-a',now:at});
 const args={jobId:first.item.jobId,ownerId:'worker-a',token:'token-a',generation:first.item.generation,now:at};
 const resumed=claimTranslation(first.shard,{ownerId:'worker-a',token:'token-a',now:at});
 assert.equal(resumed.status,'resumed');
 const renewed=renewTranslation(resumed.shard,args);
 const check=checkpointTranslation(renewed.shard,{...args,checkpointId:'cp-1',blobSha:sha('check')});
 assert.equal(checkpointTranslation(check.shard,{...args,checkpointId:'cp-1',blobSha:sha('check')}).status,'already_saved');
 const job=jobs.find(x=>x.jobId===first.item.jobId),result=readyResult(job);
 const submission={...args,job,submissionId:'submit-one',blobSha:sha('submission'),
 resultPath:'data/i18n/translation/v1/results/one.json',result};
 const done=submitTranslation(check.shard,submission);
 assert.equal(done.status,'saved_for_review');
 assert.equal(submitTranslation(done.shard,submission).status,'already_saved');
 assert.equal(done.shard.items.find(x=>x.jobId===job.jobId).status,'review');
 assert.throws(()=>approveTranslation(done.shard,{jobId:job.jobId,blobSha:sha('wrong'),
 reviewerId:'independent',now:at,checks:{}}),/QA must read/);
});
test('lease expiration fences stale owner; new owner can reclaim',()=>{
 const x=sample(),s=Object.values(x.shards).find(v=>v.items.length);
 const first=claimTranslation(s,{ownerId:'alice',token:'tok-a',now:at});
 const later='2026-10-30T11:31:00Z',r=reapTranslation(first.shard,later);
 const claim=claimTranslation(r.shard,{ownerId:'bob',token:'tok-b',now:later});
 assert.equal(claim.status,'claimed');
 assert.throws(()=>renewTranslation(claim.shard,{jobId:first.item.jobId,ownerId:'alice',
  token:'tok-a',generation:first.item.generation,now:later}),/lease ownership/);
});
test('review cannot claim published; wrong Word source rejected',()=>{
 const job=jobs[0],r=readyResult(job);r.blocks[0].provenance.documentSha256=sha('wrong');
 assert.throws(()=>validateTranslationReview(r,job),/Word paragraph evidence/);
});
test('failure retry and release preserve queued work',()=>{
 const x=sample(),s=Object.values(x.shards).find(v=>v.items.length);
 const first=claimTranslation(s,{ownerId:'worker',token:'token',now:at});
 const args={jobId:first.item.jobId,ownerId:'worker',token:'token',
 generation:first.item.generation,now:at};
 const f=failTranslation(first.shard,{...args,status:'retryable'});
 assert.equal(f.status,'retryable');
 assert.equal(reapTranslation(f.shard,'2026-10-30T10:00:20Z').restored,0);
 assert.equal(reapTranslation(f.shard,'2026-10-30T10:05:00Z').restored,1);
 const next=claimTranslation(reapTranslation(f.shard,'2026-10-30T10:05:00Z').shard,
 {ownerId:'worker2',token:'token2',now:'2026-10-30T10:05:00Z'});
 assert.equal(releaseTranslation(next.shard,{jobId:next.item.jobId,ownerId:'worker2',
 token:'token2',generation:next.item.generation,now:'2026-10-30T10:05:00Z'}).status,'released');
});
test('real pilot source packets seed into five disabled jobs covering 30 anchors',()=>{
 const root=new URL('../../data/i18n/word-block-alignments/pilot/',import.meta.url);
 const ids=['tour_brazil_rio_four_days','tour_chile_easter_island_3_days_2027','tour_colombia_essential_5_days'];
 const rows=[];for(const id of ids){
  const p=JSON.parse(fs.readFileSync(new URL(id+'.json',root),'utf8'));
  const map=JSON.parse(fs.readFileSync(new URL('../../data/i18n/block-maps/tours/'+id+'.json',import.meta.url),'utf8'));
  for(let i=0;i<p.blocks.length;i+=8)rows.push({jobId:'en:tour:'+id+':p'+(1+i/8),
   entityId:id,entityType:'tour',locale:'en',stage:'word_2027',
   sourceFingerprint:sha(id+i),source:{driveFileId:p.word.driveFileId,
   wordSha256:p.word.documentSha256,ruSha256:map.ruBlobSha256},blocks:p.blocks.slice(i,i+8)});
 }
 const seed=seedTranslationPilot(rows);
 assert.equal(seed.manifest.jobCount,5);
 assert.equal(rows.reduce((n,x)=>n+x.blocks.length,0),30);
 assert.equal(seed.index.dispatcherEnabled,false);
});
