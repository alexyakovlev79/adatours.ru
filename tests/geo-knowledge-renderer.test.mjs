import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildStructuredData} from '../src/lib/structured-data.mjs';
import {mergeGeoPassport} from '../src/lib/geo-knowledge.mjs';
const ids=['country_brazil','country_argentina','country_peru','country_antarctica','country_belize'];
const passports=ids.map(id=>JSON.parse(readFileSync('data/geo-knowledge/entities/'+id+'.json','utf8')));
const geoKnowledge=new Map(passports.map(p=>[p.stableId,p])),root='https://adatours.ru/';
const records=passports.map(p=>({kind:'country',path:p.canonicalPath,archived:false,data:{id:p.stableId,slug:p.canonicalPath.split('/')[1],name:p.stableId,status:'approved',summary:'Путешествия'}}));
const organization={name:'Ada Tours',url:root,logo:'/brand/adatours-logo-black.svg',languages:['Русский'],areaServed:[]};
for(const r of records)test('verified GEO passport '+r.data.id,()=>{
 const passport=geoKnowledge.get(r.data.id);
 const graph=buildStructuredData({root,organization,records,geoKnowledge,page:{path:r.path,url:new URL(r.path,root).href,title:'Страна',description:'Путешествия',lang:'ru'}});
 const nodes=graph['@graph'].filter(n=>n['@id']===new URL(r.path,root).href+'#country');
 assert.equal(nodes.length,1);
 const n=nodes[0];
 assert.ok(n.sameAs.includes('https://www.wikidata.org/wiki/'+passport.external.wikidataQid));
 assert.ok(n.identifier.some(x=>x.propertyID==='Wikidata'));assert.deepEqual(n.geo,passport.location ? {'@type':'GeoCoordinates',latitude:passport.location.latitude,longitude:passport.location.longitude} : undefined);
 assert.equal(n.hasMap,passport.external.osm?'https://www.openstreetmap.org/'+passport.external.osm.type+'/'+passport.external.osm.id:undefined);
 assert.ok(n.subjectOf.length===2);assert.ok(!n.sameAs.some(x=>x.includes('gov.br')||x.includes('gob.ar')));
 if(r.data.id==='country_antarctica')assert.ok(n['@type'].includes('Place')&&!n['@type'].includes('Country'));
 else assert.ok(n['@type'].includes('Country'));
});
test('rejected or stale records do not modify a canonical entity',()=>{
 const r=records[0],n={name:'Бразилия',identifier:r.data.id};
 assert.deepEqual(mergeGeoPassport(n,{...r,path:'/not-brazil/'},geoKnowledge),n);
 assert.deepEqual(mergeGeoPassport(n,r,new Map([[r.data.id,{...passports[0],status:'REVIEW'}]])),n);
});
test('pre-approved English sameAs is preserved and government URL excluded',()=>{
 const n=mergeGeoPassport({name:'Бразилия',sameAs:['https://adatours.com/brazil/']},records[0],geoKnowledge);
 assert.deepEqual(n.sameAs,['https://adatours.com/brazil/','https://www.wikidata.org/wiki/Q155']);
 assert.ok(n.subjectOf.some(x=>x.url==='https://en.wikipedia.org/wiki/Brazil'));
});

const finalCountryIds = ['country_french_guiana','country_chile','country_ecuador','country_el_salvador'];
for(const id of finalCountryIds) test('final verified GEO country passport '+id,()=>{
 const passport=JSON.parse(readFileSync('data/geo-knowledge/entities/'+id+'.json','utf8'));
 const record={kind:'country',path:passport.canonicalPath,archived:false,
   data:{id:passport.stableId,slug:passport.canonicalPath.split('/')[1],name:id,status:'approved',summary:'Путешествия'}};
 const graph=buildStructuredData({root,organization,records:[record],
   geoKnowledge:new Map([[id,passport]]),
   page:{path:record.path,url:new URL(record.path,root).href,title:'Страна',description:'Путешествия',lang:'ru'}});
 const nodes=graph['@graph'].filter(node=>node['@id']===new URL(record.path,root).href+'#country');
 assert.equal(nodes.length,1);
 const n=nodes[0];
 assert.ok(n.sameAs.includes('https://www.wikidata.org/wiki/'+passport.external.wikidataQid));
 assert.ok(n.identifier.some(x=>x.propertyID==='GeoNames'&&x.value===passport.external.geonamesId));
 assert.equal(n.hasMap,'https://www.openstreetmap.org/'+passport.external.osm.type+'/'+passport.external.osm.id);
 assert.equal(n.subjectOf.length,Object.keys(passport.external.wikipedia||{}).length);
 assert.equal(n.geo,undefined,'Unverified coordinate candidates are never emitted');
 assert.ok(!n.sameAs.includes(passport.external.officialUrl),'Government portal is not geographical sameAs');
 if(id==='country_french_guiana'){
   assert.ok(n['@type'].includes('AdministrativeArea'));
   assert.ok(n['@type'].includes('Place'));
   assert.ok(!n['@type'].includes('Country'));
 } else assert.ok(n['@type'].includes('Country'));
});


test('70% probabilistic identity produces sameAs for composite object; 69.9% does not',()=>{
 const r=records[0],base=passports[0], node={name:'Бразилия'};
 const p={...base,status:'READY',confidence:'medium',identityScope:'composite',decisionPolicy:'probability-70-v1',
 assessments:[{field:'identity',probability:70,reason:'Page referent'},{field:'external.wikidataQid',probability:70,reason:'Most probable correspondence'}]};
 const input=new Map([[r.data.id,p]]);
 const merged=mergeGeoPassport(node,r,input);
 assert.ok(merged.sameAs.includes('https://www.wikidata.org/wiki/'+p.external.wikidataQid));
 const bad={...p,assessments:[{field:'identity',probability:70,reason:'Page referent'},{field:'external.wikidataQid',probability:69.9,reason:'Below limit'}]};
 assert.ok(!(mergeGeoPassport(node,r,new Map([[r.data.id,bad]])).sameAs||[]).includes('https://www.wikidata.org/wiki/'+p.external.wikidataQid));
 const unknown={...p,assessments:[{field:'identity',probability:69.9,reason:'Unresolved main object'}]};
 assert.deepEqual(mergeGeoPassport(node,r,new Map([[r.data.id,unknown]])),node);
});
