#!/usr/bin/env node
/** Independent SHA-256 verification of exact English Word paragraph evidence.
 * Never marks translation approved or changes commercial data.
 */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const base=resolve(process.argv[2]||'.'),matching=resolve(process.argv[3]||'.');
const read=(dir,p)=>JSON.parse(readFileSync(join(dir,p),'utf8'));
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
const ids=['tour_brazil_rio_four_days','tour_chile_easter_island_3_days_2027'];
const results=[],errors=[];
for(const id of ids)try{
 const evidence=read(base,'data/i18n/word-text-evidence/pilot/'+id+'.json');
 const map=read(base,'data/i18n/word-block-alignments/pilot/'+id+'.json');
 const matchingResult=read(matching,'data/i18n/matching/v1/results/match--'+id+'/submission-match-'+id+'-1.json').result;
 if(evidence.schemaVersion!==1||evidence.kind!=='word_paragraph_evidence'||evidence.entityId!==id||
   evidence.publicationEligible!==false||matchingResult.entityId!==id||
   evidence.sourceFileId!==matchingResult.selectedSource.driveFileId||
   evidence.sourceSha256!==matchingResult.selectedSource.sourceSha256||
   evidence.sourceModifiedTime!==matchingResult.selectedSource.modifiedTime||
   evidence.sourceRefConvention!=='ooxml-paragraph-index-v1')
    throw Error('Document ID/revision/hash mismatch');
 const expected=new Map(map.blocks.flatMap(b=>(b.paragraphs||[]).map(x=>[x.ref,x.textSha256])));
 if(Object.keys(evidence.paragraphs).length!==expected.size)throw Error('Incomplete source excerpt packet');
 for(const [ref,sha] of expected){
  const row=evidence.paragraphs[ref];
  if(!row||row.textSha256!==sha||typeof row.text!=='string'||!row.text.trim()||hash(row.text)!==sha)
   throw Error('Mismatched source text SHA at '+ref);
 }
 results.push({entityId:id,paragraphs:expected.size,chars:Object.values(evidence.paragraphs).reduce((n,v)=>n+v.text.length,0)});
}catch(e){errors.push({entityId:id,error:String(e)})}
console.log(JSON.stringify({status:errors.length?'failed':'verified',wordSources:results.length,
paragraphs:results.reduce((n,r)=>n+r.paragraphs,0),errors,results}));
if(errors.length||results.length!==ids.length)process.exitCode=1;
