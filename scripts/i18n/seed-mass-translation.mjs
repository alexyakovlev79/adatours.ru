#!/usr/bin/env node
/** Offline, idempotent preparation of the whole verified 358-Tour EN swarm.
 *
 * The source of Word identity is the completed matching CAS branch; never
 * the older candidate-only tour-word-matches.json. Reuse only exact QA-ready
 * pilot blocks whose RU and selected Word source fingerprints still match.
 * This script has no network access, makes no translation and never writes
 * main or an existing staging queue.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import yaml from 'js-yaml';
import {visibleLocalizationSlots} from '../../src/lib/i18n/content-adapter.mjs';
import {sha256,planTourTranslation,createMassTranslationState}
 from '../../src/lib/i18n/translation-mass-plan.mjs';

const fail=m=>{throw Error('EN mass seed: '+m)};
const sha1=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0'+s).digest('hex');
const read=(root,p)=>fs.readFileSync(path.join(root,p),'utf8');
const json=(root,p)=>JSON.parse(read(root,p));
const exists=(root,p)=>fs.existsSync(path.join(root,p));
function getReadyState(root,relative){
 const index=json(root,relative+'/index.json');
 const ready=new Map();
 for(let n=0;n<16;n++){
  const sid=n.toString(16).padStart(2,'0');
  const state=json(root,relative+'/state/'+sid+'.json');
  if(state.shardId!==sid||!Array.isArray(state.items))fail('Corrupt source state '+sid);
  for(const item of state.items){
   if(ready.has(item.jobId))fail('Duplicate source job '+item.jobId);
   ready.set(item.jobId,item);
  }
 }
 const statusCount=[...ready.values()].reduce((map,item)=>{
  map[item.status]=(map[item.status]||0)+1;return map;
 },{});
 for(const [key,value] of Object.entries(index.counts||{}))
  if((statusCount[key]||0)!==value)fail('Source status count mismatch '+relative+'/'+key);
 return {index,items:ready};
}
function checkedReceipt(root,receipt){
 if(!receipt?.resultPath||!receipt.blobSha||!exists(root,receipt.resultPath))
  fail('Missing immutable submission receipt');
 const bytes=read(root,receipt.resultPath);
 if(sha1(bytes)!==receipt.blobSha)fail('Git result blob SHA changed '+receipt.resultPath);
 return JSON.parse(bytes);
}
export function readMassInputs({sourceRoot,matchingRoot,pilotRoot}){
 const maps=json(sourceRoot,'data/i18n/block-maps/tours/manifest.json');
 if(maps.activeTours!==358||maps.processed!==358||maps.errors!==0||
   maps.totalBlocks!==31330||!Array.isArray(maps.entries))
  fail('Full source block-map manifest is not verified');
 const matching=getReadyState(matchingRoot,'data/i18n/matching/v1');
 if(matching.index.jobCount!==358||matching.index.counts.ready!==358)
  fail('Matching is incomplete or has unresolved jobs');
 const pilot=getReadyState(pilotRoot,'data/i18n/translation/v1');
 if(pilot.index.jobCount!==5||pilot.index.counts.ready!==5)
  fail('Expected sealed five-packet pilot is not complete');
 const results=new Map();
 for(const [jobId,row] of matching.items){
  if(row.status!=='ready')fail('Missing matching QA: '+jobId);
  const saved=checkedReceipt(matchingRoot,row.submission);
  if(saved.jobId!==jobId||saved.result?.sourceFingerprint!==row.sourceFingerprint)
   fail('Matching identity mismatch '+jobId);
  results.set(saved.result.entityId,saved.result);
 }
 const pilotByTour=new Map();
 const pilotJobs=new Map();
 for(let n=0;n<16;n++){
  const sid=n.toString(16).padStart(2,'0');
  for(const j of json(pilotRoot,'data/i18n/translation/v1/jobs/'+sid+'.json').jobs)
   pilotJobs.set(j.jobId,j);
 }
 for(const [jobId,row] of pilot.items){
  if(row.status!=='ready')fail('Incomplete pilot receipt '+jobId);
  const saved=checkedReceipt(pilotRoot,row.submission),job=pilotJobs.get(jobId);
  if(!job||saved.jobId!==jobId||saved.sourceFingerprint!==job.sourceFingerprint||
     row.review?.acceptedBlobSha!==row.submission.blobSha||
     !Object.values(row.review.checks||{}).every(Boolean))
   fail('Unverified pilot QA '+jobId);
  const arr=pilotByTour.get(job.entityId)||[];
  arr.push({job,blocks:saved.blocks.map(b=>b.blockId)});
  pilotByTour.set(job.entityId,arr);
 }
 return {maps,results,pilotByTour};
}
export function compileAllMassJobs({sourceRoot,matchingRoot,pilotRoot,
 sourceCommit,matchingCommit,pilotCommit}){
 const {maps,results,pilotByTour}=readMassInputs({sourceRoot,matchingRoot,pilotRoot});
 const rows=[],staleSources=[],issues=[],pilotExcluded=[];
 let readBlocks=0;
 const allIds=new Set();
 for(const record of maps.entries){
  const id=record.entityId;
  if(allIds.has(id))fail('Duplicate source Tour '+id);
  allIds.add(id);
  try{
   const map=json(sourceRoot,'data/i18n/block-maps/tours/'+id+'.json');
   if(map.sourceContentPath!==record.path||map.ruBlobSha256!==record.sourceSha256||
     !exists(sourceRoot,map.sourceContentPath))fail('Source manifest identity changed '+id);
   const md=read(sourceRoot,map.sourceContentPath);
   if(sha256(md)!==map.ruBlobSha256){
    staleSources.push({id,source:map.sourceContentPath,reason:'RU Markdown changed after block mapping'});
    continue;
   }
   const front=/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/u.exec(md);
   if(!front)fail('Invalid canonical MD '+id);
   const data=yaml.load(front[1]);
   if(data.id!==id||data.locale!=='ru'||!['approved','published'].includes(data.status))
    fail('Inactive or misidentified Tour '+id);
   const slots=visibleLocalizationSlots({id:'ru:'+id,data,body:front[2]},'tour');
   const match=results.get(id);
   if(!match)fail('No ready matching result for '+id);
   const selected=match.selectedSource||null;
   const reused=[];
   for(const v of pilotByTour.get(id)||[]){
    if(v.job.source.ruSha256!==map.ruBlobSha256||
       (selected&&v.job.source.wordSha256!==selected.sourceSha256)){
      pilotExcluded.push({jobId:v.job.jobId,reason:'source changed'});continue;
    }
    reused.push(...v.blocks);
   }
   const row=planTourTranslation({id,map,slots,contentSha256:sha256(md),
    sourceBlobSha:sha1(md),match,pilotReady:reused});
   readBlocks+=slots.length;
   rows.push(row);
  }catch(error){
   issues.push({id,error:String(error)});
  }
 }
 if(issues.length)fail('Invalid source records: '+JSON.stringify(issues.slice(0,8)));
 const result=createMassTranslationState(rows,{sourceCommit,matchingCommit,pilotCommit});
 const report={schemaVersion:2,sourceCommit,matchingCommit,pilotCommit,
  expectedTours:358,preparedTours:rows.length,staleTourCount:staleSources.length,
  staleSources,readBlocks,pilotExcluded,
  stages:result.manifest.perStage,queuedPackets:result.index.counts.queued,
  heldPackets:result.index.counts.held,reusedReadyBlocks:result.manifest.reusedReadyBlocks,
  missingSourceTasks:358-rows.length,issues:[]};
 return {...result,report};
}
function arg(name){const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1]}
function save(root,relative,value){
 const f=path.join(root,relative);fs.mkdirSync(path.dirname(f),{recursive:true});
 if(fs.existsSync(f))fail('Refusing to overwrite existing queue file '+f);
 fs.writeFileSync(f,JSON.stringify(value,null,2)+'\n');
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url))){
 const roots={sourceRoot:arg('--source'),matchingRoot:arg('--matching'),
  pilotRoot:arg('--pilot'),sourceCommit:arg('--source-sha'),
  matchingCommit:arg('--matching-sha'),pilotCommit:arg('--pilot-sha')};
 const output=arg('--output');
 if(!output||Object.values(roots).some(x=>!x))fail('Explicit source/matching/pilot roots, SHAs and output required');
 if(fs.existsSync(output)&&fs.readdirSync(output).length)fail('Output directory is not empty');
 const q=compileAllMassJobs(roots);
 const dir=path.resolve(output);
 save(dir,'manifest.json',q.manifest);save(dir,'index.json',q.index);
 save(dir,'preflight-report.json',q.report);
 for(const [sid,item] of Object.entries(q.shards))save(dir,'state/'+sid+'.json',item);
 for(const [sid,item] of Object.entries(q.packets))save(dir,'jobs/'+sid+'.json',item);
 console.log(JSON.stringify({status:'prepared_disabled',output:dir,report:q.report,
  totalPackets:q.index.jobCount,proposedStages:q.manifest.perStage},null,2));
}
