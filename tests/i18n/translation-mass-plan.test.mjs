import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {planTourTranslation,createMassTranslationState,MASS_BLOCKS_PER_JOB,massShard}
 from '../../src/lib/i18n/translation-mass-plan.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const git='a'.repeat(40);
function sample(id='tour_test',year='selected_2027',size=17,done=[]){
 const slots=Array.from({length:size},(_,i)=>({path:'/route/'+i,field:'itinerary.label',
  text:'Экскурсия '+i}));
 const map={entityId:id,entityType:'tour',sourceContentPath:'src/content/tours/x.md',
  ruBlobSha256:sha('source'),
  paths:slots.map((v,i)=>({...v,blockId:'block:'+i,dependsOn:[]}))};
 const match={entityId:id,sourceFingerprint:'git:source:'+id,outcome:year,
  selectedSource:year==='not_found_both'?undefined:{driveFileId:'word-file',
   sourceSha256:sha('word'),sourceYearFolder:year==='selected_2026'?2026:2027}};
 return planTourTranslation({id,map,slots,contentSha256:sha('source'),
  sourceBlobSha:git,match,pilotReady:done});
}
test('full Tour creates bounded 8-block packets without any content being translated',()=>{
 const x=sample(),job=x.jobs[0];
 assert.equal(x.jobs.length,3);
 assert.equal(x.jobs.reduce((n,j)=>n+j.blocks.length,0),17);
 assert.equal(job.blocks.length,MASS_BLOCKS_PER_JOB);
 assert.equal(job.source.selectedWord.sha256,sha('word'));
 assert.equal(job.releaseEligible,false);
 assert.equal(job.blocks[0].ruText,'Экскурсия 0');
 assert.equal(x.stage,'word_2027');
});
test('approved pilot blocks are skipped; no duplicate translation of their stable IDs',()=>{
 const x=sample('tour_test','selected_2027',17,['block:0','block:1']);
 assert.equal(x.reusedReady,2);
 assert.equal(x.queuedBlocks,15);
 assert.equal(x.jobs[0].blocks[0].blockId,'block:2');
 assert.equal(x.jobs.length,2);
 assert.throws(()=>sample('tour_test','selected_2027',17,['unknown']),/pilot block not in/);
});
test('2026 and AI-only jobs are held until their independent stages open',()=>{
 const rows=[sample('tour_2027'),sample('tour_2026','selected_2026'),
   sample('tour_ai','not_found_both')];
 const state=createMassTranslationState(rows,{sourceCommit:git,matchingCommit:git,
  pilotCommit:git});
 assert.equal(state.index.tourCount,3);
 assert.deepEqual(state.index.stageCounts.word_2027.queued,3);
 assert.equal(state.index.stageCounts.word_2026.held,3);
 assert.equal(state.index.stageCounts.ai_only.held,3);
 assert.equal(state.index.publicationEnabled,false);
 assert.equal(state.index.dispatcherEnabled,false);
 assert.equal(state.index.jobCount,9);
 assert.equal(state.manifest.remainingBlocks,51);
 assert.equal(state.index.maxJobsPerOwner,60);
});
test('missing selected Word, drifted content and wrong maps cannot enter queue',()=>{
 const options=sample();
 assert.equal(options.sourceSha256,undefined);
 const slots=[{path:'/title',field:'title',text:'Тур'}];
 const map={entityId:'tour_test',entityType:'tour',sourceContentPath:'src/content/tours/t.md',
  ruBlobSha256:sha('old'),paths:[{path:'/title',field:'title',blockId:'x'}]};
 assert.throws(()=>planTourTranslation({id:'tour_test',map,slots,
  contentSha256:sha('new'),sourceBlobSha:git,
  match:{entityId:'tour_test',sourceFingerprint:'git:x',outcome:'not_found_both'}}),
  /stale RU source/);
 const x=sample();
 assert.notEqual(massShard(x.jobs[0].jobId).length,0);
});
test('different source/revision yields different work fingerprint',()=>{
 const a=sample(),b=sample();
 assert.equal(a.jobs[0].sourceFingerprint,b.jobs[0].sourceFingerprint);
 assert.throws(()=>createMassTranslationState([a,a],
  {sourceCommit:git,matchingCommit:git,pilotCommit:git}),/duplicate Tour/);
});
