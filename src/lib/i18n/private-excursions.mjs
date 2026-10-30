/** Nonpublic, source-bound EN overlays for the 11 canonical pilot Excursions.
 * Never creates duplicate content entities and never authorizes a production EN release.
 */
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { pilotMediaUrl, renderPilotMarkdown } from './pilot-html.mjs';

const MANIFEST='data/i18n/pilot-excursions/v1/manifest.json';
const CYRILLIC=/[\u0400-\u052F]/u;
const allowedKeys=new Set([
 'title','lead','body','destinationName','route','language','included','notIncluded','notes',
 'duration','format','priceNote','searchAliases','hero','gallery'
]);
const fail=reason=>{throw new Error('Private EN Excursion: '+reason);};
const text=v=>typeof v==='string'&&v.trim().length>0&&!CYRILLIC.test(v);
const arr=v=>Array.isArray(v)&&v.every(text);
const blobSha=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const safeSource=path=>typeof path==='string'&&
 /^src\/content\/excursions\/[a-z0-9][a-z0-9-]*\.md$/.test(path);
const safeSlug=v=>typeof v==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);

export function pilotExcursionUrl(slug){
 if(!safeSlug(slug))fail('Unsafe Excursion slug');
 return '/en-pilot-private/excursion/'+slug+'/';
}
export function validatePrivateExcursionManifest(manifest){
 if(!manifest||manifest.schemaVersion!==1||manifest.locale!=='en'||manifest.count!==11||
    manifest.publicationAuthorized!==false||manifest.status!=='prepared_for_private_preview'||
    !Array.isArray(manifest.entries)||manifest.entries.length!==11)fail('Manifest or private gate invalid');
 const ids=new Set(),slugs=new Set(),files=new Set();
 for(const m of manifest.entries){
  if(!/^excursion_[a-z0-9_]+$/.test(m.id)||ids.has(m.id)||
     !safeSlug(m.slug)||slugs.has(m.slug)||!safeSource(m.sourcePath)||
     !/^[a-f0-9]{40}$/.test(m.sourceBlobSha)||
     m.translationFile!=='data/i18n/pilot-excursions/v1/'+m.id+'.json'||
     files.has(m.translationFile))fail('Invalid/duplicate manifest Excursion '+m?.id);
  ids.add(m.id);slugs.add(m.slug);files.add(m.translationFile);
 }
 return manifest.entries;
}
export function validatePrivateExcursionOverlay(meta,overlay,ruEntry){
 const d=ruEntry?.data,t=overlay?.translation;
 if(!d||d.locale!=='ru'||d.id!==meta.id||d.slug!==meta.slug||
    !['approved','published'].includes(d.status))fail('Canonical RU Excursion identity/status mismatch: '+meta.id);
 if(!overlay||overlay.schemaVersion!==1||overlay.entityId!==meta.id||
    overlay.locale!=='en'||overlay.publicationAuthorized!==false||
    overlay.status!=='prepared_for_private_preview'||
    overlay.source?.path!==meta.sourcePath||
    overlay.source?.gitBlobSha!==meta.sourceBlobSha||
    overlay.source?.locale!=='ru'||
    overlay.provenance?.method!=='assistant_translation_from_canonical_ru'||
    overlay.provenance?.independentEditorialReview!==false)fail('Unverified source/EN overlay: '+meta.id);
 if(!t||typeof t!=='object'||Object.keys(t).some(k=>!allowedKeys.has(k))||
   !text(t.title)||!text(t.lead)||!text(t.body)||!text(t.destinationName))fail('Incomplete English narrative '+meta.id);
 for(const key of ['route','language','included','notIncluded','notes','searchAliases']){
  const original=Array.isArray(d[key])?d[key]:[];
  const localized=t[key]??[];
  if(!arr(localized)||localized.length!==original.length)fail('Missing/extra English text '+key+': '+meta.id);
 }
 for(const key of ['duration','format','priceNote']){
  const old=typeof d[key]==='string'&&d[key].trim();
  if(Boolean(old)!==Boolean(t[key])||(old&&!text(t[key])))fail('English '+key+' missing or invented: '+meta.id);
 }
 if(!d.hero?.src||!text(t.hero?.alt)||
   Boolean(d.hero.hover)!==Boolean(t.hero?.hover)||
   (d.hero.hover&&!text(t.hero.hover)))fail('Hero translation missing: '+meta.id);
 if(!Array.isArray(t.gallery)||t.gallery.length!==(d.gallery??[]).length)fail('Gallery translation count mismatch: '+meta.id);
 for(let i=0;i<t.gallery.length;i++){
  const item=t.gallery[i],shared=d.gallery[i];
  if(!text(item.alt)||Boolean(shared.hover)!==Boolean(item.hover)||item.src!==undefined||
     (shared.hover&&!text(item.hover)))fail('Gallery alt/hover missing: '+meta.id+'#'+i);
 }
 if(CYRILLIC.test(JSON.stringify(t)))fail('Cyrillic in English Excursion '+meta.id);
 return true;
}
export function materializePrivateExcursion(meta,overlay,ruEntry){
 validatePrivateExcursionOverlay(meta,overlay,ruEntry);
 const t=overlay.translation,d=ruEntry.data;
 const hero={...d.hero,src:pilotMediaUrl(d.hero.src),alt:t.hero.alt,
   ...(t.hero.hover?{hover:t.hero.hover}:{})};
 const gallery=d.gallery.map((asset,i)=>({...asset,
   src:pilotMediaUrl(asset.src),alt:t.gallery[i].alt,
   ...(t.gallery[i].hover?{hover:t.gallery[i].hover}:{})}));
 const data={...d,...t,id:meta.id,locale:'en',slug:d.slug,status:d.status,hero,gallery};
 delete data.body;
 // Media paths, numeric prices and stable entity relations always come from RU data.
 const body=t.body;
 const record={id:meta.id,locale:'en',data,body,rendered:{html:renderPilotMarkdown(body)},
  previewUrl:pilotExcursionUrl(d.slug)};
 if(CYRILLIC.test(JSON.stringify({title:data.title,lead:data.lead,body,route:data.route,
   gallery:data.gallery,hero:data.hero,included:data.included,notIncluded:data.notIncluded,
   notes:data.notes,language:data.language,duration:data.duration,format:data.format,
   priceNote:data.priceNote,destinationName:data.destinationName,searchAliases:data.searchAliases})))
   fail('Leaked RU visible text '+meta.id);
 return record;
}
export async function readPrivateExcursionOverlays(root,ruRecords,verifySources=true){
 const base=resolve(root);
 const manifest=JSON.parse(await readFile(join(base,MANIFEST),'utf8'));
 const entries=validatePrivateExcursionManifest(manifest);
 const byId=new Map(ruRecords.map(x=>[x?.data?.id,x]));
 if(byId.size!==entries.length)fail('Expected exactly 11 canonical RU Excursion records');
 const records=[];
 for(const meta of entries){
  if(verifySources){
   const bytes=await readFile(join(base,meta.sourcePath));
   if(blobSha(bytes)!==meta.sourceBlobSha)fail('Source Git blob changed: '+meta.id);
  }
  const overlay=JSON.parse(await readFile(join(base,meta.translationFile),'utf8'));
  records.push(materializePrivateExcursion(meta,overlay,byId.get(meta.id)));
 }
 return {manifest,records};
}
/** Both production/main and the EN branch must match immutable source fingerprints. */
export async function verifyPrivateExcursionSourceFiles(root,manifestRoot=root){
 const base=resolve(root);
 const manifest=JSON.parse(await readFile(join(resolve(manifestRoot),MANIFEST),'utf8'));
 const entries=validatePrivateExcursionManifest(manifest);
 const errors=[];
 for(const m of entries){
  try{
   const bytes=await readFile(join(base,m.sourcePath));
   if(blobSha(bytes)!==m.sourceBlobSha)errors.push('changed: '+m.id);
  }catch(e){errors.push(m.id+': '+String(e));}
 }
 if(errors.length)fail('RU source fingerprints: '+errors.join('; '));
 return entries.length;
}
