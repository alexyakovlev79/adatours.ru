import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_AUTOMATIC_CYCLES,runEnMassWorkerCycle}
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
test('failed submit never claims another packet',async()=>{
 const f=fake();
 const first=await runEnMassWorkerCycle({}, {},f.runner,{action:'start',...identity});
 f.state.failSubmit=true;
 const out=await runEnMassWorkerCycle({}, {},f.runner,{
  action:'finish',...identity,jobId:first.next.jobId,
  generation:first.next.generation,submissionId:'submission_1',result:{}});
 assert.equal(out.status,'submit_not_confirmed');
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
 assert.equal(out.status,'next_unavailable');
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
