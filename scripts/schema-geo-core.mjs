// Portable state machine: no I/O. Both Node tests and Work Code Mode use this exact file.
export const STATES = ['QUEUED','LEASED','READY','REVIEW','BLOCKED','STALE','UNAVAILABLE','PUBLISHING','DEPLOYING','PUBLISHED'];
export function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => JSON.stringify(k)+':'+stable(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
// SHA-256 over UTF-8, portable to the tools' V8 isolate (which has no node:crypto).
export function sha256(text) {
  const utf8 = unescape(encodeURIComponent(text));
  const bytes = Array.from(utf8, c => c.charCodeAt(0));
  const bitLength = bytes.length * 8; bytes.push(128);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i=7;i>=0;i--) bytes.push(i>=4 ? Math.floor(bitLength / 2**(8*i)) & 255 : bitLength >>> (8*i) & 255);
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  let H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rot=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let off=0;off<bytes.length;off+=64){
    const w=new Array(64);for(let i=0;i<16;i++)w[i]=(bytes[off+i*4]<<24)|(bytes[off+i*4+1]<<16)|(bytes[off+i*4+2]<<8)|bytes[off+i*4+3];
    for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(rot(a,7)^rot(a,18)^(a>>>3))+w[i-7]+(rot(b,17)^rot(b,19)^(b>>>10)))|0;}
    let [a,b,c,d,e,f,g,h]=H;
    for(let i=0;i<64;i++){const t1=(h+(rot(e,6)^rot(e,11)^rot(e,25))+((e&f)^(~e&g))+K[i]+w[i])|0,t2=((rot(a,2)^rot(a,13)^rot(a,22))+((a&b)^(a&c)^(b&c)))|0;h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}
    H=H.map((v,i)=>(v+[a,b,c,d,e,f,g,h][i])|0);
  }
  return H.map(n=>(n>>>0).toString(16).padStart(8,'0')).join('');
}
export const digest = value => sha256(stable(value));

export const GEO_DECISION_POLICY = 'probability-70-v1';
export const GEO_ACCEPT_PROBABILITY = 70;
export function geoAssessment(r, field) {
  const records=Array.isArray(r?.assessments)?r.assessments:[];
  return records.find(a=>a&&a.field===field);
}
export function geoAccepted(r, field) {
  if(r?.decisionPolicy!==GEO_DECISION_POLICY)return true; // Preserve immutable legacy v2 records.
  const a=geoAssessment(r,field);
  return !!a&&Number.isFinite(a.probability)&&a.probability>=GEO_ACCEPT_PROBABILITY;
}

export const statusOf = (state, job) => !job.available ? 'UNAVAILABLE' : state.jobs[job.jobId]?.status || 'QUEUED';
export function claim(queue, state, {ownerId, token, now, limit=10, maxStage=1, batchSize=10}) {
  if(!/^[a-zA-Z0-9_-]{8,120}$/.test(ownerId)||!/^[a-zA-Z0-9_-]{16,160}$/.test(token))throw Error('Invalid owner or token');
  const existing=Object.values(state.leases).filter(l=>l.ownerId===ownerId&&l.token===token&&Date.parse(l.until)>now);
  if(existing.length)return existing.map(l=>({...queue.jobs.find(j=>j.jobId===l.jobId),lease:l}));
  const eligible=queue.jobs.filter(j=>j.available&&j.stage<=maxStage&&(
    statusOf(state,j)==='QUEUED'||statusOf(state,j)==='LEASED'&&Date.parse(state.leases[j.jobId]?.until)<=now));
  eligible.sort((a,b)=>a.stage-b.stage||a.sourceOrder-b.sourceOrder||a.jobId.localeCompare(b.jobId));
  const stage=eligible[0]?.stage;
  const picked=eligible.filter(j=>j.stage===stage).slice(0,Math.min(10,Math.max(1,batchSize),Math.max(1,limit)));
  for(const j of picked){const old=state.leases[j.jobId];const lease={jobId:j.jobId,ownerId,token,generation:(old?.generation||state.jobs[j.jobId]?.attempt||0)+1,startedAt:new Date(now).toISOString(),until:new Date(now+90*60000).toISOString(),sourceFingerprint:j.sourceFingerprint};state.leases[j.jobId]=lease;state.jobs[j.jobId]={...state.jobs[j.jobId],status:'LEASED',attempt:lease.generation};}
  return picked.map(j=>({...j,lease:state.leases[j.jobId]}));
}
function owned(state, jobId, ownerId, token, now) {
  const l=state.leases[jobId];
  if(!l||l.ownerId!==ownerId||l.token!==token||Date.parse(l.until)<=now||state.jobs[jobId]?.status!=='LEASED')throw Error('Lease lost, expired or fenced: '+jobId);
  return l;
}
export function renew(state,{jobId,ownerId,token,now}){const l=owned(state,jobId,ownerId,token,now);l.until=new Date(now+90*60000).toISOString();return l;}
export function release(state,{jobId,ownerId,token,now}){owned(state,jobId,ownerId,token,now);delete state.leases[jobId];state.jobs[jobId]={...state.jobs[jobId],status:'QUEUED'};}
export function validateResult(r, job) {
  const errors=[];
  const allowedTop=['schemaVersion','jobId','stableId','kind','canonicalPath','sourceFingerprint','status','external','location','alternateNames','relationships','evidence','confidence','reviewNote','identityScope','entityClass','audit','decisionPolicy','assessments'];
  for(const k of Object.keys(r))if(!allowedTop.includes(k))errors.push('Unsupported result field: '+k);
  if(r.schemaVersion!==2||r.jobId!==job.jobId||r.stableId!==job.stableId||r.kind!==job.kind||r.canonicalPath!==job.url||r.sourceFingerprint!==job.sourceFingerprint)errors.push('Identity/version/source mismatch');
  if(!['READY','REVIEW','BLOCKED'].includes(r.status))errors.push('Invalid result status');
  if(!Array.isArray(r.evidence))errors.push('Evidence array required');
  const probabilityMode=r.decisionPolicy===GEO_DECISION_POLICY;
  if(r.decisionPolicy!==undefined&&!probabilityMode)errors.push('Unsupported GEO decision policy');
  if(r.assessments!==undefined&&!Array.isArray(r.assessments))errors.push('Assessments array required');
  const seenAssessments=new Set();
  for(const a of Array.isArray(r.assessments)?r.assessments:[]){
    if(!a||typeof a.field!=='string'||!a.field.trim()||!Number.isFinite(a.probability)||a.probability<0||a.probability>100
      ||typeof a.reason!=='string'||!a.reason.trim()
      ||a.selected!==undefined&&(typeof a.selected!=='string'||!a.selected.trim())
      ||Object.keys(a).some(k=>!['field','probability','selected','reason'].includes(k)))
      errors.push('Invalid GEO probability assessment');
    if(seenAssessments.has(a?.field))errors.push('Duplicate GEO probability assessment: '+a.field);
    seenAssessments.add(a?.field);
  }
  if(probabilityMode&&!Array.isArray(r.assessments))errors.push('Decision policy requires assessments');
  const evidence=r.evidence||[];
  // Code Mode is a plain V8 isolate and may not expose the WHATWG URL global.
  // This validator only needs HTTPS source URLs and exact Wikipedia hosts/paths.
  const parseHttps=u=>{
    if(typeof u!=='string'||/[\s\\\u0000-\u001f\u007f]/.test(u))return null;
    const m=u.match(/^https:\/\/([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::([0-9]{1,5}))?(\/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$/i);
    if(!m||m[1].includes('..')||m[2]&&Number(m[2])>65535)return null;
    return {hostname:m[1].toLowerCase(),pathname:m[3]||'/'};
  };
  const https=u=>Boolean(parseHttps(u));
  for(const e of evidence)if(!e.field||!https(e.sourceUrl)||!Number.isFinite(Date.parse(e.checkedAt))||!e.note)errors.push('Incomplete evidence');
  const hasEvidence=field=>evidence.some(e=>e.field===field);
  if(r.status==='READY'){
    if(!evidence.length)errors.push('READY requires evidence');
    if(probabilityMode){
      if(r.confidence==='low')errors.push('READY with 70% policy needs medium/high confidence');
      if(!geoAccepted(r,'identity'))errors.push('READY identity probability must be at least 70%');
    } else {
      if(r.confidence!=='high')errors.push('Legacy READY requires high confidence');
      if(['country','destination'].includes(job.kind)&&!r.external?.wikidataQid&&!r.external?.officialUrl&&!r.external?.osm&&!r.external?.geonamesId)errors.push('Legacy geography READY needs an exact external identity');
      if(r.identityScope==='composite'&&r.external&&Object.values(r.external).some(v=>v&&(!Array.isArray(v)||v.length)))errors.push('Legacy composite cannot receive single-object identity');
    }
  }
  if(r.external){
    const x=r.external;
    const allowed=['wikidataQid','wikipedia','geonamesId','osm','unescoSiteIds','wdpaIds','officialUrl'];
    for(const k of Object.keys(x))if(!allowed.includes(k))errors.push('Unsupported external field: '+k);
    if(!['country','destination'].includes(job.kind)&&Object.values(x).some(v=>v&&(!Array.isArray(v)||v.length)))errors.push('No external identity on a trip or template');
    if(x.wikidataQid&&!/^Q[1-9]\d*$/.test(x.wikidataQid))errors.push('Invalid QID');
    if(x.geonamesId&&!/^[1-9]\d*$/.test(String(x.geonamesId)))errors.push('Invalid GeoNames ID');
    if(x.osm&&(!['node','way','relation'].includes(x.osm.type)||!Number.isSafeInteger(x.osm.id)||x.osm.id<=0))errors.push('Invalid OSM identity');
    if(x.officialUrl&&!https(x.officialUrl))errors.push('Invalid official URL');
    for(const [lang,url] of Object.entries(x.wikipedia||{}))if(!https(url)||parseHttps(url).hostname!==lang+'.wikipedia.org'||!parseHttps(url).pathname.startsWith('/wiki/'))errors.push('Invalid Wikipedia URL');
    for(const [k,v] of Object.entries(x))if(v&&(!Array.isArray(v)||v.length)&&!hasEvidence('external.'+k))errors.push('Missing evidence: external.'+k);
  }
  if(r.location){const l=r.location;if(!Number.isFinite(l.latitude)||!Number.isFinite(l.longitude)||Math.abs(l.latitude)>90||Math.abs(l.longitude)>180||!['centroid','entrance','settlement_center','feature_point','representative'].includes(l.pointRole)||!https(l.coordinateSource)||!hasEvidence('location'))errors.push('Invalid/unproven coordinates');}
  if(probabilityMode&&r.status==='READY'){
    const x=r.external||{},present=v=>Array.isArray(v)?v.length>0:!!v;
    for(const field of ['wikidataQid','geonamesId','osm','officialUrl','wikipedia','unescoSiteIds','wdpaIds'])
      if(present(x[field])&&!geoAccepted(r,'external.'+field))
        errors.push('GEO external.'+field+' requires at least 70% probability');
    if(r.location&&!geoAccepted(r,'location'))errors.push('GEO location requires at least 70% probability');
    for(const rel of r.relationships||[])
      if(rel?.targetId&&!geoAccepted(r,'relationships.'+rel.targetId))
        errors.push('GEO relationships.'+rel.targetId+' requires at least 70% probability');
    if(r.entityClass&&!geoAccepted(r,'entityClass'))errors.push('GEO entityClass requires at least 70% probability');
    if(r.alternateNames?.length&&!geoAccepted(r,'alternateNames'))errors.push('GEO alternateNames requires at least 70% probability');
  }
  if(r.status!=='READY'&&!r.reviewNote)errors.push('REVIEW/BLOCKED requires explanation');
  const forbidden=['@id','@type','sameAs','aggregateRating','offers'];for(const k of forbidden)if(k in r)errors.push('Worker must not author Schema.org: '+k);
  const positions=new Set();
  for(const rel of r.relationships||[]){
    if(!['containedInPlace','visits','relatedPlace'].includes(rel.type)||!rel.targetId||!hasEvidence('relationships.'+rel.targetId))errors.push('Unproven relationship');
    if(rel.type==='visits'){if(!Number.isSafeInteger(rel.position)||rel.position<1||positions.has(rel.position))errors.push('Visit needs unique positive position');positions.add(rel.position);}
  }
  if(r.status==='READY'&&job.kind==='template'&&(!r.audit?.checkedUrls?.length||!r.audit?.findings?.length))errors.push('Template audit requires checked URLs and findings');
  return errors;
}
export function complete(queue,state,{ownerId,token,result,now}){
  const j=queue.jobs.find(j=>j.jobId===result.jobId);if(!j)throw Error('Unknown job');
  const hash=digest(result),previous=state.jobs[j.jobId];
  if(previous?.resultHash===hash&&previous?.completedToken===token)return {idempotent:true,hash,path:previous.resultPath};
  const l=owned(state,j.jobId,ownerId,token,now);if(!j.available||l.sourceFingerprint!==j.sourceFingerprint)throw Error('Source changed');
  const errors=validateResult(result,j);if(errors.length)throw Error(errors.join('; '));
  const path=`data/geo-knowledge/results/${j.jobId}/${token}-${hash}.json`;
  state.jobs[j.jobId]={...previous,status:result.status,resultHash:hash,resultPath:path,completedToken:token,completedBy:ownerId,completedAt:new Date(now).toISOString()};delete state.leases[j.jobId];
  return {hash,path};
}
export function geoPublicationScope({jobIds,contentCommit}={}){
  if(jobIds===undefined){if(contentCommit!==undefined)throw Error('Addressed publication requires explicit jobIds');return null;}
  if(!Array.isArray(jobIds)||!jobIds.length||new Set(jobIds).size!==jobIds.length
    ||jobIds.some(id=>typeof id!=='string'||!/^geo-(?:country|destination|tour|excursion)-[a-z0-9_]+$/.test(id))
    ||typeof contentCommit!=='string'||!/^[a-f0-9]{40}$/.test(contentCommit))
    throw Error('Addressed GEO publication requires unique canonical jobIds and the Word contentCommit');
  return {jobIds:[...jobIds].sort(),contentCommit};
}
export function geoPublicationScopeMatches(publication,scope){
  return !!publication&&(!scope||publication.contentCommit===scope.contentCommit
    &&stable(publication.jobs.map(row=>row.jobId).sort())===stable(scope.jobIds));
}
export function beginPublication(queue,state,{batchId,ownerId,now,jobIds,contentCommit}){
  const scope=geoPublicationScope({jobIds,contentCommit});
  const active=state.publication;
  if(active&&!['PUBLISHED','FAILED'].includes(active.status)){
    if(active.ownerId===ownerId&&active.batchId===batchId&&geoPublicationScopeMatches(active,scope))return active;
    throw Error('Publication already in progress; reconcile commit/deploy before taking over');
  }
  // Default still takes every READY result. Explicit Word scope never expands into that backlog.
  if(scope)for(const id of scope.jobIds){
    const matches=queue.jobs.filter(j=>j.jobId===id),row=state.jobs[id];
    if(matches.length!==1||statusOf(state,matches[0])!=='READY')throw Error('Addressed GEO job is not uniquely READY: '+id);
    if((row.wordRevisionCommit||row.inlineCreationCommit)!==scope.contentCommit)
      throw Error('Addressed GEO job does not belong to the Word content commit: '+id);
    if(row.geoSheetSync?.status!=='SYNCED')throw Error('Addressed GEO Sheets are not SYNCED: '+id);
    if(state.leases?.[id])throw Error('Addressed GEO job still has a worker lease: '+id);
    if(!/^[a-f0-9]{64}$/.test(row.resultHash||'')||!row.resultPath?.startsWith('data/geo-knowledge/results/'+id+'/'))
      throw Error('Addressed GEO immutable result receipt missing: '+id);
  }
  const jobs=queue.jobs.filter(j=>statusOf(state,j)==='READY'&&(!scope||scope.jobIds.includes(j.jobId)))
    .sort((a,b)=>a.stage-b.stage||a.sourceOrder-b.sourceOrder||a.jobId.localeCompare(b.jobId));
  if(!jobs.length)return null;
  state.publication={batchId,ownerId,status:'PUBLISHING',startedAt:new Date(now).toISOString(),
    ...(scope?{scope:'word_content_revision',contentCommit:scope.contentCommit}:{}),
    jobs:jobs.map(j=>({jobId:j.jobId,resultHash:state.jobs[j.jobId].resultHash,resultPath:state.jobs[j.jobId].resultPath,sourceFingerprint:j.sourceFingerprint}))};
  for(const j of jobs)state.jobs[j.jobId].status='PUBLISHING';
  return state.publication;
}
export function abortUncommittedPublication(state,{batchId,ownerId}){
  const p=state.publication;
  if(!p||p.batchId!==batchId||p.ownerId!==ownerId||p.status!=='PUBLISHING'||p.commit)
    throw Error('Cannot abort committed or foreign publication');
  for(const j of p.jobs)if(state.jobs[j.jobId]?.status==='PUBLISHING')
    state.jobs[j.jobId]={...state.jobs[j.jobId],status:'READY'};
  state.publication=null;
  return {batchId,restored:p.jobs.length};
}
export function recordCommit(state,{batchId,ownerId,commit,now}){
  const p=state.publication;if(!p||p.batchId!==batchId||p.ownerId!==ownerId||!['PUBLISHING','DEPLOYING'].includes(p.status))throw Error('Publication owner mismatch');
  if(!/^[a-f0-9]{40}$/.test(commit)||p.commit&&p.commit!==commit)throw Error('Invalid/conflicting commit');
  p.commit=commit;p.status='DEPLOYING';p.committedAt=new Date(now).toISOString();for(const j of p.jobs)state.jobs[j.jobId].status='DEPLOYING';return p;
}
export function confirmDeploy(state,{batchId,ownerId,commit,runUrl,now}){
  const p=state.publication;if(!p||p.batchId!==batchId||p.ownerId!==ownerId||p.commit!==commit||p.status!=='DEPLOYING')throw Error('Publication/deploy mismatch');
  p.status='PUBLISHED';p.runUrl=runUrl;p.publishedAt=new Date(now).toISOString();state.publications.push({...p});
  for(const j of p.jobs)state.jobs[j.jobId]={...state.jobs[j.jobId],status:'PUBLISHED',publishedCommit:commit,deployRun:runUrl,publishedAt:p.publishedAt};return p;
}
