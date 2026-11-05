import test from 'node:test';
import assert from 'node:assert/strict';
import {runEnMassQaBatch} from '../../scripts/i18n/translation-mass-qa-batch.mjs';

const checks=Object.fromEntries(['word','meaning','facts','voice','structure','relations'].map(k=>[k,true]));
const evidence=Object.fromEntries(Object.keys(checks).map(k=>[k,'Verified independent Word and EN evidence for '+k]));
const receipts=['a'.repeat(40),'b'.repeat(40)];
const ids=['en:bulk:tour:test:a001','en:bulk:tour:test:a002'];
const decision=i=>({jobId:ids[i],expectedBlobSha:receipts[i],checks,evidence});

function fixture({lostAck=false}={}){
 let head='c'.repeat(40),updates=0,trees=0;
 const shards={};
 const jobs={};
 for(let i=0;i<2;i++){
  const sid='0'+i;
  shards[sid]={schemaVersion:2,shardId:sid,items:[{
   jobId:ids[i],sourceFingerprint:'fingerprint-'+i,status:'review',
   submission:{blobSha:receipts[i],resultPath:'results/packet-'+i+'.json'}
  }]};
  jobs[sid]={jobs:[{jobId:ids[i],sourceFingerprint:'fingerprint-'+i,
   source:{contentPath:'src/content/tours/test-'+i+'.md',sourceBlobSha:String(i+1).repeat(40)}}]};
 }
 let index={schemaVersion:2,publicationEnabled:false,ownerAssignments:{},counts:{review:2,ready:0}};
 let pending=[];
 const result=x=>({result:x});
 const tools={
  mcp__GitHub__fetch:async({url})=>result({content:JSON.stringify(url.includes('/git/commits/')
   ?{tree:{sha:'d'.repeat(40)}}:{object:{sha:head}})}),
  mcp__GitHub__fetch_file:async({path})=>{
   if(path.endsWith('/index.json'))return result({content:JSON.stringify(index)});
   const sid=path.match(/\/(?:state|jobs)\/(0[01])\.json$/)?.[1];
   if(sid)return result({content:JSON.stringify(path.includes('/state/')?shards[sid]:jobs[sid])});
   const match=path.match(/results\/packet-(\d)\.json$/);
   if(match)return result({sha:receipts[Number(match[1])],content:JSON.stringify({jobId:ids[Number(match[1])]})});
   const ru=path.match(/test-(\d)\.md$/);
   if(ru)return result({sha:String(Number(ru[1])+1).repeat(40),content:'RU'});
   throw Error('Unexpected path '+path);
  },
  mcp__GitHub__create_tree:async({tree_elements})=>{trees++;pending=tree_elements;return result({sha:'e'.repeat(40)})},
  mcp__GitHub__create_commit:async()=>result({sha:'f'.repeat(40)}),
  mcp__GitHub__update_ref:async()=>{
   updates++;head='f'.repeat(40);
   for(const f of pending){
    if(f.path.endsWith('/index.json'))index=JSON.parse(f.content);
    const sid=f.path.match(/\/state\/(0[01])\.json$/)?.[1];
    if(sid)shards[sid]=JSON.parse(f.content);
   }
   if(lostAck)throw Error('GithubGraphQLAPIError: response lost');
   return result({success:true});
  }
 };
 const core={
  massShard:id=>ids.indexOf(id)===0?'00':'01',
  validateMassResult:(job,translation)=>assert.equal(job.jobId,translation.jobId),
  massApprove:(shard,args)=>{
   const out=structuredClone(shard);
   const row=out.items.find(x=>x.jobId===args.jobId);
   assert.equal(row.status,'review');
   row.status='ready';row.review={acceptedBlobSha:args.blobSha,reviewerId:args.reviewerId};
   return{shard:out,status:'ready'};
  },
  massRebuildIndex:(idx,sid,shard)=>{
   const next={...idx,counts:{...idx.counts}};
   if(shard.items[0].status==='ready'&&!shard.items[0].review._counted){
    next.counts.ready++;next.counts.review--;
    shard.items[0].review._counted=true;
   }
   return next;
  }
 };
 return{tools,core,get head(){return head},get updates(){return updates},
  get trees(){return trees},get shards(){return shards},get index(){return index}};
}

test('two independently verified packets in different shards produce one atomic CAS',async()=>{
 const f=fixture(),args={action:'approve_batch',reviewerId:'independent_qa',
  decisions:[decision(0),decision(1)]};
 const r=await runEnMassQaBatch(f.tools,f.core,args);
 assert.equal(r.status,'batch_ready');
 assert.deepEqual(r.approved,ids);
 assert.equal(f.updates,1);
 assert.equal(f.trees,1);
 assert.equal(r.shards,2);
 assert.equal(f.index.counts.ready,2);
 for(let i=0;i<2;i++){
  const row=f.shards['0'+i].items[0];
  assert.equal(row.status,'ready');
  assert.equal(row.review.evidence.facts,evidence.facts);
 }
 const repeated=await runEnMassQaBatch(f.tools,f.core,args);
 assert.equal(repeated.status,'already_ready');
 assert.deepEqual(repeated.alreadyReady,ids);
 assert.equal(f.updates,1,'idempotent retries never write a second commit');
});

test('lost GitHub acknowledgement recognizes existing commit without reapproving',async()=>{
 const f=fixture({lostAck:true});
 const r=await runEnMassQaBatch(f.tools,f.core,{action:'approve_batch',
  reviewerId:'independent_qa',decisions:[decision(0)]});
 assert.equal(r.status,'batch_ready');
 assert.equal(f.updates,1);
 assert.equal(f.shards['00'].items[0].status,'ready');
});

test('missing independent evidence and unsupported actions fail before any API calls',async()=>{
 let calls=0;
 const spy={mcp__GitHub__fetch:async()=>{calls++;throw Error('Should not fetch')}};
 const malformed={...decision(0),evidence:{...evidence,facts:'too short'}};
 await assert.rejects(runEnMassQaBatch(spy,{},{
  action:'approve_batch',reviewerId:'independent_qa',decisions:[malformed]}),
  /six independently substantiated/i);
 await assert.rejects(runEnMassQaBatch(spy,{},{
  action:'reject',reviewerId:'independent_qa',decisions:[decision(0)]}),
  /Unsupported batch QA action/);
 assert.equal(calls,0);
});
