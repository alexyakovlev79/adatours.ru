// Conservative GEO extraction from exact active Tour/Excursion sources.
// No external identity, invented coordinates or speculative itinerary visits.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import yaml from 'js-yaml';
import {claim,complete,validateResult} from './schema-geo-core.mjs';
import {readGitHubJsonFile} from './schema-geo-github-json.mjs';
const REPO=process.env.GITHUB_REPOSITORY||'alexyakovlev79/adatours.ru';
const TOKEN=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
const API='https://api.github.com/repos/'+REPO;
const BRANCH='schema-geo/staging';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:40*1024*1024}).trim();
const norm=x=>String(x??'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/ё/gi,'е').toLocaleLowerCase('ru').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const unique=a=>[...new Set((a||[]).filter(x=>typeof x==='string'&&x.trim()))];
export function deriveSourcePassport(job,front,entry,catalog,mainSha,checkedAt){
 if(front?.id!==job.stableId||entry?.id!==job.stableId||entry?.url!==job.url||
 entry?.contentPath!==job.contentPath||!['approved','published','active'].includes(front?.status)||
 front.locale!=='ru')throw Error('Production ID/status/URL/source-entry mismatch');
 if(!['tour','excursion'].includes(job.kind))throw Error('Source-only worker supports tours/excursions');
 const from='https://github.com/'+REPO+'/blob/'+mainSha+'/'+job.contentPath;
 const fromEntry='https://github.com/'+REPO+'/blob/'+mainSha+'/'+job.entryPath;
 const evidence=[
 {field:'identity',sourceUrl:from,checkedAt,note:'Exact active MD matches saved Git blob SHA '+job.sourceBlobSha+'; stable ID, locale and product status checked.'},
 {field:'canonicalPath',sourceUrl:fromEntry,checkedAt,note:'Exact source-index entry matches stable ID, contentPath and canonical URL '+job.url+'.'}];
 const assessments=[{field:'identity',probability:99,selected:job.stableId,
 reason:'Active production MD identity confirmed against canonical source-index and immutable Git blob.'}];
 const linked=job.kind==='tour'?unique(front.destinations):
 unique([front.destination,...(Array.isArray(front.relatedDestinations)?front.relatedDestinations:[])]);
 const entries=Array.isArray(catalog)?catalog:(catalog.destinations||catalog.entries||[]);
 const byId=new Map(entries.map(x=>[x.id,x])),known=new Map();
 for(const id of linked){
  const d=byId.get(id),inEntry=(entry.destinations||[]).find(x=>x.id===id);
  for(const name of unique([d?.name,inEntry?.name,...(Array.isArray(d?.aliases)?d.aliases:[])])){
   const key=norm(name);if(!key)continue;
   if(!known.has(key))known.set(key,new Set());
   known.get(key).add(id);
  }
 }
 const matched=[],seen=new Set();
 const useName=(name,day,context)=>{
  const ids=known.get(norm(name));if(!ids||ids.size!==1)return;
  const id=[...ids][0];if(seen.has(id))return;
  seen.add(id);matched.push({id,day,context});
 };
 if(job.kind==='tour'){
  for(const day of Array.isArray(front.itinerary)?front.itinerary:[]){
   if(!Number.isSafeInteger(day?.day)||day.day<1)continue;
   for(const name of Array.isArray(day.places)?day.places:[])
    if(typeof name==='string')useName(name,day.day,'itinerary day '+day.day+' places');
  }
  if(!matched.length)for(const name of Array.isArray(front.route)?front.route:[])
   if(typeof name==='string')useName(name,undefined,'explicit route list');
 }else if(front.destination&&linked.includes(front.destination)){
  matched.push({id:front.destination,context:'canonical primary destination'});seen.add(front.destination);
 }
 const relationships=[];let position=0;
 for(const m of matched){
  const rel={type:'visits',targetId:m.id,position:++position};
  if(m.day)rel.day=m.day;
  relationships.push(rel);
  evidence.push({field:'relationships.'+m.id,sourceUrl:from,checkedAt,
   note:'Confirmed visit from '+m.context+'; exact registered Destination '+m.id+'.'});
  assessments.push({field:'relationships.'+m.id,probability:96,selected:m.id,
   reason:'Exact place matched to canonical ID in explicit itinerary/route or primary excursion destination.'});
 }
 for(const id of linked)if(!seen.has(id)){
  relationships.push({type:'relatedPlace',targetId:id});
  evidence.push({field:'relationships.'+id,sourceUrl:from,checkedAt,
   note:'Registered Destination is explicitly linked in active MD; visit order and mandatory status not inferred.'});
  assessments.push({field:'relationships.'+id,probability:90,selected:id,
   reason:'Explicit canonical Destination reference; only non-positional relatedPlace asserted.'});
 }
 return {schemaVersion:2,jobId:job.jobId,stableId:job.stableId,kind:job.kind,
 canonicalPath:job.url,sourceFingerprint:job.sourceFingerprint,status:'READY',
 confidence:'high',identityScope:'single',decisionPolicy:'probability-70-v1',
 relationships,evidence,assessments,reviewNote:null};
}
async function request(route,{method='GET',body}={}){
 if(!TOKEN)throw Error('Missing GitHub token');
 const r=await fetch(API+route,{method,headers:{Authorization:'Bearer '+TOKEN,
 Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',
 'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const raw=await r.text();
 if(!r.ok)throw Error(method+' '+route+' HTTP '+r.status+' '+raw.slice(0,400));
 return raw?JSON.parse(raw):null;
}
const json=(path,ref)=>readGitHubJsonFile(route=>request(route),path,ref);
const mainFile=(sha,path)=>git('show',sha+':'+path);
const mainBlob=(sha,path)=>git('rev-parse',sha+':'+path);
function parseFrontmatter(md){
 const m=md.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
 if(!m)throw Error('Missing YAML frontmatter');
 const data=yaml.load(m[1]);
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid YAML frontmatter');
 return data;
}
function makeReview(job,mainSha,reason,checkedAt){
 return {schemaVersion:2,jobId:job.jobId,stableId:job.stableId,kind:job.kind,
 canonicalPath:job.url,sourceFingerprint:job.sourceFingerprint,status:'REVIEW',
 confidence:'low',identityScope:'single',decisionPolicy:'probability-70-v1',
 assessments:[{field:'identity',probability:45,reason:'Unverified original identity: '+reason}],
 evidence:[{field:'identity',sourceUrl:'https://github.com/'+REPO+'/blob/'+mainSha+'/'+job.contentPath,checkedAt,
 note:'Source could not be confirmed: '+reason}],reviewNote:'Source verification needed: '+reason};
}
function compute(job,mainSha,catalog){
 const checkedAt=new Date().toISOString();
 try{
  if(mainBlob(mainSha,job.contentPath)!==job.sourceBlobSha)return {stale:true};
  const front=parseFrontmatter(mainFile(mainSha,job.contentPath));
  const entry=JSON.parse(mainFile(mainSha,job.entryPath));
  const result=deriveSourcePassport(job,front,entry,catalog,mainSha,checkedAt);
  const errs=validateResult(result,job);if(errs.length)throw Error(errs.join('; '));
  return {result};
 }catch(e){
  const result=makeReview(job,mainSha,String(e).slice(0,420),checkedAt);
  const errs=validateResult(result,job);
  if(errs.length)throw Error('Invalid REVIEW for '+job.jobId+': '+errs.join('; '));
  return {result};
 }
}
async function processBatch(dispatch,mainSha,catalog){
 for(let attempt=1;attempt<=4;attempt++){
  const head=(await request('/git/ref/heads/'+BRANCH)).object.sha;
  const [state,queue,manifest,commit]=await Promise.all([
   json('data/geo-knowledge/state.json',head),json('data/geo-knowledge/queue.json',head),
   json('data/geo-knowledge/manifest.json',head),request('/git/commits/'+head)]);
  const working=structuredClone(state);
  const jobs=claim(queue,working,{ownerId:dispatch.ownerId,token:dispatch.token,
   now:Date.now(),limit:Math.min(10,dispatch.limit||10),
   batchSize:manifest.batchSize,maxStage:manifest.maxStage});
  if(!jobs.length)return {status:'empty_or_gated',commit:head};
  if(!jobs.every(j=>['tour','excursion'].includes(j.kind)&&j.stage<=manifest.maxStage))
   throw Error('Source-only worker refuses non-tour/excursion lease');
  const edits=[],statuses={};
  for(const job of jobs){
   const outcome=compute(job,mainSha,catalog);
   if(outcome.stale){
    delete working.leases[job.jobId];
    working.jobs[job.jobId]={...working.jobs[job.jobId],status:'STALE'};
    statuses.STALE=(statuses.STALE||0)+1;continue;
   }
   const saved=complete(queue,working,{ownerId:dispatch.ownerId,token:dispatch.token,
    now:Date.now(),result:outcome.result});
   if(saved.idempotent)continue;
   edits.push({path:saved.path,mode:'100644',type:'blob',
    content:JSON.stringify(outcome.result,null,2)+'\n'});
   statuses[outcome.result.status]=(statuses[outcome.result.status]||0)+1;
  }
  edits.push({path:'data/geo-knowledge/state.json',mode:'100644',type:'blob',
   content:JSON.stringify(working,null,2)+'\n'});
  const tree=await request('/git/trees',{method:'POST',body:{base_tree:commit.tree.sha,tree:edits}});
  const created=await request('/git/commits',{method:'POST',body:{parents:[head],tree:tree.sha,
   message:'geo: source-check '+jobs.length+' '+jobs[0].kind+' passports [skip ci]'}});
  try{
   await request('/git/refs/heads/'+BRANCH,{method:'PATCH',body:{sha:created.sha,force:false}});
   return {status:'saved',commit:created.sha,count:jobs.length,statuses,jobIds:jobs.map(x=>x.jobId)};
  }catch(e){
   const current=(await request('/git/ref/heads/'+BRANCH)).object.sha;
   if(current===created.sha)return {status:'saved',commit:created.sha,count:jobs.length,statuses};
   if(attempt===4)throw Error('Staging CAS contention: '+String(e));
  }
 }
}
async function main(){
 const d=JSON.parse(readFileSync('data/geo-knowledge/source-collector-dispatch.json','utf8'));
 if(!/^[a-zA-Z0-9_-]{8,120}$/.test(d.ownerId)||!/^[a-zA-Z0-9_-]{16,160}$/.test(d.token)||
 !Number.isSafeInteger(d.maxBatches)||d.maxBatches<1||d.maxBatches>100)throw Error('Unsafe dispatch');
 git('fetch','--no-tags','origin','+refs/heads/main:refs/remotes/origin/main');
 const mainSha=git('rev-parse','refs/remotes/origin/main');
 const catalog=JSON.parse(mainFile(mainSha,'src/data/catalog/destinations.json'));
 const outputs=[];
 for(let i=0;i<d.maxBatches;i++){
  const result=await processBatch(d,mainSha,catalog);
  outputs.push(result);
  console.log(JSON.stringify({batch:i+1,...result}));
  if(result.status==='empty_or_gated')break;
  if((result.statuses?.STALE||0)===result.count)break;
 }
 console.log(JSON.stringify({status:'finished',mainSha,batches:outputs.length,
  ready:outputs.reduce((n,x)=>n+(x.statuses?.READY||0),0),
  review:outputs.reduce((n,x)=>n+(x.statuses?.REVIEW||0),0)}));
}
if(process.argv[1]&&import.meta.url.endsWith('/'+process.argv[1].split('/').pop()))
 main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
