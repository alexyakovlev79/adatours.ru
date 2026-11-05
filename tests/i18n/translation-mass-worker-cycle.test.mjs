import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_AUTOMATIC_CYCLES,MAX_INLINE_RETRIES,runEnMassWorkerCycle as cycle}
 from '../../scripts/i18n/translation-mass-worker-cycle.mjs';
const credentials={ownerId:'translator_test',token:'fixed_token'};
function fake(){
 const calls=[];
 const state={completed:0,claimed:0,saved:0,active:null,denyClaim:null,denySubmit:null};
 const gateway=async(_t,_c,a)=>{
  calls.push(a);
  if(a.action==='status')return{status:'snapshot',stage:'word_2027',
   owner:{completed:state.completed,activeJobId:state.active?.jobId||null}};
  if(a.action==='claim'){
   if(state.denyClaim)return state.denyClaim;
   if(state.completed>=10)return{status:'cycle_limit_reached',completed:state.completed};
   if(state.active)return{status:'resumed',...state.active,
    owner:{completed:state.completed}};
   state.claimed++;
   state.active={jobId:'job_'+state.claimed,generation:1,
    source:{jobId:'job_'+state.claimed,blocks:[{text:'RU'}]},
    lease:{expiresAt:'2099-01-01T00:00:00Z'}};
   return{status:'claimed',...state.active,owner:{completed:state.completed}};
  }
  if(a.action==='submit'){
   if(state.denySubmit)return state.denySubmit;
   if(!state.active){
    if(state.submissionId===a.submissionId)return{status:'already_saved',
     owner:{completed:state.completed}};
    throw Error('Unexpected second submit');
   }
   assert.equal(a.jobId,state.active.jobId);
   state.saved++;state.completed++;state.submissionId=a.submissionId;
   state.active=null;
   return{status:'saved_for_review',commit:'a'.repeat(40),
    owner:{completed:state.completed}};
  }
  throw Error('Unsupported test action '+a.action);
 };
 return{state,calls,gateway};
}
test('ten sequential completed packets, no status polling or parallel job',async()=>{
 const f=fake();let job=await cycle({}, {},f.gateway,{action:'start',...credentials});
 for(let i=1;i<=10;i++){
  assert.equal(job.status,'next_claimed');
  job=await cycle({}, {},f.gateway,{action:'finish',...credentials,
   jobId:job.next.jobId,generation:job.next.generation,
   submissionId:'sub_'+i,result:{blocks:[{text:'English'}]}});
  assert.equal(job.submission.status,'saved_for_review');
  assert.equal(job.completed,i);
 }
 assert.equal(job.status,'cycle_limit_reached');
 assert.equal(f.state.saved,10);
 assert.equal(f.state.claimed,10);
 assert.equal(f.calls.filter(x=>x.action==='status').length,0);
 assert.equal(MAX_AUTOMATIC_CYCLES,10);
 assert.equal(MAX_INLINE_RETRIES,5);
});
test('claim retries with staggered pauses and continues without a new user turn',async()=>{
 const f=fake(),delays=[];let failures=2;
 const gateway=async(t,c,a)=>a.action==='claim'&&failures-->0
  ?{status:'transport_retryable',retryAfterMs:5000}:f.gateway(t,c,a);
 const result=await cycle({}, {},gateway,{action:'start',...credentials,
  wait:async ms=>delays.push(ms)});
 assert.equal(result.status,'next_claimed');
 assert.deepEqual(delays,[5000,5000]);
 assert.equal(f.state.claimed,1);
});
test('persistent contention is bounded and preserves a retryable resume',async()=>{
 const waits=[];let calls=0;
 const r=await cycle({}, {},async()=>{
  calls++;return{status:'cas_contention',retryAfterMs:7000};
 },{action:'start',...credentials,wait:async ms=>waits.push(ms)});
 assert.equal(r.status,'retry_pending');
 assert.equal(r.attemptsInCall,MAX_INLINE_RETRIES+1);
 assert.equal(r.resume.action,'start');
 assert.equal(calls,MAX_INLINE_RETRIES+1);
 assert.deepEqual(waits,Array(MAX_INLINE_RETRIES).fill(7000));
});
test('failed submit does not claim a second job or change submissionId',async()=>{
 const f=fake(),initial=await cycle({}, {},f.gateway,{action:'start',...credentials});
 f.state.denySubmit={status:'cas_contention',retryAfterMs:30000};
 const args={action:'finish',...credentials,jobId:initial.next.jobId,
  generation:1,submissionId:'same_submission',result:{blocks:[{text:'English'}]},
  wait:async()=>{}};
 const waiting=await cycle({}, {},f.gateway,args);
 assert.equal(waiting.status,'retry_pending');
 assert.equal(waiting.resume.action,'finish');
 assert.equal(waiting.resume.submissionId,'same_submission');
 assert.equal(waiting.attemptsInCall,MAX_INLINE_RETRIES+1);
 assert.equal(f.state.claimed,1);
 assert.equal(f.state.saved,0);
 f.state.denySubmit=null;
 const finished=await cycle({}, {},f.gateway,args);
 assert.equal(finished.submission.status,'saved_for_review');
 assert.equal(f.state.saved,1);
 assert.equal(f.state.claimed,2);
 assert.deepEqual(f.calls.filter(x=>x.action==='submit').map(x=>x.submissionId),
  Array(MAX_INLINE_RETRIES+2).fill('same_submission'));
});
test('after Git receipt, a failed next claim resumes by start only',async()=>{
 const f=fake(),initial=await cycle({}, {},f.gateway,{action:'start',...credentials});
 f.state.denyClaim={status:'rate_limited',retryAfterMs:3600000};
 const waiting=await cycle({}, {},f.gateway,{action:'finish',...credentials,
  jobId:initial.next.jobId,generation:1,submissionId:'first_done',result:{}});
 assert.equal(waiting.submission.status,'saved_for_review');
 assert.equal(waiting.status,'retry_pending');
 assert.equal(waiting.resume.action,'start');
 f.state.denyClaim=null;
 const resumed=await cycle({}, {},f.gateway,{action:'start',...credentials});
 assert.equal(resumed.status,'next_claimed');
 assert.equal(f.state.saved,1);
});
test('lost submit acknowledgement uses same submissionId and one stored result',async()=>{
 const f=fake();let first=true;const waits=[];
 const gateway=async(t,c,a)=>{
  if(a.action==='submit'&&first){first=false;await f.gateway(t,c,a);
   return{status:'transport_retryable',retryAfterMs:3000};}
  return f.gateway(t,c,a);
 };
 const initial=await cycle({}, {},gateway,{action:'start',...credentials});
 const r=await cycle({}, {},gateway,{action:'finish',...credentials,
  jobId:initial.next.jobId,generation:1,submissionId:'stable_receipt',
  result:{blocks:[{text:'English'}]},wait:async ms=>waits.push(ms)});
 assert.equal(r.submission.status,'already_saved');
 assert.equal(r.status,'next_claimed');
 assert.equal(f.state.saved,1);
 assert.deepEqual(waits,[3000]);
});
test('resumed work retains checkpoint and generation',async()=>{
 const f=fake();f.state.active={jobId:'unfinished_job',generation:3,
  checkpoint:{id:'four',payload:{blocks:[{text:'Saved English'}]}},
  lease:{expiresAt:'2099-01-01T00:00:00Z'}};
 const result=await cycle({}, {},f.gateway,{action:'start',...credentials});
 assert.equal(result.status,'next_claimed');
 assert.equal(result.next.resumed,true);
 assert.equal(result.next.generation,3);
 assert.equal(result.next.checkpoint.payload.blocks[0].text,'Saved English');
});
test('owner mismatch and stage drained do not start new work',async()=>{
 const mismatch=await cycle({}, {},async()=>({status:'owner_token_conflict'}),
  {action:'start',...credentials});
 assert.equal(mismatch.status,'next_unavailable');
 const exhausted=await cycle({}, {},async()=>({status:'busy_or_empty',
  stageCounts:{queued:0,leased:0,retryable:0}}),{action:'start',...credentials});
 assert.equal(exhausted.status,'stage_drained');
});
