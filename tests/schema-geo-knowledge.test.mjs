import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as c from '../scripts/schema-geo-core.mjs';
const job={jobId:'geo-country-country_brazil',stableId:'country_brazil',kind:'country',url:'/brazil/',stage:1,sourceOrder:2,sourceFingerprint:'abc',available:true};
const queue={jobs:[job,{...job,jobId:'second',stableId:'other',sourceOrder:3}]};
const fresh=()=>({jobs:{},leases:{},publications:[]});
const args={ownerId:'worker_123456',token:'token_1234567890123456',now:1000000,limit:1};
const result={schemaVersion:2,jobId:job.jobId,stableId:job.stableId,kind:job.kind,canonicalPath:job.url,sourceFingerprint:'abc',status:'READY',external:{wikidataQid:'Q155'},confidence:'high',evidence:[{field:'external.wikidataQid',sourceUrl:'https://www.wikidata.org/wiki/Q155',checkedAt:'2026-10-16T11:00:00Z',note:'Exact identity checked'}]};
test('portable hash matches SHA-256 including Unicode and long payloads',()=>{for(const text of ['', 'abc','Бразилия 🦜','x'.repeat(10000)])assert.equal(c.sha256(text),createHash('sha256').update(text).digest('hex'));});
test('collector reserves ten tasks, not five, and retries keep the original leases',()=>{
 const jobs=Array.from({length:13},(_,i)=>({...job,jobId:'job_'+i,stableId:'id_'+i,sourceOrder:i+1}));
 const s=fresh(),a=c.claim({jobs},s,{...args,limit:10,batchSize:10});
 assert.equal(a.length,10);
 assert.equal(new Set(a.map(j=>j.jobId)).size,10);
 assert.equal(c.claim({jobs},s,{...args,limit:10,batchSize:10}).length,10);
 assert.equal(Object.keys(s.leases).length,10);
 const b=c.claim({jobs},s,{...args,ownerId:'worker_234567',token:'token_2345678901234567',limit:10,batchSize:10});
 assert.equal(b.length,3);
 assert.ok(b.every(j=>!a.some(prev=>prev.jobId===j.jobId)));
 const p=c.claim({jobs},fresh(),{...args,limit:100,batchSize:8});
 assert.equal(p.length,8);
 const cap=c.claim({jobs},fresh(),{...args,limit:100,batchSize:100});
 assert.equal(cap.length,10);
});
test('two workers select disjoint jobs; retry returns original claim',()=>{const s=fresh();const a=c.claim(queue,s,args);const b=c.claim(queue,s,{...args,ownerId:'worker_234567',token:'token_2345678901234567'});assert.notEqual(a[0].jobId,b[0].jobId);assert.equal(c.claim(queue,s,args)[0].jobId,a[0].jobId);});
test('expired token is fenced after reassignment',()=>{const s=fresh();c.claim(queue,s,args);c.claim(queue,s,{...args,ownerId:'worker_234567',token:'token_2345678901234567',now:args.now+91*60000});assert.throws(()=>c.complete(queue,s,{...args,now:args.now+91*60000,result}),/Lease/);});
test('cannot renew an expired lease',()=>{const s=fresh();c.claim(queue,s,args);assert.throws(()=>c.renew(s,{...args,jobId:job.jobId,now:args.now+91*60000}),/Lease/);});
test('complete is atomic and retry is idempotent',()=>{const s=fresh();c.claim(queue,s,args);const a=c.complete(queue,s,{...args,result});assert.equal(s.jobs[job.jobId].status,'READY');assert.equal(s.leases[job.jobId],undefined);assert.equal(c.complete(queue,s,{...args,result}).hash,a.hash);assert.throws(()=>c.complete(queue,s,{...args,result:{...result,confidence:'low'}}));});
test('invalid or unproven coordinates cannot be READY',()=>{assert.ok(c.validateResult({...result,location:{latitude:95,longitude:0}},job).length);});
test('source drift fences completion',()=>{const s=fresh();c.claim(queue,s,args);assert.throws(()=>c.complete({jobs:[{...job,sourceFingerprint:'changed'}]},s,{...args,result}),/Source changed/);});
test('source and evidence fields must match exactly',()=>{assert.ok(c.validateResult({...result,external:{wikidataQid:'Q155',osm:{type:'way',id:1}}},job).some(e=>e.includes('Missing evidence')));});
test('composite identity is REVIEW, cannot assign one constituent QID',()=>{assert.ok(c.validateResult({...result,identityScope:'composite'},job).length);});

test('probability policy accepts exactly 70% object and Wikidata sameAs, including composite destinations',()=>{
 const assessed={...result,identityScope:'composite',confidence:'medium',decisionPolicy:'probability-70-v1',
  assessments:[{field:'identity',probability:70,selected:'main named destination',reason:'Page and travel context'},
               {field:'external.wikidataQid',probability:70,selected:'Q155',reason:'Best researched matching entity'}]};
 assert.deepEqual(c.validateResult(assessed,job),[]);
 assert.equal(c.geoAccepted(assessed,'identity'),true);
 assert.equal(c.geoAccepted(assessed,'external.wikidataQid'),true);
 const tooLow={...assessed,assessments:[assessed.assessments[0],{...assessed.assessments[1],probability:69.9}]};
 assert.ok(c.validateResult(tooLow,job).some(s=>s.includes('70%')));
 assert.ok(c.validateResult({...assessed,assessments:[{...assessed.assessments[0],probability:69.9},assessed.assessments[1]]},job).some(s=>s.includes('identity')));
});
test('READY may omit unresolvable optional external fields with policy 70%',()=>{
 const p={...result,external:{},confidence:'medium',decisionPolicy:'probability-70-v1',
 assessments:[{field:'identity',probability:81,selected:'named geographic destination',reason:'Own page and independent geographic context'},
              {field:'external.wikidataQid',probability:45,selected:'Q155',reason:'Candidate refers only to a different scope'}]};
 assert.deepEqual(c.validateResult(p,job),[]);
 assert.ok(c.validateResult({...p,external:{wikidataQid:'Q155'}} ,job).some(s=>s.includes('70%')));
});
test('policy requires scored accepted coordinates and relationships',()=>{
 const p={...result,confidence:'medium',decisionPolicy:'probability-70-v1',
  assessments:[{field:'identity',probability:84,reason:'Matched geography'},{field:'external.wikidataQid',probability:77,reason:'Matched Wikidata'}]};
 const l={latitude:-23.1,longitude:-46.1,pointRole:'representative',coordinateSource:'https://www.geonames.org/12345'};
 const e=[...result.evidence,{field:'location',sourceUrl:l.coordinateSource,checkedAt:'2026-10-16T11:00:00Z',note:'Representative point'}];
 assert.ok(c.validateResult({...p,location:l,evidence:e},job).some(s=>s.includes('location')));
 assert.deepEqual(c.validateResult({...p,location:l,evidence:e,assessments:[...p.assessments,{field:'location',probability:72,reason:'Representative position'}]},job),[]);
});
test('stage gate and unavailable pages are skipped',()=>{assert.deepEqual(c.claim({jobs:[{...job,stage:2}]},fresh(),args),[]);assert.deepEqual(c.claim({jobs:[{...job,available:false}]},fresh(),args),[]);});
test('publishing is serialized and PUBLISHED requires exact deployment commit',()=>{const s=fresh();c.claim(queue,s,args);c.complete(queue,s,{...args,result});const p=c.beginPublication(queue,s,{ownerId:'master',batchId:'batch1',now:args.now});assert.equal(p.jobs.length,1);assert.throws(()=>c.beginPublication(queue,s,{ownerId:'other',batchId:'batch2',now:args.now}));c.recordCommit(s,{ownerId:'master',batchId:'batch1',commit:'a'.repeat(40),now:args.now});assert.equal(s.jobs[job.jobId].status,'DEPLOYING');assert.throws(()=>c.confirmDeploy(s,{ownerId:'master',batchId:'batch1',commit:'b'.repeat(40),now:args.now}));c.confirmDeploy(s,{ownerId:'master',batchId:'batch1',commit:'a'.repeat(40),runUrl:'https://github.com/run/1',now:args.now});assert.equal(s.jobs[job.jobId].status,'PUBLISHED');});
test('publishes every READY passport in one batch regardless of legacy limit 20',()=>{
 const list=Array.from({length:103},(_,i)=>({...job,jobId:'bulk_'+i,stableId:'entity_'+i,stage:2,sourceOrder:i}));
 const state=fresh();
 for(const j of list)state.jobs[j.jobId]={status:'READY',resultHash:'sha_'+j.jobId,resultPath:'results/'+j.jobId};
 state.jobs[list[3].jobId].status='REVIEW';
 state.jobs[list[9].jobId].status='PUBLISHED';
 const p=c.beginPublication({jobs:list},state,{batchId:'all-ready',ownerId:'geo-master',now:args.now,limit:20});
 assert.equal(p.jobs.length,101);
 assert.equal(state.jobs[list[3].jobId].status,'REVIEW');
 assert.throws(()=>c.beginPublication({jobs:list},state,{batchId:'other',ownerId:'another',now:args.now}),/already in progress/);
 assert.deepEqual(c.abortUncommittedPublication(state,{batchId:'all-ready',ownerId:'geo-master'}),{batchId:'all-ready',restored:101});
 assert.equal(state.publication,null);
 assert.equal(state.jobs[list[3].jobId].status,'REVIEW');
 assert.equal(state.jobs[list[9].jobId].status,'PUBLISHED');
 assert.equal(list.filter(j=>state.jobs[j.jobId].status==='READY').length,101);
});
test('cannot abort a committed publication, even after a publisher restart',()=>{
 const state=fresh();state.jobs[job.jobId]={status:'READY',resultHash:'hash',resultPath:'result'};
 c.beginPublication({jobs:[job]},state,{batchId:'b1',ownerId:'geo-master',now:args.now});
 c.recordCommit(state,{batchId:'b1',ownerId:'geo-master',commit:'a'.repeat(40),now:args.now});
 assert.throws(()=>c.abortUncommittedPublication(state,{batchId:'b1',ownerId:'geo-master'}),/Cannot abort/);
});
import {receiptMatchesPublication} from '../scripts/schema-geo-autoconfirm.mjs';
test('autoconfirm uses the immutable exact release receipt and deploy SHA',()=>{
 const p={batchId:'geo-full',status:'DEPLOYING',commit:'b'.repeat(40),jobs:[{jobId:'geo-job-a',resultHash:'hash1'}]};
 assert.equal(receiptMatchesPublication(p,{batchId:p.batchId,jobs:p.jobs},p.commit),true);
 assert.equal(receiptMatchesPublication(p,{batchId:p.batchId,jobs:[{...p.jobs[0],resultHash:'changed'}]},p.commit),false);
 assert.equal(receiptMatchesPublication(p,{batchId:p.batchId,jobs:p.jobs},'c'.repeat(40)),false);
});
import {runSchemaGeo} from '../scripts/schema-geo-remote.mjs';
function mockGithub({dropReply=false,queueData=queue,manifestData={maxStage:1,batchSize:10}}={}) {
 let head='0'.repeat(40),serial=0,dropped=false;
 const commits=new Map([[head,{sha:head,parent:null,tree:{sha:head}}]]),trees=new Map([[head,{queue:queueData, state:fresh(),manifest:manifestData}]]);
 const ok=structuredContent=>({structuredContent}),fetchContent=obj=>ok({content:JSON.stringify(obj)});
 const tools={
  async mcp__codex_apps__github_fetch({url}){
   if(url.includes('/git/ref/heads/'))return fetchContent({object:{sha:head}});
   if(url.includes('/git/commits/'))return fetchContent(commits.get(url.split('/').at(-1)));
   if(url.includes('/compare/')){const [base,tip]=url.split('/compare/')[1].split('...');let walk=tip;while(walk&&walk!==base)walk=commits.get(walk)?.parent;return fetchContent({status:base===tip?'identical':walk===base?'ahead':'diverged'});}
   throw Error(url);
  },
  async mcp__codex_apps__github_fetch_file({path,ref}){const t=trees.get(commits.get(ref).tree.sha);return ok({content:JSON.stringify(path.endsWith('queue.json')?t.queue:path.endsWith('state.json')?t.state:t.manifest)});},
  async mcp__codex_apps__github_create_tree({base_tree_sha,tree_elements}){const sha=(++serial).toString(16).padStart(40,'0');const t=structuredClone(trees.get(base_tree_sha));for(const f of tree_elements)if(f.path.endsWith('state.json'))t.state=JSON.parse(f.content);trees.set(sha,t);return ok({sha});},
  async mcp__codex_apps__github_create_commit({tree_sha,parent_sha}){const sha=(++serial).toString(16).padStart(40,'0');commits.set(sha,{sha,parent:parent_sha,tree:{sha:tree_sha}});return ok({sha});},
  async mcp__codex_apps__github_update_ref({sha,expected_sha,force}){assert.equal(force,false);if(head!==expected_sha)return {isError:true,content:[{type:'text',text:'CAS conflict'}]};head=sha;if(dropReply&&!dropped){dropped=true;throw Error('Connection lost after successful update');}return ok({success:true});}
 };
 return {tools,getState:()=>trees.get(commits.get(head).tree.sha).state};
}
test('real remote CAS retries simultaneous claims without overwriting a worker',async()=>{const {tools,getState}=mockGithub();const [a,b]=await Promise.all([runSchemaGeo(tools,c,{action:'claim',...args}),runSchemaGeo(tools,c,{action:'claim',...args,ownerId:'worker_234567',token:'token_2345678901234567'})]);assert.notEqual(a.output[0].jobId,b.output[0].jobId);assert.equal(Object.keys(getState().leases).length,2);});
test('remote collector defaults to manifest batchSize and caps explicit requests',async()=>{
 const largeQueue={jobs:Array.from({length:13},(_,i)=>({...job,jobId:'remote_'+i,stableId:'remoteid_'+i,sourceOrder:i+1}))};
 const a=mockGithub({queueData:largeQueue});
 const out=await runSchemaGeo(a.tools,c,{action:'claim',ownerId:args.ownerId,token:args.token});
 assert.equal(out.output.length,10);
 assert.equal(Object.keys(a.getState().leases).length,10);
 const b=mockGithub({queueData:largeQueue,manifestData:{maxStage:1,batchSize:7}});
 const bound=await runSchemaGeo(b.tools,c,{action:'claim',ownerId:args.ownerId,token:args.token,limit:20});
 assert.equal(bound.output.length,7);
});
test('lost response after successful CAS does not reserve twice',async()=>{const {tools,getState}=mockGithub({dropReply:true});const a=await runSchemaGeo(tools,c,{action:'claim',...args});assert.equal(a.status,'saved');assert.equal(Object.keys(getState().leases).length,1);});
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
test('result validation also works in Code Mode without a URL global',()=>{
 const source=fs.readFileSync(new URL('../scripts/schema-geo-core.mjs',import.meta.url),'utf8');
 const validate=new Function('URL',source.replace(/^export /gm,'')+';return validateResult;')(undefined);
 assert.deepEqual(validate(result,job),[]);
 assert.ok(validate({...result,external:{...result.external,officialUrl:'https://user:secret@example.org/'}},job).length);
 assert.ok(validate({...result,external:{...result.external,officialUrl:'https://example.org/ bad'}},job).length);
});
test('queue refresh preserves scoped coordinate amendments and fences source drift',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'geo-amendment-'));
 const write=(p,d)=>{fs.mkdirSync(path.dirname(path.join(tmp,p)),{recursive:true});fs.writeFileSync(path.join(tmp,p),JSON.stringify(d));};
 try{
  const e={id:'country_brazil',type:'country',name:'Бразилия',url:'/brazil/',contentPath:'src/content/countries/brazil.md',entryPath:'entry.json',countryIds:['country_brazil'],destinationIds:[],sourceBlobSha:'blob-a'};
  const fingerprint=c.digest({stableId:e.id,kind:e.type,url:e.url,sourceBlobSha:e.sourceBlobSha,countryIds:e.countryIds,destinationIds:e.destinationIds});
  const parent={...job,sourceFingerprint:fingerprint};const amendment={...parent,jobId:job.jobId+'-coordinates',amendmentOf:job.jobId,reworkScope:'coordinates'};
  write('data/geo-knowledge/queue.json',{jobs:[parent,amendment]});
  write('data/geo-knowledge/state.json',{jobs:{[amendment.jobId]:{status:'READY',resultHash:'kept'}},leases:{},publications:[]});
  write('data/seo-geo/registry/index.json',{phases:[{path:'phase.json'}]});
  write('phase.json',{entries:[{id:e.id,kind:'country',phase:1,url:e.url,order:5}]});
  write('data/geo-knowledge/source-inventory.json',{snapshotCommit:'main',entities:[e]});write('data/catalog-archive.json',{entries:[]});
  const script=new URL('../scripts/sync-geo-knowledge-queue.mjs',import.meta.url).pathname;
  execFileSync(process.execPath,[script,'--write'],{cwd:tmp});
  let q=JSON.parse(fs.readFileSync(path.join(tmp,'data/geo-knowledge/queue.json')));let s=JSON.parse(fs.readFileSync(path.join(tmp,'data/geo-knowledge/state.json')));
  assert.equal(q.jobs.find(j=>j.jobId===amendment.jobId).available,true);assert.equal(s.jobs[amendment.jobId].status,'READY');assert.equal(s.jobs[amendment.jobId].resultHash,'kept');
  write('data/geo-knowledge/source-inventory.json',{snapshotCommit:'new-main',entities:[{...e,sourceBlobSha:'blob-b'}]});
  execFileSync(process.execPath,[script,'--write'],{cwd:tmp});s=JSON.parse(fs.readFileSync(path.join(tmp,'data/geo-knowledge/state.json')));
  assert.equal(s.jobs[amendment.jobId].status,'STALE');assert.equal(s.jobs[amendment.jobId].resultHash,'kept');
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});

import {descendantKeepsGeoRelease} from '../scripts/schema-geo-autoconfirm.mjs';
test('successful descendant may finalize unchanged GEO release but not mutated entities or receipts',()=>{
 const clean={status:'ahead',total_commits:1,files:[
  {filename:'data/seo-geo/articles/multi-country/brazil_paraguay_uruguay/interests/beach-holidays/index.md',status:'modified'},
  {filename:'data/seo-geo/articles/multi-country/brazil_paraguay_uruguay/interests/culture-and-history/index.md',status:'modified'}]};
 assert.equal(descendantKeepsGeoRelease(clean),true);
 assert.equal(descendantKeepsGeoRelease({...clean,status:'diverged'}),false);
 assert.equal(descendantKeepsGeoRelease({...clean,files:[{filename:'data/geo-knowledge/entities/destination_brazil_bonito.json'}]}),false);
 assert.equal(descendantKeepsGeoRelease({...clean,files:[{filename:'data/geo-knowledge/releases/geo-ready-20261016-all-80.json'}]}),false);
 assert.equal(descendantKeepsGeoRelease({...clean,files:[{filename:'other',previous_filename:'data/geo-knowledge/entities/country_brazil.json'}]}),false);
 assert.equal(descendantKeepsGeoRelease({...clean,files:Array(300).fill({filename:'safe'})}),false);
 assert.equal(descendantKeepsGeoRelease({...clean,total_commits:251}),false);
});


import {geoRemoteCommitMessage} from '../scripts/schema-geo-remote.mjs';
import {publishSchemaGeoAll} from '../scripts/schema-geo-publisher.mjs';
test('GEO dispatch commits trigger Actions while worker updates keep skip-ci',()=>{
 assert.equal(geoRemoteCommitMessage('beginPublication','owner'),'geo: beginPublication owner');
 assert.equal(geoRemoteCommitMessage('dispatchPublication','owner'),'geo: dispatchPublication owner');
 assert.ok(geoRemoteCommitMessage('complete','worker').includes('[skip ci]'));
 assert.ok(geoRemoteCommitMessage('recordCommit','owner').includes('[skip ci]'));
});
test('master resumes frozen PUBLISHING batch across sessions without a second claim',async()=>{
 const seen=[];
 const fake=async(_t,_c,r)=>{
  seen.push(r);
  if(r.action==='resumePublication')return {status:'publication_requires_recovery',phase:'PUBLISHING',
   batchId:'geo-ready-20261016-all-80',ownerId:'geo-master-fast-batch-20261016'};
  if(r.action==='dispatchPublication')return {status:'saved',commit:'existing',output:{count:80}};
  throw Error('Unexpected duplicate claim '+r.action);
 };
 const answer=await publishSchemaGeoAll({}, {},fake,{batchId:'unrelated-new-batch',ownerId:'different-owner'});
 assert.deepEqual(seen.map(x=>x.action),['resumePublication','dispatchPublication']);
 assert.equal(seen[1].batchId,'geo-ready-20261016-all-80');
 assert.equal(seen[1].ownerId,'geo-master-fast-batch-20261016');
 assert.equal(answer.batchId,'geo-ready-20261016-all-80');
 assert.equal(answer.jobs,80);
 assert.equal(answer.recoveredPriorClaim,true);
});
