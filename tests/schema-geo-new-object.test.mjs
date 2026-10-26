import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../scripts/schema-geo-core.mjs';
import {buildNewObjectJob,findGeoSheetRow,geoSheetWriteRequest,newGeoSheetRows,
  inspectNewGeoObject,collectNewGeoObject} from '../scripts/schema-geo-new-object.mjs';

const id='destination_brazil_inline_test',created='a'.repeat(40),prior='b'.repeat(40),initial='d'.repeat(40),sha='f'.repeat(40);
const entry={id,type:'destination',name:'Новое место',url:'/brazil/place/inline-test/',
  contentPath:'src/content/destinations/inline-test.md',countryIds:['country_brazil'],destinationIds:[]};
const sample=job=>({schemaVersion:2,jobId:job.jobId,stableId:job.stableId,kind:job.kind,
  canonicalPath:job.url,sourceFingerprint:job.sourceFingerprint,status:'READY',
  confidence:'medium',decisionPolicy:'probability-70-v1',
  assessments:[{field:'identity',probability:83,reason:'Page and travel context'}],
  evidence:[{field:'identity',sourceUrl:'https://www.wikidata.org/wiki/Q155',
    checkedAt:'2026-10-16T19:00:00Z',note:'Public evidence'}]});
test('GEO inline job matches queue fingerprint and preserves all four stages',()=>{
 for(const kind of ['country','destination','tour','excursion']){
  const folder={country:'countries',destination:'destinations',tour:'tours',excursion:'excursions'}[kind];
  const row={...entry,type:kind,id:kind+'_inline_test',contentPath:'src/content/'+folder+'/inline-test.md'};
  const job=buildNewObjectJob(row,sha,123,core);
  assert.equal(job.sourceFingerprint,core.digest({stableId:row.id,kind,url:row.url,
    sourceBlobSha:sha,countryIds:row.countryIds,destinationIds:row.destinationIds}));
  assert.equal(job.stage,{country:1,destination:2,tour:3,excursion:4}[kind]);
 }
});
test('GEO Sheets have exact columns, stable row indexes and no duplicate rows',()=>{
 const job=buildNewObjectJob(entry,sha,123,core),result=sample(job);
 const values=newGeoSheetRows(job,{status:'READY',resultPath:'data/geo-knowledge/results/mock.json',
   resultHash:core.digest(result),completedAt:'2026-10-16T20:00:00Z',completedBy:'worker',
   completedToken:'inline-abc',attempt:1},result);
 assert.equal(values.queue.length,17);assert.equal(values.results.length,10);
 assert.equal(values.queue[7],'READY');assert.equal(values.results[2],'READY');
 assert.equal(findGeoSheetRow([['Job ID'],[job.jobId]],job.jobId),1);
 assert.equal(findGeoSheetRow([['Job ID']],job.jobId),null);
 assert.throws(()=>findGeoSheetRow([['Job ID'],[job.jobId],[job.jobId]],job.jobId),/Duplicate/);
 assert.ok(geoSheetWriteRequest(16001610,null,values.queue).appendCells);
 assert.equal(geoSheetWriteRequest(16001611,1,values.results).updateCells.start.rowIndex,1);
});
function mock({fileExisted=false,failFirstSheets=false}={}){
 let staging=initial,counter=0,failed=false,writeCount=0;
 const next=()=>(++counter).toString(16).padStart(40,'0');
 const data={
  'data/geo-knowledge/state.json':JSON.stringify({jobs:{},leases:{},publications:[],publication:null}),
  'data/geo-knowledge/queue.json':JSON.stringify({schemaVersion:2,jobs:[]}),
  'data/geo-knowledge/source-inventory.json':JSON.stringify({snapshotCommit:prior,entities:[]})
 };
 const commits=new Map([[initial,{tree:{sha:initial}}]]);
 const trees=new Map([[initial,data]]);
 const sheets={16001610:[['Job ID']],16001611:[['Job ID']]};
 const md='---\nid: '+id+'\nstatus: approved\n---\nBody.';
 const tools={
  async mcp__GitHub__fetch({url}){
   const val=url.endsWith('/git/ref/heads/main')?{object:{sha:created}}
     :url.endsWith('/git/ref/heads/schema-geo/staging')?{object:{sha:staging}}
     :url.includes('/compare/')?{status:'identical'}
     :url.endsWith('/git/commits/'+created)?{parents:[{sha:prior}]}:commits.get(url.split('/').at(-1));
   if(!val)throw Error('Unexpected API '+url);
   return {result:{content:JSON.stringify(val)}};
  },
  async mcp__GitHub__fetch_file({path,ref}){
   if(ref===prior&&path===entry.contentPath){
    if(fileExisted)return {result:{sha,content:md}};
    throw Error('NOT_FOUND: 404');
   }
   if(ref===created){
    if(path===entry.contentPath)return {result:{sha,content:md}};
    if(path==='data/source-index/entries/'+id+'.json')return {result:{sha,content:JSON.stringify(entry)}};
    if(path==='data/source-index/catalogs/destinations.json')return {result:{sha,content:JSON.stringify({entries:[entry]})}};
   }
   const key=ref==='schema-geo/staging'?staging:ref;
   const value=trees.get(commits.get(key)?.tree?.sha)?.[path];
   if(value!==undefined)return {result:{content:value,sha}};
   throw Error('Mock file unavailable: '+path+' ref '+ref);
  },
  async mcp__GitHub__fetch_blob(){throw Error('Unexpected blob')},
  async mcp__GitHub__create_tree({base_tree_sha,tree_elements}){
   const out={...trees.get(base_tree_sha)};for(const f of tree_elements)out[f.path]=f.content;
   const v=next();trees.set(v,out);return {result:{sha:v}};
  },
  async mcp__GitHub__create_commit({parent_sha,tree_sha}){
   const v=next();commits.set(v,{tree:{sha:tree_sha},parents:[{sha:parent_sha}]});
   return {result:{sha:v}};
  },
  async mcp__GitHub__update_ref({sha:v,expected_sha,force}){
   assert.equal(force,false);assert.equal(staging,expected_sha);staging=v;
   return {result:{success:true}};
  },
  async mcp__Google_Drive__get_spreadsheet_range({sheet_name}){
   return {result:{values:sheets[sheet_name==='GEO очередь'?16001610:16001611]}};
  },
  async mcp__Google_Drive__batch_update_spreadsheet({spreadsheet_id,requests}){
   writeCount++;
   if(failFirstSheets&&!failed){failed=true;throw Error('Sheet unavailable');}
   assert.equal(spreadsheet_id,'1ZPptMdEcIDA3ZFMOQcFuc5jU88LJlFw9R4URCQSBmmc');
   for(const r of requests){
    const data=r.appendCells||r.updateCells;
    const values=data.rows[0].values.map(c=>c.userEnteredValue.stringValue);
    if(r.appendCells)sheets[data.sheetId].push(values);
    else sheets[data.start.sheetId][data.start.rowIndex]=values;
   }
   return {result:{spreadsheetId:spreadsheet_id,replies:[{},{}]}};
  }
 };
 return {tools,sheets,writeCount:()=>writeCount,
  state:()=>JSON.parse(trees.get(commits.get(staging).tree.sha)['data/geo-knowledge/state.json']),
  queue:()=>JSON.parse(trees.get(commits.get(staging).tree.sha)['data/geo-knowledge/queue.json'])};
}
test('old content does not qualify as a newly created object',async()=>{
 const x=mock({fileExisted:true});
 await assert.rejects(()=>inspectNewGeoObject(x.tools,core,{stableId:id,creationCommit:created}),/already existed/);
});
test('one-object research is saved, mirrored and retry-idempotent without touching publication',async()=>{
 const x=mock(),job=buildNewObjectJob(entry,sha,0,core);
 const request={stableId:id,creationCommit:created,ownerId:'inline-test-worker',result:sample(job)};
 const first=await collectNewGeoObject(x.tools,core,request);
 assert.equal(first.status,'collected_and_synced');
 assert.equal(x.state().jobs[job.jobId].geoSheetSync.status,'SYNCED');
 assert.equal(x.state().jobs[job.jobId].status,'READY');
 assert.equal(x.queue().jobs.length,1);
 assert.equal(x.sheets[16001610].length,2);assert.equal(x.sheets[16001611].length,2);
 assert.equal((await collectNewGeoObject(x.tools,core,request)).status,'already_collected_and_synced');
 assert.equal(x.writeCount(),1);
});
test('Sheets outage preserves immutable result as PENDING; retry completes without duplicate',async()=>{
 const x=mock({failFirstSheets:true}),job=buildNewObjectJob(entry,sha,0,core);
 const request={stableId:id,creationCommit:created,ownerId:'inline-test-worker',result:sample(job)};
 await assert.rejects(()=>collectNewGeoObject(x.tools,core,request),/Sheets PENDING/);
 assert.equal(x.state().jobs[job.jobId].geoSheetSync.status,'PENDING');
 assert.equal(x.queue().jobs.length,1);
 assert.equal((await collectNewGeoObject(x.tools,core,request)).status,'collected_and_synced');
 assert.equal(x.state().jobs[job.jobId].geoSheetSync.status,'SYNCED');
 assert.equal(x.sheets[16001610].length,2);assert.equal(x.sheets[16001611].length,2);
});

test('current codex_apps Sheets names and structuredContent retry the same committed result without duplicates',async()=>{
 const x=mock({failFirstSheets:true}),job=buildNewObjectJob(entry,sha,0,core);
 const oldRead=x.tools.mcp__Google_Drive__get_spreadsheet_range;
 const oldBatch=x.tools.mcp__Google_Drive__batch_update_spreadsheet;
 delete x.tools.mcp__Google_Drive__get_spreadsheet_range;
 delete x.tools.mcp__Google_Drive__batch_update_spreadsheet;
 x.tools.mcp__codex_apps__google_drive_get_spreadsheet_range=async args=>{
  assert.equal(args.spreadsheet_id,'1ZPptMdEcIDA3ZFMOQcFuc5jU88LJlFw9R4URCQSBmmc');
  assert.equal(args.range,'A1:A7000');
  assert.ok(['GEO очередь','GEO результаты'].includes(args.sheet_name));
  return {structuredContent:(await oldRead(args)).result};
 };
 x.tools.mcp__codex_apps__google_drive_batch_update_spreadsheet=async args=>{
  assert.ok(Array.isArray(args.requests));assert.equal(args.requests.length,2);
  for(const request of args.requests){
   assert.equal(Object.keys(request).length,1);
   assert.ok(request.appendCells||request.updateCells);
  }
  return {structuredContent:(await oldBatch(args)).result};
 };
 const request={stableId:id,creationCommit:created,ownerId:'current-connector-worker',result:sample(job)};
 await assert.rejects(()=>collectNewGeoObject(x.tools,core,request),/Sheets PENDING/);
 const firstHash=x.state().jobs[job.jobId].resultHash;
 assert.equal(x.state().jobs[job.jobId].geoSheetSync.status,'PENDING');
 assert.equal((await collectNewGeoObject(x.tools,core,request)).status,'collected_and_synced');
 assert.equal(x.state().jobs[job.jobId].resultHash,firstHash);
 assert.equal(x.state().jobs[job.jobId].geoSheetSync.status,'SYNCED');
 assert.equal(x.queue().jobs.length,1);
 assert.equal(x.sheets[16001610].length,2);assert.equal(x.sheets[16001611].length,2);
 assert.equal((await collectNewGeoObject(x.tools,core,request)).status,'already_collected_and_synced');
 assert.equal(x.writeCount(),2,'one failed batch, one successful exact retry, no duplicate third write');
});

test('an unrecognized Sheets read envelope cannot be mistaken for an empty sheet and append duplicates',async()=>{
 const x=mock(),job=buildNewObjectJob(entry,sha,0,core);
 delete x.tools.mcp__Google_Drive__get_spreadsheet_range;
 x.tools.mcp__codex_apps__google_drive_get_spreadsheet_range=async()=>({structuredContent:{unexpected:[]}});
 const request={stableId:id,creationCommit:created,ownerId:'bad-envelope-worker',result:sample(job)};
 await assert.rejects(()=>collectNewGeoObject(x.tools,core,request),/range response is not a values array/);
 assert.equal(x.state().jobs[job.jobId].geoSheetSync.status,'PENDING');
 assert.equal(x.writeCount(),0);
 assert.equal(x.sheets[16001610].length,1);assert.equal(x.sheets[16001611].length,1);
});
