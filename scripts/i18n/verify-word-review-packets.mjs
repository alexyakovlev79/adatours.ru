#!/usr/bin/env node
/** Verify real Word-first review payloads against source SHA-pinned excerpts.
 * Does not approve or publish them.
 */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const [root,staging]=process.argv.slice(2).map(x=>path.resolve(x));
if(!root||!staging)throw Error('Usage: verify-word-review-packets.mjs feature staging');
const read=(dir,p)=>JSON.parse(fs.readFileSync(path.join(dir,p),'utf8'));
const sha=t=>createHash('sha256').update(t,'utf8').digest('hex');
const ids=[['tour_brazil_rio_four_days','0a'],
 ['tour_chile_easter_island_3_days_2027','06']];
const details=[],errors=[];
for(const [id,sid] of ids){
 try{
  const evidence=read(root,'data/i18n/word-text-evidence/pilot/'+id+'.json');
  const result=read(root,'data/i18n/translation/review-pilot/'+id+'-p1.json');
  const idJob='en:tour:'+id+':p1';
  const job=read(staging,'data/i18n/translation/v1/jobs/'+sid+'.json').jobs
   .find(j=>j.jobId===idJob);
  if(!job||job.blocks.length!==8||result.blocks.length!==job.blocks.length||
   result.entityId!==id||result.jobId!==job.jobId||
   result.sourceFingerprint!==job.sourceFingerprint||
   result.locale!=='en'||result.state!=='review'||result.releaseEligible!==false||
   result.qaStatus!=='pending_independent_word_content_validation'||
   evidence.sourceSha256!==job.source.wordSha256)
   throw Error('Review status/identity/evidence source invalid');
  let refs=0,chars=0;
  const sources=new Map(job.blocks.map(b=>[b.blockId,b]));
  for(const block of result.blocks){
   const original=sources.get(block.blockId);
   if(!original||block.field!==original.field||block.mode!==original.mode||
    block.mode!=='word_span'||block.provenance?.kind!=='word_exact'||
    block.provenance.documentSha256!==job.source.wordSha256||
    block.provenance.fileId!==evidence.sourceFileId||
    block.provenance.revision!==evidence.sourceModifiedTime||
    JSON.stringify(block.provenance.paragraphs)!==JSON.stringify(original.paragraphs))
    throw Error('Word source provenance mismatch for block '+block.blockId);
   const paragraphTexts=original.paragraphs.map(p=>{
    const e=evidence.paragraphs[p.ref];
    if(!e||e.textSha256!==p.textSha256||sha(e.text)!==p.textSha256)
      throw Error('Incorrect paragraph text hash '+p.ref);
    refs++;return e.text;
   });
   const expected=paragraphTexts.join('\n\n');
   if(block.text!==expected||/[\u0400-\u052F]/u.test(block.text))
    throw Error('Translation not an exact Word span: '+block.blockId);
   chars+=block.text.length;
  }
  if(refs<8||chars<400)throw Error('Suspiciously incomplete Word review');
  details.push({entityId:id,blocks:result.blocks.length,paragraphRefs:refs,chars,status:'word_exact_verified_for_review'});
 }catch(e){errors.push({entityId:id,error:String(e)});}
}
console.log(JSON.stringify({status:errors.length?'failed':'passed',verified:details.length,details,errors}));
if(errors.length||details.length!==ids.length)process.exitCode=1;
