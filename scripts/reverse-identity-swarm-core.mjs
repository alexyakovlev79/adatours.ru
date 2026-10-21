/* Pure state transitions for 30-URL Ada Tours reverse-identity swarm. */
export const SWARM_ROOT='data/external-identity/reverse-swarm-20261021';
export const BRANCH='feature/external-identity-swarm-20261021';
export const LIMIT=30;
export const LEASE_MINUTES=90;
export const STATUSES=['matched_exact','redirect_ready','checked_no_confirmed_pair','review','retry','excluded'];
export const DOMAINS=['vipdeluxetravel.ru','adatours.com','brasiltours.ru'];
export const stamp=ms=>new Date(ms).toISOString();
export function hashString(str) {
  let h=2166136261;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
}
export function requireIdentity(ownerId,token) {
  if(typeof ownerId!=='string'||typeof token!=='string'||
    !/^[A-Za-z0-9_-]{12,100}$/.test(ownerId)||
    !/^[A-Za-z0-9_-]{12,100}$/.test(token)||ownerId===token)
    throw Error('Use distinct persistent ownerId/token (12-100 safe characters)');
}
export function batchPath(batchId) {
  if(!/^(vip|en|br)-[0-9]{3}$/.test(batchId))throw Error('Invalid batchId');
  return SWARM_ROOT+'/batches/'+batchId+'.json';
}
export function validateBatch(batch) {
  if(!batch||batch.version!==1||!batchIdMatchesDomain(batch.batchId,batch.domain)||
    !Array.isArray(batch.records)||batch.records.length<1||batch.records.length>LIMIT)
    throw Error('Corrupt or wrong-version batch');
  const urls=new Set(),positions=new Set();
  for(const r of batch.records){
    if(typeof r.sourceUrl!=='string'||!r.sourceUrl.startsWith('https://'+batch.domain+'/')||
      urls.has(r.sourceUrl)||!Number.isInteger(r.inventoryPosition)||positions.has(r.inventoryPosition)||
      !(r.status==='queued'||STATUSES.includes(r.status)))throw Error('Invalid batch record');
    urls.add(r.sourceUrl);positions.add(r.inventoryPosition);
  }
  return batch;
}
export function batchIdMatchesDomain(id,domain) {
  return /^(vip|en|br)-[0-9]{3}$/.test(id) &&
    ({vip:'vipdeluxetravel.ru',en:'adatours.com',br:'brasiltours.ru'})[id.split('-')[0]]===domain;
}
export function summary(batch) {
  const counts={queued:0,matched_exact:0,redirect_ready:0,checked_no_confirmed_pair:0,review:0,retry:0,excluded:0};
  for(const r of batch.records){if(!(r.status in counts))throw Error('Unknown status');counts[r.status]++;}
  return {...counts,total:batch.records.length,done:batch.records.length-counts.queued};
}
export function leaseIsActive(batch,nowMs) {
  return !!batch.lease && Number.isFinite(Date.parse(batch.lease.expiresAt)) &&
    Date.parse(batch.lease.expiresAt)>nowMs;
}
export function claimBatch(batch,{ownerId,token,nowMs}) {
  validateBatch(batch);requireIdentity(ownerId,token);
  if(!Number.isFinite(nowMs))throw Error('Invalid time');
  const counts=summary(batch);
  if(!counts.queued) return {status:'completed',batch,counts};
  if(leaseIsActive(batch,nowMs)) {
    if(batch.lease.ownerId===ownerId&&batch.lease.token===token)
      return {status:'resumed',batch,counts};
    return {status:'busy',batch,counts};
  }
  const previous=batch.lease;
  if(previous)batch.leaseHistory=[...(batch.leaseHistory||[]),{
    ownerId:previous.ownerId,batchId:batch.batchId,
    claimedAt:previous.claimedAt,expiresAt:previous.expiresAt,
    reclaimedAt:stamp(nowMs),reason:'expired'
  }];
  const generation=(batch.claimGeneration||0)+1;
  batch.claimGeneration=generation;
  batch.lease={ownerId,token,generation,claimedAt:stamp(nowMs),
    expiresAt:stamp(nowMs+LEASE_MINUTES*60000)};
  batch.updatedAt=stamp(nowMs);
  return {status:previous?'reclaimed':'reserved',batch,counts};
}
export function changeLease(batch,{ownerId,token,nowMs,action}) {
  validateBatch(batch);requireIdentity(ownerId,token);
  if(!batch.lease||batch.lease.ownerId!==ownerId||batch.lease.token!==token)
    throw Error('Worker does not own this batch');
  if(!leaseIsActive(batch,nowMs))return {status:'lease_expired',batch};
  if(action==='renew') {
    batch.lease.expiresAt=stamp(nowMs+LEASE_MINUTES*60000);
    batch.lease.lastHeartbeatAt=stamp(nowMs);batch.updatedAt=stamp(nowMs);
    return {status:'renewed',batch};
  }
  if(action==='release') {
    batch.leaseHistory=[...(batch.leaseHistory||[]),{
      ownerId,batchId:batch.batchId,claimedAt:batch.lease.claimedAt,
      expiresAt:batch.lease.expiresAt,releasedAt:stamp(nowMs),reason:'voluntary'
    }];
    batch.lease=null;batch.updatedAt=stamp(nowMs);
    return {status:'released',batch};
  }
  throw Error('Unknown lease action');
}
export function validatedResult(domain,input) {
  if(!input||typeof input.sourceUrl!=='string'||!STATUSES.includes(input.status))
    throw Error('Result requires sourceUrl and final status');
  const r={sourceUrl:input.sourceUrl,status:input.status,
    ruUrl:typeof input.ruUrl==='string'?input.ruUrl.trim():'',
    evidence:Array.isArray(input.evidence)?input.evidence.map(x=>String(x).trim()):[],
    note:typeof input.note==='string'?input.note.trim():''};
  if(r.evidence.some(x=>!x||x.length>1200)||r.evidence.length>12||
    r.note.length>2500)throw Error('Invalid evidence / note length');
  const exact=r.status==='matched_exact'||r.status==='redirect_ready';
  if(exact&&(!/^https:\/\/adatours\.ru\/[^?#]*$/.test(r.ruUrl)||r.evidence.length<2))
    throw Error('Confirmed mapping requires clean RU canonical and >=2 evidence items');
  if(!exact&&r.ruUrl)throw Error('Unconfirmed status must not assign a RU redirect/sameAs');
  if(!exact&&r.note.length<28)throw Error('Unconfirmed result needs a concrete note (>=28 chars)');
  if(r.status==='matched_exact'&&domain==='vipdeluxetravel.ru')
    throw Error('VIP cannot be marked sameAs; use redirect_ready');
  if(r.status==='redirect_ready'&&domain!=='vipdeluxetravel.ru')
    throw Error('301 redirect_ready only for VIP');
  if(r.status==='excluded'&&r.evidence.length===0)
    throw Error('Excluded requires evidence');
  r.relation=r.status==='matched_exact'?'sameAs':
    r.status==='redirect_ready'?'redirect_301':null;
  return r;
}
export function submitResults(batch,{ownerId,token,results,nowMs}) {
  validateBatch(batch);requireIdentity(ownerId,token);
  if(!Array.isArray(results)||results.length<1||results.length>10)
    throw Error('Submit 1-10 result rows at once');
  const seen=new Set(),toWrite=[];
  for(const raw of results){
    const v=validatedResult(batch.domain,raw);
    if(seen.has(v.sourceUrl))throw Error('Duplicate result in submit');
    seen.add(v.sourceUrl);
    const r=batch.records.find(x=>x.sourceUrl===v.sourceUrl);
    if(!r)throw Error('URL is not part of reserved batch: '+v.sourceUrl);
    if(r.status!=='queued'){
      const old={sourceUrl:r.sourceUrl,status:r.status,ruUrl:r.ruUrl||'',
        evidence:r.evidence||[],note:r.note||'',relation:r.relation||null};
      if(JSON.stringify(old)!==JSON.stringify(v))
        throw Error('Completed URL is immutable: '+v.sourceUrl);
      continue;
    }
    toWrite.push({r,v});
  }
  if(!toWrite.length)return {status:'already_saved',batch,counts:summary(batch),newCount:0};
  if(!batch.lease||batch.lease.ownerId!==ownerId||batch.lease.token!==token)
    throw Error('Not an owned batch');
  if(!leaseIsActive(batch,nowMs))throw Error('Lease expired, unfinished URL cannot be saved');
  const checkedAt=stamp(nowMs);
  for(const {r,v} of toWrite){
    Object.assign(r,v,{checkedAt,checkedBy:ownerId,claimGeneration:batch.lease.generation});
  }
  batch.updatedAt=checkedAt;
  const counts=summary(batch);
  if(!counts.queued){
    batch.completedAt=checkedAt;
    batch.lastOwner=ownerId;
    batch.lease=null;
  }
  return {status:'saved',batch,counts,newCount:toWrite.length};
}
