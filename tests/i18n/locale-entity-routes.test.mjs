import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocaleEntityRouteIndex,createPrivatePilotRouteIndex,
 privatePilotRouteIndex,privateRouteForId,privateRouteForRecord}
 from '../../src/lib/i18n/locale-entity-routes.mjs';

test('private locale routes preserve 21 stable identities without guessing slugs',()=>{
 assert.equal(privatePilotRouteIndex.size,21);
 assert.equal(privateRouteForId('country_chile'),'/en-pilot-private/country/chile/');
 assert.equal(privateRouteForId('destination_chile_ostrov_pashi'),'/en-pilot-private/place/easter-island/');
 assert.equal(privateRouteForId('destination_colombia_bogota'),'/en-pilot-private/place/bogota/');
 assert.equal(privateRouteForId('destination_colombia_kartahena'),'/en-pilot-private/place/cartagena/');
 assert.equal(privateRouteForId('tour_colombia_essential_5_days'),'/en-pilot-private/tour/colombia-essential-5-days/');
 assert.equal(privateRouteForId('excursion_source_siti_tur_v_bogote'),'/en-pilot-private/excursion/bogota-city-tour/');
 assert.equal(new Set(privatePilotRouteIndex.entries().map(x=>x.path)).size,21);
 assert.equal(privatePilotRouteIndex.findByPath('/en-pilot-private/country/colombia/').id,'country_colombia');
 assert.equal(privateRouteForRecord({locale:'en',id:'destination_colombia_bogota'}),'/en-pilot-private/place/bogota/');
 assert.throws(()=>privateRouteForId('destination_not_translated'),/unknown stable ID/);
 assert.throws(()=>privateRouteForRecord({locale:'ru',id:'country_chile'}),/verified EN record/);
});

test('portable locale route index supports country-first paths and refuses collisions',()=>{
 const rows=[
  {id:'country_brazil',kind:'country',path:'/brazil/'},
  {id:'destination_brazil_rio',kind:'destination',path:'/brazil/place/rio-de-janeiro/'},
  {id:'tour_brazil_rio_four_days',kind:'tour',path:'/brazil/tour/rio-de-janeiro-four-days/'}
 ];
 const index=createLocaleEntityRouteIndex(rows,{locale:'en'});
 assert.equal(index.size,3);
 assert.equal(index.pathForId(rows[2].id),rows[2].path);
 assert.throws(()=>createLocaleEntityRouteIndex([...rows,rows[0]],{locale:'en'}),/Duplicate/);
 assert.throws(()=>createLocaleEntityRouteIndex([...rows,{id:'country_chile',kind:'country',path:'/brazil/'}],{locale:'en'}),/Duplicate/);
 assert.throws(()=>createLocaleEntityRouteIndex([{id:'country_chile',kind:'country',path:'//evil/'}],{locale:'en'}),/Unsafe/);
 assert.throws(()=>createLocaleEntityRouteIndex([{id:'country_chile',kind:'tour',path:'/chile/'}],{locale:'en'}),/Bad identity/);
 assert.throws(()=>index.pathForId('country_chile'),/unknown stable ID/);
});

test('private route publication and missing manifest gates cannot be bypassed',()=>{
 const source={
  publicationAuthorized:false,status:'prepared_for_private_preview',
  entries:Array.from({length:11},(_,i)=>({id:'excursion_test_'+i,slug:'test-'+i}))
 };
 const geo={publicationAuthorized:false,status:'prepared_for_private_visual_pilot',
  items:[{id:'country_brazil',kind:'country',slug:'brazil'},
   {id:'country_chile',kind:'country',slug:'chile'},
   {id:'country_colombia',kind:'country',slug:'colombia'},
   {id:'destination_brazil_rio',kind:'destination',slug:'rio-de-janeiro'},
   {id:'destination_chile_ostrov_pashi',kind:'destination',slug:'easter-island'},
   {id:'destination_colombia_bogota',kind:'destination',slug:'bogota'},
   {id:'destination_colombia_kartahena',kind:'destination',slug:'cartagena'}]};
 assert.throws(()=>createPrivatePilotRouteIndex({excursionManifest:{...source,publicationAuthorized:true},geoManifest:geo}),/Publication gate/);
 assert.throws(()=>createPrivatePilotRouteIndex({excursionManifest:source,geoManifest:{...geo,items:geo.items.slice(1)}}),/complete private pilot/);
});
