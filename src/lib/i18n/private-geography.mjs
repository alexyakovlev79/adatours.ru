/** Strict nonpublishing geography overlays for the three-country pilot.
 * Existing RU facts, IDs and media are the only source of nontranslated values.
 */
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {pilotMediaUrl} from './pilot-html.mjs';
import {privateRouteForId} from './locale-entity-routes.mjs';
const manifestPath='data/i18n/pilot-geography/v1/manifest.json';
const forbidden=/[\u0400-\u052F]/u;
const good=s=>typeof s==='string'&&s.trim().length>0&&!forbidden.test(s);
const fingerprint=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const fail=m=>{throw Error('Private EN geography: '+m);};
export function validateGeoManifest(manifest){
 if(manifest?.schemaVersion!==1||manifest.locale!=='en'||manifest.publicationAuthorized!==false||
    manifest.status!=='prepared_for_private_visual_pilot'||manifest.items?.length!==7)fail('Manifest gate');
 const ids=manifest.items.map(x=>x.id);
 if(ids.join('|')!=='country_brazil|country_chile|country_colombia|destination_brazil_rio|destination_chile_ostrov_pashi|destination_colombia_bogota|destination_colombia_kartahena')fail('Exact seven pilot IDs');
 for(const m of manifest.items){
  if(!['country','destination'].includes(m.kind)||!good(m.slug)||!good(m.id)||
   !/^[a-f0-9]{40}$/.test(m.sourceBlobSha)||
   !/^src\/content\/(?:countries|destinations)\/[a-z0-9-]+\.md$/.test(m.sourcePath)||
   m.file!=='data/i18n/pilot-geography/v1/'+m.id+'.json')fail('Invalid manifest item '+m.id);
 }
 return manifest.items;
}
export function validateGeoOverlay(m,overlay,source){
 const d=source?.data,t=overlay?.translation;
 if(d?.id!==m.id||d?.slug!==m.slug||d.locale!=='ru'||d.status!=='approved'||
   overlay?.entityId!==m.id||overlay?.locale!=='en'||overlay?.status!=='prepared_for_private_visual_pilot'||
   overlay?.publicationAuthorized!==false||
   overlay?.source?.path!==m.sourcePath||overlay.source?.gitBlobSha!==m.sourceBlobSha||
   overlay?.provenance?.method!=='assistant_translation_from_canonical_ru'||!t)fail('Unverified identity '+m.id);
 if(!good(t.name)||!good(t.summary)||!good(t.body)||!good(t.hero?.alt))fail('Missing English core '+m.id);
 for(const key of ['gallery','featureBands']){
  if(!Array.isArray(t[key])||t[key].length!==(d[key]??[]).length)fail('Count '+key+' '+m.id);
 }
 for(const x of t.gallery){
  if(!good(x.alt)||Boolean(x.hover)===false&&Boolean(d.gallery[t.gallery.indexOf(x)]?.hover)||x.hover&&!good(x.hover))
   fail('Gallery ALT/hover '+m.id);
 }
 for(const x of t.featureBands){
  if(!good(x.eyebrow)||!good(x.title)||!good(x.text))fail('Feature band text '+m.id);
 }
 if(m.kind==='country'){
  for(const key of ['regions','languages']){
   if(!Array.isArray(t[key])||t[key].length!==d[key].length||t[key].some(x=>!good(x)))fail(key+' '+m.id);
  }
  if(!good(t.bestTime))fail('bestTime '+m.id);
 }
 if(m.kind==='destination'){
  if(!/^country_[a-z0-9_]+$/.test(d.countryId))fail('Destination country ID '+m.id);
  if(!Array.isArray(t.facts)||t.facts.length!==d.facts.length||
     t.facts.some(x=>!good(x.value)||!good(x.label)))fail('Facts '+m.id);
 }
 if(forbidden.test(JSON.stringify(t)))fail('Untranslated Russian text '+m.id);
 return true;
}
export function materializePrivateGeo(m,overlay,entry){
 validateGeoOverlay(m,overlay,entry);
 const t=overlay.translation,d=entry.data;
 const gallery=d.gallery.map((item,i)=>({...item,
  src:pilotMediaUrl(item.src),alt:t.gallery[i].alt,
  ...(t.gallery[i].hover?{hover:t.gallery[i].hover}:{})}));
 const bands=d.featureBands.map((band,i)=>({
  ...band,eyebrow:t.featureBands[i].eyebrow,title:t.featureBands[i].title,
  text:t.featureBands[i].text,image:pilotMediaUrl(band.image),
  ...(m.id==='country_brazil'&&i===0?{href:'/en-pilot-private/place/rio-de-janeiro/'}:{href:undefined})
 }));
 const data={...d,...t,locale:'en',id:m.id,slug:m.slug,
  hero:{...d.hero,src:pilotMediaUrl(d.hero.src),alt:t.hero.alt,...(t.hero.hover?{hover:t.hero.hover}:{})},
  gallery,featureBands:bands,
  searchAliases:(d.searchAliases??[]).filter(x=>typeof x==='string'&&!forbidden.test(x))
 };
 delete data.body;
 return {id:m.id,kind:m.kind,locale:'en',data,body:t.body,url:privateRouteForId(m.id)};
}
export async function readPrivateGeography(root,canonicalEntries){
 const base=resolve(root),m=JSON.parse(await readFile(join(base,manifestPath),'utf8'));
 const manifest=validateGeoManifest(m),map=new Map(canonicalEntries.map(e=>[e.data.id,e]));
 if(map.size!==7||manifest.some(item=>!map.has(item.id)))fail('Seven RU geography records required');
 const result=[];
 for(const item of manifest){
  const bytes=await readFile(join(base,item.sourcePath));
  if(fingerprint(bytes)!==item.sourceBlobSha)fail('Stale canonical source '+item.id);
  const overlay=JSON.parse(await readFile(join(base,item.file),'utf8'));
  result.push(materializePrivateGeo(item,overlay,map.get(item.id)));
 }
 return result;
}
export async function verifyPrivateGeoSources(root,manifestRoot=root){
 const base=resolve(root),manifest=JSON.parse(await readFile(join(resolve(manifestRoot),manifestPath),'utf8'));
 const items=validateGeoManifest(manifest);
 for(const m of items){
  if(fingerprint(await readFile(join(base,m.sourcePath)))!==m.sourceBlobSha)fail('Stale source '+m.id);
 }
 return items.length;
}
