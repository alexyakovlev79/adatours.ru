import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publishSchemaGeoAll} from '../scripts/schema-geo-publisher.mjs';
import * as core from '../scripts/schema-geo-core.mjs';

test('GEO publisher publishes all 80 READY in one content commit and one ref update',async()=>{
 const main='a'.repeat(40),staging='b'.repeat(40),resultCommit='c'.repeat(40);
 const jobs=Array.from({length:80},(_,i)=>({
  jobId:'geo-country-country_test_'+i,stableId:'country_test_'+i,
  kind:'country',url:'/test-'+i+'/',contentPath:'src/content/countries/test-'+i+'.md',
  sourceBlobSha:'d'.repeat(40),sourceFingerprint:'source-'+i,stage:1,
  sourceOrder:i,available:true
 }));
 const results=new Map(jobs.map((j,i)=>{
  const qid='Q'+(700000+i);
  const r={schemaVersion:2,jobId:j.jobId,stableId:j.stableId,kind:j.kind,
   canonicalPath:j.url,sourceFingerprint:j.sourceFingerprint,status:'READY',confidence:'high',
   external:{wikidataQid:qid},
   evidence:[{field:'external.wikidataQid',sourceUrl:'https://www.wikidata.org/wiki/'+qid,
    checkedAt:'2026-10-16T14:00:00Z',note:'Exact matching geographic identity'}]};
  return ['results/'+j.jobId+'.json',r];
 }));
 const locked=jobs.map(j=>({jobId:j.jobId,resultPath:'results/'+j.jobId+'.json',
  resultHash:core.digest(results.get('results/'+j.jobId+'.json')),sourceFingerprint:j.sourceFingerprint}));
 let treeCount=0,mainCommitCount=0,mainRefCount=0,recorded=false;
 const base='https://api.github.com/repos/alexyakovlev79/adatours.ru/';
 const wrap=x=>({result:{content:JSON.stringify(x)}});
 const tools={
  async mcp__GitHub__fetch({url}){
   assert.ok(url.startsWith(base),url);
   if(url.endsWith('git/ref/heads/main'))return wrap({object:{sha:main}});
   if(url.endsWith('git/commits/'+main))return wrap({tree:{sha:'root'}});
   if(url.endsWith('git/trees/root'))return wrap({tree:[{path:'src',type:'tree',sha:'src'}]});
   if(url.endsWith('git/trees/src'))return wrap({tree:[{path:'content',type:'tree',sha:'content'}]});
   if(url.endsWith('git/trees/content'))return wrap({tree:[{path:'countries',type:'tree',sha:'countries'}]});
   if(url.endsWith('git/trees/countries'))return wrap({tree:jobs.map((j,i)=>({
    path:'test-'+i+'.md',type:'blob',sha:j.sourceBlobSha
   }))});
   throw Error('Unexpected API URL: '+url);
  },
  async mcp__GitHub__fetch_file({path,ref}){
   if(path==='data/geo-knowledge/state.json')return {result:{content:JSON.stringify({publication:null})}};
   assert.equal(ref,staging);
   if(path==='data/geo-knowledge/queue.json')return {result:{content:JSON.stringify({jobs})}};
   if(results.has(path))return {result:{content:JSON.stringify(results.get(path))}};
   throw Error('Unexpected file path: '+path);
  },
  async mcp__GitHub__create_tree({base_tree_sha,tree_elements}){
   assert.ok(base_tree_sha);assert.ok(tree_elements.length);
   treeCount++;return {result:{sha:'created-tree-'+treeCount}};
  },
  async mcp__GitHub__create_commit({parent_sha,tree_sha}){
   assert.equal(parent_sha,main);assert.ok(tree_sha);
   mainCommitCount++;return {result:{sha:resultCommit}};
  },
  async mcp__GitHub__update_ref({branch_name,sha,expected_sha,force}){
   assert.equal(branch_name,'main');assert.equal(sha,resultCommit);
   assert.equal(expected_sha,main);assert.equal(force,false);
   mainRefCount++;return {result:{success:true}};
  }
 };
 const remote=async (_tools,_core,req)=>{
  if(req.action==='resumePublication')return {status:'no_pending_deploy'};
  if(req.action==='beginPublication')return {status:'saved',commit:staging,output:{jobs:locked}};
  if(req.action==='recordCommit'){
   assert.equal(req.commit,resultCommit);recorded=true;
   return {status:'saved',commit:'e'.repeat(40)};
  }
  throw Error('Unexpected dispatcher action '+req.action);
 };
 const output=await publishSchemaGeoAll(tools,core,remote,{ownerId:'geo-master-full',batchId:'geo-full-test'});
 assert.equal(output.status,'deployed_pending',JSON.stringify(output));
 assert.equal(output.results,80);assert.equal(output.uniquePassports,80);
 assert.equal(mainCommitCount,1);assert.equal(mainRefCount,1);
 assert.ok(treeCount>=1);assert.equal(recorded,true);
});
