/** Adapter from current Astro ContentCollection records to strict locale overlays.
 * Keeps stable IDs, shared commercial facts and media; no second Tour catalogue.
 * Does not publish EN or silently translate values; requires a complete block map.
 */
import { createSourceSnapshot, assembleLocalizedContent } from './content-overlay.mjs';

const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const BAD=new Set(['__proto__','prototype','constructor']);
const TYPES=new Set(['tour','country','destination','excursion','theme']);
const clone=(value)=>structuredClone(value);
function tokens(pointer) {
 if(typeof pointer!=='string'||!pointer.startsWith('/')||pointer.startsWith('//'))throw new TypeError('Invalid JSON pointer');
 const parts=pointer.slice(1).split('/').map(s=>{
  if(/~(?:[^01]|$)/.test(s))throw new TypeError('Invalid JSON pointer escape');
  return s.replace(/~1/g,'/').replace(/~0/g,'~');
 });
 if(parts.some(x=>BAD.has(x)||x.length===0))throw new TypeError('Unsafe JSON pointer');
 return parts;
}
function slotGet(data,path){
 let x=data;
 for(const s of tokens(path)){
  if(x==null||typeof x!=='object'||!has(x,s))throw new TypeError('Missing mapped field: '+path);
  x=x[s];
 }
 return x;
}
function slotSet(data,path,value){
 const t=tokens(path);let x=data;
 for(const s of t.slice(0,-1)){
  if(x==null||typeof x!=='object'||!has(x,s))throw new TypeError('Missing mapped parent: '+path);
  x=x[s];
 }
 if(x==null||typeof x!=='object'||!has(x,t[t.length-1]))throw new TypeError('Missing mapped target: '+path);
 x[t[t.length-1]]=value;
}
function collect(type,root){
 const slots=[],push=(path,field,text)=>{
  if(typeof text==='string'&&text.trim())slots.push({path,field,text});
 };
 const scalar=(p,f)=>{if(has(root,p))push('/'+p,f,root[p]);};
 const arr=(p,f)=>{
  if(Array.isArray(root[p]))root[p].forEach((v,i)=>push('/'+p+'/'+i,f,v));
 };
 const media=(v,p)=>{if(!v||typeof v!=='object'||Array.isArray(v))return;
  for(const f of ['alt','hover','caption'])if(has(v,f))push(p+'/'+f,'media.'+f,v[f]);
 };
 const mediaArray=(v,p)=>{if(Array.isArray(v))v.forEach((x,i)=>media(x,p+'/'+i));};
 if(type==='tour'){
  scalar('title','title');scalar('lead','lead');scalar('priceNote','priceNote');
  scalar('format','formatLabel');arr('route','itinerary.label');
  arr('dates','note');arr('included','included');arr('notIncluded','notIncluded');arr('notes','note');
  (root.highlights||[]).forEach((r,i)=>{push('/highlights/'+i+'/title','highlight.title',r.title);
    push('/highlights/'+i+'/text','highlight.text',r.text);media(r.image,'/highlights/'+i+'/image');});
  (root.itinerary||[]).forEach((r,i)=>{
    for(const [f,key] of [['label','itinerary.label'],['title','itinerary.title'],['text','itinerary.text']])push('/itinerary/'+i+'/'+f,key,r[f]);
    if(Array.isArray(r.places))r.places.forEach((t,j)=>push('/itinerary/'+i+'/places/'+j,'itinerary.label',t));
    (r.contentBlocks||[]).forEach((b,j)=>{
      if(has(b,'title'))push('/itinerary/'+i+'/contentBlocks/'+j+'/title','contentBlock.title',b.title);
      if(has(b,'text'))push('/itinerary/'+i+'/contentBlocks/'+j+'/text','contentBlock.text',b.text);
    });
    (r.subsections||[]).forEach((v,j)=>{
      push('/itinerary/'+i+'/subsections/'+j+'/title','subsection.title',v.title);
      push('/itinerary/'+i+'/subsections/'+j+'/text','subsection.text',v.text);
    });
    media(r.image,'/itinerary/'+i+'/image');mediaArray(r.images,'/itinerary/'+i+'/images');
  });
  (root.faq||[]).forEach((x,i)=>{push('/faq/'+i+'/question','faq.question',x.question);
    push('/faq/'+i+'/answer','faq.answer',x.answer);});
 }else if(type==='excursion'){
  scalar('title','title');scalar('lead','lead');scalar('destinationName','destinationName');
  scalar('duration','durationText');scalar('format','formatLabel');scalar('priceNote','priceNote');
  arr('language','languageLabel');arr('route','note');
  arr('included','included');arr('notIncluded','notIncluded');arr('notes','note');
 }else if(type==='country'||type==='destination'){
  scalar('name','name');scalar('summary','summary');
  if(type==='country'){
   scalar('bestTime','bestTime');scalar('entryNotes','entryNotes');
   arr('regions','name');arr('languages','name');
  }
  (root.featureBands||[]).forEach((r,i)=>{
   for(const key of ['eyebrow','title','text'])push('/featureBands/'+i+'/'+key,'featureBand.'+key,r[key]);
  });
  if(type==='destination')(root.facts||[]).forEach((r,i)=>{
   push('/facts/'+i+'/label','fact.label',r.label);
   push('/facts/'+i+'/value','fact.label',r.value);
  });
 }else if(type==='theme'){
  scalar('name','name');scalar('summary','summary');
 }
 media(root.hero,'/hero');mediaArray(root.gallery,'/gallery');
 if(typeof root.__body==='string')push('/__body','body',root.__body);
 const seen=new Set();
 for(const s of slots){if(seen.has(s.path))throw new TypeError('Duplicate visible path: '+s.path);seen.add(s.path);}
 return slots;
}
export function visibleLocalizationSlots(entry,entityType) {
 if(!TYPES.has(entityType))throw new TypeError('Unsupported entity type');
 if(!entry||!entry.data||!entry.data.id||entry.data.locale!=='ru')throw new TypeError('Expected canonical RU Astro entry');
 const root={...entry.data,__body:entry.body??''};
 return collect(entityType,root).map(x=>({...x}));
}
/** Block map is a manually aligned stable-ID sidecar, never an array-index identity. */
export function sourceFromContentEntry(entry,entityType,blockMap) {
 const slots=visibleLocalizationSlots(entry,entityType);
 if(!blockMap||blockMap.schemaVersion!==1||blockMap.entityId!==entry.data.id||
    blockMap.entityType!==entityType||!Array.isArray(blockMap.paths))throw new TypeError('Block map identity required');
 const paths=new Set(),ids=new Set(),sourceBlocks=[];
 const byPath=new Map(slots.map(x=>[x.path,x]));
 for(const desc of blockMap.paths){
  if(!desc||typeof desc.blockId!=='string'||!desc.blockId.trim()||ids.has(desc.blockId))throw new TypeError('Duplicate/missing stable block ID');
  ids.add(desc.blockId);
  if(typeof desc.path!=='string'||paths.has(desc.path)||!byPath.has(desc.path))throw new TypeError('Unknown or duplicate mapped visible path: '+desc.path);
  paths.add(desc.path);
  const slot=byPath.get(desc.path);
  if(slot.field!==desc.field)throw new TypeError('Incorrect semantic field for '+desc.path);
  sourceBlocks.push({blockId:desc.blockId,field:desc.field,text:slot.text,dependsOn:desc.dependsOn??[]});
 }
 if(paths.size!==slots.length){
  const missing=slots.filter(x=>!paths.has(x.path)).map(x=>x.path);
  throw new TypeError('Unmapped visible text (no EN fallback): '+missing.join(', '));
 }
 const facts=JSON.parse(JSON.stringify({...entry.data,__body:entry.body??''}));
 const media={};
 for(const prop of ['hero','gallery','heroVideo']){
  if(has(facts,prop)){media[prop]=facts[prop];delete facts[prop];}
 }
 for(const slot of slots){
  const target=slot.path.startsWith('/hero/')||slot.path.startsWith('/gallery/')?media:facts;
  slotSet(target,slot.path,'');
 }
 return createSourceSnapshot({
  schemaVersion:1,entityId:entry.data.id,entityType,locale:'ru',
  shared:{facts,media},blocks:sourceBlocks
 });
}
/** Assemble only an already-approved overlay. No permissive RU fallback. */
export function localizeContentEntry(entry,entityType,blockMap,overlay,wordSources={}) {
 const source=sourceFromContentEntry(entry,entityType,blockMap);
 const translated=assembleLocalizedContent(source,overlay,{wordSources});
 const root=clone({...entry.data,__body:entry.body??''});
 const targetById=new Map(translated.blocks.map(x=>[x.blockId,x.text]));
 for(const desc of blockMap.paths){
  const text=targetById.get(desc.blockId);
  if(typeof text!=='string')throw new TypeError('Approved English text missing: '+desc.blockId);
  if(/[\u0400-\u052F]/u.test(text))throw new TypeError('Cyrillic in English field: '+desc.path);
  slotSet(root,desc.path,text);
 }
 const body=root.__body;delete root.__body;
 root.locale='en';
 return { ...entry, id:'en:'+entry.data.id, data:root, body,
  _i18nSourceId:entry.data.id,_i18nSourceFingerprints:translated.shared };
}
/** Source records are still the one authority; no new EN Tour/source files. */
export async function getLocalizedCollection(collection,locale,readRecords,resolveEnglish) {
 if(!['ru','en'].includes(locale))throw new TypeError('Unsupported locale');
 if(typeof readRecords!=='function')throw new TypeError('readRecords is required');
 const rows=await readRecords(collection);
 if(!Array.isArray(rows))throw new TypeError('Collection records must be an array');
 const sourceRows=rows.filter(row=>row.data.locale==='ru');
 if(locale==='ru')return sourceRows;
 if(typeof resolveEnglish!=='function')throw new TypeError('Approved EN resolver is required');
 const byType={countries:'country',destinations:'destination',tours:'tour',excursions:'excursion',themes:'theme'};
 const type=byType[collection];if(!type)throw new TypeError('Unsupported EN collection');
 const out=[];
 for(const entry of sourceRows){
  const resolved=await resolveEnglish(entry.data.id,type);
  if(resolved==null)continue; // Cannot publish a nonexistent translation.
  out.push(localizeContentEntry(entry,type,resolved.blockMap,resolved.overlay,resolved.wordSources));
 }
 return out;
}
