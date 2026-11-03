/** Progressive EN text on the one canonical Astro content store.
 *
 * This is a build-local projection, never another catalogue or source file.
 * IDs, routes, arrays, prices, media and relations belong to the RU entry.
 * Missing/unapproved/stale text keeps its canonical Russian value.
 */
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve, join, dirname} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {enStagingSiteEnabled} from './en-staging-site.mjs';
import {visibleLocalizationSlots, sourceFromContentEntry} from './content-adapter.mjs';
import {createStableBlockMap} from './block-map.mjs';
import {assessOverlay} from './content-overlay.mjs';

const TYPES = Object.freeze({tours:'tour', excursions:'excursion', countries:'country', destinations:'destination'});
const CYRILLIC = /[\u0400-\u052f]/u;
const own = (object,key) => Object.prototype.hasOwnProperty.call(object,key);
const safeText = value => typeof value === 'string' && value.trim().length > 0 && !CYRILLIC.test(value);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const gitBlob = bytes => createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const readJson = async path => JSON.parse(await readFile(path,'utf8'));
const allowedSource = (path,collection) => new RegExp('^src/content/'+collection+'/[a-z0-9][a-z0-9-]*\\.md$').test(path);
const fail = message => {throw new Error('Shared EN content: '+message);};

export function sharedEnglishContentEnabled(env=process.env) {
  return env?.EN_SHARED_CONTENT === '1' && enStagingSiteEnabled(env);
}

function pointerParts(path) {
  if(typeof path !== 'string' || !path.startsWith('/'))fail('Invalid text pointer');
  const parts=path.slice(1).split('/').map(part=>part.replace(/~1/g,'/').replace(/~0/g,'~'));
  if(parts.some(part=>!part || ['__proto__','prototype','constructor'].includes(part)))fail('Unsafe text pointer');
  return parts;
}
function getAt(object,path) {
  let value=object;
  for(const key of pointerParts(path)) {
    if(value===null || typeof value!=='object' || !own(value,key))return undefined;
    value=value[key];
  }
  return value;
}
function setText(object,path,text) {
  const parts=pointerParts(path); let parent=object;
  for(const key of parts.slice(0,-1)) {
    if(parent===null || typeof parent!=='object' || !own(parent,key))fail('Missing text owner '+path);
    parent=parent[key];
  }
  const key=parts.at(-1);
  if(!parent || !own(parent,key) || typeof parent[key]!=='string')fail('Nontext target '+path);
  parent[key]=text;
}

/** The raw semantic format remains available to ranking/filtering logic. */
function applyText(root,path,text,metadata) {
  if(path==='/format')metadata.formatLabel=text;
  else setText(root,path,text);
}

/** Pure projection used by the loader and its regression tests. */
export function projectSharedEnglishEntry(entry,collection,prepared) {
  const type=TYPES[collection];
  if(!type || entry?.data?.locale!=='ru' || !prepared)return {entry,applied:0,status:'untranslated'};
  if(prepared.entityId!==entry.data.id || prepared.entityType!==type)fail('Prepared translation identity mismatch');
  const sourceId=entry.data.id;
  const sourceFingerprint=prepared.sourceFingerprint ?? '';
  if(prepared.stale) return {entry,applied:0,status:'stale',sourceId,sourceFingerprint,reason:prepared.reason};
  const root=structuredClone({...entry.data,__body:entry.body??''});
  delete root._i18n;
  const slots=visibleLocalizationSlots(entry,type);
  const metadata={contentLanguage:'ru',translatedFields:0,sourceId,sourceFingerprint,
    sourceName:entry.data.name??entry.data.title??''};
  let translated=0;
  const missing=[];
  let sourceKind;
  if(prepared.overlay) {
    // Stable ownership + source/dependency hashes permit an unrelated image
    // change or one changed text slot without invalidating every translation.
    let map,source,assessment;
    try {
      map=createStableBlockMap(entry,type);
      source=sourceFromContentEntry(entry,type,map);
      assessment=assessOverlay(source,prepared.overlay,{wordSources:prepared.wordSources??{}});
    } catch(error) {
      return {entry,applied:0,status:'stale',sourceId,sourceFingerprint,reason:'source_block_map_changed: '+error.message};
    }
    const global=assessment.issues.filter(issue=>!issue.blockId);
    if(global.length)return {entry,applied:0,status:'invalid',sourceId,sourceFingerprint,reason:global.map(x=>x.code).join(',')};
    const rejected=new Set(assessment.issues.map(issue=>issue.blockId));
    const target=new Map(prepared.overlay.blocks.map(block=>[block.blockId,block]));
    for(const slot of map.paths) {
      const block=target.get(slot.blockId);
      if(!rejected.has(slot.blockId) && block?.state==='approved' && safeText(block.text)) {
        applyText(root,slot.path,block.text,metadata); translated++;
      } else missing.push(slot.path);
    }
    sourceKind='approved-blocks';
  } else {
    // The older geography/excursion overlays have one source-file receipt.
    // Their caller verified that receipt; only known text slots are applied.
    const target={...prepared.translation,__body:prepared.translation?.body??''};
    for(const slot of slots) {
      const text=getAt(target,slot.path);
      if(safeText(text)) {applyText(root,slot.path,text,metadata); translated++;}
      else missing.push(slot.path);
    }
    sourceKind='prepared-overlay';
  }
  if(!translated)return {entry,applied:0,status:'untranslated',sourceId,sourceFingerprint};
  const body=root.__body; delete root.__body;
  metadata.translatedFields=translated;
  metadata.contentLanguage=missing.length?'ru':'en';
  if(missing.length)metadata.fallbackReason='untranslated_or_stale_fields';
  root._i18n=metadata;
  // entry.id, data.id, slug, locale, relationships and every nontext value stay
  // canonical. The old demo materializers must not rewrite featureBand hrefs.
  return {entry:{...entry,data:root,body},applied:translated,status:missing.length?'partial':'translated',
    sourceId,sourceFingerprint,sourceKind,missing};
}

const preparedByRoot=new Map();
async function readPreparedEnglish(root) {
  const base=resolve(root);
  if(preparedByRoot.has(base))return preparedByRoot.get(base);
  const promise=(async()=>{
    const records=new Map();
    const summary=await readJson(join(base,'data/i18n/pilot-previews/v1/summary.json'));
    if(summary.phase!=='approved_nonpublishing_pilot' || summary.publicationAuthorized!==false ||
       !Array.isArray(summary.reports) || summary.failures?.length)fail('Invalid approved Tour snapshot');
    for(const report of summary.reports) {
      if(!report.approved || report.state!=='ready' || report.issues!==0)continue;
      const id=report.entityId;
      if(!/^tour_[a-z0-9_]+$/.test(id) || records.has(id))fail('Invalid/duplicate approved Tour ID');
      const [map,overlay,wordSources]=await Promise.all([
        readJson(join(base,'data/i18n/block-maps/tours',id+'.json')),
        readJson(join(base,'data/i18n/pilot-previews/v1/overlays',id+'.json')),
        readJson(join(base,'data/i18n/pilot-previews/v1/word-sources',id+'.json')),
      ]);
      if(map.entityId!==id || map.entityType!=='tour' || !allowedSource(map.sourceContentPath,'tours') ||
         overlay.entityId!==id || overlay.entityType!=='tour' || overlay.locale!=='en')fail('Invalid Tour source identity '+id);
      // Full-source SHA remains useful in the receipt. Eligibility is checked
      // per block against the *current* Astro entry inside the pure projector.
      let sourceFingerprint;
      try {sourceFingerprint='sha256:'+sha256(await readFile(join(base,map.sourceContentPath)));}
      catch(error) {if(error.code!=='ENOENT')throw error; sourceFingerprint='missing';}
      records.set(id,{entityId:id,entityType:'tour',overlay,wordSources,sourceFingerprint,
        ...(sourceFingerprint==='missing'?{stale:true,reason:'canonical_source_missing'}:{})});
    }
    for(const [collection,manifestPath,property,status] of [
      ['excursions','data/i18n/pilot-excursions/v1/manifest.json','entries','prepared_for_private_preview'],
      ['geography','data/i18n/pilot-geography/v1/manifest.json','items','prepared_for_private_visual_pilot'],
    ]) {
      const manifest=await readJson(join(base,manifestPath));
      if(manifest.schemaVersion!==1 || manifest.locale!=='en' || manifest.publicationAuthorized!==false ||
         manifest.status!==status || !Array.isArray(manifest[property]))fail('Invalid '+collection+' translation manifest');
      for(const meta of manifest[property]) {
        const type=collection==='excursions'?'excursion':meta.kind;
        const sourceCollection={excursion:'excursions',country:'countries',destination:'destinations'}[type];
        const file=collection==='excursions'?meta.translationFile:meta.file;
        const folder=collection==='excursions'?'pilot-excursions':'pilot-geography';
        if(!sourceCollection || !allowedSource(meta.sourcePath,sourceCollection) ||
           !/^[a-f0-9]{40}$/.test(meta.sourceBlobSha) ||
           file!=='data/i18n/'+folder+'/v1/'+meta.id+'.json' || records.has(meta.id))fail('Invalid source binding '+meta.id);
        const overlay=await readJson(join(base,file));
        if(overlay.entityId!==meta.id || overlay.locale!=='en' || overlay.schemaVersion!==1 ||
           overlay.status!==status || overlay.publicationAuthorized!==false ||
           overlay.source?.path!==meta.sourcePath || overlay.source?.gitBlobSha!==meta.sourceBlobSha ||
           overlay.provenance?.method!=='assistant_translation_from_canonical_ru' ||
           !overlay.translation || typeof overlay.translation!=='object')fail('Invalid prepared text '+meta.id);
        let actual;
        try {actual=gitBlob(await readFile(join(base,meta.sourcePath)));}
        catch(error) {if(error.code!=='ENOENT')throw error; actual='missing';}
        records.set(meta.id,{entityId:meta.id,entityType:type,translation:overlay.translation,
          sourceFingerprint:'git:'+actual,stale:actual!==meta.sourceBlobSha,
          ...(actual!==meta.sourceBlobSha?{reason:'canonical_source_changed'}:{})});
      }
    }
    return records;
  })();
  preparedByRoot.set(base,promise);
  try {return await promise;} catch(error) {preparedByRoot.delete(base); throw error;}
}

const receiptState=new Map();
let receiptWrite=Promise.resolve();
async function saveReceipt(root,collection,rows,env) {
  const key=resolve(root);
  const collections=receiptState.get(key)??new Map();
  collections.set(collection,rows); receiptState.set(key,collections);
  // Collections sync concurrently; serialize snapshots so the final receipt
  // includes every finished collection, never whichever write won a race.
  receiptWrite=receiptWrite.then(async()=>{
    const entries=[...collections.values()].flat().sort((a,b)=>a.sourceId.localeCompare(b.sourceId));
    const receipt={schemaVersion:1,mode:'shared-canonical-english',
      canonicalSourceSha:env.ADA_CANONICAL_SHA??null,createdAt:new Date().toISOString(),
      collections:[...collections.keys()].sort(),
      counts:{translated:entries.filter(x=>x.status==='translated').length,
        partial:entries.filter(x=>x.status==='partial').length,stale:entries.filter(x=>x.status==='stale').length,
        invalid:entries.filter(x=>x.status==='invalid').length,translatedFields:entries.reduce((n,x)=>n+x.applied,0)},
      entries};
    const file=join(key,'.astro/ada-en-shared-content.json');
    await mkdir(dirname(file),{recursive:true});
    await writeFile(file,JSON.stringify(receipt,null,2)+'\n');
  });
  return receiptWrite;
}

/** Wrap the canonical glob loader; no collection consumers need a fork. */
export function withSharedEnglishContent(loader,collection,{env=process.env,root}={}) {
  if(!sharedEnglishContentEnabled(env) || !own(TYPES,collection))return loader;
  return {...loader,name:loader.name+'-shared-english',async load(context) {
    await loader.load(context);
    const base=resolve(root??fileURLToPath(context.config.root));
    const prepared=await readPreparedEnglish(base);
    const report=[];
    // store.set is synchronous. Project after glob finished, then await the
    // supported Markdown renderer before writing each new digest.
    for(const original of [...context.store.values()]) {
      const translation=prepared.get(original.data?.id);
      if(!translation || translation.entityType!==TYPES[collection])continue;
      const result=projectSharedEnglishEntry(original,collection,translation);
      report.push({collection,sourceId:original.data.id,status:result.status,applied:result.applied,
        sourceName:original.data.name??original.data.title??'',displayName:result.entry.data.name??result.entry.data.title??'',
        sourceFingerprint:result.sourceFingerprint??translation.sourceFingerprint,
        ...(result.reason?{reason:result.reason}:{}),...(result.missing?.length?{fallbackFields:result.missing}:{})});
      if(!result.applied)continue;
      const projected=result.entry;
      const data=await context.parseData({id:original.id,data:projected.data,filePath:original.filePath});
      const rendered=projected.body===original.body?original.rendered:
        await context.renderMarkdown(projected.body,{...(original.filePath?{fileURL:pathToFileURL(resolve(base,original.filePath))}:{})});
      context.store.set({...original,data,body:projected.body,rendered,
        digest:context.generateDigest({data,body:projected.body,localeProjection:'shared-en-v1'})});
    }
    await saveReceipt(base,collection,report,env);
    context.logger?.info?.('Shared EN '+collection+': '+report.filter(x=>x.applied).length+' translated entities, '+report.filter(x=>x.status==='stale').length+' stale fallbacks');
  }};
}
