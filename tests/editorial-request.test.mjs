import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import {gitBlobSha,parseEditorRequest,applyEditorialRequest} from '../scripts/editorial-request.mjs';

const original=['---','id: tour_test_five_countries','slug: five-countries',
'locale: ru','status: published','title: "Пять стран"','priceFrom: 2400',
'priceNote: "Цена за одного"','dates:','- "2027-01-01"',
'countries:','- country_brazil','hero:','  src: /media/tours/test/hero.webp',
'  alt: Описание','itinerary:','- day: 1','  title: Рио',
'  text: |-','    Первый день.','    Отдых.','  excursionRef: excursion_test_x',
'lead: Первое описание.','---','Тело страницы.',''].join('\n');
function setup(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ada-editor-'));
 for(const d of ['data/editorial','data/source-index/entries','src/content/tours'])
   fs.mkdirSync(path.join(root,d),{recursive:true});
 fs.writeFileSync(path.join(root,'data/editorial/authorized-users.json'),
   JSON.stringify({allowedGithubLogins:['anna-account','manager-account']}));
 fs.writeFileSync(path.join(root,'data/source-index/entries/tour_test_five_countries.json'),
   JSON.stringify({id:'tour_test_five_countries',type:'tour',contentPath:'src/content/tours/example.md'}));
 fs.writeFileSync(path.join(root,'src/content/tours/example.md'),original);
 return root;
}
const request=changes=>({version:1,entityType:'tour',entityId:'tour_test_five_countries',
 expectedBlobSha:gitBlobSha(original),changes});
test('edits price and day text without changing identity, places or excursion links',()=>{
 const root=setup(),r=parseEditorRequest(JSON.stringify(request([
 {field:'priceFrom',value:4500},{field:'priceNote',value:'За двоих'},
 {field:'itinerary[0].text',value:'Новый первый день.'}])));
 const out=applyEditorialRequest(root,'anna-account',r,{write:true});
 assert.equal(out.changed,true);
 const text=fs.readFileSync(path.join(root,out.path),'utf8');
 const data=yaml.load(text.split('---')[1]);
 assert.equal(data.priceFrom,4500);assert.equal(data.priceNote,'За двоих');
 assert.equal(data.itinerary[0].text,'Новый первый день.');
 assert.equal(data.itinerary[0].excursionRef,'excursion_test_x');
 assert.deepEqual(data.countries,['country_brazil']);
 assert.equal(data.id,'tour_test_five_countries');
});
test('Anna and manager same role, outsider cannot write',()=>{
 const root=setup(),r=parseEditorRequest(JSON.stringify(request([{field:'lead',value:'Новое описание'}])));
 assert.equal(applyEditorialRequest(root,'anna-account',r).changed,true);
 assert.equal(applyEditorialRequest(root,'manager-account',r).changed,true);
 assert.throws(()=>applyEditorialRequest(root,'outsider',r),/not authorized/);
});
test('rejects code, identity, references, theme, status, and executable markup',()=>{
 for(const field of ['id','slug','status','routeCountries','destinations','themes','primaryThemes',
    'itinerary[0].excursionRef','layout','priority']){
   assert.throws(()=>parseEditorRequest(JSON.stringify(request([{field,value:'bad'}]))),/outside editorial permissions/);
 }
 for(const value of ['<script>alert(1)</script>','[go](javascript:alert(1))',
   '<img src=x onerror=alert(1)>','{{ bad }}']){
   assert.throws(()=>parseEditorRequest(JSON.stringify(request([{field:'lead',value}]))),/Unsafe/);
 }
});
test('rejects stale SHA, unknown nested field and extra JSON keys',()=>{
 const root=setup(),r=request([{field:'lead',value:'Новое'}]);r.expectedBlobSha='a'.repeat(40);
 assert.throws(()=>applyEditorialRequest(root,'anna-account',parseEditorRequest(JSON.stringify(r))),/Stale/);
 const missing=parseEditorRequest(JSON.stringify(request([{field:'itinerary[1].text',value:'Нет'}])));
 assert.throws(()=>applyEditorialRequest(root,'anna-account',missing),/Indexed field missing/);
 assert.throws(()=>parseEditorRequest(JSON.stringify({...request([{field:'lead',value:'X'}]),command:'execute'})),/Unexpected/);
});
test('identical edit is a no-op; new YAML fields cannot be created',()=>{
 const root=setup();
 assert.equal(applyEditorialRequest(root,'anna-account',request([{field:'title',value:'Пять стран'}])).changed,false);
 assert.throws(()=>applyEditorialRequest(root,'anna-account',request([{field:'priceBasis',value:'group'}])),/Cannot create/);
});

test('canonical interest registry allows theme edits without source-index entries',()=>{
 const root=setup();
 fs.mkdirSync(path.join(root,'src/content/themes'),{recursive:true});
 fs.mkdirSync(path.join(root,'src/data'),{recursive:true});
 fs.writeFileSync(path.join(root,'src/data/interest-registry.json'),
   JSON.stringify([{id:'theme_spa',slug:'spa',name:'SPA и wellness'}]));
 const theme=['---','id: theme_spa','slug: spa','locale: ru','status: approved',
   'name: SPA и wellness','summary: Первоначальное описание','---',
   '## Вступление','','Абзац.',''].join('\n');
 const themePath=path.join(root,'src/content/themes/spa.md');
 fs.writeFileSync(themePath,theme);
 const req=parseEditorRequest(JSON.stringify({
   version:1,entityType:'theme',entityId:'theme_spa',expectedBlobSha:gitBlobSha(theme),
   changes:[{field:'summary',value:'Исправленное описание'}]
 }));
 const result=applyEditorialRequest(root,'anna-account',req,{write:true});
 assert.equal(result.path,'src/content/themes/spa.md');
 assert.match(fs.readFileSync(themePath,'utf8'),/summary: Исправленное описание/);
 assert.throws(()=>applyEditorialRequest(root,'outsider',req),/not authorized/);
});

test('themes missing canonical registry identity cannot be edited',()=>{
 const root=setup();
 fs.mkdirSync(path.join(root,'src/content/themes'),{recursive:true});
 fs.mkdirSync(path.join(root,'src/data'),{recursive:true});
 fs.writeFileSync(path.join(root,'src/data/interest-registry.json'),
   JSON.stringify([{id:'theme_spa',slug:'spa',name:'SPA'}]));
 const theme=['---','id: theme_spa','slug: wrong-spa','locale: ru','status: approved',
   'name: SPA','summary: Старый текст','---','Тело',''].join('\n');
 fs.writeFileSync(path.join(root,'src/content/themes/spa.md'),theme);
 const req=parseEditorRequest(JSON.stringify({
   version:1,entityType:'theme',entityId:'theme_spa',expectedBlobSha:gitBlobSha(theme),
   changes:[{field:'summary',value:'Новый текст'}]
 }));
 assert.throws(()=>applyEditorialRequest(root,'anna-account',req),/not uniquely mapped/);
});
