#!/usr/bin/env node
/**
 * Side-effect-free shared-price reconciliation from matched Word 2027.
 * Never changes the public Tour or a translated overlay. A human-readable
 * source note is not a machine-verified tariff; supplementary fees are not
 * candidates for the Tour priceFrom minimum.
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const live=resolve(process.argv[2]||'.'),production=resolve(process.argv[3]||'.');
const output=process.argv.includes('--output')?resolve(process.argv[process.argv.indexOf('--output')+1]):null;
const read=async (dir,p)=>JSON.parse(await readFile(join(dir,p),'utf8'));
const rows=[],issues=[];
const note=(id,kind,detail)=>issues.push({entityId:id,kind,detail:String(detail||'')});
const excludedWords=/^(?:excluded|optional|supplement|not.included|separate|entrance|airfare|flights|domestic.flight)/i;
const extraKind=/(?:excluded|optional|supplement|airfare|flight_estimate|park_entrance|ticket_extra)/i;
function isSupplement(r){
 if(r.supplement===true||r.optional===true)return true;
 if(extraKind.test(String(r.type||r.rateType||'')))return true;
 const basis=String(r.priceBasis||'').trim();
 return excludedWords.test(basis) || /(optional excursion|not included in base|excluded from programme)/i.test(basis);
}
function basisClass(r){
 const s=String(r.priceBasis||'').toLowerCase().replace(/_/g,' ');
 if(/per.person|per.traveller|per.passenger|per.pax|p\/p/.test(s))return 'per_person';
 if(/per.group|per.tour|per.program|total.programme/.test(s))return 'per_group';
 if(r.occupancy||r.travellers||r.groupSize)return 'per_person';
 return 'unknown';
}
for(let i=0;i<16;i++){
 const id=i.toString(16).padStart(2,'0'),state=await read(live,'data/i18n/matching/v1/state/'+id+'.json');
 const jobs=await read(live,'data/i18n/matching/v1/jobs/'+id+'.json');
 const def=new Map(jobs.jobs.map(j=>[j.jobId,j]));
 for(const stateRow of state.items){
  if(stateRow.status!=='ready')continue;
  const job=def.get(stateRow.jobId);
  const result=await read(live,stateRow.submission.resultPath);
  const r=result.result;
  if(r.outcome!=='selected_2027')continue;
  let ruText;
  try{ruText=await readFile(join(production,job.ruContentPath),'utf8');}
  catch(e){note(job.entityId,'production_source_missing',e.message);continue;}
  const oldMatch=/^priceFrom:\s*(.*)$/mu.exec(ruText);
  const old=oldMatch&&/^[0-9]+(?:\.[0-9]+)?$/.test(oldMatch[1].trim())?Number(oldMatch[1].trim()):null;
  const curr=/^currency:\s*(.*)$/mu.exec(ruText)?.[1]?.trim()||null;
  const base=[],extra=[],invalid=[];
  for(const tariff of r.priceAmendments||[]){
   if(!Number.isFinite(tariff.amount)||tariff.amount<=0||!tariff.currency||!tariff.sourceLocator){invalid.push(tariff);continue;}
   if(isSupplement(tariff)){extra.push(tariff);continue;}
   const b=basisClass(tariff);
   base.push({amount:tariff.amount,currency:tariff.currency,basis:b,occupancy:tariff.occupancy??null,
    sourceLocator:tariff.sourceLocator,otherConditions:{
      travellers:tariff.travellers??null,groupSize:tariff.groupSize??tariff.minimumGroupSize??null,
      hotel:tariff.hotel??tariff.hotels??null,season:tariff.season??null
    }});
  }
  const currencies=[...new Set(base.map(x=>x.currency))];
  const bases=[...new Set(base.map(x=>x.basis))];
  const minimum=base.length?Math.min(...base.map(x=>x.amount)):null;
  const unambiguous=base.length>0&&currencies.length===1&&bases.length===1&&bases[0]!=='unknown'&&
    (!curr||curr===currencies[0]);
  const status=!base.length?'no_base_rate':
    !unambiguous?'needs_structural_reconciliation':
      old===minimum?'already_current':'price_change_candidate';
  if(status==='price_change_candidate'&&minimum<100)note(job.entityId,'small_base_minimum','Inspect supplementary classification before applying');
  if(invalid.length)note(job.entityId,'malformed_tariff_rows',invalid.length);
  rows.push({entityId:job.entityId,sourceFileId:r.selectedSource.driveFileId,
    sourceSha256:r.selectedSource.sourceSha256,sourceModifiedTime:r.selectedSource.modifiedTime,
    oldPriceFrom:old,currentCurrency:curr,wordBasePriceFrom:minimum,
    status,proposedCurrency:currencies.length===1?currencies[0]:null,
    proposedPriceBasis:bases.length===1?bases[0]:null,priceRows:base,
    supplementaryRows:extra,invalidRows:invalid.length,
    sourceContentPath:job.ruContentPath,sourceFingerprint:job.sourceFingerprint,
    resultPath:stateRow.submission.resultPath});
 }
}
const counts=Object.fromEntries([...new Set(rows.map(x=>x.status))].sort().map(k=>[k,rows.filter(x=>x.status===k).length]));
const summary={schemaVersion:1,source:'Word 2027 only',rows:rows.length,counts,
 changedCandidates:counts.price_change_candidate||0,unambiguous:false,
 publicPricesUpdated:false,supplementaryRows:rows.reduce((s,x)=>s+x.supplementaryRows.length,0),
 anomalies:issues.length,mainIsSourceOfTruth:true};
if(output){
 await mkdir(output,{recursive:true});
 for(const [name,val] of [['summary',summary],['candidates',rows],['issues',issues]])
  await writeFile(join(output,name+'.json'),JSON.stringify(val,null,2)+'\n');
}
console.log(JSON.stringify({...summary,sampleChanges:rows.filter(x=>x.status==='price_change_candidate')
 .slice(0,30).map(x=>({id:x.entityId,old:x.oldPriceFrom,proposed:x.wordBasePriceFrom,
  basis:x.proposedPriceBasis,baseRows:x.priceRows.length}))},null,2));
