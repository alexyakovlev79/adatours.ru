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

test('bulk owner status exposes only verified progress for the matching stable token',async()=>{
 const index={schemaVersion:2,jobCount:4006,tourCount:353,stage:'word_2027',
  pilotOnly:false,publicationEnabled:false,dispatcherEnabled:true,
  translationMassLaunchAllowed:true,maxJobsPerOwner:60,
  counts:{queued:2410},stageCounts:{word_2027:{queued:2410}},
  ownerAssignments:{worker_1:{token:'token_1',jobIds:['job1','job2'],completedJobIds:['job1']}},
  activeOwners:{worker_1:{jobId:'job2',expiresAt:'2026-11-04T00:00:00Z'}}};
 const tools={mcp__GitHub__fetch:async()=>({result:{content:JSON.stringify({object:{sha:'a'.repeat(40)}})}}),
  mcp__GitHub__fetch_file:async()=>({result:{content:JSON.stringify(index)}})};
 const status=await runEnMassTranslation(tools,{}, {action:'status',ownerId:'worker_1',token:'token_1',now:'2026-11-03T18:00:00Z'});
 assert.equal(status.owner.completed,1);
 assert.equal(status.owner.activeJobId,'job2');
 assert.equal(status.owner.maxJobsPerOwner,60);
 const mismatch=await runEnMassTranslation(tools,{}, {action:'status',ownerId:'worker_1',token:'wrong_token'});
 assert.equal(mismatch.status,'owner_token_conflict');
});

test('checkpoint survives a lost GitHub reply via one-file shard CAS, without rewriting global index',async()=>{
 const {massShard,massCheckpoint}=await import('../../scripts/i18n/translation-mass-core.mjs');
 const jobId='en:bulk:tour:test:b001',sid=massShard(jobId);
 const ownerId='worker_local',token='stable_token',time='2026-11-03T21:00:00Z';
 const item={jobId,stage:'word_2027',status:'leased',sourceFingerprint:'test-fingerprint',
  generation:1,attempts:0,lease:{ownerId,token,claimedAt:time,
   expiresAt:'2026-11-03T22:30:00Z'}};
 const index={schemaVersion:2,pilotOnly:false,publicationEnabled:false,
  dispatcherEnabled:true,translationMassLaunchAllowed:true,stage:'word_2027',
  maxJobsPerOwner:60,ownerAssignments:{[ownerId]:{token,jobIds:[jobId],completedJobIds:[]}},
  activeOwners:{[ownerId]:{jobId,token,expiresAt:item.lease.expiresAt,generation:1}},
  counts:{leased:1},shards:{}};
 let stateText=JSON.stringify({schemaVersion:2,shardId:sid,items:[item]});
 let stateSha='a'.repeat(40),writes=0,treeWrites=0;
 const mock={
  mcp__GitHub__fetch:async()=>({result:{content:JSON.stringify({object:{sha:'b'.repeat(40)}})}}),
  mcp__GitHub__fetch_file:async({path})=>{
   if(path.endsWith('/index.json'))return{result:{content:JSON.stringify(index),sha:'c'.repeat(40)}};
   if(path.endsWith('/state/'+sid+'.json'))return{result:{content:stateText,sha:stateSha}};
   if(path.endsWith('/jobs/'+sid+'.json'))return{result:{content:JSON.stringify({
    shardId:sid,jobs:[{jobId,sourceFingerprint:item.sourceFingerprint,
     source:{contentPath:'src/content/tours/test.md',sourceBlobSha:'d'.repeat(40)}}]})}};
   return{result:{content:'RU',sha:'d'.repeat(40)}};
  },
  mcp__GitHub__create_tree:async()=>{treeWrites++;throw Error('Tree writes forbidden for checkpoints')},
  mcp__GitHub__update_file:async({path,sha,content,branch})=>{
   assert.equal(path,'data/i18n/translation-mass/v2/state/'+sid+'.json');
   assert.equal(branch,'i18n/translation-mass-staging');
   assert.equal(sha,stateSha);
   writes++;stateText=content;stateSha='e'.repeat(40);
   throw Error('409 Conflict: response lost after successful file update');
  }
 };
 const result=await runEnMassTranslation(mock,{massShard,massCheckpoint},
  {action:'checkpoint',ownerId,token,jobId,generation:1,
   checkpointId:'local-four',checkpoint:{blocks:[{text:'Recovered'}]},now:time});
 assert.equal(result.status,'already_saved');
 assert.equal(writes,1);
 assert.equal(treeWrites,0);
 assert.equal(JSON.parse(stateText).items[0].checkpoint.payload.blocks[0].text,'Recovered');
});
