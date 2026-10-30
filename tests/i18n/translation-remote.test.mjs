import test from 'node:test';
import assert from 'node:assert/strict';
import {runEnTranslation} from '../../scripts/i18n/translation-remote.mjs';
test('remote is restricted to explicitly supported pilot branches and no worker can publish',async()=>{
 const core={};
 await assert.rejects(runEnTranslation({},core,{action:'status',
  branch:'main'}),/not allowlisted/);
 await assert.rejects(runEnTranslation({},core,{action:'approve',
  branch:'i18n/translation-smoke-20261030'}),/Unsupported translator action/);
});
test('remote status returns one compact index snapshot without shard scans',async()=>{
 let called=[];
 const mock={mcp__GitHub__fetch:async a=>{
  called.push('fetch');return{result:{content:JSON.stringify({object:{sha:'a'.repeat(40)}})}};
 },mcp__GitHub__fetch_file:async a=>{
  called.push(a.path);return{result:{content:JSON.stringify({
   schemaVersion:1,dispatcherEnabled:false,pilotOnly:true,publicationEnabled:false,
   counts:{queued:5},activeOwners:{},updatedAt:'2026-10-30T00:00:00Z'})}};
 }};
 const r=await runEnTranslation(mock,{},{
  action:'status',branch:'i18n/translation-smoke-20261030',now:'2026-10-30T10:00:00Z'});
 assert.equal(r.status,'snapshot');assert.equal(r.enabled,false);
 assert.deepEqual(called,['fetch','data/i18n/translation/v1/index.json']);
});
test('remote claim stays closed until explicit pilot enablement',async()=>{
 const mock={mcp__GitHub__fetch:async()=>({result:{content:JSON.stringify({object:{sha:'a'.repeat(40)}})}}),
 mcp__GitHub__fetch_file:async()=>({result:{content:JSON.stringify({
  schemaVersion:1,dispatcherEnabled:false,pilotOnly:true,publicationEnabled:false,
  counts:{queued:5}})}})};
 const r=await runEnTranslation(mock,{},{
  action:'claim',branch:'i18n/translation-smoke-20261030',
  ownerId:'worker-one',token:'token-one',now:'2026-10-30T10:00:00Z'});
 assert.equal(r.status,'gate_closed');
});
