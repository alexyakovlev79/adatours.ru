#!/usr/bin/env node
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {validateMatchResult} from './matching-core.mjs';
const source=resolve(process.argv[2]||'.');
const dest=process.argv.includes('--output')?resolve(process.argv[process.argv.indexOf('--output')+1]):null;
const read=async p=>JSON.parse(await readFile(join(source,p),'utf8'));
const shaGit=buf=>createHash('sha1').update('blob '+buf.length+'\0').update(buf).digest('hex');
const err=[],warn=[],rows=[],prices=[],status={},outcomes={},duplicateDocs=new Map();
const problem=(kind,id,detail,fatal=false)=>(fatal?err:warn).push({kind,id,detail:String(detail||'')});
const registry=await read('data/i18n/matching/v1/manifest.json');
const idx=await read('data/i18n/matching/v1/index.json');
const sources=await read('data/i18n/programme-sources.json');
const files=new Map(sources.documents.map(d=>[d.driveFileId,d]));
const seen=new Set();
for(let i=0;i<16;i++){
 const id=i.toString(16).padStart(2,'0');
 const shard=await read('data/i18n/matching/v1/state/'+id+'.json');
 const jobs=await read('data/i18n/matching/v1/jobs/'+id+'.json');
 const jobsMap=new Map(jobs.jobs.map(j=>[j.jobId,j]));
 for(const item of shard.items){
  status[item.status]=(status[item.status]||0)+1;
  if(seen.has(item.jobId))problem('duplicate-job',item.jobId,'duplicate state',true);
  seen.add(item.jobId);
  const job=jobsMap.get(item.jobId);
  if(!job){problem('missing-job',item.jobId,'descriptor missing',true);continue;}
  if(item.sourceFingerprint!==job.sourceFingerprint)problem('fingerprint-mismatch',item.jobId,'descriptor and state differ',true);
  if(item.status!=='ready')continue;
  if(!item.submission?.resultPath){problem('missing-receipt',item.jobId,'no resultPath',true);continue;}
  let payload,raw;
  try{raw=await readFile(join(source,item.submission.resultPath));payload=JSON.parse(raw.toString('utf8'));}
  catch(e){problem('missing-result',item.jobId,e.message,true);continue;}
  if(shaGit(raw)!==item.submission.blobSha)problem('blob-sha',item.jobId,'receipt does not match Git blob',true);
  if(payload.jobId!==item.jobId)problem('result-identity',item.jobId,payload.jobId,true);
  let r=payload.result;
  try{validateMatchResult(r,job)}catch(e){problem('invalid-result',item.jobId,e.message,true);continue;}
  outcomes[r.outcome]=(outcomes[r.outcome]||0)+1;
  const doc=r.selectedSource;
  const sourceDoc=doc&&files.get(doc.driveFileId);
  if(doc){
   if(!sourceDoc)problem('source-not-in-inventory',item.jobId,doc.driveFileId);
   else{
    if(sourceDoc.modifiedTime!==doc.modifiedTime)problem('source-version',item.jobId,doc.driveFileId+' modifiedTime differs');
    if(Number(sourceDoc.sourceYearFolder)!==Number(doc.sourceYearFolder))problem('folder-year',item.jobId,doc.driveFileId);
   }
   duplicateDocs.set(doc.driveFileId,[...(duplicateDocs.get(doc.driveFileId)||[]),job.entityId]);
  }
  const days=new Set((r.dayAlignment||[]).map(x=>x.day).filter(Number.isInteger));
  if(doc&&job.durationDays&&days.size!==job.durationDays)problem('day-coverage',item.jobId,days.size+'/'+job.durationDays);
  const tariffRows=r.priceAmendments||[];
  for(const t of tariffRows){
   if(/excluded|not included|entrance fee|оплачивается отдельно/i.test(String(t.priceBasis||'')))problem('excluded-fee-as-tour-rate',item.jobId,JSON.stringify(t));
   prices.push({entityId:job.entityId,sourceFileId:doc?.driveFileId,sourceSha256:doc?.sourceSha256,
    sourceModifiedTime:doc?.modifiedTime,year:doc?.sourceYearFolder,amount:t.amount,currency:t.currency,
    priceBasis:t.priceBasis,occupancy:t.occupancy??null,hotel:t.hotel??null,sourceLocator:t.sourceLocator,
    changeRequired:t.changeRequired??null,currentRuAmount:t.currentRuAmount??null});
  }
  rows.push({entityId:job.entityId,jobId:item.jobId,outcome:r.outcome,year:doc?.sourceYearFolder||null,
   wordId:doc?.driveFileId||null,matchedDays:days.size,expectedDays:job.durationDays??null,
   priceRows:tariffRows.length,proposedChanges:tariffRows.filter(x=>x.changeRequired===true).length,
   resultPath:item.submission.resultPath,resultBlobSha:item.submission.blobSha});
 }
}
for(const [id,entities] of duplicateDocs)if(entities.length>1)problem('word-reused',id,entities.join(', '));
if(seen.size!==idx.jobCount||idx.jobCount!==registry.jobCount)problem('manifest-count','global',seen.size+'/'+idx.jobCount+'/'+registry.jobCount,true);
for(const [state,n] of Object.entries(idx.counts))if((status[state]||0)!==n)problem('state-count',state,(status[state]||0)+' vs '+n,true);
const summary={total:idx.jobCount,ready:status.ready||0,unresolved:idx.jobCount-(status.ready||0),
 states:status,outcomes,priceRows:prices.length,priceChangesFlagged:prices.filter(p=>p.changeRequired===true).length,
 unknownChangeFlag:prices.filter(p=>p.changeRequired===null).length,
 fatalIssues:err.length,warnings:warn.length,wordDocumentsUsed:duplicateDocs.size,
 matchingSource:'i18n/matching-staging',translationReady:false,pricesApplied:false};
if(dest){await mkdir(dest,{recursive:true});for(const [name,value] of [['summary',summary],['results',rows],['prices',prices],['issues',[...err,...warn]]])await writeFile(join(dest,name+'.json'),JSON.stringify(value,null,2)+'\n');}
console.log(JSON.stringify({...summary,issuePreview:[...err,...warn].slice(0,35)},null,2));
if(err.length||summary.unresolved)process.exitCode=1;