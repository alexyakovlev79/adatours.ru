/** One worker conversation: claim one packet, submit it, then claim the next.
 * Same flow as Ada Tours SEO/GEO writer and voice-rewrite writer.
 */
export const MAX_AUTOMATIC_CYCLES=10;
export const MAX_INLINE_RETRIES=5;
const ID=/^[a-zA-Z0-9_.:-]{3,200}$/;
const SAVED=new Set(['saved_for_review','already_saved']);
const RETRY=new Set(['rate_limited','cas_contention','transport_retryable']);
export async function runEnMassWorkerCycle(tools,core,remote,args={}){
 const {action,ownerId,token}=args;
 if(!['start','finish','status'].includes(action))throw Error('Unknown worker-cycle action');
 if(!ID.test(ownerId||'')||!ID.test(token||''))throw Error('Stable ownerId/token required');
 const call=options=>remote(tools,core,options);
 const pause=typeof args.wait==='function'?args.wait:
  ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const jitter=()=>3000+Math.floor(Math.random()*27001);
 // Finite retry budget: only CAS/temporary transport errors, never 429.
 const withRetries=async options=>{
  for(let attempt=0;attempt<=MAX_INLINE_RETRIES;attempt++){
   const r=await call(options);
   if(!['cas_contention','transport_retryable'].includes(r.status))return r;
   if(attempt===MAX_INLINE_RETRIES)return{...r,attemptsInCall:attempt+1};
   const ms=Number.isInteger(r.retryAfterMs)&&r.retryAfterMs>=3000&&
    r.retryAfterMs<=30000?r.retryAfterMs:jitter();
   await pause(ms);
  }
 };
 const resume=kind=>kind==='finish'
  ?{action:kind,ownerId,token,jobId:args.jobId,
    generation:args.generation,submissionId:args.submissionId}
  :{action:kind,ownerId,token};
 const waiting=(r,kind)=>({status:'retry_pending',reason:r,
  retryAfterMs:r.retryAfterMs||jitter(),retryable:true,
  attemptsInCall:r.attemptsInCall||1,resume:resume(kind)});
 const take=async()=>{
  let r=await withRetries({action:'claim',ownerId,token});
  if(r.status==='requested_job_not_available')
   r=await withRetries({action:'claim',ownerId,token,skipResume:true});
  if(['cycle_limit_reached','owner_quota_reached'].includes(r.status))
   return{status:'cycle_limit_reached',completed:r.completed,limit:MAX_AUTOMATIC_CYCLES};
  if(RETRY.has(r.status))return waiting(r,'start');
  if(['claimed','resumed'].includes(r.status)){
   if(!Number.isInteger(r.owner?.completed))throw Error('Missing confirmed completed count');
   return{status:'next_claimed',completed:r.owner.completed,limit:MAX_AUTOMATIC_CYCLES,
    next:{jobId:r.jobId,source:r.source,generation:r.generation,
     lease:r.lease,checkpoint:r.checkpoint||null,resumed:r.status==='resumed',
     commit:r.commit||null}};
  }
  const counts=r.stageCounts;
  const drained=r.status==='busy_or_empty'&&counts&&
   ['queued','leased','retryable'].every(k=>counts[k]===0);
  return{status:drained?'stage_drained':'next_unavailable',reason:r,
   completed:r.owner?.completed||0,limit:MAX_AUTOMATIC_CYCLES};
 };
 if(action==='status'){
  const s=await call({action:'status',ownerId,token});
  return s.status==='snapshot'?{status:'cycle_status',completed:s.owner?.completed||0,
   limit:MAX_AUTOMATIC_CYCLES,activeJobId:s.owner?.activeJobId||null,
   stage:s.stage,head:s.head}:s;
 }
 if(action==='start')return take();
 // A second claim is allowed only after the immutable Git result is confirmed.
 const {wait:_testWait,...submitArgs}=args;
 const saved=await withRetries({...submitArgs,action:'submit'});
 if(!SAVED.has(saved.status))return RETRY.has(saved.status)
  ?{...waiting(saved,'finish'),submission:saved}
  :{status:'submit_not_confirmed',submission:saved};
 if(saved.owner?.completed>=MAX_AUTOMATIC_CYCLES)
  return{status:'cycle_limit_reached',completed:saved.owner.completed,
   limit:MAX_AUTOMATIC_CYCLES,submission:saved};
 try{
  const following=await take();
  return{...following,submission:saved};
 }catch(e){
  return{status:'submitted_next_pending',submission:saved,
   reason:String(e).slice(0,250),resume:resume('start')};
 }
}
