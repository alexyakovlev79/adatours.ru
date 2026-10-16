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
test('two workers select disjoint jobs; retry returns original claim',()=>{const s=fresh();const a=c.claim(queue,s,args);const b=c.claim(queue,s,{...args,ownerId:'worker_234567',token:'token_2345678901234567'});assert.notEqual(a[0].jobId,b[0].jobId);assert.equal(c.claim(queue,s,args)[0].jobId,a[0].jobId);});
test('expired token is fenced after reassignment',()=>{const s=fresh();c.claim(queue,s,args);c.claim(queue,s,{...args,ownerId:'worker_234567',token:'token_2345678901234567',now:args.now+91*60000});assert.throws(()=>c.complete(queue,s,{...args,now:args.now+91*60000,result}),/Lease/);});
test('cannot renew an expired lease',()=>{const s=fresh();c.claim(queue,s,args);assert.throws(()=>c.renew(s,{...args,jobId:job.jobId,now:args.now+91*60000}),/Lease/);});
test('complete is atomic and retry is idempotent',()=>{const s=fresh();c.claim(queue,s,args);const a=c.complete(queue,s,{...args,result});assert.equal(s.jobs[job.jobId].status,'READY');assert.equal(s.leases[job.jobId],undefined);assert.equal(c.complete(queue,s,{...args,result}).hash,a.hash);assert.throws(()=>c.complete(queue,s,{...args,result:{...result,confidence:'low'}}));});
test('invalid or unproven coordinates cannot be READY',()=>{assert.ok(c.validateResult({...result,location:{latitude:95,longitude:0}},job).length);});
test('source drift fences completion',()=>{const s=fresh();c.claim(queue,s,args);assert.throws(()=>c.complete({jobs:[{...job,sourceFingerprint:'changed'}]},s,{...args,result}),/Source changed/);});
test('source and evidence fields must match exactly',()=>{assert.ok(c.validateResult({...result,external:{wikidataQid:'Q155',osm:{type:'way',id:1}}},job).some(e=>e.includes('Missing evidence')));});
test('composite identity is REVIEW, cannot assign one constituent QID',()=>{assert.ok(c.validateResult({...result,identityScope:'composite'},job).length);});
test('stage gate and unavailable pages are skipped',()=>{assert.deepEqual(c.claim({jobs:[{...job,stage:2}]},fresh(),args),[]);assert.deepEqual(c.claim({jobs:[{...job,available:false}]},fresh(),args),[]);});
test('publishing is serialized and PUBLISHED requires exact deployment commit',()=>{const s=fresh();c.claim(queue,s,args);c.complete(queue,s,{...args,result});const p=c.beginPublication(queue,s,{ownerId:'master',batchId:'batch1',now:args.now});assert.equal(p.jobs.length,1);assert.throws(()=>c.beginPublication(queue,s,{ownerId:'other',batchId:'batch2',now:args.now}));c.recordCommit(s,{ownerId:'master',batchId:'batch1',commit:'a'.repeat(40),now:args.now});assert.equal(s.jobs[job.jobId].status,'DEPLOYING');assert.throws(()=>c.confirmDeploy(s,{ownerId:'master',batchId:'batch1',commit:'b'.repeat(40),now:args.now}));c.confirmDeploy(s,{ownerId:'master',batchId:'batch1',commit:'a'.repeat(40),runUrl:'https://github.com/run/1',now:args.now});assert.equal(s.jobs[job.jobId].status,'PUBLISHED');});
import {runSchemaGeo} from '../scripts/schema-geo-remote.mjs';
function mockGithub({dropReply=false}={}) {
 let head='0'.repeat(40),serial=0,dropped=false;
 const commits=new Map([[head,{sha:head,parent:null,tree:{sha:head}}]]),trees=new Map([[head,{queue, state:fresh(),manifest:{maxStage:1}}]]);
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
test('lost response after successful CAS does not reserve twice',async()=>{const {tools,getState}=mockGithub({dropReply:true});const a=await runSchemaGeo(tools,c,{action:'claim',...args});assert.equal(a.status,'saved');assert.equal(Object.keys(getState().leases).length,1);});
