import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as core from '../../scripts/i18n/matching-core.mjs';
import { runEnMatching } from '../../scripts/i18n/matching-remote.mjs';

const ROOT='data/i18n/matching/v1';
const sha=s=>createHash('sha1').update(s).digest('hex');
function sandbox({pilots=2,total=3}={}){
  const matches=Array.from({length:total},(_,i)=>({
    entityId:'tour_sample_'+i,ruContentPath:'src/content/tours/sample-'+i+'.md',
    ruTitle:'Sample '+i,ruStatus:'approved',durationDays:3,
    selectedSource:null,candidates:{2027:[],2026:[]}
  }));
  const baseline='a'.repeat(40);
  const source={schemaVersion:1,repositoryCommit:baseline,
    observedAt:'2026-10-28T16:31:50.000Z',generation:{sourceManifestSha256:'b'.repeat(64)},
    counts:{activeTours:total},matches};
  const manifest=core.createMatchManifest(source,{pilotEntityIds:matches.slice(0,pilots).map(x=>x.entityId)});
  const seed=core.seedMatchQueue(manifest);
  seed.index.matchingEnabled=true;
  const original=new Map([
    [ROOT+'/index.json',JSON.stringify(seed.index)],
    ...Object.entries(seed.shards).map(([id,s])=>[ROOT+'/state/'+id+'.json',JSON.stringify(s)]),
    ...Object.entries(seed.packets).map(([id,s])=>[ROOT+'/jobs/'+id+'.json',JSON.stringify(s)]),
    ...matches.map(x=>[x.ruContentPath,'---\nid: '+x.entityId+'\n---\nSample description\n'])
  ]);
  const trees=new Map(),commits=new Map(),blobs=new Map(),branches=new Map();
  let sequence=0,lostOnComplete=false,conflicts=0,updateCalls=0;
  const newSha=()=>sha('model:'+String(++sequence));
  const asFile=x=>({content:x,sha:sha('blob:'+x)});
  const toMap=entries=>new Map([...entries].map(([k,v])=>[k,asFile(v)]));
  const tree0=newSha(),commit0=newSha();
  trees.set(tree0,toMap(original));commits.set(commit0,{tree:tree0,message:'seed'});
  branches.set('i18n/matching-staging',commit0);
  branches.set('main',commit0);
  branches.set(baseline,commit0);
  const result=x=>({result:x});
  const tools={
    mcp__GitHub__fetch:async({url})=>{
      if(url.includes('/git/ref/heads/')){
        const branch=decodeURIComponent(url.split('/git/ref/heads/')[1]);
        if(!branches.has(branch))throw Error('ref not found '+branch);
        return result({content:JSON.stringify({object:{sha:branches.get(branch)}})});
      }
      if(url.includes('/git/commits/')){
        const commit=commits.get(url.split('/git/commits/')[1]);
        if(!commit)throw Error('commit missing');
        return result({content:JSON.stringify({tree:{sha:commit.tree},message:commit.message})});
      }
      throw Error('Unsupported fetch '+url);
    },
    mcp__GitHub__fetch_file:async({path,ref})=>{
      const r=branches.get(ref)||ref;
      const commit=commits.get(r);
      const file=commit&&trees.get(commit.tree).get(path);
      if(!file)throw Error('file not found '+path);
      return result(file);
    },
    mcp__GitHub__create_blob:async({content})=>{
      const id=sha('blob:'+content);
      blobs.set(id,content);
      return result({sha:id});
    },
    mcp__GitHub__create_tree:async({base_tree_sha,tree_elements})=>{
      const existing=trees.get(base_tree_sha);
      if(!existing)throw Error('unknown base tree');
      const tree=new Map(existing);
      for(const el of tree_elements){
        const content=el.content??blobs.get(el.sha);
        if(typeof content!=='string')throw Error('Missing new content '+el.path);
        tree.set(el.path,asFile(content));
      }
      const id=newSha();
      trees.set(id,tree);
      return result({sha:id});
    },
    mcp__GitHub__create_commit:async({tree_sha,parent_sha,message})=>{
      if(!trees.has(tree_sha)||!commits.has(parent_sha))throw Error('Invalid new commit');
      const id=newSha();
      commits.set(id,{tree:tree_sha,parent:parent_sha,message});
      return result({sha:id});
    },
    mcp__GitHub__update_ref:async({branch_name,sha:commit,expected_sha,force})=>{
      updateCalls++;
      assert.equal(force,false);
      if(branches.get(branch_name)!==expected_sha){
        conflicts++;
        throw Error('expected_sha reference update conflict');
      }
      branches.set(branch_name,commit);
      if(lostOnComplete&&commits.get(commit).message.includes('i18n-match complete')){
        lostOnComplete=false;
        throw Error('reference update conflict: response lost after successful write');
      }
      return result({success:true});
    }
  };
  return {tools,manifest,enableLostReply(){lostOnComplete=true;},
    metrics:()=>({conflicts,updateCalls}),
    async index(){
      const commit=commits.get(branches.get('i18n/matching-staging'));
      return JSON.parse(trees.get(commit.tree).get(ROOT+'/index.json').content);
    },
    async shard(jobId){
      const commit=commits.get(branches.get('i18n/matching-staging'));
      const key=core.shardFor(jobId);
      return JSON.parse(trees.get(commit.tree).get(ROOT+'/state/'+key+'.json').content);
    },
    async mutateFile(path,fn){
      const b=branches.get('i18n/matching-staging'),old=commits.get(b);
      const tree=new Map(trees.get(old.tree));
      const value=JSON.parse(tree.get(path).content);
      tree.set(path,asFile(JSON.stringify(fn(value))));
      const ts=newSha(),cs=newSha();
      trees.set(ts,tree);commits.set(cs,{tree:ts,parent:b,message:'test mutation'});
      branches.set('i18n/matching-staging',cs);
    }
  };
}
const owner=(key)=>({ownerId:'owner-'+key,token:'token-'+key});
const match=(job)=>({
  entityId:job.entityId,sourceFingerprint:job.sourceFingerprint,outcome:'not_found_both',
  selectedSource:null,checkedYears:[2027,2026],quarantinedCandidatesChecked:true,
  evidence:['Reviewed 2027 routes and candidate documents','Reviewed 2026 routes and quarantined documents']
});
test('live-style dispatcher reports pilot while masking lease tokens',async()=>{
  const env=sandbox(),status=await runEnMatching(env.tools,core,{action:'status'});
  assert.equal(status.counts.queued,2);
  assert.equal(status.counts.held,1);
  assert.equal(status.translationEnabled,false);
  const a=await runEnMatching(env.tools,core,{action:'claim',...owner('a')});
  assert.equal(a.status,'claimed');
  const report=await runEnMatching(env.tools,core,{action:'status'});
  assert.equal(report.activeOwners['owner-a'].jobId,a.jobId);
  assert.equal(report.activeOwners['owner-a'].token,undefined);
  assert.equal(Object.values(report.activeOwners).some(x=>Object.hasOwn(x,'token')),false);
});
test('two simultaneous claim requests get distinct Tours with CAS fencing',async()=>{
 const env=sandbox();
 const [a,b]=await Promise.all([
   runEnMatching(env.tools,core,{action:'claim',...owner('a')}),
   runEnMatching(env.tools,core,{action:'claim',...owner('b')}),
 ]);
 assert.equal(a.status,'claimed');assert.equal(b.status,'claimed');
 assert.notEqual(a.jobId,b.jobId);
 const stats=await runEnMatching(env.tools,core,{action:'status'});
 assert.equal(stats.counts.leased,2);
 assert.equal(stats.counts.queued,0);
 assert.ok(env.metrics().updateCalls>=2);
});
test('resume, renew and release act on one real lease',async()=>{
 const env=sandbox({pilots:1});
 const a=await runEnMatching(env.tools,core,{action:'claim',...owner('a')});
 const duplicate=await runEnMatching(env.tools,core,{action:'claim',...owner('a')});
 assert.equal(duplicate.status,'resumed');
 assert.equal(a.jobId,duplicate.jobId);
 const fresh=await runEnMatching(env.tools,core,{action:'renew',jobId:a.jobId,generation:a.generation,...owner('a')});
 assert.equal(fresh.status,'saved');
 const index=await env.index();
 assert.ok(index.activeOwners['owner-a'],'owner retained after extension');
 const released=await runEnMatching(env.tools,core,{action:'release',jobId:a.jobId,generation:a.generation,...owner('a')});
 assert.equal(released.status,'released');
 const status=await runEnMatching(env.tools,core,{action:'status'});
 assert.equal(status.counts.queued,1);
 assert.equal(status.activeOwners['owner-a'],undefined);
});
test('lost completion response yields already_saved, never a second accepted result',async()=>{
 const env=sandbox({pilots:1});
 const a=await runEnMatching(env.tools,core,{action:'claim',...owner('a')});
 env.enableLostReply();
 const result=await runEnMatching(env.tools,core,{action:'complete',...owner('a'),jobId:a.jobId,generation:a.generation,
   submissionId:'submit-123',result:match(a.job)});
 assert.equal(result.status,'already_saved');
 const s=await runEnMatching(env.tools,core,{action:'status'});
 assert.equal(s.counts.ready,1);
 const row=(await env.shard(a.jobId)).items.find(r=>r.jobId===a.jobId);
 assert.equal(row.submission.submissionId,'submit-123');
});
test('expired lease is reclaimed and old token cannot complete it',async()=>{
 const env=sandbox({pilots:1});
 const a=await runEnMatching(env.tools,core,{action:'claim',...owner('a')});
 const sid=core.shardFor(a.jobId),path=ROOT+'/state/'+sid+'.json';
 await env.mutateFile(path,s=>{
   const r=s.items.find(x=>x.jobId===a.jobId);
   r.lease.expiresAt='2000-01-01T00:00:00.000Z';
   return s;
 });
 await env.mutateFile(ROOT+'/index.json',idx=>{
   idx.shards[sid].earliestExpiryAt='2000-01-01T00:00:00.000Z';
   return idx;
 });
 const r=await runEnMatching(env.tools,core,{action:'reap'});
 assert.equal(r.status,'reclaimed');
 const b=await runEnMatching(env.tools,core,{action:'claim',...owner('b')});
 assert.equal(b.jobId,a.jobId);
 assert.equal(b.generation,a.generation+1);
 await assert.rejects(()=>runEnMatching(env.tools,core,{action:'complete',...owner('a'),jobId:a.jobId,
    generation:a.generation,submissionId:'submit-old',result:match(a.job)}),/Lease is not owned/);
});
test('caller cannot forge lease times and disabled gate does not issue jobs',async()=>{
 const env=sandbox();
 await assert.rejects(()=>runEnMatching(env.tools,core,{action:'claim',...owner('a'),now:'2099-01-01T00:00:00Z'}),/clock/);
 await env.mutateFile(ROOT+'/index.json',idx=>{idx.matchingEnabled=false;return idx;});
 assert.equal((await runEnMatching(env.tools,core,{action:'claim',...owner('a')})).status,'gate_closed');
});


test('one Work chat may claim only 3 pilot jobs; second chat receives remaining two',async()=>{
 const env=sandbox({total:5,pilots:5});
 const a=owner('a'),b=owner('b');
 let idsA=[],idsB=[];
 for(let i=0;i<3;i++){
   const claim=await runEnMatching(env.tools,core,{action:'claim',...a});
   assert.equal(claim.status,'claimed');
   idsA.push(claim.jobId);
   const saved=await runEnMatching(env.tools,core,{action:'complete',...a,
     jobId:claim.jobId,generation:claim.generation,
     submissionId:'idempotent-a-'+i,result:match(claim.job)});
   assert.equal(saved.status,'saved');
 }
 const stop=await runEnMatching(env.tools,core,{action:'claim',...a});
 assert.equal(stop.status,'worker_quota_reached');
 assert.equal(stop.limit,3);
 assert.equal(stop.assignedCount,3);
 for(let i=0;i<2;i++){
   const claim=await runEnMatching(env.tools,core,{action:'claim',...b});
   assert.equal(claim.status,'claimed');
   idsB.push(claim.jobId);
   const saved=await runEnMatching(env.tools,core,{action:'complete',...b,
     jobId:claim.jobId,generation:claim.generation,
     submissionId:'idempotent-b-'+i,result:match(claim.job)});
   assert.equal(saved.status,'saved');
 }
 assert.equal(new Set([...idsA,...idsB]).size,5);
 const status=await runEnMatching(env.tools,core,{action:'status'});
 assert.equal(status.counts.ready,5);
 assert.equal(status.counts.queued,0);
});
test('bulk owner limit is 6 completed jobs and a different chat gets the rest',async()=>{
 const env=sandbox({total:9,pilots:9});
 await env.mutateFile(ROOT+'/index.json',idx=>{idx.pilotOnly=false;return idx});
 const a=owner('bulk-a'),b=owner('bulk-b');
 let ids=[];
 for(let i=0;i<6;i++){
  const claim=await runEnMatching(env.tools,core,{action:'claim',...a});
  assert.equal(claim.status,'claimed');
  ids.push(claim.jobId);
  const done=await runEnMatching(env.tools,core,{action:'complete',...a,jobId:claim.jobId,
    generation:claim.generation,submissionId:'done-bulk-'+i,result:match(claim.job)});
  assert.equal(done.status,'saved');
 }
 assert.equal(new Set(ids).size,6);
 const stop=await runEnMatching(env.tools,core,{action:'claim',...a});
 assert.equal(stop.status,'worker_quota_reached');
 assert.equal(stop.limit,6);
 const idx=await env.index();
 assert.equal(idx.ownerAssignments[a.ownerId].jobIds.length,6);
 assert.equal(idx.ownerAssignments[a.ownerId].token,a.token);
 const other=await runEnMatching(env.tools,core,{action:'claim',...b});
 assert.equal(other.status,'claimed');
 assert.ok(!ids.includes(other.jobId));
});



test('an expired third lease cannot bypass the three-job pilot limit',async()=>{
 const env=sandbox({total:5,pilots:5}),a=owner('expiry');
 for(let i=0;i<2;i++){
  const c=await runEnMatching(env.tools,core,{action:'claim',...a});
  assert.equal(c.status,'claimed');
  const saved=await runEnMatching(env.tools,core,{action:'complete',...a,jobId:c.jobId,
   generation:c.generation,submissionId:'expiry-done-'+i,result:match(c.job)});
  assert.equal(saved.status,'saved');
 }
 const third=await runEnMatching(env.tools,core,{action:'claim',...a});
 assert.equal(third.status,'claimed');
 await env.mutateFile(ROOT+'/index.json',idx=>{
   idx.activeOwners[a.ownerId].expiresAt='2000-01-01T00:00:00.000Z';
   return idx;
 });
 const attempt=await runEnMatching(env.tools,core,{action:'claim',...a});
 assert.equal(attempt.status,'worker_quota_reached');
 assert.equal(attempt.assignedCount,3);
});
