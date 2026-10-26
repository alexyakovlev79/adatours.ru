import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as core from '../scripts/schema-geo-core.mjs';
import * as inline from '../scripts/schema-geo-new-object.mjs';
import {inspectWordGeoRevision,saveWordGeoRevision,collectWordGeoRevision,wordGeoContentProjection} from '../scripts/schema-geo-word-revision.mjs';

const id='tour_word_revision_test',contentCommit='a'.repeat(40),parent='b'.repeat(40),main='c'.repeat(40),initial='d'.repeat(40);
const sourceSha='e'.repeat(40),oldSha='f'.repeat(40),entrySha='1'.repeat(40);
const places=['destination_peru_lima','destination_peru_reserved_route_place'];
const entry={id,type:'tour',slug:'word-revision-test',name:'Word revision test',url:'/peru/tour/word-revision-test/',
 contentPath:'src/content/tours/word-revision-test.md',countryIds:['country_peru'],destinationIds:places,
 routeCountryIds:['country_peru'],routeDestinationIds:places,primaryThemes:['theme_culture'],themes:[]};
const md=['---','id: '+id,'slug: '+entry.slug,'status: published','countries: [country_peru]',
 'destinations:',...places.map(id=>'- '+id),'routeCountries: ["country_peru"]','routeDestinations:',
 ...places.map(id=>'- '+id),'primaryThemes: [theme_culture]','themes: []','---','Confirmed Word programme.'].join('\n');
const sourceJob=()=>({...inline.buildNewObjectJob(entry,sourceSha,1,core),origin:'word_revision',wordRevisionCommit:contentCommit});
const resultFor=job=>({schemaVersion:2,jobId:job.jobId,stableId:id,kind:'tour',canonicalPath:job.url,
 sourceFingerprint:job.sourceFingerprint,status:'READY',confidence:'high',decisionPolicy:'probability-70-v1',
 relationships:places.map((targetId,i)=>({type:'visits',targetId,position:i+1})),
 assessments:['identity',...places.map(id=>'relationships.'+id)].map(field=>({field,probability:95,reason:'Confirmed Word route and exact existing internal ID'})),
 evidence:['identity',...places.map(id=>'relationships.'+id)].map(field=>({field,sourceUrl:'https://drive.google.com/file/d/word-source/view',checkedAt:'2026-10-26T15:00:00Z',note:'Full Word checked'})),
 reviewNote:'Addressed route revision; reserved place has no fabricated page.'});
const request=()=>({stableId:id,contentCommit,ownerId:'word-geo-worker',result:resultFor(sourceJob())});

function mock({unchanged=false,mainDrift=false,entryDrift=false,compactDrift=false,prior=null,lease=null,publication=null,
 oldJob=null,oldPayload=null,sheetsFailOnce=false,casRace=false}={}){
 let staging=initial,counter=100,fail=sheetsFailOnce,raced=false,writes=0;
 const next=()=>(++counter).toString(16).padStart(40,'0');
 const jobId=sourceJob().jobId;
 const data={
  'data/geo-knowledge/state.json':JSON.stringify({jobs:{neighbour:{status:'QUEUED'},...(prior?{[jobId]:prior}:{})},
    leases:lease?{[jobId]:lease}:{},publication,publications:[{batchId:'prior-history'}]}),
  'data/geo-knowledge/queue.json':JSON.stringify({jobs:oldJob?[oldJob]:[]}),
  'data/geo-knowledge/source-inventory.json':JSON.stringify({entities:[]}),
  ...(prior?.resultPath?{[prior.resultPath]:JSON.stringify(oldPayload)}:{})
 };
 const commits=new Map([[initial,{tree:{sha:initial}}]]),trees=new Map([[initial,data]]);
 const sheets={16001610:[['Job ID']],16001611:[['Job ID']]};
 const tools={
  async mcp__GitHub__fetch({url}){
   const value=url.endsWith('/git/ref/heads/main')?{object:{sha:main}}
    :url.endsWith('/git/ref/heads/schema-geo/staging')?{object:{sha:staging}}
    :url.includes('/compare/')?{status:'ahead'}
    :url.endsWith('/git/commits/'+contentCommit)?{parents:[{sha:parent}]}:commits.get(url.split('/').at(-1));
   if(!value)throw Error('Unexpected API '+url);
   return {result:{content:JSON.stringify(value)}};
  },
  async mcp__GitHub__fetch_file({path,ref}){
   if([main,contentCommit,parent].includes(ref)){
    if(path===entry.contentPath)return {result:{sha:ref===parent?(unchanged?sourceSha:oldSha):(ref===main&&mainDrift?'9'.repeat(40):sourceSha),content:md}};
    if(path==='data/source-index/entries/'+id+'.json')return {result:{sha:ref===main&&entryDrift?'8'.repeat(40):entrySha,content:JSON.stringify(entry)}};
    if(path==='data/source-index/catalogs/tours.json')return {result:{sha:entrySha,content:JSON.stringify({entries:[{...entry,...(compactDrift?{destinationIds:places.slice(0,1)}:{})}]})}};
   }
   const key=ref==='schema-geo/staging'?staging:ref;
   const content=trees.get(commits.get(key)?.tree.sha)?.[path];
   if(content===undefined)throw Error('NOT_FOUND '+path+' '+ref);
   return {result:{sha:entrySha,content}};
  },
  async mcp__GitHub__fetch_blob(){throw Error('Unexpected blob');},
  async mcp__GitHub__create_tree({base_tree_sha,tree_elements}){
   const values={...trees.get(base_tree_sha)};for(const f of tree_elements)values[f.path]=f.content;
   const sha=next();trees.set(sha,values);return {result:{sha}};
  },
  async mcp__GitHub__create_commit({tree_sha,parent_sha}){
   const sha=next();commits.set(sha,{tree:{sha:tree_sha},parents:[{sha:parent_sha}]});return {result:{sha}};
  },
  async mcp__GitHub__update_ref({sha,expected_sha,force}){
   assert.equal(force,false);
   if(casRace&&!raced){
    raced=true;const values={...trees.get(commits.get(staging).tree.sha)};
    const current=JSON.parse(values['data/geo-knowledge/state.json']);current.jobs.neighbour={status:'READY',resultHash:'neighbour-result'};
    values['data/geo-knowledge/state.json']=JSON.stringify(current);
    staging=next();trees.set(staging,values);commits.set(staging,{tree:{sha:staging}});
    return {result:{success:false}};
   }
   assert.equal(staging,expected_sha);staging=sha;writes++;return {result:{success:true}};
  },
  async mcp__Google_Drive__get_spreadsheet_range({sheet_name}){
   return {result:{values:sheets[sheet_name==='GEO очередь'?16001610:16001611]}};
  },
  async mcp__Google_Drive__batch_update_spreadsheet({spreadsheet_id,requests}){
   if(fail){fail=false;throw Error('Sheet offline');}
   for(const r of requests){
    const item=r.appendCells||r.updateCells,values=item.rows[0].values.map(c=>c.userEnteredValue.stringValue);
    if(r.appendCells)sheets[item.sheetId].push(values);else sheets[item.start.sheetId][item.start.rowIndex]=values;
   }
   return {result:{spreadsheetId:spreadsheet_id,replies:requests.map(()=>({}))}};
  }
 };
 const read=path=>JSON.parse(trees.get(commits.get(staging).tree.sha)[path]);
 return {tools,sheets,state:()=>read('data/geo-knowledge/state.json'),queue:()=>read('data/geo-knowledge/queue.json'),read,writes:()=>writes};
}
test('revision inspector binds a modified existing MD to current main, exact entry and compact geography',async()=>{
 const x=mock(),inspected=await inspectWordGeoRevision(x.tools,core,inline,{stableId:id,contentCommit});
 assert.equal(inspected.job.sourceFingerprint,sourceJob().sourceFingerprint);
 assert.equal(inspected.previousSourceBlobSha,oldSha);assert.deepEqual(inspected.visitDestinationIds,places);
 for(const [options,message] of [[{unchanged:true},/not modified/],[{mainDrift:true},/MD changed/],
  [{entryDrift:true},/entry changed/],[{compactDrift:true},/differs in compact/]]){
  const y=mock(options);await assert.rejects(()=>inspectWordGeoRevision(y.tools,core,inline,{stableId:id,contentCommit}),message);
 }
});
test('portable frontmatter projection fails closed on aliases and duplicated route identities',()=>{
 assert.throws(()=>wordGeoContentProjection(md.replace('countries: [country_peru]','countries: *unverified'),'tour'),/Unsupported/);
 assert.throws(()=>wordGeoContentProjection(md.replace('themes: []','themes: [theme_culture, theme_culture]'),'tour'),/Duplicate/);
 const source=fs.readFileSync(new URL('../scripts/schema-geo-word-revision.mjs',import.meta.url),'utf8');
 const portable=new Function(source.replace(/^export /gm,'')+';return wordGeoContentProjection;')();
 assert.deepEqual(portable(md,'tour').visitDestinationIds,places);
});
test('excursion source contract keeps its URL destination separate from related visits',()=>{
 const content=['---','id: excursion_word_revision','slug: excursion-word-revision','status: approved',
  'country: country_peru','destination: destination_peru_lima',
  'relatedDestinations: [destination_peru_reserved_route_place]','themes: [theme_culture]','---','Word programme'].join('\n');
 const parsed=wordGeoContentProjection(content,'excursion');
 assert.deepEqual(parsed.projection.destinationIds,[places[0]]);
 assert.deepEqual(parsed.projection.relatedDestinationIds,[places[1]]);
 assert.deepEqual(parsed.visitDestinationIds,places);
});
test('current trip result must cover every guaranteed visit, including a reserved internal ID',async()=>{
 const x=mock(),req=request();req.result.relationships.pop();
 await assert.rejects(()=>saveWordGeoRevision(x.tools,core,inline,req),/exact guaranteed route/);
 assert.equal(x.writes(),0);
});
test('saved revision uses one canonical job; Sheets outage retries the exact result without duplicate',async()=>{
 const x=mock({sheetsFailOnce:true}),req=request(),jobId=sourceJob().jobId;
 await assert.rejects(()=>collectWordGeoRevision(x.tools,core,inline,req),/Sheets PENDING/);
 assert.equal(x.state().jobs[jobId].geoSheetSync.status,'PENDING');
 const retried=await collectWordGeoRevision(x.tools,core,inline,req);
 assert.equal(retried.saved.status,'already_saved');assert.equal(x.queue().jobs.length,1);
 assert.equal(x.state().jobs[jobId].geoSheetSync.status,'SYNCED');
 assert.equal(x.sheets[16001610].length,2);assert.equal(x.sheets[16001611].length,2);
 assert.equal((await collectWordGeoRevision(x.tools,core,inline,req)).status,'already_collected_and_synced');
 assert.equal(x.writes(),2);assert.deepEqual(x.state().publications,[{batchId:'prior-history'}]);
});
test('new revision preserves old immutable payload and publication history, without carrying published status forward',async()=>{
 const oldJob=inline.buildNewObjectJob(entry,oldSha,17,core),oldPayload=resultFor(oldJob);
 const oldPath='data/geo-knowledge/results/'+oldJob.jobId+'/previous.json';
 const prior={status:'PUBLISHED',attempt:3,resultHash:core.digest(oldPayload),resultPath:oldPath,
  publishedCommit:parent,deployRun:'https://github.com/run/old',publishedAt:'2026-10-20T00:00:00Z',
  revisionHistory:[{reason:'older revision'}]};
 const x=mock({prior,oldJob,oldPayload});await collectWordGeoRevision(x.tools,core,inline,request());
 const current=x.state().jobs[oldJob.jobId];
 assert.equal(current.status,'READY');assert.equal(current.publishedCommit,undefined);
 const {revisionHistory,...previousRecord}=prior;
 assert.equal(current.revisionHistory.length,2);assert.deepEqual(current.revisionHistory[1].record,previousRecord);
 assert.deepEqual(x.read(oldPath),oldPayload);assert.equal(x.queue().jobs[0].sourceOrder,17);
});
test('active lease and in-flight publication fence Word revisions; expired lease is archived',async()=>{
 const jobId=sourceJob().jobId;
 for(const options of [
  {lease:{until:'2999-01-01T00:00:00Z'},prior:{status:'LEASED'}},
  {prior:{status:'PUBLISHING'}},{prior:{status:'DEPLOYING'}},
  {publication:{status:'PUBLISHING',jobs:[{jobId}]}}
 ]){
  const x=mock(options);await assert.rejects(()=>saveWordGeoRevision(x.tools,core,inline,request()),/lease|publication/);
  assert.equal(x.writes(),0);
 }
 const expired={until:'2000-01-01T00:00:00Z',generation:5,ownerId:'expired-worker'};
 const x=mock({lease:expired,prior:{status:'LEASED',attempt:5}});
 await saveWordGeoRevision(x.tools,core,inline,request());
 assert.equal(x.state().leases[jobId],undefined);assert.equal(x.state().jobs[jobId].attempt,6);
 assert.deepEqual(x.state().jobs[jobId].revisionHistory[0].lease,expired);
});
test('CAS retry rereads staging, preserving another collector result; conflicting retry cannot replace own payload',async()=>{
 const x=mock({casRace:true}),req=request();await saveWordGeoRevision(x.tools,core,inline,req);
 assert.equal(x.state().jobs.neighbour.resultHash,'neighbour-result');
 assert.equal(x.queue().jobs.length,1);assert.equal(x.writes(),1);
 req.result.reviewNote='Conflicting same-revision replacement';
 await assert.rejects(()=>saveWordGeoRevision(x.tools,core,inline,req),/Conflicting result/);
 assert.equal(x.writes(),1);
});
