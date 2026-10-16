// GitHub Actions bulk publisher. The only remote trigger is a staging dispatch marker.
// Validates all immutable READY results locally; writes one fast-forward main commit,
// then explicitly workflow_dispatches Pages (GITHUB_TOKEN pushes do not trigger workflows).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {digest,validateResult,stable,recordCommit} from './schema-geo-core.mjs';

const ROOT=process.cwd();
const REPO=process.env.GITHUB_REPOSITORY||'alexyakovlev79/adatours.ru';
const TOKEN=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
const BASE='https://api.github.com/repos/'+REPO;

function git(args,cwd=ROOT){
 return execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:1024*1024*10}).trim();
}
async function api(route,{method='GET',body}={}){
 if(!TOKEN)throw Error('GitHub Actions token unavailable');
 const r=await fetch(BASE+route,{method,headers:{
  Authorization:'Bearer '+TOKEN,Accept:'application/vnd.github+json',
  'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'
 },body:body===undefined?undefined:JSON.stringify(body)});
 const raw=await r.text();
 if(!r.ok)throw Error(method+' '+route+': HTTP '+r.status+' '+raw.slice(0,500));
 return raw?JSON.parse(raw):null;
}
async function stateFromGithub(ref){
 const file=await api('/contents/data/geo-knowledge/state.json?ref='+encodeURIComponent(ref));
 if(file.encoding!=='base64')throw Error('Unexpected GEO state encoding');
 return JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
}
function sameBatch(p,d){
 return !!p&&p.batchId===d.batchId&&p.ownerId===d.ownerId&&p.jobs.length===d.count;
}
function prepare(stagingState,queue,dispatch){
 const p=stagingState.publication;
 if(!sameBatch(p,dispatch)||p.status!=='PUBLISHING'||p.commit)
  return {skip:true,reason:'No matching uncommitted PUBLISHING batch'};
 const lookup=new Map(queue.jobs.map(j=>[j.jobId,j])), selected=new Map();
 for(const locked of p.jobs){
  const j=lookup.get(locked.jobId);
  if(!j||!j.available||j.sourceFingerprint!==locked.sourceFingerprint)
   throw Error('Stale/unavailable queued job: '+locked.jobId);
  if(!/^[a-z0-9_]+$/.test(j.stableId))throw Error('Unsafe stable ID: '+j.stableId);
  const payload=JSON.parse(fs.readFileSync(path.join(ROOT,locked.resultPath),'utf8'));
  if(payload.status!=='READY'||digest(payload)!==locked.resultHash)
   throw Error('Immutable result mismatch: '+locked.jobId);
  const errs=validateResult(payload,j);
  if(errs.length)throw Error(locked.jobId+': '+errs.join('; '));
  const old=selected.get(j.stableId);
  if(old&&!j.amendmentOf&&!old.job.amendmentOf)
   throw Error('Unrelated duplicate stable ID: '+j.stableId);
  if(!old||j.amendmentOf===old.job.jobId||old.job.amendmentOf!==j.job.jobId)
   selected.set(j.stableId,{job:j,payload});
 }
 return {p,selected,sourceJobs:p.jobs.map(x=>lookup.get(x.jobId)),skip:false};
}
function writeToMain(mainDir,data){
 for(const job of data.sourceJobs){
  if(!job.contentPath||!job.sourceBlobSha)continue;
  const real=git(['rev-parse','HEAD:'+job.contentPath],mainDir);
  if(real!==job.sourceBlobSha)throw Error('Main source has changed: '+job.jobId);
 }
 const changed=[];
 for(const [stableId,{payload}] of data.selected){
  const rel='data/geo-knowledge/entities/'+stableId+'.json';
  const full=path.join(mainDir,rel);
  fs.mkdirSync(path.dirname(full),{recursive:true});
  fs.writeFileSync(full,JSON.stringify(payload,null,2)+'\n','utf8');
  changed.push(rel);
 }
 const receiptPath='data/geo-knowledge/releases/'+data.p.batchId+'.json';
 const receipt={schemaVersion:2,batchId:data.p.batchId,jobs:data.p.jobs};
 const full=path.join(mainDir,receiptPath);
 if(fs.existsSync(full)){
  const existing=JSON.parse(fs.readFileSync(full,'utf8'));
  if(stable(existing)!==stable(receipt))throw Error('Conflicting existing GEO release receipt');
 }else{
  fs.mkdirSync(path.dirname(full),{recursive:true});
  fs.writeFileSync(full,JSON.stringify(receipt,null,2)+'\n','utf8');
 }
 changed.push(receiptPath);
 // Detect a collision across existing and newly added production passports before pushing.
 const dir=path.join(mainDir,'data/geo-knowledge/entities');
 const qids=new Map();
 for(const filename of fs.readdirSync(dir).filter(n=>n.endsWith('.json'))){
  const p=JSON.parse(fs.readFileSync(path.join(dir,filename),'utf8'));
  const qid=p.external?.wikidataQid;
  if(!qid)continue;
  if(qids.has(qid)&&qids.get(qid)!==p.stableId)
   throw Error('Wikidata QID collision: '+qid+' '+qids.get(qid)+' / '+p.stableId);
  qids.set(qid,p.stableId);
 }
 git(['add','--',...changed],mainDir);
 const dirty=git(['diff','--cached','--name-only'],mainDir);
 return {dirty:!!dirty,changedFiles:changed.length};
}
async function commitMain(data){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'geo-batch-'));
 try{
  git(['fetch','--no-tags','--depth=1','origin','+refs/heads/main:refs/remotes/origin/main']);
  git(['worktree','add','--detach',temp,'refs/remotes/origin/main']);
  for(let attempt=1;attempt<=3;attempt++){
   if(attempt>1){
    git(['fetch','--no-tags','--depth=1','origin','+refs/heads/main:refs/remotes/origin/main']);
    git(['reset','--hard','refs/remotes/origin/main'],temp);
    git(['clean','-fd'],temp);
   }
   const initial=git(['rev-parse','HEAD'],temp);
   const output=writeToMain(temp,data);
   if(output.dirty){
    git(['-c','user.name=ADA Tours GEO Publisher','-c','user.email=actions@users.noreply.github.com',
     'commit','-m','geo: publish '+data.p.jobs.length+' READY results ('+data.selected.size+' passports), batch '+data.p.batchId],temp);
   }
   const commit=git(['rev-parse','HEAD'],temp);
   if(!output.dirty)return {commit,alreadyPresent:true};
   try{
    // A normal fast-forward push, never force. GITHUB_TOKEN commits need explicit dispatch.
    git(['push','origin','HEAD:refs/heads/main'],temp);
    return {commit,alreadyPresent:false};
   }catch(e){
    const live=(await api('/git/ref/heads/main')).object.sha;
    if(live===commit)return {commit,alreadyPresent:false};
    if(attempt===3)throw Error('main CAS failed three times: '+String(e));
   }
  }
 }finally{
  try{git(['worktree','remove','--force',temp]);}catch{}
  fs.rmSync(temp,{force:true,recursive:true});
 }
}
async function recordInStaging(data,releaseSha){
 for(let attempt=1;attempt<=5;attempt++){
  const head=(await api('/git/ref/heads/schema-geo/staging')).object.sha;
  const state=await stateFromGithub(head),p=state.publication;
  if(!sameBatch(p,{batchId:data.p.batchId,ownerId:data.p.ownerId,count:data.p.jobs.length}))
   throw Error('Publication lock no longer matches');
  if(stable(p.jobs)!==stable(data.p.jobs))throw Error('Locked result hashes changed');
  if(p.status==='PUBLISHED'&&p.commit===releaseSha)return;
  if(p.status==='DEPLOYING'&&p.commit===releaseSha)return;
  recordCommit(state,{batchId:p.batchId,ownerId:p.ownerId,commit:releaseSha,now:Date.now()});
  const blob=await api('/git/blobs',{method:'POST',body:{content:JSON.stringify(state,null,2)+'\n',encoding:'utf-8'}});
  const current=await api('/git/commits/'+head);
  const tree=await api('/git/trees',{method:'POST',body:{base_tree:current.tree.sha,
   tree:[{path:'data/geo-knowledge/state.json',mode:'100644',type:'blob',sha:blob.sha}]}});
  const commit=await api('/git/commits',{method:'POST',body:{
   message:'geo: record content commit '+releaseSha.slice(0,12)+' [skip ci]',
   tree:tree.sha,parents:[head]}});
  try{
   await api('/git/refs/heads/schema-geo/staging',{method:'PATCH',body:{sha:commit.sha,force:false}});
   return;
  }catch(e){
   if(attempt===5)throw e;
  }
 }
}
async function dispatchPages(releaseSha){
 const live=(await api('/git/ref/heads/main')).object.sha;
 if(live!==releaseSha)throw Error('main advanced before dispatch; do not pretend exact SHA deploy');
 const runs=await api('/actions/runs?head_sha='+releaseSha+'&per_page=20');
 const existing=(runs.workflow_runs||[]).find(r=>r.head_sha===releaseSha&&r.event==='workflow_dispatch'&&r.path==='.github/workflows/deploy.yml');
 if(existing)return {alreadyDispatched:true,runUrl:existing.html_url};
 // The explicit dispatch *does* trigger workflows when called with github.token.
 await api('/actions/workflows/deploy.yml/dispatches',{method:'POST',body:{ref:'main'}});
 return {alreadyDispatched:false};
}
async function main(){
 const d=JSON.parse(fs.readFileSync('data/geo-knowledge/dispatch.json','utf8'));
 const state=JSON.parse(fs.readFileSync('data/geo-knowledge/state.json','utf8'));
 const queue=JSON.parse(fs.readFileSync('data/geo-knowledge/queue.json','utf8'));
 if(!/^[a-zA-Z0-9_-]{8,120}$/.test(d.batchId)||!/^[a-zA-Z0-9_-]{8,120}$/.test(d.ownerId))
  throw Error('Unsafe GEO dispatch identity');
 const data=prepare(state,queue,d);
 if(data.skip){console.log(JSON.stringify({status:'skipped',reason:data.reason}));return;}
 const published=await commitMain(data);
 // The Pages workflow is independent: even if the staging acknowledgment is lost,
 // the completed deploy can recover PUBLISHING from the immutable main receipt.
 let recordError=null;
 try{await recordInStaging(data,published.commit);}catch(e){recordError=String(e);console.error('Staging recordCommit deferred: '+recordError);}
 const dispatched=await dispatchPages(published.commit);
 console.log(JSON.stringify({status:'deployed_pending',batchId:data.p.batchId,results:data.p.jobs.length,
  passports:data.selected.size,mainCommit:published.commit,alreadyPresent:published.alreadyPresent,
  dispatched,recordError}));
}
main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
