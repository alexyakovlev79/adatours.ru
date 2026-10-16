import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publishSchemaGeoAll} from '../scripts/schema-geo-publisher.mjs';

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
  if(request.action==='resumePublication')return {status:'publication_requires_recovery',phase:'PUBLISHING',batchId:'batch-stuck'};
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
