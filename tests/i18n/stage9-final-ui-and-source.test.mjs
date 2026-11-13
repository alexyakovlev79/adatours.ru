import test from 'node:test';
import assert from 'node:assert/strict';
import {parse,serialize} from 'parse5';
import {localizeSharedUiDocument,translateEnglishCatalogueMeta} from '../../src/lib/i18n/shared-ui-html.mjs';
import {translateUiText} from '../../src/lib/i18n/shared-ui-locale.mjs';
import {uiText,validateUiCatalog} from '../../src/lib/i18n/messages.mjs';
import fs from 'node:fs';

test('stage 9: confirmed category labels and RU originals',()=>{
 assert.deepEqual(validateUiCatalog(),[]);
 for(const [ru,en] of [['Остров','Island'],['Городок','Town'],['Природная территория','Natural area'],
 ['Археологический объект','Archaeological site'],['Национальный парк','National park'],
 ['Религиозный объект','Religious site'],['Все туры с этой экскурсией','All tours featuring this excursion'],
 ['Все туры с возможностью посетить это место','Tours with an optional visit to this destination'],
 ['Актуальные туры','Current tours']]){
  assert.equal(translateUiText(ru,'en'),en,ru);
  assert.equal(translateUiText(ru,'ru'),ru,ru);
 }
});
test('stage 9: catalogue metadata ONLY localizes known display labels',()=>{
 assert.equal(translateEnglishCatalogueMeta('Brazil · Город'), 'Brazil · City');
 assert.equal(translateEnglishCatalogueMeta('Ecuador · Природная территория'), 'Ecuador · Natural area');
 assert.equal(translateEnglishCatalogueMeta('Место · Brazil'), 'Place · Brazil');
 assert.equal(translateEnglishCatalogueMeta('12 days · Частный'), '12 days · Private');
 assert.equal(translateEnglishCatalogueMeta('Brazil + Chile · 13 days · от $8 945 · Group tour'),
  'Brazil + Chile · 13 days · from $8 945 · Group tour');
 assert.equal(translateEnglishCatalogueMeta('1,5–2 часа'),'1.5–2 hours');
 assert.equal(translateEnglishCatalogueMeta('2,5 часа'),'2.5 hours');
 assert.equal(translateEnglishCatalogueMeta('Mexico · Город','ru'),'Mexico · Город');
 assert.equal(translateEnglishCatalogueMeta('Гватемала и Белиз · отель'),'Гватемала и Белиз · отель');
});
test('stage 9: catalogue-only metadata, links and SEO chrome, no random prose changes',()=>{
 const doc=parse('<!doctype html><html lang="en"><head></head><body>'+
  '<p class="eyebrow">Brazil · Город</p>'+
  '<p class="eyebrow">12 days · Частный · от $9 450</p>'+
  '<a class="catalog-more__link"><span>Buenos Aires: все туры</span></a>'+
  '<p>Стоимость от $9 450 за тур не меняется</p><p>Brazil · Город</p>'+
  '<span class="band-card__eyebrow">Остров</span></body></html>');
 localizeSharedUiDocument(doc,{locale:'en'});
 const output=serialize(doc);
 assert.match(output,/Brazil · City/);
 assert.match(output,/12 days · Private · from \$9 450/);
 assert.match(output,/Buenos Aires: all tours/);
 assert.match(output,/Стоимость от \$9 450 за тур не меняется/);
 assert.match(output,/<p>Brazil · Город<\/p>/);
 assert.match(output,/band-card__eyebrow">Island/);
});
test('stage 9: SEO article expansion control preserves RU source and displays EN chrome',()=>{
 const source=fs.readFileSync(new URL('../../src/components/editorial/SeoGeoSection.astro',import.meta.url),'utf8');
 assert.match(source,/const toggleLabel = isEnglish \? 'Read more' : article\.buttonLabel/);
 assert.match(source,/aria-label=\{toggleLabel\}/);
 assert.match(source,/data-seo-geo-label>\{toggleLabel\}/);
});
