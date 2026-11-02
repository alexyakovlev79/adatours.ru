import test from 'node:test';
import assert from 'node:assert/strict';
import {runEnMassTranslation} from '../../scripts/i18n/translation-mass-remote.mjs';
test('bulk connector rejects any QA/publish action without touching GitHub',async()=>{
 await assert.rejects(runEnMassTranslation({}, {},{action:'approve'}),/Unsupported worker action/);
 await assert.rejects(runEnMassTranslation({}, {},{action:'publish'}),/Unsupported worker action/);
});
test('disabled bulk queue status is read-only and claims return gate_closed',async()=>{
 const read=[];
 const mock={
  mcp__GitHub__fetch:async a=>{read.push('head');return{result:{content:JSON.stringify({
   object:{sha:'a'.repeat(40)}})}}},
  mcp__GitHub__fetch_file:async a=>{read.push(a.path);return{result:{content:JSON.stringify({
   schemaVersion:2,jobCount:4006,tourCount:353,stage:'word_2027',
   pilotOnly:false,publicationEnabled:false,dispatcherEnabled:false,
   translationMassLaunchAllowed:false,counts:{queued:2411,held:1595},
   stageCounts:{word_2027:{queued:2411}},activeOwners:{},sourceCommit:'a'.repeat(40)
  })}}}
 };
 const status=await runEnMassTranslation(mock,{}, {action:'status',now:'2026-11-02T20:00:00Z'});
 assert.equal(status.status,'snapshot');
 assert.equal(status.jobCount,4006);
 const claim=await runEnMassTranslation(mock,{}, {action:'claim',
  ownerId:'worker_one',token:'stable_token',now:'2026-11-02T20:00:00Z'});
 assert.equal(claim.status,'gate_closed');
 assert.deepEqual(read,['head','data/i18n/translation-mass/v2/index.json',
  'head','data/i18n/translation-mass/v2/index.json']);
});
