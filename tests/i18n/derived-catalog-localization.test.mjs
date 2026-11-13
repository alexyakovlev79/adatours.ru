import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {englishCatalogueHeading,englishCataloguePresentation,
  catalogueDestinationType,englishDestinationTypeCount,catalogueEntityNames
} from '../../src/lib/i18n/catalog-display.mjs';
import {vipTourPriceLabel} from '../../src/lib/vip-tours.mjs';
import {DESTINATION_TYPES,destinationTypeLabel} from '../../src/lib/destination-taxonomy.mjs';

const seo = {
  title:'5 tours in Aconcagua, Argentina (2026-2027) — prices from $2,500 — Page 12 | Ada Tours',
  description:'Browse 5 Ada Tours itineraries in Aconcagua, Argentina. Page 12: items 331–335 of 335.',
};

test('one English presentation translates thousands of variable derived catalogue URLs',()=>{
  const source={
    title:'5 туров в Аконкагуа — страница 12',
    intro:'Выберите поездку на Аконкагуа.',
  };
  const copy=englishCataloguePresentation({seo,source,variant:'vip-country-tours'});
  assert.equal(englishCatalogueHeading(seo.title),'5 tours in Aconcagua, Argentina');
  assert.equal(copy.title,'5 tours in Aconcagua, Argentina');
  assert.equal(copy.intro,seo.description);
  assert.doesNotMatch(copy.title+copy.intro,/[\u0400-\u052f]/u);
});

test('approved English editorial and contextual intro overrides are preserved',()=>{
  const source={title:'Journeys through Latin America',intro:'Start with a journey and adapt it to your dates.',
    editorial:{eyebrow:'Choose a route',text:'Travel through Latin America.'}};
  const global=englishCataloguePresentation({seo,source,variant:'global-tours'});
  assert.equal(global.title,source.title);
  assert.equal(global.intro,source.intro);
  assert.deepEqual(global.editorial,source.editorial);
  const contextual=englishCataloguePresentation({seo,source,variant:'vip-country-tours',
    introOverride:'Compare private itineraries in Argentina.'});
  assert.equal(contextual.intro,'Compare private itineraries in Argentina.');
  const unsafe=englishCataloguePresentation({seo,source,variant:'vip-country-tours',
    introOverride:'Пока нет поездок.'});
  assert.equal(unsafe.intro,seo.description);
});

test('all canonical 36 destination types have stable English labels; RU stays identical',()=>{
  assert.equal(englishDestinationTypeCount,DESTINATION_TYPES.length);
  for(const type of DESTINATION_TYPES){
    const original=destinationTypeLabel(type);
    assert.equal(catalogueDestinationType(type,'ru',original),original);
    const english=catalogueDestinationType(type,'en',original);
    assert.ok(english&&!/[\u0400-\u052f]/u.test(english),type);
  }
  assert.equal(catalogueDestinationType('unknown','en'),'Destination');
});

test('entity-name lookup reuses verified fulltext names and excludes ambiguous names',()=>{
 const en=catalogueEntityNames([
  {_i18n:{sourceName:'Рио-де-Жанейро'},name:'Rio de Janeiro'},
  {_i18n:{sourceName:'Ла-Пас'},name:'La Paz'},
  {_i18n:{sourceName:'Остров'},name:'Island A'},
  {_i18n:{sourceName:'Остров'},name:'Island B'},
 ],name=>name==='Бразилия'?'Brazil':undefined);
 assert.equal(en('Рио-де-Жанейро'),'Rio de Janeiro');
 assert.equal(en('Ла-Пас'),'La Paz');
 assert.equal(en('Остров'),'Остров');
 assert.equal(en('Бразилия'),'Brazil');
});

test('VIP price labels translate only presentation, not amounts or currencies',()=>{
 const tour={priceFrom:12995,currency:'USD'};
 assert.equal(vipTourPriceLabel(tour,'en'),'From $12,995');
 assert.match(vipTourPriceLabel(tour,'ru'),/^от \$12[\s\u00a0]995$/u);
 assert.equal(vipTourPriceLabel({priceFrom:0,currency:'USD'},'en'),'');
});

test('derived templates explicitly use the EN locale, no per-page Russian-only flags',()=>{
 const read=p=>fs.readFileSync(p,'utf8');
 const catalog=read('src/layouts/EntityCatalogLayout.astro');
 assert.match(catalog,/<BaseLayout lang=\{uiLocale\}/);
 assert.match(catalog,/englishCataloguePresentation/);
 assert.match(catalog,/englishSeoMetadata/);
 assert.doesNotMatch(catalog,/lang=\{translatedGlobalCatalogue \? 'en' : 'ru'\}/);
 const combinations=read('src/pages/multi-country/[...selection].astro');
 assert.match(combinations,/<BaseLayout\s+lang=\{uiLocale\}/);
 for(const p of ['src/pages/index.astro','src/pages/country/index.astro',
 'src/pages/interests/index.astro','src/pages/multi-country/index.astro',
 'src/pages/vip/index.astro','src/layouts/ThemeLayout.astro']){
   assert.match(read(p),/<BaseLayout[^>]*lang=\{uiLocale\}/s,p);
 }
});
