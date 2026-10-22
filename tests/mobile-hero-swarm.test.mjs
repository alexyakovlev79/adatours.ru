import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import * as core from '../scripts/mobile-hero-swarm-core.mjs';
import { runMobileHeroSwarm } from '../scripts/mobile-hero-swarm-remote.mjs';
const copy=x=>JSON.parse(JSON.stringify(x)),json=x=>JSON.stringify(x,null,2)+'\n';
const now=Date.parse('2026-10-23T10:00:00Z');
const owner='worker_one_0001',token='token_one_00001';
const sourceHash='a'.repeat(64),imageHash='b'.repeat(64);
test('connector V8 without TextEncoder, Buffer or Node can hash Unicode submissions',async()=>{
  const source=await readFile(new URL('../scripts/mobile-hero-swarm-core.mjs',import.meta.url),'utf8');
  const isolated=runInNewContext(source.replace(/^export /gm,'')+';({sha256,digest})',{});
  for(const text of ['','abc','Голова попугая 🦜','\ud800'])assert.equal(isolated.sha256(text),createHash('sha256').update(text).digest('hex'));
  assert.equal(isolated.digest({focus:'Два лица 🦙'}),core.digest({focus:'Два лица 🦙'}));
});
function asset(id='hero-test-001'){return{id,source:'/media/tours/test/hero-20261001.webp',sourceSha256:sourceHash,sourceWidth:1600,sourceHeight:1000,usages:[{id:'usage-'+id,pagePath:'/test/',profile:'standard'}]};}
function packet(id='b001',job=asset()){return{schemaVersion:1,id,assetIds:[job.id],jobsPath:`${core.SWARM_ROOT}/jobs/${id}.json`,generation:0,status:'queued',lease:null,jobs:[job]};}
function ready(job=asset()){
  return{assetId:job.id,status:'ready',source:job.source,sourceSha256:sourceHash,sourceWidth:1600,sourceHeight:1000,processing:{sharpVersion:'0.35.5',format:'webp',quality:78,withoutEnlargement:true},recipes:[{id:'crop-1',profile:'standard',usageIds:job.usages.map(u=>u.id),crop:{left:300,top:0,width:750,height:1000},objectPosition:'center top',focusReason:'Keep both human faces and the animal head in the visible crop.',visualQA:{sourceViewed:true,previewsViewed:true,notes:'Viewed original and 320, 412 and 479 pixel cover simulations.'},variants:[{key:`media/hero-mobile-swarm/${job.id}-480-20261023-v1.webp`,width:480,height:640,bytes:12345,sha256:imageHash}]}]};
}
function receipt(result=ready()){return{version:1,assets:result.recipes.flatMap(r=>r.variants.map(v=>({key:v.key,sha256:v.sha256,bytes:v.bytes,source:'direct-s3',contentType:'image/webp',uploadedAt:'2026-10-23T10:01:00Z',status:'uploaded-and-verified'})))};}
function submission(result=ready(),extra={}){return{action:'submit',ownerId:owner,token,generation:1,submissionId:'submission_one_001',results:[result],receipt:receipt(result),nowMs:now+1000,...extra};}
test('portable SHA-256 and canonical payload digests match standard vectors',()=>{
  for(const value of ['', 'abc', 'Русский текст 🦜', 'x'.repeat(1500)])assert.equal(core.sha256(value),createHash('sha256').update(value).digest('hex'));
  assert.equal(core.digest({b:2,a:1}),core.digest({a:1,b:2}));
});
test('claim, expiry, renew and fencing prevent stale owner writes',()=>{
  const p=packet();core.take(p,{ownerId:owner,token,nowMs:now});
  assert.equal(p.generation,1);assert.equal(p.lease.expiresAt,'2026-10-23T11:00:00.000Z');
  assert.equal(core.take(p,{ownerId:owner,token,nowMs:now+1}).resumed,true);
  assert.equal(core.take(p,{ownerId:'another_worker_1',token:'another_token_001',nowMs:now+1}).packet,null);
  assert.throws(()=>core.renew(p,{ownerId:owner,token,generation:0,nowMs:now+10}),/generation/);
  core.take(p,{ownerId:'another_worker_1',token:'another_token_001',nowMs:now+3600000});assert.equal(p.generation,2);
  assert.throws(()=>core.saveResults(p,submission()),/Lease lost/);
});
test('ready result requires meaningful visual QA, exact usages, pixel bounds and verified bytes',()=>{
  const good=ready();assert.equal(core.validateReadyResult(good,asset(),receipt(good)).size,1);
  const mutations=[r=>r.recipes[0].visualQA.previewsViewed=false,r=>r.recipes[0].crop.left=1500,r=>r.sourceSha256='c'.repeat(64),r=>r.recipes[0].usageIds=['another-usage'],r=>r.recipes[0].profile='photo-lead',r=>r.recipes[0].variants[0].width=900,r=>r.processing.sharpVersion='0.34.4'];
  for(const mutate of mutations){const r=copy(good);mutate(r);assert.throws(()=>core.validateReadyResult(r,asset(),receipt(good)));}
  const bad=receipt();bad.assets[0].sha256='c'.repeat(64);assert.throws(()=>core.validateReadyResult(good,asset(),bad),/matching verified/);
});
test('checkpoint survives expiry/reclaim and final commit accounts for every frozen job',()=>{
  const a=asset(),b=asset('hero-test-002'),p=packet();p.jobs.push(b);p.assetIds.push(b.id);
  core.take(p,{ownerId:owner,token,nowMs:now});core.saveResults(p,submission(ready(a),{action:'checkpoint'}));
  assert.equal(p.status,'leased');assert.equal(p.progress.length,1);
  const newOwner='another_worker_1',newToken='another_token_001';core.take(p,{ownerId:newOwner,token:newToken,nowMs:now+3600000});
  assert.equal(p.progress[0].status,'ready');assert.equal(p.receipt.assets.length,1);
  const unresolved={assetId:b.id,source:b.source,status:'review',note:'The original download is currently unavailable; no replacement published.'};
  core.saveResults(p,{action:'submit',ownerId:newOwner,token:newToken,generation:2,submissionId:'submission_final_002',results:[unresolved],receipt:{version:1,assets:[]},nowMs:now+3601000});
  assert.equal(p.status,'completed');assert.equal(p.progress.length,2);assert.equal(p.lease,null);
  const record=core.stateRecord(p);assert.equal('jobs'in record,false);assert.equal(record.assetIds.length,2);
});
test('accepted result immutable; identical submission is safe even after completion',()=>{
  const p=packet();core.take(p,{ownerId:owner,token,nowMs:now});const req=submission();core.saveResults(p,req);
  assert.equal(core.saveResults(p,req).alreadySaved,true);
  const changed=copy(req);changed.results[0].recipes[0].focusReason+=' Changed.';assert.throws(()=>core.saveResults(p,changed),/different payload/);
  core.requeue(p,{expectedGeneration:1,reason:'Retry only unresolved entries after the network recovers.',nowMs:now+2000});assert.equal(p.progress.length,1);
});
class FakeGitHub {
  constructor(count=3){
    this.sequence=0;this.commits=new Map();this.trees=new Map();this.beforeRef=null;this.throwAfterRef=false;this.atomicWrites=[];
    const files={};this.metas=[];
    for(let i=1;i<=count;i++){
      const id='b'+String(i).padStart(3,'0'),job=asset('hero-test-'+String(i).padStart(3,'0')),p=packet(id,job),jobsPath=p.jobsPath,jobs=json({schemaVersion:1,id,jobs:p.jobs});
      const meta={id,path:core.packetPath(id),jobsPath,assetIds:[job.id],jobsBlobSha:this.sha(jobs),jobsSha256:core.sha256(jobs)};this.metas.push(meta);files[meta.path]=json(core.stateRecord(p));files[jobsPath]=jobs;
    }
    files[core.SWARM_ROOT+'/manifest.json']=json({schemaVersion:1,repository:core.SWARM_REPOSITORY,branch:core.SWARM_BRANCH,root:core.SWARM_ROOT,status:'active',leaseMinutes:60,batchSize:10,maxPasses:12,sourceCommit:'d'.repeat(40),packets:this.metas});
    this.head=this.commit(files,'seed');this.tools=Object.fromEntries(['fetch_file','fetch','update_file','create_tree','create_commit','update_ref'].map(name=>['mcp__codex_apps__github_'+name,this[name].bind(this)]));
  }
  sha(content){return createHash('sha1').update('blob '+Buffer.byteLength(content)+'\0'+content).digest('hex');}
  commit(files,message,parent=null){const tree='tree-'+(++this.sequence),sha='commit-'+this.sequence;this.trees.set(tree,copy(files));this.commits.set(sha,{files:copy(files),tree,message,parent});return sha;}
  current(path){return JSON.parse(this.commits.get(this.head).files[path]);}
  async fetch_file({path,ref}){const sha=this.commits.has(ref)?ref:this.head,content=this.commits.get(sha).files[path];if(content===undefined)throw Error('404 '+path);return{structuredContent:{content,sha:this.sha(content)}};}
  async fetch({url}){let value;if(url.includes('/git/ref/'))value={object:{sha:this.head}};else{const sha=url.split('/').at(-1);value={tree:{sha:this.commits.get(sha).tree}};}return{structuredContent:{content:JSON.stringify(value)}};}
  async update_file({path,sha,content,message}){const files=copy(this.commits.get(this.head).files);if(this.sha(files[path])!==sha)throw Error('409 blob conflict');files[path]=content;this.head=this.commit(files,message,this.head);return{structuredContent:{commit_sha:this.head,content_sha:this.sha(content)}};}
  async create_tree({base_tree_sha,tree_elements}){const files=copy(this.trees.get(base_tree_sha));for(const element of tree_elements)files[element.path]=element.content;const sha='prepared-tree-'+(++this.sequence);this.trees.set(sha,files);this.atomicWrites.push(tree_elements.map(e=>e.path));return{structuredContent:{sha}};}
  async create_commit({parent_sha,tree_sha,message}){return{structuredContent:{sha:this.commit(this.trees.get(tree_sha),message,parent_sha)}};}
  async update_ref({sha,expected_sha,force}){assert.equal(force,false);if(this.beforeRef){const action=this.beforeRef;this.beforeRef=null;await action();}if(this.head!==expected_sha)throw Error('409 head moved');this.head=sha;if(this.throwAfterRef){this.throwAfterRef=false;throw Error('Connection lost after successful write');}return{structuredContent:{success:true}};}
}
const call=(git,args)=>runMobileHeroSwarm(git.tools,core,args);
async function claimOne(git,id='b001',suffix='one'){return call(git,{action:'claim',packetId:id,ownerId:'worker_'+suffix+'_0001',token:'token_'+suffix+'_00001',pass:1});}
function remoteSubmission(claim){const p=claim.packet,r=ready(p.jobs[0]);return{action:'submit',packetId:p.id,ownerId:p.lease.ownerId,token:p.lease.token,generation:p.generation,submissionId:'submit_'+p.id+'_0001',results:[r],receipt:receipt(r)};}
test('concurrent chats reserve different entire packets and never rewrite immutable jobs',async()=>{
  const git=new FakeGitHub(5);
  const results=await Promise.all(Array.from({length:5},(_,i)=>call(git,{action:'claim',ownerId:'worker_parallel_'+i,token:'token_parallel_'+i,cursor:0,pass:1})));
  assert.equal(new Set(results.map(r=>r.packet.id)).size,5);assert(results.every(r=>r.packet.jobs.length===1));
  for(const meta of git.metas)assert.equal('jobs'in git.current(meta.path),false);
  const busy=await call(git,{action:'claim',ownerId:'worker_extra_0001',token:'token_extra_00001'});assert.equal(busy.status,'busy');assert.equal(busy.scanned.length,5);
});
test('tree submit retries fresh head, preserves another packet and saves results/receipt/state atomically',async()=>{
  const git=new FakeGitHub(2),mine=await claimOne(git);
  git.beforeRef=()=>claimOne(git,'b002','other');
  const saved=await call(git,remoteSubmission(mine));assert.equal(saved.status,'saved');assert.equal(git.current(core.packetPath('b002')).status,'leased');assert.equal(git.current(core.packetPath('b001')).status,'completed');
  assert(git.atomicWrites.every(paths=>paths.length===3&&paths.includes(core.packetPath('b001'))&&paths.includes(core.SWARM_ROOT+'/results/b001.json')&&paths.includes(core.SWARM_ROOT+'/receipts/b001.json')));
  assert.equal(git.current(core.SWARM_ROOT+'/results/b001.json').results[0].status,'ready');
});
test('uncertain successful final write is recognized; same payload cannot create duplicate commits',async()=>{
  const git=new FakeGitHub(1),mine=await claimOne(git),request=remoteSubmission(mine);git.throwAfterRef=true;
  const saved=await call(git,request);assert.equal(saved.status,'saved_after_uncertain_response');const previousHead=git.head;
  const again=await call(git,request);assert.equal(again.status,'already_saved');assert.equal(git.head,previousHead);
});
test('frozen job tampering and missing receipts reject before any result commit',async()=>{
  const git=new FakeGitHub(1),mine=await claimOne(git),request=remoteSubmission(mine);request.receipt.assets[0].bytes++;
  await assert.rejects(call(git,request),/matching verified/);assert.equal(git.atomicWrites.length,0);
  const files=copy(git.commits.get(git.head).files);files[git.metas[0].jobsPath]+=' ';git.head=git.commit(files,'tamper',git.head);
  await assert.rejects(call(git,remoteSubmission(mine)),/Frozen jobs blob changed/);
});
test('pass limit comes from manifest and status can paginate complete queue accurately',async()=>{
  const git=new FakeGitHub(3);await assert.rejects(call(git,{action:'claim',ownerId:owner,token,pass:13}),/maxPasses/);
  const first=await call(git,{action:'status',from:0,count:2});assert.equal(first.nextFrom,2);assert.equal(first.photos,2);
  const last=await call(git,{action:'status',from:2,count:2});assert.equal(last.nextFrom,null);assert.equal(last.queued,1);
});
