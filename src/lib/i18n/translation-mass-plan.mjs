/** Deterministic bulk EN queue plans. No translated text is invented here.
 * Each source block is owned once; Word evidence is read only by its worker.
 * Stage gates and worker CAS are independent of the old three-Tour pilot.
 */
import {createHash} from 'node:crypto';

export const MASS_STAGES=Object.freeze(['word_2027','word_2026','ai_only']);
export const MASS_STATES=Object.freeze(['held','queued','leased','review','ready','retryable',
 'blocked_external','stale_source','failed_final']);
export const MASS_SHARDS=16;
export const MASS_BLOCKS_PER_JOB=8;
const SHA=/^[a-f0-9]{64}$/,GIT_SHA=/^[a-f0-9]{40}$/;
const validId=s=>typeof s==='string'&&/^[a-zA-Z0-9_.:-]+$/.test(s);
const check=(condition,reason)=>{if(!condition)throw Error('EN mass plan: '+reason)};
export const sha256=value=>createHash('sha256').update(value).digest('hex');
const hashObject=value=>sha256(JSON.stringify(value));
export function massShard(jobId){
 check(validId(jobId),'invalid shard key');
 let h=2166136261;for(let i=0;i<jobId.length;i++){h^=jobId.charCodeAt(i);h=Math.imul(h,16777619)}
 return ((h>>>0)%MASS_SHARDS).toString(16).padStart(2,'0');
}
export function stageOf(outcome){
 const stage={selected_2027:'word_2027',selected_2026:'word_2026',not_found_both:'ai_only'}[outcome];
 check(Boolean(stage),'unsupported matching decision '+String(outcome));
 return stage;
}
/** Build all packets for exactly one verified, still-current canonical Tour. */
export function planTourTranslation({id,map,slots,contentSha256,sourceBlobSha,match,pilotReady=[]}){
 check(validId(id)&&id.startsWith('tour_'),'invalid stable Tour ID');
 check(map?.entityId===id&&map.entityType==='tour'&&Array.isArray(map.paths),
  id+' missing stable block map');
 check(contentSha256===map.ruBlobSha256&&SHA.test(contentSha256),'stale RU source '+id);
 check(GIT_SHA.test(sourceBlobSha),'missing RU Git blob for '+id);
 check(match?.entityId===id&&validId(match.sourceFingerprint),
  'unverified matching result '+id);
 const stage=stageOf(match.outcome);
 check(Array.isArray(slots)&&slots.length===map.paths.length&&slots.length>0,
  'visible block coverage differs for '+id);
 const byPath=new Map(slots.map(s=>[s.path,s]));
 check(byPath.size===slots.length,'duplicate visible source paths '+id);
 const seen=new Set(),ready=new Set(pilotReady),pending=[];
 for(const desc of map.paths){
  const s=byPath.get(desc.path);
  check(s&&s.field===desc.field&&validId(desc.blockId)&&!seen.has(desc.blockId),
   'stale/duplicate block map '+id+'/'+String(desc.path));
  seen.add(desc.blockId);
  check(typeof s.text==='string'&&s.text.trim(),'empty source text '+id+'/'+desc.path);
  if(ready.has(desc.blockId))continue; // Verified pilot ready; do not translate twice.
  pending.push({blockId:desc.blockId,path:desc.path,field:desc.field,
   ruText:s.text,ruTextSha256:sha256(s.text),dependsOn:desc.dependsOn||[]});
 }
 for(const accepted of ready)check(seen.has(accepted),'pilot block not in current map '+accepted);
 const word=stage==='ai_only'?null:match.selectedSource;
 if(stage!=='ai_only')check(word&&validId(word.driveFileId)&&SHA.test(word.sourceSha256),
  'Word source without verified bytes '+id);
 if(stage==='ai_only')check(!match.selectedSource,'AI-only Tour has a selected Word '+id);
 const source={contentPath:map.sourceContentPath,contentSha256,sourceBlobSha,
  matchJobId:'match:'+id,matchFingerprint:match.sourceFingerprint,
  selectedWord:word?{fileId:word.driveFileId,sha256:word.sourceSha256,
   yearFolder:word.sourceYearFolder??null,editionYear:word.editionYear??null,
   modifiedTime:word.modifiedTime??null}:null};
 const jobs=[];
 for(let i=0;i<pending.length;i+=MASS_BLOCKS_PER_JOB){
  const part=pending.slice(i,i+MASS_BLOCKS_PER_JOB);
  const chunk=Math.floor(i/MASS_BLOCKS_PER_JOB)+1;
  const jobId='en:bulk:tour:'+id+':b'+String(chunk).padStart(3,'0');
  const sourceFingerprint=hashObject({jobId,stage,source,blocks:part});
  jobs.push({schemaVersion:2,jobId,stableId:id,entityType:'tour',locale:'en',
   stage,sourceFingerprint,source,blocks:part,releaseEligible:false,
   requiresWordAlignment:stage!=='ai_only',priceChangesOwnedBy:'commercial-master'});
 }
 return {id,stage,totalBlocks:slots.length,reusedReady:ready.size,
  queuedBlocks:pending.length,jobs};
}
export function createMassTranslationState(rows,{sourceCommit,matchingCommit,pilotCommit}){
 check(GIT_SHA.test(sourceCommit)&&GIT_SHA.test(matchingCommit)&&
  GIT_SHA.test(pilotCommit),'exact source/matching/pilot commit required');
 check(Array.isArray(rows)&&rows.length>0,'no Tour rows');
 const shards={},packets={},allIds=new Set(),blocks=new Set(),perStage={},counts={};
 for(let i=0;i<MASS_SHARDS;i++){
  const k=i.toString(16).padStart(2,'0');
  shards[k]={schemaVersion:2,shardId:k,items:[]};
  packets[k]={schemaVersion:2,shardId:k,jobs:[]};
 }
 for(const stage of MASS_STAGES)perStage[stage]={tours:0,jobs:0,blocks:0};
 const order=[];
 let reused=0,total=0;
 for(const row of rows){
  check(row?.id&&MASS_STAGES.includes(row.stage)&&Array.isArray(row.jobs),
   'invalid Tour preparation row');
  check(!allIds.has(row.id),'duplicate Tour '+row.id);
  allIds.add(row.id);perStage[row.stage].tours++;
  total+=row.totalBlocks;reused+=row.reusedReady;
  for(const job of row.jobs){
   check(job.stableId===row.id&&job.stage===row.stage&&SHA.test(job.sourceFingerprint),
    'invalid job identity '+job.jobId);
   check(job.blocks.length>=1&&job.blocks.length<=MASS_BLOCKS_PER_JOB,'bad packet size');
   const status=job.stage===MASS_STAGES[0]?'queued':'held';
   const sid=massShard(job.jobId);
   packets[sid].jobs.push(job);
   shards[sid].items.push({jobId:job.jobId,stage:job.stage,status,
    sourceFingerprint:job.sourceFingerprint,generation:0,attempts:0,
    lease:null,checkpoint:null,submission:null,review:null,nextAttemptAt:null});
   for(const b of job.blocks){
    const k=row.id+':'+b.blockId;
    check(!blocks.has(k),'duplicate block owner '+k);blocks.add(k);
   }
   perStage[row.stage].jobs++;perStage[row.stage].blocks+=job.blocks.length;
   order.push({jobId:job.jobId,stableId:row.id,stage:row.stage,
    blocks:job.blocks.length,sourceFingerprint:job.sourceFingerprint});
  }
 }
 check(total===reused+blocks.size,'global block accounting mismatch');
 for(const shard of Object.values(shards))shard.items.sort((a,b)=>a.jobId.localeCompare(b.jobId));
 for(const packet of Object.values(packets))packet.jobs.sort((a,b)=>a.jobId.localeCompare(b.jobId));
 const stageCounts=Object.fromEntries(MASS_STAGES.map(stage=>[stage,
  Object.fromEntries(MASS_STATES.map(state=>[state,0]))]));
 const summaries={};
 for(const [sid,shard] of Object.entries(shards)){
  const summary={count:shard.items.length,stages:Object.fromEntries(MASS_STAGES.map(s=>
   [s,{queued:0,held:0,leased:0,retryable:0}]))};
  for(const item of shard.items){
   stageCounts[item.stage][item.status]++;
   summary.stages[item.stage][item.status]++;
  }
  summaries[sid]=summary;
 }
 for(const stage of MASS_STAGES)for(const state of MASS_STATES)
  counts[state]=(counts[state]||0)+stageCounts[stage][state];
 const index={schemaVersion:2,version:'ada-en-mass-20261102-v1',
  sourceCommit,matchingCommit,pilotCommit,stage:MASS_STAGES[0],
  status:'PREPARED_DISABLED',dispatcherEnabled:false,translationMassLaunchAllowed:false,
  publicationEnabled:false,pilotOnly:false,
  jobCount:order.length,tourCount:rows.length,reusedReadyBlocks:reused,
  counts,stageCounts,shards:summaries,activeOwners:{},ownerAssignments:{},
  maxJobsPerOwner:60};
 const manifest={schemaVersion:2,version:index.version,sourceCommit,matchingCommit,
  pilotCommit,activeTours:rows.length,sourceBlocks:total,reusedReadyBlocks:reused,
  remainingBlocks:blocks.size,perStage,jobs:order,
  description:'Immutable bulk preparation; Word-first 2027 > 2026 > AI gaps, no public release'};
 return {index,manifest,shards,packets};
}
