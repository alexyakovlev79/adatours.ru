/** Astro-facing locale collection bridge.
 *
 * RU uses the existing canonical Content Collections untouched. Published EN
 * is fail-closed through the global locale release gates. The nonpublic EN
 * pilot is an explicit source-bound mode: it cannot bypass the approval
 * contract of getLocalizedCollection() or silently promote draft blocks.
 */
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {getLocalizedCollection} from './content-adapter.mjs';
import {planProgressiveEnglishCollection} from './progressive-locale.mjs';
import {resolveAstroBuildContext} from './build-context.mjs';
import {enStagingSiteEnabled} from './en-staging-site.mjs';
import {PILOT_TOURS,privatePilotEnabled,assertPilotRenderSource,pilotExcursionDependencies} from './pilot-html.mjs';
import {readPrivateGeography} from './private-geography.mjs';
import {readPrivateExcursionOverlays} from './private-excursions.mjs';
import {privatePilotRouteIndex} from './locale-entity-routes.mjs';

const KINDS=Object.freeze({countries:'country',destinations:'destination',tours:'tour',excursions:'excursion'});
const fail=m=>{throw Error('Astro locale collection: '+m);};
const kindFor=collection=>{
 if(!Object.hasOwn(KINDS,collection))fail('Unsupported collection '+String(collection));
 return KINDS[collection];
};
const privateIds=Object.fromEntries(Object.keys(KINDS).map(collection=>[
 collection,new Set(privatePilotRouteIndex.entries()
  .filter(row=>row.kind===KINDS[collection]).map(row=>row.id))
]));
const sourceDigest=bytes=>createHash('sha256').update(bytes).digest('hex');

function exactRuRecords(collection,rows) {
 const expected=privateIds[collection];
 if(!Array.isArray(rows))fail('Content adapter must receive arrays: '+collection);
 const selected=rows.filter(entry=>entry?.data?.locale==='ru'&&expected.has(entry.data.id));
 const ids=selected.map(entry=>entry.data.id);
 if(ids.length!==expected.size||new Set(ids).size!==expected.size)
  fail('Missing or duplicate canonical RU records: '+collection);
 for(const entry of selected){
  if(!['approved','published'].includes(entry.data.status))
   fail('Inactive canonical RU entity: '+entry.data.id);
 }
 return selected;
}

async function readPilotTours(root,sourceRows) {
 const base=resolve(root);
 const path='data/i18n/pilot-previews/v1';
 const readJson=async p=>JSON.parse(await readFile(join(base,path,p),'utf8'));
 const summary=await readJson('summary.json');
 const records=await Promise.all(PILOT_TOURS.map(s=>readJson('rendered/'+s.id+'.json')));
 assertPilotRenderSource(records,summary);
 const ruById=new Map(sourceRows.map(x=>[x.data.id,x]));
 for(const spec of PILOT_TOURS){
  const original=ruById.get(spec.id),translated=records.find(x=>x.id===spec.id);
  if(!original||!translated||original.data.slug!==spec.slug||
     !['approved','published'].includes(original.data.status))fail('Tour source identity '+spec.id);
  const map=JSON.parse(await readFile(join(base,'data/i18n/block-maps/tours',spec.id+'.json'),'utf8'));
  if(map?.entityId!==spec.id||map?.entityType!=='tour'||
     !/^src\/content\/tours\/[a-z0-9-]+\.md$/.test(map.sourceContentPath)||
     !/^[a-f0-9]{64}$/.test(map.ruBlobSha256))fail('Missing Tour source fingerprint '+spec.id);
  if(sourceDigest(await readFile(join(base,map.sourceContentPath)))!==map.ruBlobSha256)
   fail('Canonical Tour source changed since EN pilot: '+spec.id);
  const src=original.data,en=translated.data;
  for(const key of ['id','slug','priceFrom','currency','durationDays','durationNights','status']){
   if(src[key]!==en[key])fail('Shared Tour fact changed: '+spec.id+'/'+key);
  }
  for(const key of ['countries','routeCountries','destinations','routeDestinations','primaryThemes','themes']){
   if(JSON.stringify(src[key]??[])!==JSON.stringify(en[key]??[]))
    fail('Shared Tour relation changed: '+spec.id+'/'+key);
  }
  if(src.hero?.src!==en.hero?.src)fail('Shared Tour media changed '+spec.id);
 }
 return records;
}

async function buildPrivatePilotSnapshot(readRecords,root) {
 if(privatePilotRouteIndex.size!==21)fail('Unexpected private EN entity graph');
 const kinds=Object.keys(KINDS);
 const sourceRows=Object.fromEntries(await Promise.all(kinds.map(async collection=>{
  const wanted=privateIds[collection];
  const rows=await readRecords(collection,({data})=>data.locale==='ru'&&wanted.has(data.id));
  return [collection,exactRuRecords(collection,rows)];
 })));
 const [tours,geo,excursionData]=await Promise.all([
  readPilotTours(root,sourceRows.tours),
  readPrivateGeography(root,[...sourceRows.countries,...sourceRows.destinations]),
  readPrivateExcursionOverlays(root,sourceRows.excursions)
 ]);
 const excursions=excursionData.records;
 const foundRefs=new Set(tours.flatMap(row=>pilotExcursionDependencies(row.data.itinerary)));
 if(excursions.length!==11||foundRefs.size!==11||
    excursions.some(row=>!foundRefs.has(row.id)))fail('Unresolved pilot Excursion reference');
 const byCollection={
  tours,
  countries:geo.filter(row=>row.kind==='country'),
  destinations:geo.filter(row=>row.kind==='destination'),
  excursions
 };
 const seen=new Set();
 for(const collection of kinds) {
  const rows=byCollection[collection];
  if(rows.length!==privateIds[collection].size)fail('Incomplete EN collection '+collection);
  for(const row of rows){
   const id=row.data?.id??row.id;
   if(row.id!==id||row.data.locale!=='en'||!privateIds[collection].has(id)||seen.has(id))
    fail('Unverified EN identity in '+collection+': '+String(id));
   const route=privatePilotRouteIndex.pathForId(id);
   if(row.url!==undefined&&row.url!==route||row.previewUrl!==undefined&&row.previewUrl!==route)
    fail('EN route mismatch: '+id);
   seen.add(id);
  }
 }
 if(seen.size!==21)fail('Incomplete EN identity graph');
 return Object.freeze(Object.fromEntries(kinds.map(kind=>[kind,Object.freeze(byCollection[kind])])));
}

// Cache only for an immutable build's Astro getCollection function/root, never
// share a rejected source result or a private preview with another reader.
const privateCache=new WeakMap();
export async function readPrivatePilotCollections(readRecords,{root=process.cwd(),env=process.env}={}){
 if(typeof readRecords!=='function')throw new TypeError('Astro getCollection reader required');
 if(!privatePilotEnabled(env)||(env.SITE_LOCALE==='en'&&!enStagingSiteEnabled(env))||env.PUBLIC_EN_RELEASE==='1')
  fail('Private EN content requires closed preview flags');
 const rootPath=resolve(root);
 const cached=privateCache.get(readRecords);
 if(cached?.root===rootPath)return cached.promise;
 const promise=buildPrivatePilotSnapshot(readRecords,rootPath);
 privateCache.set(readRecords,{root:rootPath,promise});
 try{return await promise}
 catch(e){if(privateCache.get(readRecords)?.promise===promise)privateCache.delete(readRecords);throw e}
}

/**
 * One entrypoint for Astro data. Public RU stays on the existing canonical
 * loader. Private EN uses source-bound sidecars; public EN can only pass the
 * main release gates and requires complete approved block overlays.
 */
export async function getAstroLocalizedCollection(collection,locale,readRecords,options={}){
 // Only the noindex dedicated staging host may preview incremental promotion.
 // The regular closed 22-page pilot and public EN release gate remain unchanged.
 if(options.progressivePreview===true){
  if(locale!=='en'||options.privatePreview===true||
     !enStagingSiteEnabled({...process.env,...options.env}))
   fail('Progressive collection requires verified nonpublic staging');
  const plan=await planProgressiveEnglishCollection(collection,readRecords,
   options.resolveApprovedEnglish,{
    dependsOnEnglish:options.dependsOnEnglish,
    readyExternalIds:options.readyExternalIds
   });
  return plan.english;
 }
 kindFor(collection);
 if(typeof readRecords!=='function')throw new TypeError('Astro getCollection reader required');
 if(locale==='ru')return getLocalizedCollection(collection,'ru',readRecords);
 if(locale!=='en')fail('Unsupported locale');
 if(options.privatePreview===true){
  const snapshot=await readPrivatePilotCollections(readRecords,options);
  return snapshot[collection];
 }
 // Build-context refuses public English until status + domain gates are ready.
 resolveAstroBuildContext({...process.env,...options.env,SITE_LOCALE:'en'});
 if(typeof options.resolveApprovedEnglish!=='function')
  fail('Published EN requires approved block resolver');
 return getLocalizedCollection(collection,'en',readRecords,options.resolveApprovedEnglish);
}
