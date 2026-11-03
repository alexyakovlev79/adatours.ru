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
import {validateMassResult} from '../../../scripts/i18n/translation-mass-core.mjs';

// An immutable, independently reviewed snapshot; reading it does not change
// worker queues, publicationEnabled or releaseEligible. Only noindex staging
// calls this module's loader. No translated text is copied into this module.
export const ACCEPTED_MASS_SNAPSHOT_SHA='691306df7cdae1e1cb899cbac2bfc4dcbe781230';
const MASS_ROOT='data/i18n/translation-mass/v2';
const MASS_QA=['word','meaning','facts','voice','structure','relations'];

const TYPES = Object.freeze({tours:'tour', excursions:'excursion', countries:'country', destinations:'destination'});
const CYRILLIC = /[\u0400-\u052f]/u;
const own = (object,key) => Object.prototype.hasOwnProperty.call(object,key);
const safeText = value => typeof value === 'string' && value.trim().length > 0 && !CYRILLIC.test(value);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const gitBlob = bytes => createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const readJson = async path => JSON.parse(await readFile(path,'utf8'));
const allowedSource = (path,collection) => new RegExp('^src/content/'+collection+'/[a-z0-9][a-z0-9-]*\\.md$').test(path);
const fail = message => {throw new Error('Shared EN content: '+message);};

// Approved source evidence hashes the exact text following the frontmatter,
// including its boundary newlines. Astro 7.3.4's markdown getEntryInfo instead
// stores parsed.content.trim(). Keep that parser detail outside hash checking.
function canonicalMarkdownBody(contents) {
  const match=/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)([\s\S]*)$/u.exec(contents);
  return match?.[1];
}

export function sharedEnglishContentEnabled(env=process.env) {
  return env?.EN_SHARED_CONTENT === '1' && enStagingSiteEnabled(env);
}

/** Validate the exact immutable output accepted by the separate QA process. */
export function verifyAcceptedMassPacket({job,row,resultBytes,sourceBytes,wordSources}) {
  if(row?.status!=='ready' || row.jobId!==job?.jobId || row.sourceFingerprint!==job.sourceFingerprint ||
     !row.submission?.blobSha || row.review?.acceptedBlobSha!==row.submission.blobSha ||
     !MASS_QA.every(key=>row.review?.checks?.[key]===true) || !row.review?.reviewerId ||
     !Number.isFinite(Date.parse(row.review.at)))fail('Unaccepted mass translation receipt');
  if(gitBlob(resultBytes)!==row.submission.blobSha)fail('Accepted mass result blob changed');
  const result=JSON.parse(resultBytes.toString('utf8'));
  validateMassResult(job,result);
  if(!allowedSource(job.source?.contentPath,'tours') || job.entityType!=='tour')fail('Unsafe mass source path');
  if(sha256(sourceBytes)!==job.source.contentSha256 || gitBlob(sourceBytes)!==job.source.sourceBlobSha)
    return {status:'stale',jobId:job.jobId,reason:'canonical_source_changed',blocks:[]};
  const word=job.source.selectedWord;
  const existing=word && wordSources?.[word.fileId];
  if(job.stage!=='word_2027' || !existing || existing.documentHash!=='sha256:'+word.sha256 ||
     existing.revision!==word.modifiedTime)fail('Accepted mass Word source differs from verified English source');
  // validateMassResult verifies ownership/source hashes, the selected Word
  // identity, paragraph-evidence shape and allowed transformations. The
  // independent six-check receipt is the acceptance authority for their
  // meaning and paragraph content; do not forge legacy approval records.
  return {status:'ready',jobId:job.jobId,blocks:result.blocks,
    receipt:{snapshotSha:ACCEPTED_MASS_SNAPSHOT_SHA,jobId:job.jobId,resultBlobSha:row.submission.blobSha,
      reviewedAt:row.review.at,reviewerId:row.review.reviewerId,
      wordFileId:word.fileId,wordSha256:word.sha256}};
}

async function attachAcceptedMass(records,base,snapshotRoot) {
  const head=(await readFile(join(snapshotRoot,'.git/HEAD'),'utf8')).trim();
  if(head!==ACCEPTED_MASS_SNAPSHOT_SHA)fail('Accepted mass checkout is not the pinned immutable commit');
  const index=await readJson(join(snapshotRoot,MASS_ROOT,'index.json'));
  if(index.schemaVersion!==2 || index.publicationEnabled!==false || index.counts?.ready!==1)
    fail('Pinned mass snapshot acceptance count/gate changed');
  const snapshots=[];
  for(const [sid,summary] of Object.entries(index.shards)) {
    if(!Object.values(summary.stages??{}).some(counts=>counts.ready>0))continue;
    if(!/^[a-f0-9]{2}$/.test(sid))fail('Invalid accepted mass shard');
    const [state,packets]=await Promise.all([
      readJson(join(snapshotRoot,MASS_ROOT,'state',sid+'.json')),
      readJson(join(snapshotRoot,MASS_ROOT,'jobs',sid+'.json')),
    ]);
    for(const row of state.items.filter(item=>item.status==='ready')) {
      const job=packets.jobs.find(item=>item.jobId===row.jobId);
      const prepared=job && records.get(job.stableId);
      if(!prepared || !job || !/^data\/i18n\/translation-mass\/v2\/results\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\.json$/.test(row.submission?.resultPath??''))
        fail('Unresolved accepted mass source/result');
      const packet=verifyAcceptedMassPacket({job,row,
        resultBytes:await readFile(join(snapshotRoot,row.submission.resultPath)),
        sourceBytes:await readFile(join(base,job.source.contentPath)),wordSources:prepared.wordSources});
      snapshots.push({jobId:packet.jobId,status:packet.status,blocks:packet.blocks.length,...(packet.reason?{reason:packet.reason}:{})});
      if(packet.status==='ready')prepared.acceptedMass=[...(prepared.acceptedMass??[]),packet];
    }
  }
  if(snapshots.length!==index.counts.ready)fail('Accepted mass snapshot is incomplete');
  records.massSnapshot={sha:ACCEPTED_MASS_SNAPSHOT_SHA,packets:snapshots};
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
  // Use the body read from the current canonical file, never a translated or
  // historical snapshot. Accept only Astro's documented boundary trim; any
  // substantive store/file disagreement must not inherit the file's evidence.
  const canonicalBody=prepared.canonicalBody;
  if(typeof canonicalBody==='string' && entry.body!==canonicalBody && entry.body!==canonicalBody.trim())
    return {entry,applied:0,status:'stale',sourceId,sourceFingerprint,reason:'canonical_body_store_mismatch'};
  const sourceEntry=typeof canonicalBody==='string'?{...entry,body:canonicalBody}:entry;
  const root=structuredClone({...sourceEntry.data,__body:sourceEntry.body??''});
  delete root._i18n;
  const slots=visibleLocalizationSlots(sourceEntry,type);
  const metadata={contentLanguage:'ru',translatedFields:0,sourceId,sourceFingerprint,
    sourceName:entry.data.name??entry.data.title??''};
  let translated=0;
  const appliedPaths=new Set();
  const missing=[];
  let sourceKind;
  if(prepared.overlay) {
    // Stable ownership + source/dependency hashes permit an unrelated image
    // change or one changed text slot without invalidating every translation.
    let map,source,assessment;
    try {
      map=createStableBlockMap(sourceEntry,type);
      source=sourceFromContentEntry(sourceEntry,type,map);
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
        applyText(root,slot.path,block.text,metadata); translated++; appliedPaths.add(slot.path);
      } else missing.push(slot.path);
    }
    sourceKind='approved-blocks';
  } else {
    // The older geography/excursion overlays have one source-file receipt.
    // Their caller verified that receipt; only known text slots are applied.
    const target={...prepared.translation,__body:prepared.translation?.body??''};
    for(const slot of slots) {
      const text=getAt(target,slot.path);
      if(safeText(text)) {applyText(root,slot.path,text,metadata); translated++; appliedPaths.add(slot.path);}
      else missing.push(slot.path);
    }
    sourceKind='prepared-overlay';
  }
  const acceptedMass=[];
  if(prepared.acceptedMass?.length) {
    const current=new Map(createStableBlockMap(sourceEntry,type).paths.map(slot=>[slot.blockId,slot]));
    const raw={...sourceEntry.data,__body:sourceEntry.body??''};
    for(const packet of prepared.acceptedMass) {
      if(packet.status!=='ready' || packet.receipt?.snapshotSha!==ACCEPTED_MASS_SNAPSHOT_SHA)continue;
      let appliedBlocks=0,changedTexts=0;
      for(const block of packet.blocks) {
        const slot=current.get(block.blockId),sourceText=slot && getAt(raw,slot.path);
        if(!slot || slot.field!==block.field || !safeText(block.text) || typeof sourceText!=='string' ||
           sha256(sourceText)!==block.sourceTextSha256)continue;
        const prior=slot.path==='/format'?metadata.formatLabel:getAt(root,slot.path);
        if(prior!==block.text)changedTexts++;
        applyText(root,slot.path,block.text,metadata);appliedBlocks++;
        if(!appliedPaths.has(slot.path)){appliedPaths.add(slot.path);translated++;}
        const missingAt=missing.indexOf(slot.path);if(missingAt>=0)missing.splice(missingAt,1);
      }
      acceptedMass.push({...packet.receipt,appliedBlocks,changedTexts});
    }
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
    sourceId,sourceFingerprint,sourceKind,missing,...(acceptedMass.length?{acceptedMass}:{})};
}

const preparedByRoot=new Map();
async function readPreparedEnglish(root,env) {
  const base=resolve(root);
  const snapshotRoot=env.EN_ACCEPTED_TRANSLATIONS_ROOT?resolve(base,env.EN_ACCEPTED_TRANSLATIONS_ROOT):null;
  const cacheKey=base+'\0'+(snapshotRoot??'');
  if(preparedByRoot.has(cacheKey))return preparedByRoot.get(cacheKey);
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
      let sourceFingerprint,canonicalBody;
      try {
        const sourceBytes=await readFile(join(base,map.sourceContentPath));
        sourceFingerprint='sha256:'+sha256(sourceBytes);
        canonicalBody=canonicalMarkdownBody(sourceBytes.toString('utf8'));
      }
      catch(error) {if(error.code!=='ENOENT')throw error; sourceFingerprint='missing';}
      records.set(id,{entityId:id,entityType:'tour',overlay,wordSources,sourceFingerprint,canonicalBody,
        ...(sourceFingerprint==='missing'?{stale:true,reason:'canonical_source_missing'}:
          canonicalBody===undefined?{stale:true,reason:'canonical_source_frontmatter_missing'}:{})});
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
    if(snapshotRoot)await attachAcceptedMass(records,base,snapshotRoot);
    return records;
  })();
  preparedByRoot.set(cacheKey,promise);
  try {return await promise;} catch(error) {preparedByRoot.delete(cacheKey); throw error;}
}

const receiptState=new Map();
let receiptWrite=Promise.resolve();
async function saveReceipt(root,collection,rows,env,massSnapshot) {
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
      entries,...(massSnapshot?{acceptedMassSnapshot:massSnapshot}:{})};
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
    const prepared=await readPreparedEnglish(base,env);
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
        ...(result.acceptedMass?{acceptedMass:result.acceptedMass}:{}),
        ...(result.reason?{reason:result.reason}:{}),...(result.missing?.length?{fallbackFields:result.missing}:{})});
      if(!result.applied)continue;
      const projected=result.entry;
      const data=await context.parseData({id:original.id,data:projected.data,filePath:original.filePath});
      const rendered=projected.body===original.body?original.rendered:
        await context.renderMarkdown(projected.body,{...(original.filePath?{fileURL:pathToFileURL(resolve(base,original.filePath))}:{})});
      context.store.set({...original,data,body:projected.body,rendered,
        digest:context.generateDigest({data,body:projected.body,localeProjection:'shared-en-v1'})});
    }
    await saveReceipt(base,collection,report,env,prepared.massSnapshot);
    context.logger?.info?.('Shared EN '+collection+': '+report.filter(x=>x.applied).length+' translated entities, '+report.filter(x=>x.status==='stale').length+' stale fallbacks');
  }};
}
