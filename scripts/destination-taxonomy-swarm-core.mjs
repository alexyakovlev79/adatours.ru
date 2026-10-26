/** Pure deterministic state machine for destination taxonomy swarm. No network or filesystem. */
export const ROOT='data/migrations/destination-taxonomy-20261026/swarm';
export const BRANCH='feature/destination-taxonomy-swarm-20261026';
export const REPOSITORY='alexyakovlev79/adatours.ru';
export const DESTINATION_TYPES=Object.freeze([
  'city','town','village','district','region','island','national_park','resort',
  'natural_area','route_cluster','mountain','volcano','glacier','waterfall',
  'lake','river','beach','canyon','cave','desert','valley','forest','wetland',
  'archaeological_site','historic_site','museum','monument','religious_site',
  'viewpoint','square','building','garden','peninsula','bay','attraction','other_landmark'
]);
export const NAVIGATION_ROLES=Object.freeze(['hub','sight']);
const TYPES=new Set(DESTINATION_TYPES),ROLES=new Set(NAVIGATION_ROLES);
const validId=x=>/^p\d{3}$/.test(x??'');
const validWorker=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{12,110}$/.test(x);
export const shardPath=n=>{if(!Number.isInteger(n)||n<0||n>=16)throw Error('Invalid shard');return ROOT+'/shards/'+String(n).padStart(2,'0')+'.json';};
export const jobPath=id=>{if(!validId(id))throw Error('Invalid packet ID');return ROOT+'/jobs/'+id+'.json';};
export const resultPath=(id,g)=>{if(!validId(id)||!Number.isSafeInteger(g)||g<1)throw Error('Invalid result path');return ROOT+'/results/'+id+'/g'+g+'.json';};
export function hash(value){let h=2166136261;for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619);return (h>>>0).toString(16).padStart(8,'0');}
export const dataOf=x=>x?.data??x;
export function sourceFingerprint(row){
  return hash(JSON.stringify([row.id,row.name,row.slug,row.url,row.countryId,row.existingType??null,row.contentPath??null]));
}
export function checkIdentity(ownerId,token){
  if(!validWorker(ownerId)||!validWorker(token)||ownerId===token)throw Error('Distinct persistent ownerId and token (12-110 chars) required');
}
export function validateJob(job) {
  if(job?.schemaVersion!==1||!validId(job.packetId)||!Array.isArray(job.records)||!job.records.length||job.records.length>20)throw Error('Invalid immutable job packet');
  if(new Set(job.records.map(r=>r.id)).size!==job.records.length)throw Error('Duplicate destination in job');
  if(job.records.some(r=>!/^destination_[a-z0-9_]+$/.test(r.id??'')||!r.name||!r.countryId||!r.url||r.fingerprint!==sourceFingerprint(r)))throw Error('Invalid immutable destination identity or fingerprint');
  if(job.sourceFingerprint!==hash(JSON.stringify(job.records.map(r=>[r.id,r.fingerprint]))))throw Error('Packet fingerprint mismatch');
  return job;
}
export function validateShard(shard) {
  if(shard?.schemaVersion!==1||!Number.isInteger(shard.shard)||shard.shard<0||shard.shard>=16||!Array.isArray(shard.items))throw Error('Invalid shard');
  const ids=new Set();
  for(const p of shard.items){
    if(!validId(p.id)||ids.has(p.id)||!['queued','leased','completed'].includes(p.status)||!Number.isSafeInteger(p.generation)||p.generation<0)throw Error('Invalid packet state');
    ids.add(p.id);
  }
  return shard;
}
export function active(p,nowMs){return p.status==='leased'&&Date.parse(p.lease?.expiresAt)>nowMs;}
export function take(shard,{ownerId,token,nowMs,leaseMinutes=90,packetId}){
  checkIdentity(ownerId,token);validateShard(shard);
  if(!Number.isFinite(nowMs)||leaseMinutes!==90)throw Error('Invalid lease clock/duration');
  const candidates=packetId?shard.items.filter(p=>p.id===packetId):shard.items;
  const owned=candidates.find(p=>active(p,nowMs)&&p.lease.ownerId===ownerId&&p.lease.token===token);
  if(owned)return {changed:false,resumed:true,item:owned};
  const p=candidates.find(p=>p.status==='queued'||(p.status==='leased'&&!active(p,nowMs)));
  if(!p)return {changed:false,resumed:false,item:null};
  p.generation+=1;p.attempts=(p.attempts||0)+1;p.status='leased';
  p.lease={ownerId,token,generation:p.generation,claimedAt:new Date(nowMs).toISOString(),expiresAt:new Date(nowMs+90*60000).toISOString()};
  return {changed:true,resumed:false,item:p};
}
export function requireLease(p,{ownerId,token,generation,nowMs}){
  checkIdentity(ownerId,token);
  if(!p||!active(p,nowMs)||p.lease.ownerId!==ownerId||p.lease.token!==token||p.generation!==generation||p.lease.generation!==generation)throw Error('Lost or expired lease; stale generation is fenced');
  return p;
}
export function renew(shard,request){
  validateShard(shard);const p=shard.items.find(x=>x.id===request.packetId);requireLease(p,request);
  p.lease.expiresAt=new Date(request.nowMs+90*60000).toISOString();return p;
}
export function release(shard,request){
  validateShard(shard);const p=shard.items.find(x=>x.id===request.packetId);requireLease(p,request);
  p.status='queued';p.lease=null;return p;
}
export function validateResults(job,records){
  validateJob(job);
  if(!Array.isArray(records)||records.length!==job.records.length||new Set(records.map(x=>x.id)).size!==records.length)throw Error('Submit every unique destination exactly once');
  const byId=new Map(job.records.map(x=>[x.id,x]));
  const normalized=[];
  for(const r of records){
    if(!byId.has(r.id)||!['ready','review'].includes(r.status))throw Error('Unexpected destination or verdict '+r.id);
    if(typeof r.evidence!=='string'||r.evidence.trim().length<18||r.evidence.length>1600)throw Error('Specific evidence (18-1600 chars) required: '+r.id);
    if(!Number.isInteger(r.confidence)||r.confidence<0||r.confidence>100)throw Error('Invalid confidence: '+r.id);
    if(r.status==='ready'){
      if(!TYPES.has(r.destinationType)||!ROLES.has(r.navigationRole)||r.confidence<70)throw Error('Ready requires valid destinationType, navigationRole and >=70 confidence: '+r.id);
    } else {
      if(typeof r.reason!=='string'||r.reason.trim().length<18||r.reason.length>1000)throw Error('REVIEW needs a specific unresolved question: '+r.id);
      if(r.destinationType!=null&&!TYPES.has(r.destinationType))throw Error('Invalid REVIEW type: '+r.id);
      if(r.navigationRole!=null&&!ROLES.has(r.navigationRole))throw Error('Invalid REVIEW role: '+r.id);
    }
    normalized.push({id:r.id,status:r.status,destinationType:r.destinationType??null,navigationRole:r.navigationRole??null,confidence:r.confidence,
      evidence:r.evidence.trim(),...(r.reason?{reason:r.reason.trim()}:{})});
  }
  return job.records.map(x=>normalized.find(r=>r.id===x.id));
}
export function recordChecksum(job,records){return hash(JSON.stringify([job.sourceFingerprint,records]));}
export function finish(shard,job,request){
  const p=shard.items.find(x=>x.id===request.packetId);
  const normalized=validateResults(job,request.records);const checksum=recordChecksum(job,normalized);
  if(p?.status==='completed'){
    if(p.submissionId===request.submissionId&&p.recordChecksum===checksum)return {alreadySaved:true,item:p,records:normalized,checksum};
    throw Error('Completed packet already has a different result; coordinator requeue required');
  }
  requireLease(p,request);
  if(job.packetId!==p.id||job.sourceFingerprint!==p.sourceFingerprint)throw Error('Immutable job fingerprint mismatch');
  if(typeof request.submissionId!=='string'||!/^[A-Za-z0-9_-]{12,110}$/.test(request.submissionId))throw Error('Stable submissionId required');
  const ready=normalized.filter(x=>x.status==='ready').length,review=normalized.length-ready;
  p.status='completed';p.lease=null;p.ready=ready;p.review=review;
  p.submissionId=request.submissionId;p.recordChecksum=checksum;p.resultPath=resultPath(p.id,p.generation);
  p.completedAt=new Date(request.nowMs).toISOString();p.completedBy=request.ownerId;
  return {alreadySaved:false,item:p,records:normalized,checksum};
}
export function requeueReview(shard,{packetId,expectedGeneration,reason,nowMs}){
  const p=shard.items.find(x=>x.id===packetId);
  if(!p||p.status!=='completed'||p.generation!==expectedGeneration||!p.review||typeof reason!=='string'||reason.trim().length<20)throw Error('Coordinator can reopen only current REVIEW with a specific reason');
  p.history=[...(p.history??[]),{generation:p.generation,resultPath:p.resultPath,reason:reason.trim(),reopenedAt:new Date(nowMs).toISOString()}];
  p.status='queued';p.ready=0;p.review=0;p.lease=null;p.submissionId=null;p.recordChecksum=null;p.resultPath=null;p.completedAt=null;p.completedBy=null;
  return p;
}
export function summarize(shards,nowMs){
  const count={packets:0,queued:0,leased:0,expired:0,completed:0,ready:0,review:0};
  for(const s of shards){validateShard(s);for(const p of s.items){count.packets++;count[p.status]++;if(p.status==='leased'&&!active(p,nowMs))count.expired++;count.ready+=(p.ready||0);count.review+=(p.review||0);}}
  return count;
}
