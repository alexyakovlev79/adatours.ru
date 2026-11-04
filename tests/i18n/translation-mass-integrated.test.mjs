/** Integration tests with the byte-identical canonical mass core and a fake GitHub
 * REST implementation. No external API calls, no production side effects. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as core from '../../scripts/i18n/translation-mass-core.mjs';
import {runEnMassTranslation as remote} from '../../scripts/i18n/translation-mass-remote.mjs';
import {runEnMassWorkerCycle as cycle} from '../../scripts/i18n/translation-mass-worker-cycle.mjs';
const repo='alexyakovlev79/adatours.ru',root='data/i18n/translation-mass/v2';
const stages=['word_2027','word_2026','ai_only'];
const states=['held','queued','leased','review','ready','retryable','blocked_external','stale_source','failed_final'];
const date='2026-11-04T07:00:00Z',ru='Test RU source';
const sha1=x=>createHash('sha1').update(x).digest('hex');
const sha256=x=>createHash('sha256').update(x).digest('hex');
const gitBlob=x=>sha1(Buffer.concat([Buffer.from(`blob ${Buffer.byteLength(x)}\0`),Buffer.from(x)]));
const json=x=>JSON.stringify(x,null,2)+'\n';
function fixture(each=16){
 let seq=0,HEAD=sha1('base-root'),patches=new Map(),commits=new Map();
 const files=new Map(),blobs=new Map(),snapshots=new Map();
 const snapshot=()=>snapshots.set(HEAD,new Map([...files].map(([k,v])=>[k,{...v}])));
 const stats={refReads:0,fileReads:0,contentsWrites:0,blobWrites:0,trees:0,commits:0,refWrites:0};
 const write=(p,content)=>files.set(p,{content,sha:gitBlob(content)});
 const all=Array.from({length:32},(_,i)=>i.toString(16).padStart(2,'0'));
 const shardItems=Object.fromEntries(all.map(k=>[k,[]])),jobs=Object.fromEntries(all.map(k=>[k,[]]));
 let c=0;
 while(all.some(k=>shardItems[k].length<each)){
  const id=`en:bulk:tour:tour_test_${c++}:b001`,sid=core.massShard(id);
  if(shardItems[sid].length>=each)continue;
  shardItems[sid].push({jobId:id,stage:'word_2027',sourceFingerprint:`source:${id}`,
   status:'queued',generation:0,attempts:0,lease:null});
  jobs[sid].push({schemaVersion:2,jobId:id,stableId:'tour_test',stage:'word_2027',
   sourceFingerprint:`source:${id}`,source:{contentPath:'src/content/tours/test.md',
    sourceBlobSha:gitBlob(ru),selectedWord:{fileId:'word-2027',sha256:sha256('DOCX')}},
   blocks:Array.from({length:8},(_,i)=>({blockId:`body_${i+1}`,field:'body',ruTextSha256:sha256(`Текст ${i+1}`)}))});
 }
 write('src/content/tours/test.md',ru);
 let index={schemaVersion:2,version:2,sourceCommit:HEAD,matchingCommit:HEAD,pilotCommit:HEAD,
  stage:'word_2027',status:'RUNNING',dispatcherEnabled:true,
  translationMassLaunchAllowed:true,publicationEnabled:false,pilotOnly:false,
  jobCount:each*32,tourCount:each*32,reusedReadyBlocks:0,
  shards:{},activeOwners:{},ownerAssignments:{},maxJobsPerOwner:60,
  updatedAt:date};
 for(const sid of all){
  const state={schemaVersion:2,shardId:sid,items:shardItems[sid]};
  index.shards[sid]=core.massShardSummary(state);
  write(`${root}/state/${sid}.json`,json(state));
  write(`${root}/jobs/${sid}.json`,json({schemaVersion:2,shardId:sid,jobs:jobs[sid]}));
 }
 index.stageCounts=Object.fromEntries(stages.map(stage=>[stage,Object.fromEntries(states.map(s=>[s,0]))]));
 index.counts=Object.fromEntries(states.map(s=>[s,0]));
 for(const row of Object.values(index.shards))for(const stage of stages)for(const k of states)
  index.stageCounts[stage][k]+=row.stages[stage][k];
 for(const stage of stages)for(const k of states)
  index.counts[k]+=index.stageCounts[stage][k];
 write(`${root}/index.json`,json(index));snapshot();
 const ok=x=>({result:x});
 const tools={
  mcp__GitHub__fetch:async({url})=>{
   if(url.endsWith('/git/ref/heads/i18n/translation-mass-staging')){
    stats.refReads++;return ok({content:JSON.stringify({object:{sha:HEAD}})});
   }
   if(url.includes('/git/commits/')){
    stats.refReads++;return ok({content:JSON.stringify({tree:{sha:sha1('tree'+HEAD)}})});
   }
   throw Error('Unsupported mock Github fetch: '+url);
  },
  mcp__GitHub__fetch_file:async({path,ref})=>{
   stats.fileReads++;
   const f=ref==='main'?files.get(path):
    (snapshots.get(ref)?.get(path)||files.get(path));
   if(!f)throw Error('Mock missing '+path);
   if(ref==='main'&&!path.startsWith('src/content/'))throw Error('Bad main file access');
   return ok({content:f.content,sha:f.sha});
  },
  mcp__GitHub__update_file:async({path,sha,content,branch})=>{
   assert.equal(branch,'i18n/translation-mass-staging');
   if(files.get(path).sha!==sha)throw Error('409 Conflict: expected blob SHA changed');
   stats.contentsWrites++;
   write(path,content);HEAD=sha1(`contents:${++seq}:${HEAD}`);snapshot();
   return ok({commit_sha:HEAD,content_sha:gitBlob(content)});
  },
  mcp__GitHub__create_blob:async({content})=>{
   stats.blobWrites++;const hash=gitBlob(content);blobs.set(hash,content);
   return ok({sha:hash});
  },
  mcp__GitHub__create_tree:async({tree_elements})=>{
   stats.trees++;const sha=sha1(`tree:${++seq}`);patches.set(sha,tree_elements);
   return ok({sha});
  },
  mcp__GitHub__create_commit:async({tree_sha,parent_sha,message})=>{
   stats.commits++;const sha=sha1(`commit:${++seq}:${parent_sha}`);
   commits.set(sha,{tree_sha,parent_sha,message});return ok({sha});
  },
  mcp__GitHub__update_ref:async({expected_sha,sha,force})=>{
   assert.equal(force,false);
   if(expected_sha!==HEAD)throw Error('409 Conflict: expected HEAD SHA changed');
   const c=commits.get(sha);
   assert.equal(c.parent_sha,HEAD);
   for(const entry of patches.get(c.tree_sha)){
    write(entry.path,entry.sha?blobs.get(entry.sha):entry.content);
   }
   stats.refWrites++;HEAD=sha;snapshot();return ok({success:true});
  }
 };
 const resultFor=j=>({jobId:j.jobId,stableId:j.stableId,locale:'en',status:'review',
  releaseEligible:false,sourceFingerprint:j.sourceFingerprint,
  blocks:j.blocks.map((block,i)=>({blockId:block.blockId,field:block.field,
   sourceTextSha256:block.ruTextSha256,text:`Verified translated content ${i+1}`,
   provenance:{kind:'word_exact',fileId:'word-2027',documentSha256:sha256('DOCX'),
    paragraphs:[{ref:`word/document.xml#p${String(i+1).padStart(4,'0')}`,
     textSha256:sha256(`Paragraph ${i+1}`)}]}}))});
 return{tools,stats,files,all,resultFor,read:p=>JSON.parse(files.get(p).content),
  write:(p,o)=>{write(p,typeof o==='string'?o:json(o));snapshot();},HEAD:()=>HEAD,
  shard:sid=>JSON.parse(files.get(`${root}/state/${sid}.json`).content)};
}


test('one chat processes ten 8-block packets with no status polling',async()=>{
 const f=fixture(16),ownerId='author_one',token='author_token';
 const actions=[];const r=async(t,c,a)=>{actions.push(a.action);return remote(t,c,a)};
 let next=await cycle(f.tools,core,r,{action:'start',ownerId,token,now:date});
 for(let n=1;n<=10;n++){
  assert.equal(next.status,'next_claimed');
  const j=next.next.source;
  assert.equal(j.blocks.length,8,'the complete packet consists of eight blocks');
  next=await cycle(f.tools,core,r,{action:'finish',ownerId,token,
   jobId:j.jobId,generation:next.next.generation,submissionId:`saved_${n}`,
   result:f.resultFor(j),now:date});
  assert.equal(next.submission.status,'saved_for_review');
 }
 assert.equal(next.status,'cycle_limit_reached');
 assert.equal(next.completed,10);
 assert.equal(actions.filter(a=>a==='status').length,0);
 assert.equal(actions.filter(a=>a==='claim').length,10);
 assert.equal(actions.filter(a=>a==='submit').length,10);
 assert.equal(f.stats.contentsWrites,0,'no intermediate checkpoint writes');
 assert.equal(f.stats.blobWrites,10,'immutable text blob once per packet');
 assert.equal(f.stats.refWrites,20,'one atomic CAS commit per claim and submit');
 const allItems=f.all.flatMap(s=>f.shard(s).items);
 assert.equal(allItems.filter(x=>x.status==='review').length,10);
 assert.equal(f.read(`${root}/index.json`).ownerAssignments[ownerId].completedJobIds.length,10);
});

test('repeat submissionId is read-only and mismatched content is rejected',async()=>{
 const f=fixture(1),ownerId='owner_replay',token='token_replay';
 const claim=await remote(f.tools,core,{action:'claim',ownerId,token,now:date});
 assert.equal(claim.status,'claimed');
 const input={action:'submit',ownerId,token,jobId:claim.jobId,
  generation:claim.generation,submissionId:'sub_repeat',
  result:f.resultFor(claim.source),now:date};
 assert.equal((await remote(f.tools,core,input)).status,'saved_for_review');
 const old={...f.stats};
 assert.equal((await remote(f.tools,core,input)).status,'already_saved');
 assert.equal(f.stats.blobWrites,old.blobWrites);
 assert.equal(f.stats.refWrites,old.refWrites);
 await assert.rejects(remote(f.tools,core,{...input,
  result:{...input.result,blocks:[{...input.result.blocks[0],text:'Changed result'}]}}),
  /payload collision/);
});

test('twenty simultaneous claims do not issue the same job twice',async()=>{
 const f=fixture(16),workers=Array.from({length:20},(_,i)=>({
  ownerId:`worker_${i}`,token:`token_${i}`}));
 const results=await Promise.all(workers.map(o=>remote(f.tools,core,{action:'claim',...o,now:date})));
 const validClaims=results.filter(r=>r.status==='claimed'||r.status==='resumed');
 assert.ok(validClaims.length>0);
 assert.equal(new Set(validClaims.map(r=>r.jobId)).size,validClaims.length);
 assert.ok(results.every(r=>['claimed','resumed','cas_contention'].includes(r.status)));
 assert.equal(f.read(`${root}/index.json`).counts.leased,validClaims.length);
});

test('rate limit stops after one GitHub call without a retry storm',async()=>{
 let calls=0;
 const t={mcp__GitHub__fetch:async()=>{calls++;throw Error('GitHub API error 403: API rate limit exceeded for user ID');}};
 const r=await remote(t,core,{action:'claim',ownerId:'limit_owner',token:'limit_token'});
 assert.equal(r.status,'rate_limited');assert.equal(r.retryAfterMs,3600000);
 assert.equal(calls,1);
});

test('lost ref confirmation is checked once and does not repeat claim',async()=>{
 const f=fixture(3),ownerId='lost_owner',token='lost_token';
 const update=f.tools.mcp__GitHub__update_ref;let once=true;
 f.tools.mcp__GitHub__update_ref=async x=>{
  const v=await update(x);
  if(once){once=false;throw Error('Transport closed after commit');}
  return v;
 };
 const r=await remote(f.tools,core,{action:'claim',ownerId,token,now:date});
 assert.equal(r.status,'claimed');
 assert.equal(f.stats.refWrites,1);
 const replay=await remote(f.tools,core,{action:'claim',ownerId,token,now:date});
 assert.equal(replay.status,'resumed');assert.equal(replay.jobId,r.jobId);
 assert.equal(f.stats.refWrites,1);
});

test('new checkpoints are rejected without GitHub calls; existing ones remain readable',async()=>{
 const f=fixture(1),ownerId='saved_worker',token='saved_token';
 const claimed=await remote(f.tools,core,{action:'claim',ownerId,token,now:date});
 const before={...f.stats};
 await assert.rejects(remote(f.tools,core,{action:'checkpoint',ownerId,token,
  jobId:claimed.jobId,generation:claimed.generation,checkpointId:'part_four',
  checkpoint:{blocks:[{text:'first four translated'}]},now:date}),
  /Unsupported worker action/);
 assert.deepEqual(f.stats,before,'no GitHub call for disabled checkpoint');
 const sid=core.massShard(claimed.jobId),shard=f.shard(sid);
 const item=shard.items.find(x=>x.jobId===claimed.jobId);
 const previous={blocks:[{text:'a previously saved partial draft'}]};
 item.checkpoint={id:'legacy-four',format:'inline-v1',payload:previous,
  ownerId,token,generation:claimed.generation,at:date};
 f.write(`${root}/state/${sid}.json`,shard);
 const same=await remote(f.tools,core,{action:'claim',ownerId,token,now:date});
 assert.equal(same.status,'resumed');
 assert.deepEqual(same.checkpoint.payload,previous);
 assert.equal(f.stats.contentsWrites,0);
});

test('a changed Russian original does not publish a stale translation',async()=>{
 const f=fixture(1),ownerId='stale_owner',token='stale_token';
 f.write('src/content/tours/test.md','Modified RU source');
 const r=await remote(f.tools,core,{action:'claim',ownerId,token,now:date});
 assert.equal(r.status,'stale_source');
 assert.equal(f.stats.blobWrites,0);
});

test('submit response lost after commit is recovered without a second result',async()=>{
 const f=fixture(2),ownerId='submit_owner',token='submit_token';
 const claim=await remote(f.tools,core,{action:'claim',ownerId,token,now:date});
 const input={action:'submit',ownerId,token,jobId:claim.jobId,
  generation:claim.generation,submissionId:'submission_final',
  result:f.resultFor(claim.source),now:date};
 const update=f.tools.mcp__GitHub__update_ref;let once=true;
 f.tools.mcp__GitHub__update_ref=async a=>{
  const out=await update(a);
  if(once){once=false;throw Error('Transport closed after commit');}
  return out;
 };
 const result=await remote(f.tools,core,input);
 assert.equal(result.status,'saved_for_review');
 assert.equal(f.stats.blobWrites,1);
 assert.equal((await remote(f.tools,core,input)).status,'already_saved');
 assert.equal(f.stats.blobWrites,1);
 const rows=f.all.flatMap(x=>f.shard(x).items);
 assert.equal(rows.filter(x=>x.status==='review').length,1);
});

test('one owner token cannot be replaced by another',async()=>{
 const f=fixture(1);
 const first=await remote(f.tools,core,{action:'claim',ownerId:'same_owner',token:'first_token',now:date});
 assert.equal(first.status,'claimed');
 const second=await remote(f.tools,core,{action:'claim',ownerId:'same_owner',token:'second_token',now:date});
 assert.equal(second.status,'owner_token_conflict');
 assert.equal(f.read(`${root}/index.json`).counts.leased,1);
});

test('after confirmed submit, next claim failure preserves receipt and does not resubmit',async()=>{
 const f=fixture(2),ownerId='follow_up_owner',token='follow_up_token';
 const first=await cycle(f.tools,core,remote,{action:'start',ownerId,token,now:date});
 const input={action:'finish',ownerId,token,jobId:first.next.jobId,
  generation:first.next.generation,submissionId:'sub_follow',
  result:f.resultFor(first.next.source),now:date};
 let failures=0;
 const gateway=async(t,c,a)=>{
  if(a.action==='claim'&&failures++===0)
   return{status:'rate_limited',retryAfterMs:3600000};
  return remote(t,c,a);
 };
 const out=await cycle(f.tools,core,gateway,input);
 assert.equal(out.submission.status,'saved_for_review');
 assert.equal(out.status,'retry_pending');
 assert.equal(out.resume.action,'start');
 const previousBlobWrites=f.stats.blobWrites;
 const recovered=await cycle(f.tools,core,remote,{action:'start',ownerId,token,now:date});
 assert.equal(recovered.status,'next_claimed');
 assert.equal(f.stats.blobWrites,previousBlobWrites);
});
