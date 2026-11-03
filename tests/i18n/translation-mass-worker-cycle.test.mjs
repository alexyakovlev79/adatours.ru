import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_AUTOMATIC_CYCLES,MAX_INLINE_RETRIES,runEnMassWorkerCycle}
 from '../../scripts/i18n/translation-mass-worker-cycle.mjs';

const identity={ownerId:'one_translator',token:'stable_token'};
function fake(){
 const calls=[],state={completed:0,active:null,claimCount:0,submitCount:0,failSubmit:false,failClaim:false};
 const runner=async (_tools,_core,args)=>{
  calls.push({...args});
  if(args.action==='status')return{status:'snapshot',stage:'word_2027',
   enabled:true,translationMassLaunchAllowed:true,owner:{
    completed:state.completed,maxJobsPerOwner:60,activeJobId:state.active?.jobId||null}};
  if(args.action==='claim'){
   if(state.failClaim)return{status:'rate_limited',retryAfterMs:60000};
   if(state.active)return{status:'resumed',...state.active};
   state.claimCount++;
   state.active={jobId:'job_'+state.claimCount,generation:1,
    source:{jobId:'job_'+state.claimCount,blocks:[{text:'RU'}]},
    lease:{expiresAt:'2099-01-01T00:00:00Z'}};
   return{status:'claimed',...state.active};
  }
  if(args.action==='submit'){
   if(state.failSubmit)return{status:'rate_limited'};
   if(!state.active){
    if(args.submissionId===state.lastSubmissionId)return{status:'already_saved'};
    throw Error('Unexpected repeated submit');
   }
   assert.equal(args.jobId,state.active.jobId);
   state.submitCount++;
   state.completed++;
   state.lastSubmissionId=args.submissionId;
   state.active=null;
   return{status:'saved_for_review',commit:'b'.repeat(40),jobId:args.jobId};
  }
  throw Error('Unknown mocked action');
 };
 return {calls,state,runner};
}
test('one translator claims the next job only after commit and stops after exactly ten',async()=>{
 const f=fake();
 let current=await runEnMassWorkerCycle({}, {},f.runner,{action:'start',...identity});
 assert.equal(current.status,'next_claimed');
 for(let k=1;k<=MAX_AUTOMATIC_CYCLES;k++){
  const next=await runEnMassWorkerCycle({}, {},f.runner,{
   action:'finish',...identity,jobId:current.next.jobId,
   generation:current.next.generation,submissionId:'submission_'+k,
   result:{blocks:[{text:'an English translation'}]}});
  assert.equal(next.submission.status,'saved_for_review');
  assert.equal(next.completed,k);
  current=next;
  if(k<MAX_AUTOMATIC_CYCLES)assert.equal(current.status,'next_claimed');
  else assert.equal(current.status,'cycle_limit_reached');
 }
 assert.equal(f.state.claimCount,10);
 assert.equal(f.state.submitCount,10);
 assert.equal(f.calls.filter(x=>x.action==='claim').length,10);
 assert.equal((await runEnMassWorkerCycle({}, {},f.runner,{
  action:'start',...identity})).status,'cycle_limit_reached');
});

test('more than three temporary failures still acquire work, without changing identity',async()=>{
 const f=fake(),waits=[];let attempts=0;
 const runner=async(t,c,a)=>{
  if(a.action==='claim'&&attempts++<5){
   assert.equal(a.ownerId,identity.ownerId);assert.equal(a.token,identity.token);
   return{status:attempts%2?'transport_retryable':'cas_contention',retryAfterMs:5000};
  }
  return f.runner(t,c,a);
 };
 const out=await runEnMassWorkerCycle({}, {},runner,{action:'start',...identity},
  {sleep:async ms=>waits.push(ms),random:()=>0});
 assert.equal(out.status,'next_claimed');assert.equal(attempts,6);
 assert.equal(waits.length,5);assert.ok(waits.every(ms=>ms>=5000));
});

test('retry budget yields a continuation; the next call can submit the same result once',async()=>{
 const f=fake(),first=await runEnMassWorkerCycle({}, {},f.runner,{action:'start',...identity});
 const args={action:'finish',...identity,jobId:first.next.jobId,generation:1,
  submissionId:'unchanged_submission',result:{blocks:[{text:'Saved English'}]}};
 let attempts=0;
 const runner=async(t,c,a)=>{
  if(a.action==='submit'&&attempts++<MAX_INLINE_RETRIES){
   assert.equal(a.submissionId,args.submissionId);assert.equal(a.result,args.result);
   return{status:'transport_retryable',retryAfterMs:5000};
  }
  return f.runner(t,c,a);
 };
 const pending=await runEnMassWorkerCycle({}, {},runner,args,{sleep:async()=>{}});
 assert.equal(pending.status,'retry_pending');assert.equal(pending.resume.action,'finish');
 assert.equal(f.state.submitCount,0);assert.equal(f.state.claimCount,1);
 const saved=await runEnMassWorkerCycle({}, {},runner,args,{sleep:async()=>{}});
 assert.equal(saved.submission.status,'saved_for_review');assert.equal(f.state.submitCount,1);
});

test('busy queue is retried while stage drain requires confirmed zero counts',async()=>{
 const f=fake();let claims=0;
 const runner=async(t,c,a)=>a.action==='claim'&&claims++<4
  ?{status:'busy_or_empty',stageCounts:{queued:1,leased:5,retryable:0}}
  :f.runner(t,c,a);
 const out=await runEnMassWorkerCycle({}, {},runner,{action:'start',...identity},{sleep:async()=>{}});
 assert.equal(out.status,'next_claimed');assert.equal(claims,5);
 const drained=await runEnMassWorkerCycle({}, {},async(t,c,a)=>a.action==='claim'
  ?{status:'busy_or_empty',stageCounts:{queued:0,leased:0,retryable:0}}
  :f.runner(t,c,a),{action:'start',...identity},{sleep:async()=>assert.fail('No polling drained stage')});
 assert.equal(drained.status,'next_unavailable');assert.equal(drained.reason.status,'stage_drained');
});

test('rate limits return timed continuation and never sleep or retry immediately',async()=>{
 const f=fake();let claims=0;
 const out=await runEnMassWorkerCycle({}, {},async(t,c,a)=>a.action==='claim'
  ?(claims++,{status:'rate_limited',retryAfterMs:120000}):f.runner(t,c,a),
  {action:'start',...identity},{sleep:async()=>assert.fail('No hot rate-limit retry')});
 assert.equal(out.status,'retry_pending');assert.equal(out.retryAfterMs,120000);
 assert.equal(claims,1);assert.equal(out.resume.action,'start');
});

test('temporary status read failures are retried before a claim',async()=>{
 const f=fake();let reads=0;
 const out=await runEnMassWorkerCycle({}, {},async(t,c,a)=>a.action==='status'&&reads++<4
  ?{status:'transport_retryable'}:f.runner(t,c,a),
  {action:'start',...identity},{sleep:async()=>{}});
 assert.equal(out.status,'next_claimed');assert.equal(reads,5);
});
test('failed submit never claims another packet',async()=>{
 const f=fake();
 const first=await runEnMassWorkerCycle({}, {},f.runner,{action:'start',...identity});
 f.state.failSubmit=true;
 const out=await runEnMassWorkerCycle({}, {},f.runner,{
  action:'finish',...identity,jobId:first.next.jobId,
  generation:first.next.generation,submissionId:'submission_1',result:{}});
 assert.equal(out.status,'retry_pending');
 assert.equal(out.resume.action,'finish');
 assert.equal(f.state.claimCount,1);
 assert.equal(f.state.completed,0);
});
test('lost next-claim leaves committed receipt and start resumes without resubmitting',async()=>{
 const f=fake();
 const first=await runEnMassWorkerCycle({}, {},f.runner,{action:'start',...identity});
 f.state.failClaim=true;
 const out=await runEnMassWorkerCycle({}, {},f.runner,{
  action:'finish',...identity,jobId:first.next.jobId,
  generation:1,submissionId:'submission_1',result:{}});
 assert.equal(out.status,'retry_pending');
 assert.equal(out.resume.action,'start');
 assert.equal(out.submission.status,'saved_for_review');
 assert.equal(f.state.submitCount,1);
 f.state.failClaim=false;
 const next=await runEnMassWorkerCycle({}, {},f.runner,{action:'start',...identity});
 assert.equal(next.status,'next_claimed');
 assert.equal(f.state.claimCount,2);
 assert.equal(f.state.submitCount,1);
});
test('owner mismatch fails closed before claiming',async()=>{
 const f=fake();
 const bad=async()=>({status:'owner_token_conflict'});
 const v=await runEnMassWorkerCycle({}, {},bad,{action:'start',...identity});
 assert.equal(v.status,'next_blocked');
 assert.equal(f.state.claimCount,0);
});

test('bounded cycle retry uses identical submissionId on CAS contention',async()=>{
 const f=fake();
 const first=await runEnMassWorkerCycle({}, {},f.runner,{action:'start',...identity});
 let collisions=0;
 const runner=async(tools,core,args)=>{
  if(args.action==='submit'&&collisions++===0)return{status:'cas_contention',retryAfterMs:1};
  return f.runner(tools,core,args);
 };
 const out=await runEnMassWorkerCycle({}, {},runner,{
  action:'finish',...identity,jobId:first.next.jobId,generation:1,
  submissionId:'stable_submission_1',result:{blocks:[{text:'A translation'}]}});
 assert.equal(out.submission.status,'saved_for_review');
 assert.equal(f.state.submitCount,1);
 assert.equal(f.state.claimCount,2);
 assert.equal(collisions,2);
});

test('start reclaims the same unfinished assigned packet and exposes its saved checkpoint',async()=>{
 const f=fake(),first=await runEnMassWorkerCycle({}, {},f.runner,{action:'start',...identity});
 assert.equal(first.next.jobId,'job_1');
 f.state.active=null; // old lease was released, no completed submission
 let targeted=null;
 const runner=async(t,c,a)=>{
  if(a.action==='status'){
   const s=await f.runner(t,c,a);
   s.owner.resumeCandidateJobId='job_1';
   return s;
  }
  if(a.action==='claim'&&a.jobId==='job_1'){
   targeted=a.jobId;
   return{status:'claimed',jobId:'job_1',generation:2,
    source:{jobId:'job_1',blocks:[{text:'RU'}]},
    lease:{expiresAt:'2099-01-01T00:00:00Z'},
    checkpoint:{id:'four',format:'inline-v1',payload:{blocks:[{text:'partial EN'}]}}};
  }
  return f.runner(t,c,a);
 };
 const resumed=await runEnMassWorkerCycle({}, {},runner,{action:'start',...identity});
 assert.equal(targeted,'job_1');
 assert.equal(resumed.next.jobId,'job_1');
 assert.equal(resumed.next.generation,2);
 assert.equal(resumed.next.checkpoint.payload.blocks[0].text,'partial EN');
 assert.equal(f.state.claimCount,1);
});

