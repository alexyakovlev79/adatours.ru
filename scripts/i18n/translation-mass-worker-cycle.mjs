/** Controlled hand-off for one Word-first EN translator conversation.
 * Each successful review-stage CAS submit immediately claims the next packet.
 * The translator writes the English text BETWEEN calls; this file never
 * fabricates translations, invokes a model or self-approves QA.
 */
export const MAX_AUTOMATIC_CYCLES=10;
const ID_OK=/^[a-zA-Z0-9_.:-]{3,200}$/;
const SAVED=new Set(['saved_for_review','already_saved']);

export async function runEnMassWorkerCycle(tools,core,remote,args={}){
 const {action,ownerId,token}=args;
 if(!['start','finish','status'].includes(action))
  throw Error('Unsupported EN mass worker-cycle action');
 if(!ID_OK.test(ownerId||'')||!ID_OK.test(token||''))
  throw Error('A stable per-chat ownerId and token are required');
 const call=data=>remote(tools,core,data);
 const withContentionRetry=async data=>{
  let out=await call(data);
  // Repeat exactly the same idempotent operation after a bounded pause.
  // Rate-limit responses are deliberately not retried here.
  if(out.status==='cas_contention'){
   await new Promise(resolve=>setTimeout(resolve,out.retryAfterMs||3000));
   out=await call(data);
  }
  return out;
 };
 const inspect=async()=>{
  const snapshot=await call({action:'status',ownerId,token});
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
  if(progress.blocked)return{status:'next_blocked',reason:progress.blocked};
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
   return{status:'next_unavailable',completed,limit:MAX_AUTOMATIC_CYCLES,
    reason:claimed};
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
 if(!SAVED.has(saved.status))return{status:'submit_not_confirmed',submission:saved};
 try{
  const followUp=await takeNext();
  return{...followUp,submission:saved};
 }catch(error){
  return{status:'submitted_next_pending',submission:saved,
   reason:String(error).slice(0,300),
   instruction:'Resume with action=start, same ownerId/token; do not resubmit with a new ID'};
 }
}
