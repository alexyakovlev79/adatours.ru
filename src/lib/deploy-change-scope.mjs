// Explicit bounded changes only. Unknown changes always receive full CI.
const serial = (x) => JSON.stringify(x);
const keys = (x) => Object.keys(x || {}).sort().join(',');
const json = (x) => { try { return JSON.parse(x); } catch { return null; } };
const text = (x) => typeof x === 'string' && x.length > 0 && x.length <= 20000;
const filePhoto = (x) => typeof x === 'string' && /^\/media\/[a-z0-9_-]+\/[A-Za-z0-9_./-]+\.(webp|jpg|jpeg|png|avif)$/i.test(x) && !x.includes('..');
const allowedMd = /^src\/content\/(countries|destinations|tours|excursions|themes|people)\/[A-Za-z0-9_.\/-]+\.md$/;
const documentation = /^(docs\/|README(?:\.|$))/;
export function safeTeam(before, after) {
  const a=json(before), b=json(after);
  if (!a || !b || keys(a)!==keys(b) || a.sourceUrl!==b.sourceUrl ||
      !Array.isArray(a.members) || !Array.isArray(b.members) || a.members.length!==b.members.length) return false;
  if (a.updatedAt!==b.updatedAt && !/^\d{4}-\d\d-\d\d/.test(b.updatedAt||'')) return false;
  for(let i=0;i<a.members.length;i++){
    const x=a.members[i], y=b.members[i];
    if(!x||!y||keys(x)!==keys(y)||x.id!==y.id) return false;
    for(const k of Object.keys(x))
      if(!['name','role','paragraphs','photo'].includes(k) && serial(x[k])!==serial(y[k])) return false;
    if(!text(y.name)||!text(y.role)||!Array.isArray(y.paragraphs)||!y.paragraphs.every(text)) return false;
    if(!x.photo||!y.photo||keys(x.photo)!==keys(y.photo)) return false;
    for(const k of Object.keys(x.photo))
      if(!['src','alt','hover','width','height'].includes(k)) return false;
    if(!filePhoto(y.photo.src)||!text(y.photo.alt)||!text(y.photo.hover)||
       !Number.isInteger(y.photo.width)||!Number.isInteger(y.photo.height)||
       y.photo.width<1||y.photo.width>12000||y.photo.height<1||y.photo.height>12000) return false;
  }
  return true;
}
export function safeInterestCopy(before, after) {
  const a=json(before),b=json(after);
  if(!a||!b||keys(a)!==keys(b))return false;
  for(const id of Object.keys(a)){
    if(!a[id]||!b[id]||keys(a[id])!==keys(b[id]))return false;
    for(const k of Object.keys(a[id])){
      if(['toursTitle','tourIntro','geographyIntro','catalogIntro'].includes(k)){
        if(!text(b[id][k]))return false;
      }else if(serial(a[id][k])!==serial(b[id][k]))return false;
    }
  }
  return true;
}
function mdParts(s){
  if(!s.startsWith('---\n'))return null;
  const i=s.indexOf('\n---\n',4);
  return i<0?null:{front:s.slice(0,i+5),lines:s.slice(i+5).split('\n')};
}
function markup(s){
  if(/^#{1,6}\s/.test(s.trim()))return 'heading:'+s;
  const markers=s.replace(/[^*_#[\](){}<>|!~\x60]/g,'');
  const links=[...s.matchAll(/https?:\/\/[^\s)]+|\{\{[^}]+\}\}|\[[^\]]+\]\([^)]+\)|<[^>]+>|\x60[^\x60]*\x60/g)].map(x=>x[0]);
  const prefix=/^\s*(?:[-*+]\s|\d+\.\s|>\s|\|)/.exec(s)?.[0]||'';
  return serial([!s.trim(),markers,links,prefix]);
}
export function safeMarkdown(before,after){
  const a=mdParts(before), b=mdParts(after);
  return !!a && !!b && a.front===b.front && a.lines.length===b.lines.length
    && a.lines.every((s,i)=>markup(s)===markup(b.lines[i]));
}
export function safeReceipts(before,after){
  const a=json(before),b=json(after);
  if(!a||!b||keys(a)!==keys(b)||a.version!==b.version||
    !Array.isArray(a.assets)||!Array.isArray(b.assets)||
    b.assets.length<a.assets.length||b.assets.length-a.assets.length>30)return false;
  const old=new Map(a.assets.map(x=>[x.key,x]));
  const next=new Map(b.assets.map(x=>[x.key,x]));
  if(old.size!==a.assets.length||next.size!==b.assets.length)return false;
  for(const [k,v] of old)if(!next.has(k)||serial(next.get(k))!==serial(v))return false;
  return b.assets.every(x=>x&&typeof x.key==='string'&&x.key.startsWith('media/')&&
    !x.key.includes('..')&&/^[a-f0-9]{64}$/.test(x.sha256||'')&&Number.isInteger(x.bytes)&&
    x.bytes>0&&text(x.contentType)&&text(x.uploadedAt));
}
export function safeEnhancements(before,after){
  const a=json(before),b=json(after);
  if(!a||!b||keys(a)!==keys(b)||!Array.isArray(a.enhancements)||
    !Array.isArray(b.enhancements)||b.enhancements.length<a.enhancements.length||
    b.enhancements.length-a.enhancements.length>30)return false;
  for(const k of Object.keys(a))if(k!=='enhancements'&&serial(a[k])!==serial(b[k]))return false;
  for(let i=0;i<a.enhancements.length;i++)
    if(serial(a.enhancements[i])!==serial(b.enhancements[i]))return false;
  const originals=new Set(a.enhancements.map(x=>x.source));
  for(const e of b.enhancements.slice(a.enhancements.length)){
    if(!e||typeof e.source!=='string'||originals.has(e.source)||
      !filePhoto(e.enhanced)||e.method!=='gpt-image'||e.revision!==1||
      !text(e.enhancedAt))return false;
    originals.add(e.source);
  }
  return true;
}
export function classifyChanges(changes,previous,current){
  if(!Array.isArray(changes)||!changes.length||changes.length>24)return {mode:'full',reason:'Unbounded diff'};
  let count=0;
  for(const {status,path} of changes){
    if(!path||/[\r\n\\]/.test(path))return {mode:'full',reason:'Invalid path'};
    if(documentation.test(path))continue;
    if(status!=='M')return {mode:'full',reason:'New/deleted/renamed runtime file: '+path};
    const validator=path==='src/data/organization/team.json'?safeTeam:
      path==='src/data/interest-copy.json'?safeInterestCopy:
      path==='src/data/media/direct-s3-uploads.json'?safeReceipts:
      path==='src/data/media/photo-enhancements.json'?safeEnhancements:
      allowedMd.test(path)?safeMarkdown:null;
    if(!validator)return {mode:'full',reason:'Code, schema or structural path: '+path};
    try{
      if(!validator(previous(path),current(path)))return {mode:'full',reason:'Unsafe structural edit: '+path};
    }catch{return {mode:'full',reason:'Content diff inaccessible: '+path};}
    count++;
  }
  return {mode:'fast',reason:count?'Verified small copy/media-only change':'Documentation only'};
}
