#!/usr/bin/env node
/** Complete only the three isolated pilot Tour overlays. Reads exact current
 * main RU sources, accepted staging receipts, Word 2027 citation sidecars,
 * and the 142 manually edited supplementary translations.
 * No public site, main or translation state is written.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import yaml from 'js-yaml';
import {
 sourceBlockEvidence,translationApprovalHash,assessOverlay,textFingerprint
} from '../../src/lib/i18n/content-overlay.mjs';
import {sourceFromContentEntry,localizeContentEntry} from '../../src/lib/i18n/content-adapter.mjs';
const [feature,production,staging]=process.argv.slice(2,5).map(v=>resolve(v));
const outArg=process.argv.indexOf('--output');
const output=outArg>=0?resolve(process.argv[outArg+1]):null;
const approve=process.argv.includes('--approve-drafts');
if(!feature||!production||!staging)throw Error('Usage feature production staging [--output dir] [--approve-drafts]');
const read=async(base,path)=>JSON.parse(await readFile(join(base,path),'utf8'));
const ids=[
 ['tour_brazil_rio_four_days','rio-de-janeiro-four-days.md'],
 ['tour_chile_easter_island_3_days_2027','easter-island-3-days.md'],
 ['tour_colombia_essential_5_days','colombia-essential-5-days.md']
];
const current=await read(staging,'data/i18n/translation/v1/index.json');
if(current.publicationEnabled!==false||current.translationMassLaunchAllowed!==false||
 current.dispatcherEnabled!==false||current.counts.ready!==5||
 current.counts.leased!==0||current.counts.review!==0||current.counts.queued!==0)
 throw Error('Sealed and QA-accepted 5/5 pilot queue required');
const gitsha=(base,p)=>{
 const x=spawnSync('git',['hash-object',p],{cwd:base,encoding:'utf8'});
 if(x.status!==0)throw Error('Missing source '+p);return x.stdout.trim();
};
const checks={
 tour_brazil_rio_four_days:{priceFrom:1255,service:'English- or Spanish-speaking',body:['$2,607','$1,447','$1,255','Rocinha']},
 tour_chile_easter_island_3_days_2027:{priceFrom:1492,service:'English-speaking',body:['3,279','1,492','Flights are not included']},
 tour_colombia_essential_5_days:{priceFrom:1863,service:'English-speaking',body:['$3,480','$1,863','Cartagena','Bogotá']}
};
let reports=[],failures=[];
for(const [id,file] of ids){
 try{
  const p='src/content/tours/'+file;
  const raw=await readFile(join(production,p),'utf8');
  const m=/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/u.exec(raw);
  if(!m)throw Error('Malformed RU Markdown '+p);
  const data=yaml.load(m[1]);if(data.id!==id||data.locale!=='ru'||data.status==='archived')
   throw Error('RU source not active or identity drift: '+id);
  const entry={id:'ru:'+id,data,body:m[2]};
  const map=await read(feature,'data/i18n/block-maps/tours/'+id+'.json');
  if(map.ruBlobSha256===undefined||map.sourceContentPath!==p||
    map.sourceBlocksCount!==map.paths.length)throw Error('Map identity/coverage drift: '+id);
  const evidence=await read(feature,'data/i18n/word-text-evidence/pilot/'+id+'.json');
  const doc=await read(feature,'data/i18n/translation/pilot-completion-drafts/'+id+'.json');
  if(doc.entityId!==id||doc.status!=='draft_for_full_pilot_semantic_QA'||doc.releaseEligible!==false)
   throw Error('Unexpected locale draft identity/state');
  const mappedPaths=new Set(map.paths.map(s=>s.path));
  const source=sourceFromContentEntry(entry,'tour',map);
  const wordSources={},accepted=new Map();
  let acceptedWord=0,acceptedAi=0,stagingShaSet=new Set();
  for(const sid of Object.keys(current.shards)){
   if(current.shards[sid].counts.ready===0)continue;
   const state=await read(staging,'data/i18n/translation/v1/state/'+sid+'.json');
   const jobs=await read(staging,'data/i18n/translation/v1/jobs/'+sid+'.json');
   for(const row of state.items.filter(x=>x.status==='ready'&&x.jobId.startsWith('en:tour:'+id+':'))){
    if(!row.submission||!row.review||row.review.acceptedBlobSha!==row.submission.blobSha||
     !['word','meaning','facts','voice','structure','relations'].every(k=>row.review.checks?.[k]===true))
     throw Error('No reviewed immutable receipt: '+row.jobId);
    if(gitsha(staging,row.submission.resultPath)!==row.submission.blobSha)
     throw Error('Immutable result Git blob hash does not match receipt: '+row.jobId);
    const job=jobs.jobs.find(x=>x.jobId===row.jobId);
    const result=await read(staging,row.submission.resultPath);
    if(!job||result.entityId!==id||result.sourceFingerprint!==job.sourceFingerprint||
     job.source.ruContentPath!==p||job.source.ruGitBlobSha!==gitsha(production,p)||
     job.source.wordSha256!==evidence.sourceSha256)
     throw Error('Job source or identity mismatch: '+row.jobId);
    const byId=new Map(job.blocks.map(x=>[x.blockId,x]));
    for(const b of result.blocks){
     const original=byId.get(b.blockId);if(!original||b.field!==original.field||b.mode!==original.mode||
      accepted.has(b.blockId))throw Error('Accepted block duplicated/misowned');
     if(b.mode==='word_span'){
      if(b.provenance?.kind!=='word_exact'||b.provenance.documentSha256!==evidence.sourceSha256||
       b.provenance.fileId!==evidence.sourceFileId||
       JSON.stringify(b.provenance.paragraphs)!==JSON.stringify(original.paragraphs))
       throw Error('Word source reference mismatch: '+b.blockId);
      const text=original.paragraphs.map(p=>{
       const e=evidence.paragraphs[p.ref];
       if(!e||e.textSha256!==p.textSha256||textFingerprint(e.text)!=='sha256:'+p.textSha256)
        throw Error('Word SHA mismatch at '+p.ref);
       return e.text;
      }).join('\n\n');
      if(text!==b.text)throw Error('Word text modified after approval: '+b.blockId);
      const locator=original.paragraphs.map(p=>p.ref).join('|');
      wordSources[evidence.sourceFileId]??={revision:evidence.sourceModifiedTime,
       documentHash:'sha256:'+evidence.sourceSha256,blocks:{}};
      wordSources[evidence.sourceFileId].blocks[locator]=text;
      accepted.set(b.blockId,{text,provenance:{kind:'word_exact',
       fileId:evidence.sourceFileId,revision:evidence.sourceModifiedTime,
       documentHash:'sha256:'+evidence.sourceSha256,
       locator,textHash:textFingerprint(text)}});
      acceptedWord++;
     }else{
      if(b.provenance?.kind!=='ai_translation'||!b.provenance.model||!b.provenance.runId)
       throw Error('AI provenance mismatch: '+b.blockId);
      accepted.set(b.blockId,{text:b.text,provenance:{kind:'ai_translation',
       model:b.provenance.model,runId:b.provenance.runId}});
      acceptedAi++;
     }
    }
    stagingShaSet.add(row.submission.blobSha);
   }
  }
  const needed=map.paths.filter(x=>!accepted.has(x.blockId));
  const needPaths=new Set(needed.map(x=>x.path));
  const exactPaths=Object.keys(doc.translations||{});
  if(exactPaths.length!==needPaths.size||exactPaths.some(x=>!needPaths.has(x))||
     exactPaths.some(x=>!mappedPaths.has(x)))throw Error('Draft does not cover remaining text slots');
  if(![52,58,62].includes(source.blocks.length))throw Error('Unexpected pilot entity size');
  const sourceById=new Map(source.blocks.map(x=>[x.blockId,x]));
  const date=new Date().toISOString();
  const overlay={schemaVersion:1,entityId:id,entityType:'tour',locale:'en',
   sourceLocale:'ru',blocks:[]};
  const localizedText=[];
  for(const slot of map.paths){
   const original=sourceById.get(slot.blockId);if(!original)throw Error('Missing source block');
   const existing=accepted.get(slot.blockId);
   const text=existing?.text??doc.translations[slot.path];
   if(typeof text!=='string'||!text.trim()||/[\u0400-\u052F]/u.test(text))
    throw Error('Untranslated, empty or Cyrillic block: '+slot.path);
   const e=sourceBlockEvidence(source,slot.blockId);
   const proposal={blockId:slot.blockId,field:slot.field,text,
    sourceTextHash:e.sourceTextHash,dependencyHashes:e.dependencyHashes,
    provenance:existing?.provenance??{kind:'ai_translation',model:'GPT-6',
      runId:'three-tour-pilot-20261030-'+id}};
   if(existing||approve){
    proposal.state='approved';
    proposal.approval={reviewerId:existing?'pilot-source-QA-20261030':'pilot-semantic-QA-20261030',
     reviewedAt:date,checks:{meaning:true,voice:true,facts:true},
     approvedContentHash:translationApprovalHash(proposal)};
   }else proposal.state='review';
   overlay.blocks.push(proposal);
   localizedText.push({path:slot.path,blockId:slot.blockId,field:slot.field,text,authority:existing?'accepted_immutable_source':'draft_manual_review'});
  }
  if(overlay.blocks.length!==map.paths.length)throw Error('Not all 172 source blocks covered');
  const c=checks[id];if(Number(data.priceFrom)!==c.priceFrom)throw Error('Main shared price does not match verified Word 2027 '+id);
  const inc=localizedText.filter(x=>x.path.startsWith('/included/')).map(x=>x.text).join(' ');
  if(!inc.includes(c.service))throw Error('Word guide language not reflected in inclusions');
  const body=localizedText.find(x=>x.path==='/__body')?.text||'';
  if(c.body.some(t=>!body.includes(t)))throw Error('Commercial body missing expected Word details: '+id);
  const evaluated=assessOverlay(source,overlay,{wordSources});
  if(evaluated.issues.some(x=>['stale','invalid','blocked','incomplete'].includes(x.category)))
    throw Error('Blocked/invalid locale evidence: '+JSON.stringify(evaluated.issues.slice(0,5)));
  if(approve){
   if(!evaluated.readyForAssembly)throw Error('Approved pilot must be fully assembleable');
   const localized=localizeContentEntry(entry,'tour',map,overlay,wordSources);
   if(localized.data.locale!=='en'||localized.data.id!==id||
      Number(localized.data.priceFrom)!==c.priceFrom||
      localized.data.itinerary.length!==data.itinerary.length)
    throw Error('Locale renderer altered shared ID, price or itinerary structure');
   if(output){await mkdir(join(output,'rendered'),{recursive:true});
    await writeFile(join(output,'rendered',id+'.json'),JSON.stringify({
     id,locale:'en',data:localized.data,body:localized.body},null,2)+'\n');}
  }
  if(output){
   await mkdir(join(output,'overlays'),{recursive:true});
   await writeFile(join(output,'overlays',id+'.json'),JSON.stringify(overlay,null,2)+'\n');
   await mkdir(join(output,'word-sources'),{recursive:true});
   await writeFile(join(output,'word-sources',id+'.json'),JSON.stringify(wordSources,null,2)+'\n');
  }
  reports.push({entityId:id,sourceVisibleBlocks:map.paths.length,
   alreadyApprovedWordBlocks:acceptedWord,alreadyApprovedAiBlocks:acceptedAi,
   proposedAdditionalBlocks:needed.length,
   fullCoverage:true,approved:approve,
   state:evaluated.status,issues:evaluated.issues.length,
   preservedPriceFrom:Number(data.priceFrom),sourceReceipts:[...stagingShaSet]});
 }catch(e){failures.push({entityId:id,error:String(e)});}
}
const summary={phase:approve?'approved_nonpublishing_pilot':'review_only_nonpublishing_pilot',
 totalSourceSlots:reports.reduce((n,x)=>n+x.sourceVisibleBlocks,0),
 totalReadyPrevious:reports.reduce((n,x)=>n+x.alreadyApprovedWordBlocks+x.alreadyApprovedAiBlocks,0),
 totalAdditional:reports.reduce((n,x)=>n+x.proposedAdditionalBlocks,0),
 publicationAuthorized:false,mainTouched:false,
 reports,failures};
if(output){await mkdir(output,{recursive:true});
 await writeFile(join(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');}
console.log(JSON.stringify(summary));
if(failures.length||reports.length!==3||summary.totalSourceSlots!==172||
 summary.totalReadyPrevious!==30||summary.totalAdditional!==142)process.exitCode=1;
