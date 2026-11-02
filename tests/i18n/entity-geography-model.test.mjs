import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTourGeographyModel,buildExcursionGeographyModel} from '../../src/lib/i18n/entity-geography-model.mjs';

const country={data:{id:'country_brazil',locale:'ru',name:'Бразилия',slug:'brazil'}};
const rio={data:{id:'destination_brazil_rio',countryId:'country_brazil',
 locale:'ru',name:'Рио-де-Жанейро'}};
const base={id:'tour_test',locale:'ru',countries:['country_brazil'],
 destinations:['destination_brazil_rio','destination_brazil_future'],
 routeDestinations:['destination_brazil_rio']};
test('RU Tour relation model preserves current published/unsupplied place behavior',()=>{
 const output=buildTourGeographyModel(base,{
  countries:[country],destinations:[rio],
  plannedDestinations:new Map([['destination_brazil_future',{name:'Будущее место'}]]),
  countryUrl:e=>'/'+e.data.slug+'/',
  destinationUrl:()=>'/brazil/place/rio-de-janeiro/'
 });
 assert.deepEqual(output.countryNames,['Бразилия']);
 assert.equal(output.mainCountries[0].entry,country);
 assert.equal(output.mainCountries[0].href,'/brazil/');
 assert.equal(output.routeDestinations[1].name,'Будущее место');
 assert.equal(output.routeDestinations[1].href,undefined);
 assert.deepEqual(output.mainPlaces.map(x=>x.id),['destination_brazil_rio']);
 assert.deepEqual(output.optionalPlaces.map(x=>x.id),['destination_brazil_future']);
});
test('EN Tour links use only explicit English records, never planned RU place names',()=>{
 const en={...base,locale:'en'};
 const c={data:{...country.data,locale:'en',name:'Brazil'},url:'/en-pilot-private/country/brazil/'};
 const p={data:{...rio.data,locale:'en',name:'Rio de Janeiro'},url:'/en-pilot-private/place/rio-de-janeiro/'};
 const out=buildTourGeographyModel(en,{countries:[c],destinations:[p],
  strictLocalized:true,plannedDestinations:new Map([['destination_brazil_future',{name:'Русское место'}]]),
  countryUrl:e=>e.url,destinationUrl:e=>e.url});
 assert.deepEqual(out.countryNames,['Brazil']);
 assert.equal(out.mainCountries[0].name,'Brazil');
 assert.equal(out.mainPlaces.length,1);
 assert.equal(out.optionalPlaces.length,0);
 assert.equal(out.mainPlaces[0].href,'/en-pilot-private/place/rio-de-janeiro/');
 assert.throws(()=>buildTourGeographyModel(en,{countries:[country],destinations:[p],strictLocalized:true}),/Unapproved locale/);
 assert.throws(()=>buildTourGeographyModel(en,{countries:[],destinations:[p],strictLocalized:true}),/Untranslated main Country/);
});
test('RU Excursion retains the exact canonical destination fallback and ordering',()=>{
 const excursion={locale:'ru',destination:'destination_brazil_rio',
  relatedDestinations:['destination_brazil_future','destination_brazil_rio'],
  destinationName:'Обзорная экскурсия'};
 const x=buildExcursionGeographyModel(excursion,{destinations:[rio]});
 assert.equal(x.destinationName,'Рио-де-Жанейро');
 assert.deepEqual(x.linkedEntries,[rio]);
 const y=buildExcursionGeographyModel({...excursion,destination:'destination_brazil_future'},
  {destinations:[],plannedDestinations:new Map([['destination_brazil_future',{name:'Будущее место'}]])});
 assert.equal(y.destinationName,'Будущее место');
 assert.equal(y.linkedEntries.length,0);
});
test('EN Excursion never publishes a Russian fallback or duplicate translated links',()=>{
 const enExcursion={locale:'en',destination:'destination_brazil_rio',
  relatedDestinations:['destination_brazil_rio','destination_brazil_future'],
  destinationName:'Rio de Janeiro'};
 const p={data:{...rio.data,locale:'en',name:'Rio de Janeiro'},url:'/en-pilot-private/place/rio-de-janeiro/'};
 const x=buildExcursionGeographyModel(enExcursion,{destinations:[p],strictLocalized:true,
  destinationUrl:e=>e.url});
 assert.equal(x.destinationName,'Rio de Janeiro');
 assert.equal(x.linkedPlaces.length,1);
 assert.equal(x.linkedPlaces[0].href,p.url);
 assert.throws(()=>buildExcursionGeographyModel({...enExcursion,destination:'destination_brazil_future',
  destinationName:'Русский'}, {strictLocalized:true}),/Untranslated/);
 assert.throws(()=>buildExcursionGeographyModel(enExcursion,{destinations:[rio],strictLocalized:true}),/Unapproved locale/);
});
