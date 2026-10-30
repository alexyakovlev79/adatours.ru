import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleLocalizationSlots,sourceFromContentEntry,localizeContentEntry,getLocalizedCollection } from '../../src/lib/i18n/content-adapter.mjs';
import { sourceBlockEvidence,translationApprovalHash } from '../../src/lib/i18n/content-overlay.mjs';
const base={id:'ru:tour_alpha',data:{
 id:'tour_alpha',locale:'ru',slug:'alpha',status:'approved',title:'Путешествие по Рио',lead:'Красивое место',priceFrom:1908,
 currency:'USD',priceBasis:'per_person',priceNote:'Цена на человека',
 countries:['country_brazil'],searchAliases:['Тур по Рио','Rio Tour 4 days'],hero:{src:'/media/hero.webp',alt:'Пляж Рио'},
 itinerary:[{day:1,title:'Первый день',text:'Встреча с гидом',places:['Рио-де-Жанейро']}],
 included:['Трансфер'],notIncluded:['Перелет'],dates:[],route:['Рио-де-Жанейро'],notes:[]
 },body:'Наша поездка'};
function fixture(){
 const slots=visibleLocalizationSlots(base,'tour');
 const map={schemaVersion:1,entityId:'tour_alpha',entityType:'tour',
   paths:slots.map((s,i)=>({path:s.path,field:s.field,blockId:'stable.semantic.'+i,
     dependsOn:s.path==='/priceNote'?['/facts/priceFrom']:[]}))};
 const source=sourceFromContentEntry(base,'tour',map);
 const english=slots.map(s=>({path:s.path,text:{
  '/title':'Rio Journey','/lead':'A wonderful destination','/priceNote':'Price per person',
  '/hero/alt':'Rio beach','/itinerary/0/title':'First day','/itinerary/0/text':'Meet your guide',
  '/itinerary/0/places/0':'Rio de Janeiro','/route/0':'Rio de Janeiro',
  '/included/0':'Transfer','/notIncluded/0':'Flights','/__body':'Our journey'
 }[s.path]}));
 assert.ok(english.every(s=>s.text));
 const overlay={schemaVersion:1,entityId:'tour_alpha',entityType:'tour',locale:'en',sourceLocale:'ru',
  blocks:source.blocks.map((s,i)=>{
   const x={blockId:s.blockId,field:s.field,text:english[i].text,state:'approved',
     ...sourceBlockEvidence(source,s.blockId),provenance:{kind:'ai_translation',model:'test',runId:'unit-20261029'}};
   x.approval={reviewerId:'test',reviewedAt:'2026-10-29T10:00:00.000Z',checks:{meaning:true,voice:true,facts:true},
      approvedContentHash:translationApprovalHash(x)};
   return x;
  })};
 return {map,overlay};
}
test('inspect gives all visible slots including photo alt and itinerary',()=>{
 const p=visibleLocalizationSlots(base,'tour').map(x=>x.path);
 assert.ok(p.includes('/hero/alt'));assert.ok(p.includes('/itinerary/0/text'));
 assert.ok(p.includes('/__body'));assert.ok(p.includes('/priceNote'));
});
test('adapter keeps shared price, ID, media and paths while translating all visitor fields',()=>{
 const {map,overlay}=fixture();
 const out=localizeContentEntry(base,'tour',map,overlay);
 assert.equal(out.data.title,'Rio Journey');
 assert.equal(out.data.priceFrom,1908);assert.equal(out.data.currency,'USD');
 assert.equal(out.data.priceBasis,'per_person');assert.equal(out.data.hero.src,'/media/hero.webp');
 assert.equal(out.data.hero.alt,'Rio beach');
 assert.equal(out.data.itinerary[0].text,'Meet your guide');
 assert.equal(out.data.itinerary[0].places[0],'Rio de Janeiro');
 assert.equal(out.data.locale,'en');
 assert.deepEqual(out.data.searchAliases,['Rio Tour 4 days']);
 assert.deepEqual(base.data.searchAliases,['Тур по Рио','Rio Tour 4 days']);
 assert.equal(base.data.title,'Путешествие по Рио');
});
test('updated shared price invalidates only price-dependent block, no stale display',()=>{
 const {map,overlay}=fixture();
 const updated=structuredClone(base);updated.data.priceFrom=2500;
 assert.throws(()=>localizeContentEntry(updated,'tour',map,overlay),/Locale overlay cannot be assembled/);
});
test('missing segment mapping blocks EN completely',()=>{
 const {map,overlay}=fixture();map.paths.pop();
 assert.throws(()=>localizeContentEntry(base,'tour',map,overlay),/Unmapped visible text/);
});
test('a missing approved overlay cannot render Russian fallback',()=>{
 const {map}=fixture();
 assert.throws(()=>localizeContentEntry(base,'tour',map,null),/Locale overlay cannot be assembled/);
});
test('changed text and structural insertion must rebuild the stable block map',()=>{
 const {map,overlay}=fixture();const modified=structuredClone(base);modified.data.itinerary.unshift({day:0,title:'Прибытие',text:'Вечер'});
 assert.throws(()=>localizeContentEntry(modified,'tour',map,overlay));
});
test('resolver skips absent EN entities while RU collection retains source',async()=>{
 const {map,overlay}=fixture();
 const read=async()=>[base];
 assert.equal((await getLocalizedCollection('tours','ru',read)).length,1);
 assert.equal((await getLocalizedCollection('tours','en',read,async()=>null)).length,0);
 const en=await getLocalizedCollection('tours','en',read,async()=>({blockMap:map,overlay}));
 assert.equal(en.length,1);assert.equal(en[0].data.title,'Rio Journey');
});
test('EN resolver and map must not accept unsafe/mismatched identity',()=>{
 const {map,overlay}=fixture();
 map.entityId='other';
 assert.throws(()=>localizeContentEntry(base,'tour',map,overlay),/Block map identity/);
});
