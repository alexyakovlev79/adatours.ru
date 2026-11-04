import test from 'node:test';
import assert from 'node:assert/strict';
import {runEnMassTranslation} from '../../scripts/i18n/translation-mass-remote.mjs';
import * as core from '../../scripts/i18n/translation-mass-core.mjs';

test('lost update_ref response confirms committed head without a second mutation',async()=>{
 const jobId='en:bulk:tour:test:b001',sid=core.massShard(jobId);
 const ownerId='worker_one',token='stable_token',time='2026-11-03T21:00:00Z';
 const shard={schemaVersion:2,shardId:sid,items:[{jobId,stage:'word_2027',
  status:'leased',sourceFingerprint:'fingerprint',generation:1,attempts:0,
  lease:{ownerId,token,expiresAt:'2026-11-03T22:00:00Z'}}]};
 const index={schemaVersion:2,pilotOnly:false,publicationEnabled:false,
  dispatcherEnabled:true,translationMassLaunchAllowed:true,stage:'word_2027',
  jobCount:1,shards:{[sid]:core.massShardSummary(shard)},
  activeOwners:{[ownerId]:{jobId,token,expiresAt:'2026-11-03T22:00:00Z'}}};
 let head='a'.repeat(40),mutations=0,files;
 const next='b'.repeat(40);
 const ok=x=>({result:x});
 const mock={
  mcp__GitHub__fetch:async({url})=>ok({content:JSON.stringify(url.includes('/git/commits/')
   ?{tree:{sha:'c'.repeat(40)}}:{object:{sha:head}})}),
  mcp__GitHub__fetch_file:async({path})=>ok(path.startsWith('src/content/')
   ?{sha:'d'.repeat(40),content:'RU'}:{content:JSON.stringify(path.endsWith('/index.json')
    ?index:path.includes('/state/')?shard:{shardId:sid,jobs:[{jobId,
     sourceFingerprint:'fingerprint',source:{contentPath:'src/content/tours/test.md',
      sourceBlobSha:'d'.repeat(40)}}]})}),
  mcp__GitHub__create_tree:async a=>{files=a.tree_elements;return ok({sha:'e'.repeat(40)})},
  mcp__GitHub__create_commit:async()=>ok({sha:next}),
  mcp__GitHub__update_ref:async a=>{
   assert.equal(a.force,false);assert.equal(a.expected_sha,head);
   mutations++;head=next;throw Error('GithubGraphQLAPIError: internal server error');
  }
 };
 const out=await runEnMassTranslation(mock,core,{action:'renew',ownerId,token,
  jobId,generation:1,now:time});
 assert.equal(out.status,'renewed');assert.equal(out.commit,next);assert.equal(mutations,1);
 assert.equal(files.length,2);
 assert.equal(JSON.parse(files.find(x=>x.path.endsWith('/index.json')).content)
  .activeOwners[ownerId].expiresAt,'2026-11-03T22:30:00.000Z');
});
test('GitHub transport and internal GraphQL errors are resumable, not external job blockers',async()=>{
 for(const message of ['GithubGraphQLAPIError: Something went wrong executing query',
  'Transport closed','RemoteProtocolError: Server disconnected without sending a response.',
  '503 Service unavailable','ECONNRESET']){
  const out=await runEnMassTranslation({mcp__GitHub__fetch:async()=>{throw Error(message)}},
   {},{action:'claim',ownerId:'worker_one',token:'stable_token'});
  assert.equal(out.status,'transport_retryable');assert.equal(out.retryable,true);
 }
});
test('permission failures are not silently retried and 429 is a timed continuation',async()=>{
 const mock=message=>({mcp__GitHub__fetch:async()=>{throw Error(message)}});
 await assert.rejects(runEnMassTranslation(mock('403 Forbidden: permission denied'),{},
  {action:'claim',ownerId:'worker_one',token:'stable_token'}),/permission denied/);
 const limited=await runEnMassTranslation(mock('429 too many requests'),{},
  {action:'claim',ownerId:'worker_one',token:'stable_token'});
 assert.equal(limited.status,'rate_limited');assert.equal(limited.retryAfterMs,3600000);
});
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

test('checkpoint action is disabled before any GitHub API call',async()=>{
 let calls=0;
 const tools={mcp__GitHub__fetch:async()=>{calls++;throw Error('Must not read GitHub');}};
 await assert.rejects(runEnMassTranslation(tools,core,{action:'checkpoint',
  ownerId:'worker_local',token:'stable_token',jobId:'en:bulk:tour:test:b001',
  checkpointId:'after_four',checkpoint:{blocks:[{text:'draft'}]}}),
  /Unsupported worker action/);
 assert.equal(calls,0);
});
