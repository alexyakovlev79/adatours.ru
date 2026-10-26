import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {syncSourceCatalogs} from '../scripts/sync-source-catalogs.mjs';

function fixture(records,assets=[]){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'source-catalog-contract-'));
 const write=(relative,value)=>{
  const filename=path.join(root,relative);fs.mkdirSync(path.dirname(filename),{recursive:true});
  fs.writeFileSync(filename,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
 };
 for(const record of records)write('data/source-index/entries/'+record.id+'.json',record);
 write('data/source-index/index.json',{metadata:{preparedAt:'2026-10-01',sourceAudit:{retained:true},entityCount:0},entries:[]});
 write('src/data/media/direct-s3-uploads.json',{version:1,assets});
 return {root,write,read:relative=>JSON.parse(fs.readFileSync(path.join(root,relative),'utf8')),
  raw:relative=>fs.readFileSync(path.join(root,relative),'utf8'),clean:()=>fs.rmSync(root,{recursive:true,force:true})};
}
const entry=(type,id,slug,url,extra={})=>({id,type,slug,name:id,url,contentPath:'src/content/'+
 ({country:'countries',destination:'destinations',tour:'tours',excursion:'excursions'}[type])+'/'+slug+'.md',
 countryIds:['country_brazil'],destinationIds:[],sourceUrl:null,media:{status:'ready'},
 sourceHistory:[{note:'Do not alter full entries or historical donor metadata'}],...extra});
const city=()=>entry('destination','destination_brazil_rio','rio-de-janeiro','/brazil/place/rio-de-janeiro/',{
 destinationIds:['destination_brazil_rio'],destinationType:'city',navigationRole:'hub',themes:['theme_culture']});

test('repeated real sync preserves independent taxonomy, the wildlife interest, route arrays and history',()=>{
 const records=[entry('country','country_brazil','brazil','/brazil/'),city(),
  entry('destination','destination_fixture_resort','fixture-resort','/brazil/place/fixture-resort/',{
   destinationType:'resort',navigationRole:'sight',themes:[]}),
  entry('tour','tour_fixture','fixture','/multi-country/tour/fixture/',{
   countryIds:['country_brazil','country_argentina'],routeCountryIds:['country_brazil','country_argentina'],
   destinationIds:['destination_brazil_rio'],routeDestinationIds:[],primaryThemes:['theme_wildlife'],themes:['theme_nature'],
   status:'archived',archivedAt:'2026-10-01',archiveReason:'Historical fixture',legacyUrls:['/tours/fixture/']}),
  entry('excursion','excursion_fixture','fixture-excursion','/brazil/rio-de-janeiro/fixture-excursion/',{
   destinationIds:['destination_brazil_rio'],relatedDestinationIds:['destination_fixture_resort'],themes:[]}),
  entry('excursion','excursion_empty_fixture','empty-fixture-excursion','/brazil/rio-de-janeiro/empty-fixture-excursion/',{
   destinationIds:['destination_brazil_rio'],relatedDestinationIds:[],themes:['theme_culture']})];
 const x=fixture(records);
 try{
  const originals=records.map(r=>x.raw('data/source-index/entries/'+r.id+'.json'));
  const first=syncSourceCatalogs({repoRoot:x.root});assert.equal(first.networkRequests,0);
  const outputPaths=['index.json','catalogs/countries.json','catalogs/destinations.json','catalogs/tours.json','catalogs/excursions.json'];
  const outputs=outputPaths.map(p=>x.raw('data/source-index/'+p));
  const index=x.read('data/source-index/index.json');
  assert.deepEqual(index.metadata.sourceAudit,{retained:true});assert.equal(index.metadata.preparedAt,'2026-10-01');
  for(const row of records){
   const compact=index.entries.find(x=>x.id===row.id);
   for(const key of ['destinationType','navigationRole','primaryThemes','themes','routeCountryIds','routeDestinationIds','relatedDestinationIds','status','archivedAt','archiveReason','legacyUrls'])
    assert.deepEqual(compact[key],row[key],row.id+': '+key);
  }
  const resort=x.read('data/source-index/catalogs/destinations.json').entries.find(r=>r.id==='destination_fixture_resort');
  assert.equal(resort.destinationType,'resort');assert.equal(resort.navigationRole,'sight');
  syncSourceCatalogs({repoRoot:x.root});
  assert.deepEqual(outputPaths.map(p=>x.raw('data/source-index/'+p)),outputs,'second sync is byte-idempotent');
  assert.deepEqual(records.map(r=>x.raw('data/source-index/entries/'+r.id+'.json')),originals,'source histories/format remain intact');
 }finally{x.clean();}
});
test('missing or invalid place taxonomy fails before replacing any current catalog/index',()=>{
 for(const changes of [{navigationRole:undefined},{destinationType:'made-up-type'},{navigationRole:'city'}]){
  const x=fixture([{...city(),...changes}]);
  try{
   const previous=x.raw('data/source-index/index.json');
   assert.throws(()=>syncSourceCatalogs({repoRoot:x.root}),/destinationType or navigationRole/);
   assert.equal(x.raw('data/source-index/index.json'),previous);
   assert.equal(fs.existsSync(path.join(x.root,'data/source-index/catalogs/destinations.json')),false);
  }finally{x.clean();}
 }
});
function generatedEntry(){
 const row=city(),url='/media/destinations/rio/hero-generated-20261026-test.webp';
 return {...row,readiness:{media:'generated',text:'editorial_generated'},
  text:{selected:{kind:'editorial_generated',repositoryPath:'data/source-index/materials/'+row.id+'.md',mimeType:'text/markdown',name:'Prepared source'},
   provenance:{kind:'editorial_generated',sources:['https://www.visitbrasil.com/'],parentTourId:'tour_fixture',createdAt:'2026-10-26'}},
  media:{status:'generated',sourceUrl:null,provenance:{kind:'gpt_image',createdAt:'2026-10-26'},
   images:[{url,role:'hero',order:1,alt:'Рио-де-Жанейро'}]}};
}
test('generated source sync accepts a validated S3 receipt without a binary and rejects an absent or malformed receipt',()=>{
 const row=generatedEntry(),receipt={source:'direct-s3',key:row.media.images[0].url.slice(1),sha256:'a'.repeat(64),
  bytes:12345,contentType:'image/webp',uploadedAt:'2026-10-26T15:00:00Z'};
 for(const [assets,expected] of [[[receipt],'pass'],[[],'missing'],[[{...receipt,sha256:'invalid'}],'invalid']]){
  const x=fixture([row],assets);x.write(row.text.selected.repositoryPath,'Verified supplied geographic source.\n');
  try{
   const previous=x.raw('data/source-index/index.json');
   if(expected==='pass'){
    assert.equal(syncSourceCatalogs({repoRoot:x.root}).entries,1);
    assert.equal(fs.existsSync(path.join(x.root,'public')),false);
    assert.equal(x.read('data/source-index/catalogs/destinations.json').entries[0].navigationRole,'hub');
   }else{
    assert.throws(()=>syncSourceCatalogs({repoRoot:x.root}),expected==='missing'?/missing generated asset/:/direct-s3-uploads.json/);
    assert.equal(x.raw('data/source-index/index.json'),previous);
   }
  }finally{x.clean();}
 }
});
