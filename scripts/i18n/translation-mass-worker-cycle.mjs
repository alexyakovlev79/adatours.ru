/** Controlled hand-off for one Word-first EN translator conversation.
 * Each successful review-stage CAS submit immediately claims the next packet.
 * The translator writes the English text BETWEEN calls; this file never
 * fabricates translations, invokes a model or self-approves QA.
 */
export const MAX_AUTOMATIC_CYCLES=10;
export const MAX_INLINE_RETRIES=12;
const ID_OK=/^[a-zA-Z0-9_.:-]{3,200}$/;
const SAVED=new Set(['saved_for_review','already_saved']);

export async function runEnMassWorkerCycle(tools,core,remote,args={},runtime={}){
 const {action,ownerId,token}=args;
 if(!['start','finish','status'].includes(action))
  throw Error('Unsupported EN mass worker-cycle action');
 if(!ID_OK.test(ownerId||'')||!ID_OK.test(token||''))
  throw Error('A stable per-chat ownerId and token are required');
 const call=data=>remote(tools,core,data);
 const sleep=runtime.sleep||((ms)=>new Promise(resolve=>setTimeout(resolve,ms)));
 const random=runtime.random||Math.random;
 const continuation=action=>({action,ownerId,token,
  instruction:action==='finish'
   ?'Retry original finish with identical jobId, generation, submissionId and result; keep checkpoint and lease'
   :'Retry start with the same ownerId/token; do not stop this conversation for a temporary failure'});
 const withContentionRetry=async data=>{
  let out;
  for(let attempt=0;attempt<MAX_INLINE_RETRIES;attempt++){
   out=await call(data);
   // 429 is a timed continuation for the caller, never a hot loop here.
   if(out.status==='rate_limited')return{...out,retryable:true,
    retryAfterMs:Math.max(60000,out.retryAfterMs||0)};
   const busy=out.status==='busy_or_empty';
   const counts=out.stageCounts;
   const exhausted=busy&&counts&&
    ['queued','leased','retryable'].every(k=>counts[k]===0);
   if(exhausted)return{...out,status:'stage_drained'};
   const retry=['cas_contention','transport_retryable'].includes(out.status)||busy||
    (data.action==='claim'&&out.status==='stale_source');
   if(!retry)return out;
   if(attempt===MAX_INLINE_RETRIES-1)return{...out,retryable:true,
    retryAfterMs:Math.max(5000,out.retryAfterMs||0),attempts:MAX_INLINE_RETRIES};
   const waitMs=Math.max(out.retryAfterMs||0,
    Math.min(30000,2000*2**attempt)+Math.floor(random()*1000));
   if(runtime.onRetry)await runtime.onRetry({action:data.action,attempt:attempt+1,
    status:out.status,retryAfterMs:waitMs});
   await sleep(waitMs);
  }
  return out;
 };
 const inspect=async()=>{
  const snapshot=await withContentionRetry({action:'status',ownerId,token});
  if(snapshot.status!=='snapshot')return{blocked:snapshot};
  if(snapshot.enabled!==true||snapshot.translationMassLaunchAllowed!==true)
   return{blocked:{status:'gate_closed',stage:snapshot.stage,head:snapshot.head}};
  if(!snapshot.owner||!Number.isInteger(snapshot.owner.completed)||
     snapshot.owner.completed<0||snapshot.owner.completed>snapshot.owner.maxJobsPerOwner)
   throw Error('Missing trusted Git-backed owner completion count');
  return{snapshot,completed:snapshot.owner.completed};
 };
 const takeNext=async()=>{
  const progress=await inspect();
  if(progress.blocked)return{status:progress.blocked.retryable?'retry_pending':'next_blocked',
   reason:progress.blocked,...(progress.blocked.retryable?
    {retryable:true,retryAfterMs:progress.blocked.retryAfterMs,resume:continuation('start')}:{})};
  const completed=progress.completed;
  if(completed>=MAX_AUTOMATIC_CYCLES)
   return{status:'cycle_limit_reached',completed,limit:MAX_AUTOMATIC_CYCLES};
  // After an interrupted or released lease, recover the same unfinished
  // packet first. Fall back to normal selection if another worker owns it.
  const candidate=progress.snapshot.owner.resumeCandidateJobId;
  let claimed=candidate
   ?await withContentionRetry({action:'claim',ownerId,token,jobId:candidate})
   :await withContentionRetry({action:'claim',ownerId,token});
  if(candidate&&['busy_or_empty','requested_job_not_available','stale_source']
     .includes(claimed.status))
   claimed=await withContentionRetry({action:'claim',ownerId,token});
  if(!['claimed','resumed'].includes(claimed.status))
   return{status:claimed.retryable?'retry_pending':'next_unavailable',completed,
    limit:MAX_AUTOMATIC_CYCLES,reason:claimed,...(claimed.retryable?
     {retryable:true,retryAfterMs:claimed.retryAfterMs,resume:continuation('start')}:{})};
  return{status:'next_claimed',completed,limit:MAX_AUTOMATIC_CYCLES,
   next:{jobId:claimed.jobId,source:claimed.source,
    generation:claimed.generation,lease:claimed.lease,
    commit:claimed.commit||null,resumed:claimed.status==='resumed',
    checkpoint:claimed.checkpoint||null}};
 };
 if(action==='status'){
  const progress=await inspect();
  return progress.blocked??{status:'cycle_status',completed:progress.completed,
   limit:MAX_AUTOMATIC_CYCLES,activeJobId:progress.snapshot.owner.activeJobId,
   stage:progress.snapshot.stage,head:progress.snapshot.head};
 }
 if(action==='start')return takeNext();
 // Only a persisted submit receipt (including an idempotent replay) permits
 // another claim. A transient failure after that receipt must never conceal it.
 const saved=await withContentionRetry({...args,action:'submit'});
 if(!SAVED.has(saved.status))return{status:saved.retryable?'retry_pending':'submit_not_confirmed',
  submission:saved,...(saved.retryable?{retryable:true,retryAfterMs:saved.retryAfterMs,
   resume:continuation('finish')}:{})};
 try{
  const followUp=await takeNext();
  return{...followUp,submission:saved};
 }catch(error){
  return{status:'submitted_next_pending',submission:saved,
   reason:String(error).slice(0,300),
   instruction:'Resume with action=start, same ownerId/token; do not resubmit with a new ID'};
 }
}

