import test from 'node:test';
import assert from 'node:assert/strict';
import {getAstroLocalizedCollection,readPrivatePilotCollections}
 from '../../src/lib/i18n/astro-locale-collection.mjs';
import {PILOT_TOURS} from '../../src/lib/i18n/pilot-html.mjs';

const ru={id:'ru:country_brazil',collection:'countries',data:{
 id:'country_brazil',slug:'brazil',locale:'ru',status:'approved',name:'Бразилия'
},body:'Русский текст'};
const reader=async(_collection,filter)=>filter?[ru].filter(x=>filter(x)):[ru];

test('ordinary RU collection remains an unchanged canonical collection',async()=>{
 const records=await getAstroLocalizedCollection('countries','ru',reader);
 assert.equal(records.length,1);
 assert.equal(records[0],ru);
 assert.equal(records[0].data.locale,'ru');
 assert.equal(records[0].id,'ru:country_brazil');
 assert.equal(records[0].body,'Русский текст');
});
test('the shared Astro reader does not silently assume the EN locale',async()=>{
 await assert.rejects(()=>getAstroLocalizedCollection('countries','es',reader),/Unsupported locale/);
 await assert.rejects(()=>getAstroLocalizedCollection('themes','en',reader,{privatePreview:true,
  env:{EN_PILOT_PREVIEW:'1',SITE_LOCALE:'ru',PUBLIC_EN_RELEASE:'0'}}),/Unsupported collection/);
 await assert.rejects(()=>getAstroLocalizedCollection('countries','en',reader),/locale build blocked|not enabled/i);
});
test('private EN cannot be requested in a normal RU/public build',async()=>{
 for(const env of [
  {},
  {SITE_LOCALE:'ru',EN_PILOT_PREVIEW:'0',PUBLIC_EN_RELEASE:'0'},
  {SITE_LOCALE:'ru',EN_PILOT_PREVIEW:'1',PUBLIC_EN_RELEASE:'1'},
  {SITE_LOCALE:'en',EN_PILOT_PREVIEW:'1',PUBLIC_EN_RELEASE:'0'}
 ]){
  await assert.rejects(()=>readPrivatePilotCollections(reader,{env}),/closed preview flags/);
  await assert.rejects(()=>getAstroLocalizedCollection('countries','en',reader,{
   privatePreview:true,env
  }),/closed preview flags/);
 }
});
test('private collection cannot be read without a genuine Astro record reader',async()=>{
 await assert.rejects(()=>getAstroLocalizedCollection('countries','ru',null),/reader required/);
 await assert.rejects(()=>readPrivatePilotCollections(null,{env:{
  EN_PILOT_PREVIEW:'1',SITE_LOCALE:'ru',PUBLIC_EN_RELEASE:'0'
 }}),/reader required/);
});
test('pilot only covers the three confirmed Tour identities',()=>{
 assert.deepEqual(PILOT_TOURS.map(x=>x.id),[
  'tour_brazil_rio_four_days',
  'tour_chile_easter_island_3_days_2027',
  'tour_colombia_essential_5_days'
 ]);
});
