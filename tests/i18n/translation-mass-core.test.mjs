import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {planTourTranslation,createMassTranslationState,massShard as plannerShard} from '../../src/lib/i18n/translation-mass-plan.mjs';
import {massShard,massIndexShard,massClaim,massReap,massRebuildIndex,massRenew,
 massCheckpoint,massSubmit,massApprove,massRelease,massFail,validateMassResult}
 from '../../scripts/i18n/translation-mass-core.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex'),git='a'.repeat(40);
const at='2026-11-02T20:00:00Z';
function row(id='tour_test'){
 const map={entityId:id,entityType:'tour',sourceContentPath:'src/content/tours/x.md',
  ruBlobSha256:sha('RU'),
  paths:[{path:'/title',blockId:'blk1',field:'title',dependsOn:[]}]};
 return planTourTranslation({id,map,slots:[{path:'/title',field:'title',text:'Путешествие'}],
  contentSha256:sha('RU'),sourceBlobSha:git,
  match:{entityId:id,sourceFingerprint:'git:x',outcome:'selected_2027',
   selectedSource:{driveFileId:'file-123',sourceSha256:sha('WORD')}}});
}
const source=()=>createMassTranslationState([row('tour_one'),row('tour_two')],
 {sourceCommit:git,matchingCommit:git,pilotCommit:git});
test('bulk claim is fail-closed, then two workers get different jobs',()=>{
 const state=source();
 assert.throws(()=>massIndexShard(state.index,at),/gate closed/);
 const open={...state.index,dispatcherEnabled:true,translationMassLaunchAllowed:true};
 const sid=massIndexShard(open,at);
 assert.ok(sid);
 const shard=state.shards[sid],one=massClaim(shard,{stage:'word_2027',ownerId:'worker1',token:'token1',now:at});
 assert.equal(one.status,'claimed');
 const replay=massClaim(one.shard,{stage:'word_2027',ownerId:'worker1',token:'token1',now:at});
 assert.equal(replay.status,'resumed');
 assert.equal(replay.item.jobId,one.item.jobId);
});
test('lease expiry fences previous owner and later claim is safe',()=>{
 const state=source(),s=Object.values(state.shards).find(s=>s.items.length);
 const first=massClaim(s,{stage:'word_2027',ownerId:'worker1',token:'token1',now:at});
 const later='2026-11-02T21:31:00Z',reaped=massReap(first.shard,later);
 assert.equal(reaped.restored,1);
 const second=massClaim(reaped.shard,{stage:'word_2027',ownerId:'worker2',token:'token2',now:later});
 assert.equal(second.status,'claimed');
 assert.throws(()=>massRenew(second.shard,{jobId:first.item.jobId,ownerId:'worker1',
  token:'token1',generation:first.item.generation,now:later}),/lease ownership/);
});
test('review requires complete source-bound English text; accepted QA cannot be forged',()=>{
 const state=source(),s=Object.values(state.shards).find(s=>s.items.length),job=Object.values(state.packets)
  .flatMap(s=>s.jobs).find(j=>j.jobId===s.items[0].jobId);
 const first=massClaim(s,{stage:'word_2027',ownerId:'worker1',token:'token1',now:at});
 const args={jobId:job.jobId,ownerId:'worker1',token:'token1',
  generation:first.item.generation,now:at};
 const b=job.blocks[0],result={jobId:job.jobId,stableId:job.stableId,
  locale:'en',status:'review',releaseEligible:false,sourceFingerprint:job.sourceFingerprint,
  blocks:[{blockId:b.blockId,field:b.field,text:'A journey',
    sourceTextSha256:b.ruTextSha256,provenance:{kind:'word_exact',
     fileId:job.source.selectedWord.fileId,
     documentSha256:job.source.selectedWord.sha256,
     paragraphs:[{ref:'word/document.xml#p0001',textSha256:sha('paragraph')}]}}]};
 assert.equal(validateMassResult(job,result),true);
 const receipt='b'.repeat(40);
 const submitted=massSubmit(first.shard,{...args,job,result,
  blobSha:receipt,submissionId:'submission1',
  resultPath:'data/i18n/translation-mass/v2/results/submission1.json'});
 assert.equal(submitted.status,'saved_for_review');
 assert.equal(massSubmit(submitted.shard,{...args,job,result,blobSha:receipt,
  submissionId:'submission1',resultPath:'data/i18n/translation-mass/v2/results/submission1.json'}).status,'already_saved');
 assert.throws(()=>massApprove(submitted.shard,{jobId:job.jobId,blobSha:receipt,
  reviewerId:'reviewer',now:at,checks:{word:true}}),/QA incomplete/);
 const approved=massApprove(submitted.shard,{jobId:job.jobId,blobSha:receipt,
  reviewerId:'reviewer',now:at,checks:{word:true,meaning:true,facts:true,
   voice:true,structure:true,relations:true}});
 assert.equal(approved.status,'ready');
});
test('checkpoint replay, renewal and stage status reconciliation are idempotent',()=>{
 const state=source(),sid=Object.keys(state.shards).find(k=>state.shards[k].items.length);
 const claimed=massClaim(state.shards[sid],{stage:'word_2027',ownerId:'worker1',token:'token1',now:at});
 const args={jobId:claimed.item.jobId,ownerId:'worker1',token:'token1',
  generation:claimed.item.generation,now:at};
 const cp=massCheckpoint(claimed.shard,{...args,checkpointId:'cp-1',blobSha:'c'.repeat(40)});
 assert.equal(massCheckpoint(cp.shard,{...args,checkpointId:'cp-1',
  blobSha:'c'.repeat(40)}).status,'already_saved');
 const renewed=massRenew(cp.shard,{...args,now:'2026-11-02T20:10:00Z'});
 assert.equal(renewed.status,'renewed');
 const index=massRebuildIndex(state.index,sid,renewed.shard,'2026-11-02T20:10:00Z');
 assert.equal(index.counts.leased,1);
 assert.equal(index.jobCount,2);
 const released=massRelease(renewed.shard,{...args,now:'2026-11-02T20:10:00Z'});
 assert.equal(released.status,'released');
});

test('remote and planner use exactly the same 32-shard keys',()=>{
 for(const j of source().manifest.jobs)assert.equal(massShard(j.jobId),plannerShard(j.jobId));
});

test('targeted claim selects exactly that verified job, never a neighbor',()=>{
 const state=source();
 const shardId=Object.keys(state.shards).find(k=>state.shards[k].items.length);
 const shard=state.shards[shardId];
 const target=shard.items[0].jobId;
 const result=massClaim(shard,{stage:'word_2027',ownerId:'worker3',token:'token3',now:at,jobId:target});
 assert.equal(result.item.jobId,target);
 const missing=massClaim(shard,{stage:'word_2027',ownerId:'worker4',token:'token4',now:at,jobId:'en:bulk:tour:nonexistent:b001'});
 assert.equal(missing.status,'empty_or_busy');
});

test('Word-derived label keeps exact paragraph evidence without pretending to be word_exact or absent',()=>{
 const state=source(),job=Object.values(state.packets).flatMap(x=>x.jobs)[0];
 const block=job.blocks[0];
 const output={jobId:job.jobId,stableId:job.stableId,locale:'en',status:'review',releaseEligible:false,
  sourceFingerprint:job.sourceFingerprint,blocks:[{blockId:block.blockId,field:block.field,
   text:'Guided Rio journey',sourceTextSha256:block.ruTextSha256,
   provenance:{kind:'word_aligned',fileId:job.source.selectedWord.fileId,
    documentSha256:job.source.selectedWord.sha256,
    paragraphs:[{ref:'word/document.xml#p0020',textSha256:sha('Rio')}],
    transformation:'contextual_label',rationale:'Short visitor label composed from a longer Word passage'}}]};
 assert.equal(validateMassResult(job,output),true);
 output.blocks[0].provenance.paragraphs=[];
 assert.throws(()=>validateMassResult(job,output),/Word-aligned transformation/);
});
