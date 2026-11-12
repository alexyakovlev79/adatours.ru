import test from 'node:test';
import assert from 'node:assert/strict';
import {createEnglishSeoContext,englishSeoMetadata} from '../../src/lib/i18n/seo-metadata.mjs';
import {formatSeoMoney} from '../../src/lib/seo-price-meta.mjs';
import {russianFallbackHtml} from '../../scripts/i18n/ru-fallback.mjs';

const fixture=()=>{
 const countries=[
  {id:'country_brazil',slug:'brazil',name:'Бразилия',locale:'ru',status:'approved'},
  {id:'country_peru',slug:'peru',name:'Перу',locale:'ru',status:'approved'},
 ];
 const destinations=[
  {id:'destination_brazil_rio',slug:'rio-de-janeiro',name:'Rio de Janeiro',locale:'ru',countryId:'country_brazil',status:'approved'},
  {id:'destination_peru_lima',slug:'lima',name:'Lima',locale:'ru',countryId:'country_peru',status:'approved'},
 ];
 const tours=[
  {id:'tour_a',slug:'rio-adventure',title:'Rio adventure',locale:'ru',status:'approved',
   routeCountries:['country_brazil'],countries:['country_brazil'],routeDestinations:['destination_brazil_rio'],
   primaryThemes:['theme_culture'],priceFrom:2500,currency:'USD',durationDays:8,
   lead:'A carefully planned trip to Rio de Janeiro.'},
  {id:'tour_b',slug:'brazil-peru',title:'Brazil and Peru discovery',locale:'ru',status:'approved',
   routeCountries:['country_brazil','country_peru'],countries:['country_brazil','country_peru'],
   primaryThemes:['theme_culture'],routeDestinations:['destination_brazil_rio','destination_peru_lima'],
   priceFrom:3000,currency:'USD',durationDays:12,lead:'Explore Brazil and Peru on one journey.'},
  {id:'tour_archive',slug:'former-route',title:'Former route',locale:'ru',status:'archived',
   countries:['country_brazil'],priceFrom:1,currency:'USD',primaryThemes:['theme_culture']},
 ];
 const excursions=[{id:'excursion_rio',slug:'rio-city-tour',title:'Rio city tour',locale:'ru',
  country:'country_brazil',destination:'destination_brazil_rio',
  status:'approved',priceFrom:90,currency:'USD',lead:'Discover Rio de Janeiro.'}];
 const themes=[{id:'theme_culture',slug:'culture-and-history',name:'Культура и история',
  status:'approved',locale:'ru',summary:'Explore history and culture on a journey.'}];
 return createEnglishSeoContext({countries,destinations,tours,excursions,themes,pageSize:1});
};
const meta=(path,ctx=fixture())=>englishSeoMetadata({
 path,title:'Русский заголовок | Ada Tours',description:'Русское описание',
 date:new Date('2026-11-13T12:00:00Z')},ctx);

test('English SEO is language-safe across home, catalogue, countries, places, trips and excursions',()=>{
 const ctx=fixture();
 for(const route of ['/','/country/','/tours/','/places/','/excursions/','/interests/',
   '/brazil/','/brazil/place/rio-de-janeiro/','/brazil/tour/rio-adventure/',
   '/multi-country/tour/brazil-peru/','/brazil/rio-de-janeiro/rio-city-tour/',
   '/interests/culture-and-history/','/interests/culture-and-history/tours/brazil/',
   '/brazil/tour/','/brazil/place/','/brazil/excursion/','/vip/',
   '/multi-country/','/multi-country/brazil_peru/','/multi-country/brazil_peru/interests/culture-and-history/',
   '/about/','/press/','/mice/','/dmc/']){
   const actual=meta(route,ctx);
   assert.ok(actual.title.endsWith(' | Ada Tours'),route);
   assert.ok(actual.description.length>15,route);
   assert.doesNotMatch(actual.title+actual.description,/[\u0400-\u052f]/u,route);
   assert.equal(actual.canonicalPath,route);
   assert.doesNotMatch(actual.title+actual.description,/Russian-speaking|русскоговор|English-speaking guide/i,route);
 }
 assert.match(meta('/brazil/tour/rio-adventure/',ctx).title,/\$2,500/);
 assert.match(meta('/brazil/',ctx).title,/2 tours/);
 assert.match(meta('/multi-country/',ctx).title,/1 multi-country tour/);
 assert.match(meta('/interests/culture-and-history/',ctx).title,/2 tours/);
 assert.doesNotMatch(meta('/brazil/',ctx).title,/former route|3 tours/);
});

test('pagination is page-specific with complete-selection counts and exact range',()=>{
 const ctx=fixture();
 const second=meta('/brazil/tour/page/2/',ctx);
 assert.match(second.title,/Page 2 \| Ada Tours$/);
 assert.match(second.description,/Page 2: items 2–2 of 2\./);
 assert.equal(second.canonicalPath,'/brazil/tour/page/2/');
 assert.match(meta('/multi-country/page/2/',ctx).title,/Page 2/);
 assert.equal(meta('/brazil/tour/',ctx).page,1);
});

test('double-digit catalogue pages retain page-specific metadata and full counts',()=>{
 const base=fixture();
 const tours=Array.from({length:14},(_,i)=>({
   id:'tour_'+i,slug:'brazil-route-'+i,title:'Brazil route '+i,
   locale:'ru',status:'approved',countries:['country_brazil'],
   routeCountries:['country_brazil'],priceFrom:1000+i,currency:'USD',
 }));
 const ctx=createEnglishSeoContext({countries:base.allCountries,
  destinations:base.allDestinations,excursions:base.allExcursions,
  themes:base.allThemes,tours,pageSize:1});
 const tenth=meta('/brazil/tour/page/10/',ctx);
 assert.match(tenth.title,/Page 10 \| Ada Tours$/);
 assert.match(tenth.description,/Page 10: items 10–10 of 14\./);
});

test('one confirmed USD price is formatted in English; mixed currencies never yield a fabricated USD price',()=>{
 const ctx=fixture();
 assert.equal(formatSeoMoney(12500,'USD','en'),'$12,500');
 assert.match(meta('/brazil/tour/',ctx).title,/prices from \$2,500/);
 const mixed=createEnglishSeoContext({countries:ctx.allCountries,
  destinations:ctx.allDestinations,excursions:ctx.allExcursions,themes:ctx.allThemes,
  tours:ctx.allTours.map(tour=>tour.id==='tour_b'?{...tour,priceFrom:500,currency:'EUR'}:tour)});
 assert.doesNotMatch(meta('/brazil/tour/',mixed).title,/\$\d/);
 assert.match(meta('/brazil/tour/rio-adventure/',mixed).title,/\$2,500/);
});

test('shared EN staging keeps OG/Twitter but suppresses canonical, schema and indexing',()=>{
 const head='<meta name="robots" content="noindex, nofollow">'+
  '<link rel="canonical" href="https://alexyakovlev79.github.io/adatours-en/brazil/tour/">'+
  '<meta property="og:locale" content="ru_RU">'+
  '<meta property="og:title" content="Brazil tours | Ada Tours">'+
  '<meta property="og:url" content="https://alexyakovlev79.github.io/adatours-en/brazil/tour/">'+
  '<meta property="og:image" content="https://alexyakovlev79.github.io/adatours-en/media/sample.webp">'+
  '<meta name="twitter:title" content="Brazil tours | Ada Tours">'+
  '<meta name="twitter:image" content="/adatours-en/media/sample.webp">'+
  '<script type="application/ld+json">{}</script>';
 const source='<!doctype html><html lang="en" data-ada-shared-locale="en"><head>'+head+
  '</head><body><h1>Brazil tours</h1></body></html>';
 const path='/brazil/tour/';
 const html=russianFallbackHtml(source,path,new Set([path]),{sharedContent:true});
 assert.match(html,/noindex,nofollow,noarchive,nosnippet/);
 assert.match(html,/og:locale" content="en_US"/);
 assert.match(html,/og:url" content="https:\/\/alexyakovlev79.github.io\/adatours-en\/en\/brazil\/tour\/"/);
 assert.match(html,/og:title" content="Brazil tours \| Ada Tours"/);
 assert.match(html,/twitter:title" content="Brazil tours \| Ada Tours"/);
 assert.match(html,/https:\/\/img.adatours.ru\/media\/sample.webp/);
 assert.doesNotMatch(html,/<link rel="canonical"|application\/ld\+json/);
});
