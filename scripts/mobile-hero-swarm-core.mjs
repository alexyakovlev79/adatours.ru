/** Portable, deterministic packet transitions. No filesystem, network or ambient clock. */
export const SWARM_ROOT = 'data/media/hero-mobile-swarm-20261023';
export const SWARM_BRANCH = 'feature/mobile-hero-swarm-20261023';
export const SWARM_REPOSITORY = 'alexyakovlev79/adatours.ru';
export const packetPath = id => { checkPacketId(id); return `${SWARM_ROOT}/packets/${id}.json`; };
export function checkPacketId(id) { if (!/^b\d{3,5}$/.test(id ?? '')) throw Error('Invalid packet ID'); }
export function checkIdentity(ownerId, token) {
  if (![ownerId, token].every(x => typeof x === 'string' && /^[A-Za-z0-9_-]{10,100}$/.test(x)) || ownerId === token)
    throw Error('Use separate persistent ownerId and token strings of 10–100 safe characters');
}
export function hashString(value) { let h=2166136261; for (let i=0;i<value.length;i++) h=Math.imul(h^value.charCodeAt(i),16777619); return h>>>0; }
export function canonical(value) {
  if (value === null || typeof value !== 'object') { const raw=JSON.stringify(value); if(raw===undefined) throw Error('Undefined/non-JSON payload'); return raw; }
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
/** Small SHA-256 implementation keeps the dispatcher usable in a connector V8 isolate. */
export function sha256(value) {
  const encoded=[];
  for(const char of value){let n=char.codePointAt(0);if(n>=0xd800&&n<=0xdfff)n=0xfffd;
    if(n<0x80)encoded.push(n);else if(n<0x800)encoded.push(0xc0|(n>>6),0x80|(n&63));
    else if(n<0x10000)encoded.push(0xe0|(n>>12),0x80|((n>>6)&63),0x80|(n&63));
    else encoded.push(0xf0|(n>>18),0x80|((n>>12)&63),0x80|((n>>6)&63),0x80|(n&63));}
  const bytes = Uint8Array.from(encoded), length=bytes.length;
  const size=Math.ceil((length+9)/64)*64, data=new Uint8Array(size);data.set(bytes);data[length]=128;
  const dv=new DataView(data.buffer);dv.setUint32(size-8,Math.floor(length/0x20000000));dv.setUint32(size-4,(length*8)>>>0);
  const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const ro=(x,n)=>(x>>>n)|(x<<(32-n)),w=new Uint32Array(64);
  for(let offset=0;offset<size;offset+=64){
    for(let i=0;i<16;i++)w[i]=dv.getUint32(offset+i*4);
    for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(ro(a,7)^ro(a,18)^(a>>>3))+w[i-7]+(ro(b,17)^ro(b,19)^(b>>>10)))>>>0;}
    let [a,b,c,d,e,f,g,j]=h;
    for(let i=0;i<64;i++){const t1=(j+(ro(e,6)^ro(e,11)^ro(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0,t2=((ro(a,2)^ro(a,13)^ro(a,22))+((a&b)^(a&c)^(b&c)))>>>0;j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
    [a,b,c,d,e,f,g,j].forEach((v,i)=>h[i]=(h[i]+v)>>>0);
  }
  return h.map(x=>x.toString(16).padStart(8,'0')).join('');
}
export const digest = value => sha256(canonical(value));
const utc=ms=>new Date(ms).toISOString();
const clone=value=>JSON.parse(JSON.stringify(value));
const note=value=>typeof value==='string'&&value.trim().length>=16&&value.length<=6000;
const hash=value=>/^[a-f0-9]{64}$/.test(value??'');
const positive=value=>Number.isSafeInteger(value)&&value>0;
function checkClock(nowMs){if(!Number.isFinite(nowMs))throw Error('Explicit current time is required');}
export function validatePacket(packet) {
  checkPacketId(packet?.id);
  const ids=packet.jobs?.map(j=>j.id)??packet.assetIds;
  if(packet.schemaVersion!==1||!Array.isArray(ids)||ids.length<1||ids.length>10||new Set(ids).size!==ids.length)
    throw Error('Invalid frozen packet jobs');
  if(!['queued','leased','completed'].includes(packet.status))throw Error('Invalid packet status');
  if(!Number.isSafeInteger(packet.generation??0)||(packet.generation??0)<0)throw Error('Invalid generation');
  return packet;
}
export function stateRecord(packet) { const value=clone(packet); if(value.jobs){value.assetIds??=value.jobs.map(j=>j.id);delete value.jobs;} return value; }
export function activeLease(packet,nowMs){return packet.status==='leased'&&Date.parse(packet.lease?.expiresAt)>nowMs;}
export function requireLease(packet,{ownerId,token,generation,nowMs}) {
  checkIdentity(ownerId,token);checkClock(nowMs);validatePacket(packet);
  if(!activeLease(packet,nowMs)||packet.lease.ownerId!==ownerId||packet.lease.token!==token||packet.lease.generation!==generation||packet.generation!==generation)
    throw Error('Lease lost, expired or fencing generation changed; do not overwrite another worker');
  return packet;
}
export function take(packet,{ownerId,token,nowMs,leaseMinutes=60}) {
  checkIdentity(ownerId,token);checkClock(nowMs);validatePacket(packet);
  if(leaseMinutes!==60)throw Error('This queue uses a 60-minute lease');
  if(activeLease(packet,nowMs)){
    if(packet.lease.ownerId===ownerId&&packet.lease.token===token)return{changed:false,resumed:true,packet};
    return{changed:false,resumed:false,packet:null};
  }
  if(packet.status==='completed')return{changed:false,resumed:false,packet:null};
  packet.generation=(packet.generation??0)+1;packet.status='leased';packet.attempts=(packet.attempts??0)+1;
  packet.lease={ownerId,token,generation:packet.generation,claimedAt:utc(nowMs),expiresAt:utc(nowMs+3600000)};
  packet.updatedAt=utc(nowMs);return{changed:true,resumed:false,packet};
}
export function renew(packet,args) {
  requireLease(packet,args);packet.lease.expiresAt=utc(args.nowMs+3600000);packet.updatedAt=utc(args.nowMs);return packet;
}
export function release(packet,args) {
  requireLease(packet,args);packet.status='queued';packet.lease=null;packet.updatedAt=utc(args.nowMs);return packet;
}
export function requeue(packet,{expectedGeneration,reason,nowMs}) {
  validatePacket(packet);checkClock(nowMs);
  if(packet.status!=='completed'||packet.generation!==expectedGeneration||!note(reason))throw Error('Requeue requires a completed current generation and explanation');
  packet.history=[...(packet.history??[]),{generation:packet.generation,completedAt:packet.completedAt,reason,reopenedAt:utc(nowMs)}];
  packet.status='queued';packet.lease=null;packet.completedAt=null;packet.progress=(packet.progress??[]).filter(r=>r.status==='ready');packet.updatedAt=utc(nowMs);
  return packet;
}
export function mergeReceipts(previous,incoming) {
  const merged=new Map();
  for(const row of [...(previous?.assets??[]),...(incoming?.assets??[])]){
    if(!row||row.source!=='direct-s3'||row.contentType!=='image/webp'||!/^media\/[a-z0-9_-]+\/[A-Za-z0-9_.\/-]+\.webp$/.test(row.key??'')||row.key.includes('..')||row.key.includes('//')||!hash(row.sha256)||!positive(row.bytes)||row.bytes>15000000||!Number.isFinite(Date.parse(row.uploadedAt??''))||!['uploaded-and-verified','already-matching'].includes(row.status))
      throw Error('Invalid verified upload receipt');
    const old=merged.get(row.key);if(old&&(old.sha256!==row.sha256||old.bytes!==row.bytes))throw Error('Conflicting receipt under immutable key '+row.key);
    if(!old)merged.set(row.key,clone(row));
  }
  return{version:1,assets:[...merged.values()].sort((a,b)=>a.key.localeCompare(b.key))};
}
export function validateReadyResult(result,job,receipt) {
  if(result.source!==job.source||!hash(result.sourceSha256)||!positive(result.sourceWidth)||!positive(result.sourceHeight))throw Error('Source metadata missing or does not match frozen job');
  if(job.sourceSha256&&job.sourceSha256!==result.sourceSha256)throw Error('Frozen source hash changed');
  for(const key of ['sourceWidth','sourceHeight'])if(job[key]&&job[key]!==result[key])throw Error('Frozen source dimensions changed');
  const p=result.processing;
  if(!p||p.sharpVersion!=='0.35.5'||p.format!=='webp'||p.quality!==78||p.withoutEnlargement!==true)throw Error('Unexpected image processing recipe');
  if(!Array.isArray(result.recipes)||!result.recipes.length)throw Error('Ready asset needs crop recipes');
  const usageById=new Map((job.usages??[]).map(u=>[u.id,u])),covered=new Set(),ids=new Set(),allVariants=new Set();
  const receipts=new Map(receipt.assets.map(r=>[r.key,r]));
  for(const recipe of result.recipes){
    if(typeof recipe.id!=='string'||!recipe.id||ids.has(recipe.id))throw Error('Unique recipe ID required');ids.add(recipe.id);
    if(!Array.isArray(recipe.usageIds)||!recipe.usageIds.length||!note(recipe.focusReason)||typeof recipe.objectPosition!=='string'||!recipe.objectPosition.trim())throw Error('Recipe needs usages, focus reason and final object position');
    if(!recipe.visualQA||recipe.visualQA.sourceViewed!==true||recipe.visualQA.previewsViewed!==true||!note(recipe.visualQA.notes))throw Error('Manual visual inspection of source and rendered crops is required');
    for(const id of recipe.usageIds){const usage=usageById.get(id);if(!usage||covered.has(id)||usage.profile!==recipe.profile)throw Error('Unknown, duplicate or wrong-profile usage');covered.add(id);}
    const c=recipe.crop;if(!c||!['left','top','width','height'].every(k=>Number.isSafeInteger(c[k]))||c.left<0||c.top<0||c.width<1||c.height<1||c.left+c.width>result.sourceWidth||c.top+c.height>result.sourceHeight)throw Error('Crop outside original pixels');
    if(!Array.isArray(recipe.variants)||!recipe.variants.length||recipe.variants.length>3)throw Error('Ready recipe needs 1–3 size variants');
    const widths=new Set();
    for(const variant of recipe.variants){
      if(!positive(variant.width)||!positive(variant.height)||variant.width>c.width||variant.height>c.height||widths.has(variant.width)||Math.abs(variant.height-variant.width*c.height/c.width)>1.1)throw Error('Invalid dimensions, duplicate width or image enlargement');
      widths.add(variant.width);
      const allowedNew=variant.key?.startsWith('media/hero-mobile-swarm/');
      const allowedExisting=(job.existingCrops??[]).some(old=>old.sourceSha256===result.sourceSha256&&(old.variants??[]).some(v=>v.key===variant.key&&v.sha256===variant.sha256&&v.bytes===variant.bytes));
      if(!allowedNew&&!allowedExisting)throw Error('Variant key outside this swarm or verified existing crop');
      if(!hash(variant.sha256)||!positive(variant.bytes))throw Error('Variant checksum and size required');
      const uploaded=receipts.get(variant.key);if(!uploaded||uploaded.sha256!==variant.sha256||uploaded.bytes!==variant.bytes)throw Error('Variant lacks a matching verified upload receipt');
      allVariants.add(variant.key);
    }
  }
  if(covered.size!==usageById.size)throw Error('Ready result does not cover every frozen hero usage');
  return allVariants;
}
function submissionData(request){return{kind:request.action,results:request.results,receipt:request.receipt??{version:1,assets:[]}};}
export function previousSubmission(packet,request) {
  if(typeof request.submissionId!=='string'||!/^[A-Za-z0-9_-]{10,120}$/.test(request.submissionId))throw Error('Persistent submissionId required (10–120 safe characters)');
  checkIdentity(request.ownerId,request.token);
  const fingerprint=digest(submissionData(request));const old=(packet.submissions??[]).find(x=>x.id===request.submissionId);
  if(old){if(old.fingerprint!==fingerprint||old.ownerId!==request.ownerId||old.token!==request.token||old.generation!==request.generation)throw Error('submissionId already used for different payload or owner generation');return{alreadySaved:true,fingerprint,submission:old};}
  return{alreadySaved:false,fingerprint};
}
export function saveResults(packet,request) {
  const prior=previousSubmission(packet,request);if(prior.alreadySaved)return{alreadySaved:true,packet};
  requireLease(packet,request);
  if(!['checkpoint','submit'].includes(request.action)||!Array.isArray(request.results)||!request.results.length||request.results.length>packet.jobs.length||new Set(request.results.map(r=>r.assetId)).size!==request.results.length)throw Error('Submit a nonempty unique subset of the packet jobs');
  const byId=new Map(packet.jobs.map(j=>[j.id,j])),progress=new Map((packet.progress??[]).map(r=>[r.assetId,r]));
  for(const result of request.results){
    const job=byId.get(result.assetId);if(!job||!['ready','review','retry','stale_source'].includes(result.status))throw Error('Unknown job or result status');
    if(result.source!==job.source)throw Error('Result source differs from frozen job');
    if(result.status!=='ready'&&!note(result.note))throw Error('Non-ready result needs a concrete explanation');
    const old=progress.get(result.assetId);if(old?.status==='ready'&&canonical(old)!==canonical(result))throw Error('Accepted ready result is immutable; coordinator must create a revised queue');
    progress.set(result.assetId,clone(result));
  }
  const receipt=mergeReceipts(packet.receipt,request.receipt??{version:1,assets:[]}),usedKeys=new Set();
  for(const result of progress.values())if(result.status==='ready')for(const key of validateReadyResult(result,byId.get(result.assetId),receipt))usedKeys.add(key);
  for(const row of receipt.assets)if(!usedKeys.has(row.key))throw Error('Receipt contains an unrelated or unaccepted object');
  if(request.action==='submit'&&progress.size!==packet.jobs.length)throw Error('Final submit must account for every photo in the packet');
  packet.progress=[...progress.values()].sort((a,b)=>a.assetId.localeCompare(b.assetId));packet.receipt=receipt;packet.updatedAt=utc(request.nowMs);
  packet.submissions=[...(packet.submissions??[]),{id:request.submissionId,fingerprint:prior.fingerprint,ownerId:request.ownerId,token:request.token,generation:request.generation,kind:request.action,savedAt:utc(request.nowMs)}];
  if(request.action==='submit'){packet.status='completed';packet.completedAt=utc(request.nowMs);packet.completedBy=request.ownerId;packet.lease=null;}
  return{alreadySaved:false,packet};
}
export function summarize(packets,nowMs){
  const counts={packets:packets.length,queued:0,leased:0,expired:0,completed:0,photos:0,ready:0,review:0,retry:0,stale_source:0,pending:0};
  for(const p of packets){validatePacket(p);counts[p.status]++;if(p.status==='leased'&&!activeLease(p,nowMs))counts.expired++;const total=p.jobs?.length??p.assetIds.length;counts.photos+=total;for(const r of p.progress??[])counts[r.status]++;counts.pending+=total-(p.progress??[]).length;}
  return counts;
}
