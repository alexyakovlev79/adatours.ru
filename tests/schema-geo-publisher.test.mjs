import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publishSchemaGeoAll} from '../scripts/schema-geo-publisher.mjs';
import * as core from '../scripts/schema-geo-core.mjs';
import {runSchemaGeo} from '../scripts/schema-geo-remote.mjs';

test('GEO master starts all 80 READY jobs with one CAS dispatch, no per-file GitHub calls',async()=>{
 const calls=[];
 const remote=async (_tools,_core,request)=>{
  calls.push(request.action);
  if(request.action==='resumePublication')return {status:'no_pending_deploy'};
  if(request.action==='beginPublication')return {
   status:'saved',commit:'a'.repeat(40),output:{jobs:Array.from({length:80},(_,i)=>({jobId:'job-'+i}))}
  };
  throw Error('Unexpected request '+request.action);
 };
 const result=await publishSchemaGeoAll({},null,remote,{
  batchId:'geo-80-one-batch',ownerId:'geo-master-test'
 });
 assert.equal(result.status,'queued_for_github_actions');
 assert.equal(result.jobs,80);
 assert.equal(result.stagingCommit,'a'.repeat(40));
 assert.deepEqual(calls,['resumePublication','beginPublication']);
});
test('GEO master can dispatch an existing PUBLISHING lock without creating another',async()=>{
 const calls=[];
 const remote=async(_tools,_core,request)=>{
  calls.push(request.action);
  if(request.action==='resumePublication')return {status:'publication_requires_recovery',phase:'PUBLISHING',batchId:'batch-stuck',ownerId:'original-owner'};
  if(request.action==='dispatchPublication')return {status:'saved',commit:'b'.repeat(40),output:{count:80}};
  throw Error('Unexpected request '+request.action);
 };
 const result=await publishSchemaGeoAll({},null,remote,{batchId:'batch-stuck',ownerId:'original-owner'});
 assert.equal(result.status,'queued_for_github_actions');
 assert.equal(result.jobs,80);
 assert.equal(result.recoveredPriorClaim,true);
 assert.deepEqual(calls,['resumePublication','dispatchPublication']);
});
test('pending deployment is never republished',async()=>{
 const calls=[];
 const remote=async(_tools,_core,request)=>{
  calls.push(request.action);
  return {status:'awaiting_deploy',batchId:'existing',commit:'c'.repeat(40)};
 };
 const result=await publishSchemaGeoAll({},null,remote,{batchId:'new-batch',ownerId:'geo-master'});
 assert.equal(result.status,'awaiting_existing_deploy');
 assert.deepEqual(calls,['resumePublication']);
});
test('addressed Word publication locks only explicit ready, synced jobs from that content commit',async()=>{
 const contentCommit='a'.repeat(40),now=Date.now();
 const jobs=['tour_current','destination_current','destination_backlog'].map((id,i)=>({
  jobId:'geo-'+(i?'destination':'tour')+'-'+id,stableId:id,kind:i?'destination':'tour',
  available:true,stage:i?2:3,sourceOrder:i+1,sourceFingerprint:'source-'+i
 }));
 const state={jobs:Object.fromEntries(jobs.map(j=>[j.jobId,{status:'READY',resultHash:'b'.repeat(64),
  resultPath:'data/geo-knowledge/results/'+j.jobId+'/result.json',geoSheetSync:{status:'SYNCED'},
  ...(j===jobs[0]?{wordRevisionCommit:contentCommit}:j===jobs[1]?{inlineCreationCommit:contentCommit}:{})}])),leases:{},publication:null};
 const selection={jobIds:jobs.slice(0,2).map(j=>j.jobId),contentCommit};
 const batch=core.beginPublication({jobs},state,{ownerId:'word-master',batchId:'word-batch',now,...selection});
 assert.equal(batch.jobs.length,2);assert.equal(state.jobs[jobs[2].jobId].status,'READY');
 assert.equal(batch.contentCommit,contentCommit);
 assert.equal(core.beginPublication({jobs},state,{ownerId:'word-master',batchId:'word-batch',now,...selection}),batch);
 assert.throws(()=>core.beginPublication({jobs},state,{ownerId:'word-master',batchId:'word-batch',now,
  jobIds:[jobs[0].jobId],contentCommit}),/already in progress/);
});
test('scoped publication rejects missing job, old commit, PENDING Sheets and empty scope before mutation',()=>{
 const contentCommit='a'.repeat(40),job={jobId:'geo-tour-tour_current',available:true,stage:3,sourceOrder:1};
 for(const change of [s=>{s.jobs[job.jobId].geoSheetSync.status='PENDING';},
  s=>{s.jobs[job.jobId].wordRevisionCommit='b'.repeat(40);},s=>{s.jobs[job.jobId].status='STALE';}]){
  const state={jobs:{[job.jobId]:{status:'READY',wordRevisionCommit:contentCommit,geoSheetSync:{status:'SYNCED'},
   resultHash:'c'.repeat(64),resultPath:'data/geo-knowledge/results/'+job.jobId+'/result.json'}},leases:{}};
  change(state);const before=structuredClone(state);
  assert.throws(()=>core.beginPublication({jobs:[job]},state,{jobIds:[job.jobId],contentCommit,now:1}));
  assert.deepEqual(state,before);
 }
 assert.throws(()=>core.geoPublicationScope({jobIds:[],contentCommit}),/unique/);
 assert.throws(()=>core.geoPublicationScope({jobIds:[job.jobId,job.jobId],contentCommit}),/unique/);
 const state={jobs:{},leases:{}};
 assert.throws(()=>core.beginPublication({jobs:[]},state,{jobIds:[job.jobId],contentCommit,now:1}),/not uniquely READY/);
});
test('addressed master does not recover or widen a different active publication',async()=>{
 const calls=[],selection={jobIds:['geo-tour-tour_current'],contentCommit:'a'.repeat(40)};
 const remote=async(_tools,_core,request)=>{
  calls.push(request);assert.deepEqual(request.jobIds,selection.jobIds);
  return {status:'scope_blocked_by_publication',batchId:'foreign-batch',phase:'PUBLISHING'};
 };
 const answer=await publishSchemaGeoAll({},core,remote,{...selection,ownerId:'word-master',batchId:'word-batch'});
 assert.equal(answer.status,'scope_blocked_by_publication');assert.equal(calls.length,1);
 assert.equal(calls[0].action,'resumePublication');
});
test('addressed master forwards its exact scope to the existing CAS dispatcher',async()=>{
 const calls=[],selection={jobIds:['geo-tour-tour_current'],contentCommit:'a'.repeat(40)};
 const remote=async(_tools,_core,request)=>{
  calls.push(request);assert.deepEqual(request.jobIds,selection.jobIds);assert.equal(request.contentCommit,selection.contentCommit);
  if(request.action==='resumePublication')return {status:'no_pending_deploy'};
  return {status:'saved',commit:'b'.repeat(40),output:{jobs:selection.jobIds.map(jobId=>({jobId}))}};
 };
 const answer=await publishSchemaGeoAll({},core,remote,{...selection,ownerId:'word-master',batchId:'word-batch'});
 assert.equal(answer.jobs,1);assert.deepEqual(answer.jobIds,selection.jobIds);
 assert.deepEqual(calls.map(r=>r.action),['resumePublication','beginPublication']);
});
test('remote scoped recovery never mutates a different publication and is idempotent after its own deploy',async()=>{
 const request={action:'resumePublication',jobIds:['geo-tour-tour_current'],contentCommit:'a'.repeat(40)};
 const publication={status:'PUBLISHING',batchId:'different-word',ownerId:'another-master',
  contentCommit:'b'.repeat(40),jobs:[{jobId:'geo-tour-tour_other'}]};
 const state={publication,jobs:{},leases:{},publications:[]};
 let writes=0;
 const write=async()=>{writes++;throw Error('No write expected');};
 const tools={
  async mcp__GitHub__fetch({url}){
   return {result:{content:JSON.stringify(url.includes('/git/ref/')?{object:{sha:'c'.repeat(40)}}:{tree:{sha:'d'.repeat(40)}})}};
  },
  async mcp__GitHub__fetch_file(){return {result:{content:JSON.stringify(state)}};},
  mcp__GitHub__create_tree:write,mcp__GitHub__create_commit:write,mcp__GitHub__update_ref:write
 };
 assert.equal((await runSchemaGeo(tools,core,request)).status,'scope_blocked_by_publication');
 Object.assign(publication,{status:'PUBLISHED',contentCommit:request.contentCommit,jobs:request.jobIds.map(jobId=>({jobId})),
  commit:'e'.repeat(40),runUrl:'https://github.com/run/exact'});
 assert.equal((await runSchemaGeo(tools,core,request)).status,'scope_already_published');
 assert.equal(writes,0);
});
