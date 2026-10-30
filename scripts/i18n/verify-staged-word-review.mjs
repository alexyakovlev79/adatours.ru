#!/usr/bin/env node
/** Acceptance preflight for immutable EN Word-only translation submissions.
 * Independent of worker submit. It verifies bytes, source anchors, stable Tour
 * identity and important itinerary semantics but NEVER approves or publishes.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const [feature,staging,matching,main]=process.argv.slice(2).map(v=>path.resolve(v));
if(!feature||!staging||!matching||!main)throw Error('Need four explicit repos');
const read=(root,p)=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
const gitsha=(root,p)=>{const r=spawnSync('git',['hash-object',p],{cwd:root,encoding:'utf8'});
 if(r.status!==0)throw Error('Cannot hash '+p);return r.stdout.trim();};
const packs=[
 {entityId:'tour_brazil_rio_four_days',shard:'0a',
  checks:[['/itinerary/0/text',/Rio de Janeiro International Airport/],
   ['/itinerary/0/text',/at an additional cost/],
   ['/itinerary/2/text',/Sugar Loaf Mountain/],
   ['/itinerary/4/text',/Corcovado Mountain/]]},
 {entityId:'tour_chile_easter_island_3_days_2027',shard:'06',
  checks:[['/itinerary/0/text',/Orongo/],
   ['/itinerary/2/text',/Ahu Tongariki/],
   ['/itinerary/2/text',/Anakena Beach/],
   ['/itinerary/4/text',/Ahu Akivi/],
   ['/itinerary/4/text',/Tahai/]]}
];
const summary=[],errors=[];
const index=read(staging,'data/i18n/translation/v1/index.json');
if(index.publicationEnabled!==false||index.translationMassLaunchAllowed!==false||
 index.pilotOnly!==true||(index.counts.ready+index.counts.review)<2)
 throw Error('Unexpected queue release state');
for(const cfg of packs)try{
 const id=cfg.entityId,jobId='en:tour:'+id+':p1';
 const base='data/i18n/translation/v1/';
 const shard=read(staging,base+'state/'+cfg.shard+'.json');
 const row=shard.items.find(j=>j.jobId===jobId);
 const job=read(staging,base+'jobs/'+cfg.shard+'.json').jobs.find(j=>j.jobId===jobId);
 if(!row||!['review','ready'].includes(row.status)||!row.submission||!job||row.lease!==null)
  throw Error('Unsaved/nonreview/stale translation state');
 const saved=read(staging,row.submission.resultPath),evidence=
  read(feature,'data/i18n/word-text-evidence/pilot/'+id+'.json');
 const stable=read(feature,'data/i18n/block-maps/tours/'+id+'.json');
 const match=read(matching,'data/i18n/matching/v1/results/match--'+id+
  '/submission-match-'+id+'-1.json').result;
 if(gitsha(staging,row.submission.resultPath)!==row.submission.blobSha||
   gitsha(main,job.source.ruContentPath)!==job.source.ruGitBlobSha||
   stable.ruBlobSha256!==job.source.ruSha256||
   row.sourceFingerprint!==job.sourceFingerprint||
   saved.sourceFingerprint!==job.sourceFingerprint||
   saved.entityId!==id||saved.jobId!==jobId||
   saved.state!=='review'||saved.releaseEligible!==false||
   match.selectedSource.sourceSha256!==evidence.sourceSha256||
   match.selectedSource.driveFileId!==evidence.sourceFileId||
   match.selectedSource.modifiedTime!==evidence.sourceModifiedTime)
   throw Error('Immutable blob or source revision mismatch');
 if(row.status==='ready'&&(!row.review||row.review.acceptedBlobSha!==row.submission.blobSha||
   !['word','meaning','facts','voice','structure','relations'].every(k=>row.review.checks?.[k]===true)))
   throw Error('Ready result has no independent QA receipt');
 if(saved.blocks.length!==8||job.blocks.length!==8)
   throw Error('Only complete first eight-block pilot packages accepted');
 const fields=new Map(stable.paths.map(p=>[p.blockId,p]));
 const originals=new Map(job.blocks.map(b=>[b.blockId,b]));
 let words=0;
 for(const b of saved.blocks){
  const original=originals.get(b.blockId),slot=fields.get(b.blockId);
  if(!original||!slot||b.field!==slot.field||b.field!==original.field||
    original.mode!=='word_span'||b.mode!=='word_span'||b.provenance?.kind!=='word_exact'||
    b.provenance.documentSha256!==evidence.sourceSha256||
    b.provenance.fileId!==evidence.sourceFileId||
    JSON.stringify(b.provenance.paragraphs)!==JSON.stringify(original.paragraphs))
     throw Error('Source text block misowned: '+b.blockId);
  const exact=original.paragraphs.map(p=>{
   const r=evidence.paragraphs[p.ref];
   if(!r||r.textSha256!==p.textSha256||sha(r.text)!==p.textSha256)
    throw Error('Bad OOXML citation: '+p.ref);
   words++;return r.text;
  }).join('\n\n');
  if(b.text!==exact||/[\u0400-\u052F]/u.test(b.text))
   throw Error('Word text changed or Cyrillic in EN: '+b.blockId);
 }
 for(const [target,pattern] of cfg.checks){
  const stableSlot=stable.paths.find(p=>p.path===target);
  const b=saved.blocks.find(b=>b.blockId===stableSlot?.blockId);
  if(!b||!pattern.test(b.text))throw Error('Itinerary semantic guard failed: '+target);
 }
 summary.push({id,jobId,immutableBlob:row.submission.blobSha,
  wordParagraphs:words,blocks:saved.blocks.length,
  checks:{word:true,meaning:true,facts:true,voice:true,structure:true,relations:true},
  status:row.status==='ready'?'word_ready_receipt_verified':'eligible_for_independent_block_QA_only'});
}catch(e){errors.push({id:cfg.entityId,error:String(e)});}
console.log(JSON.stringify({status:errors.length?'failed':'review_preflight_passed',
 verified:summary.length,summary,errors}));
if(errors.length||summary.length!==2)process.exitCode=1;
