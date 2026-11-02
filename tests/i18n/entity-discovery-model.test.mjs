import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCountryDiscoveryModel,buildDestinationDiscoveryModel} from '../../src/lib/i18n/entity-discovery-model.mjs';
const row=(id,locale,other={})=>({data:{id,locale,status:'approved',...other}});
const br=row('country_brazil','ru',{name:'Бразилия'});
const ar=row('country_argentina','ru',{name:'Аргентина'});
const rio=row('destination_brazil_rio','ru',{name:'Рио-де-Жанейро',countryId:br.data.id});
const salvador=row('destination_brazil_salvador','ru',{name:'Салвадор',countryId:br.data.id});
const buenos=row('destination_argentina_buenos','ru',{name:'Буэнос-Айрес',countryId:ar.data.id});
const journey=row('tour_brazil_cities','ru',{
 title:'Города Бразилии',countries:[br.data.id,ar.data.id],
 routeCountries:[br.data.id],destinations:[rio.data.id,salvador.data.id,buenos.data.id],
 routeDestinations:[rio.data.id,salvador.data.id]
});
const optional=row('tour_south_america','ru',{
 title:'Латинская Америка',countries:[ar.data.id,br.data.id],
 routeCountries:[ar.data.id],destinations:[rio.data.id,buenos.data.id],
 routeDestinations:[buenos.data.id]
});
test('country discovery uses canonical main countries and its own places',()=>{
 const model=buildCountryDiscoveryModel(br.data,{
  tours:[journey,optional],destinations:[rio,salvador,buenos]
 });
 assert.deepEqual(model.tours.map(x=>x.data.id),[journey.data.id]);
 assert.deepEqual(model.destinations.map(x=>x.data.id),[rio.data.id,salvador.data.id]);
});
test('destination discovery preserves main/optional and stable co-visitation',()=>{
 const model=buildDestinationDiscoveryModel(rio.data,{
  tours:[journey,optional],destinations:[rio,salvador,buenos]
 });
 assert.deepEqual(model.allRelatedTours.map(x=>x.data.id),[journey.data.id,optional.data.id]);
 assert.deepEqual(model.mainTours.map(x=>x.data.id),[journey.data.id]);
 assert.deepEqual(model.optionalTours.map(x=>x.data.id),[optional.data.id]);
 assert.deepEqual(model.relatedDestinations.map(x=>x.data.id),[buenos.data.id,salvador.data.id]);
});
test('English previews use verified EN names and no unpublished destination fallback',()=>{
 const enCountry=row(br.data.id,'en',{name:'Brazil'});
 const enRio=row(rio.data.id,'en',{name:'Rio de Janeiro',countryId:br.data.id});
 const enTour=row(journey.data.id,'en',{...journey.data,locale:'en',title:'Brazil cities'});
 const model=buildCountryDiscoveryModel(enCountry.data,{tours:[enTour],destinations:[enRio]},
  {strictLocalized:true});
 assert.deepEqual(model.tours.map(x=>x.data.title),['Brazil cities']);
 assert.deepEqual(model.destinations.map(x=>x.data.name),['Rio de Janeiro']);
 const place=buildDestinationDiscoveryModel(enRio.data,{tours:[enTour],destinations:[enRio]},
  {strictLocalized:true});
 assert.equal(place.mainTours[0].data.id,journey.data.id);
 assert.equal(place.relatedDestinations.length,0);
 assert.throws(()=>buildCountryDiscoveryModel(enCountry.data,{tours:[journey]},
  {strictLocalized:true}),/Mixed\/unapproved locale/);
 assert.throws(()=>buildDestinationDiscoveryModel(enRio.data,{destinations:[rio]},
  {strictLocalized:true}),/Mixed\/unapproved locale/);
 assert.throws(()=>buildCountryDiscoveryModel(enCountry.data,{
  destinations:[row('destination_bad','en',{name:'Русское место',countryId:br.data.id})]
 },{strictLocalized:true}),/Untranslated destinations label/);
});
test('duplicate stable IDs and malformed route arrays are rejected',()=>{
 assert.throws(()=>buildCountryDiscoveryModel(br.data,{destinations:[rio,rio]}),/duplicate/);
 assert.throws(()=>buildCountryDiscoveryModel(br.data,{tours:[row('tour_bad','ru',{
  title:'Bad',countries:['country_brazil'],routeCountries:'brazil'
 })]}),/Expected stable ID array/);
});
