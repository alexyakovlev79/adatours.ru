import test from 'node:test';
import assert from 'node:assert/strict';
import {parse,serialize} from 'parse5';
import {translateUiText} from '../../src/lib/i18n/shared-ui-locale.mjs';
import {translateEnglishCatalogueMeta,localizeSharedUiDocument} from '../../src/lib/i18n/shared-ui-html.mjs';
import {translateAuthoredPageText} from '../../src/lib/i18n/page-copy.mjs';
import ui from '../../src/data/i18n/ui-copy.json' with {type:'json'};

test('stage9 port: add only genuinely new UI labels without changing prior translations',()=>{
  assert.equal(translateUiText('Станция','en'),'Station');
  assert.equal(translateUiText('Винодельня','en'),'Winery');
  assert.equal(translateUiText('Остров','en'),'Island');
  assert.equal(translateUiText('Остров','ru'),'Остров');
  assert.equal(ui.messages['stage9.taxonomy.island'].en,'Island');
});

test('stage9 port: catalogue metadata translates exact visitor labels, duration and price prefix',()=>{
  const ru='Пляж · 3 часа · от $150';
  assert.equal(translateEnglishCatalogueMeta(ru,'en'),'Beach · 3 hours · from $150');
  assert.equal(translateEnglishCatalogueMeta(ru,'ru'),ru);
  const doc=parse('<html lang="en"><body><p class="catalog-meta">'+ru+'</p></body></html>');
  assert.ok(localizeSharedUiDocument(doc,{locale:'en'})>0);
  assert.match(serialize(doc),/Beach · 3 hours · from \$150/);
});

test('stage9 port: exact editorial titles have EN copy and no RU source mutation',()=>{
  const ru='Аргентина и Бразилия: От льда к солнцу';
  assert.equal(translateAuthoredPageText(ru,'en'),'Argentina and Brazil: From Ice to Sunshine');
  assert.equal(translateAuthoredPageText(ru,'ru'),ru);
  assert.equal(translateAuthoredPageText('Непереведенный источник','en'),'Непереведенный источник');
});

// Exact residual-source verification includes preflight 43454165962 artifact 14054220441.
// Real latest EN HTML residual inventory (preflight 43439260916):
// 418 enquiry titles + 469 destination excursion headings still had RU prefixes.
test('stage9: source-bound dynamic CTA and destination headings use EN without changing entity names or RU', async()=>{
  const {excursionEnquiryTitle,destinationExcursionsHeading}=await import('../../src/lib/i18n/stage9-contextual-labels.mjs');
  const ex='Bariloche: Circuito Chico and Cerro Campanario';
  const place='Buenos Aires';
  assert.equal(excursionEnquiryTitle(ex,'en'),'Enquire about this excursion: '+ex);
  assert.equal(excursionEnquiryTitle(ex,'ru'),'Заказать экскурсию: '+ex);
  assert.equal(destinationExcursionsHeading(place,'en'),'Excursions: '+place);
  assert.equal(destinationExcursionsHeading(place,'ru'),'Экскурсии: '+place);
  assert.equal(excursionEnquiryTitle('Тигре','ru'),'Заказать экскурсию: Тигре');
});

test('stage9 source-bound residual paragraphs: exact EN copy without altering RU or invented fallback',async()=>{
  const data=(await import('../../src/data/i18n/stage9-residual-copy.en.json',{with:{type:'json'}})).default;
  assert.equal(data.messages.length,621);
  for(const row of data.messages){
    assert.equal(translateAuthoredPageText(row.ru,'en'),row.en);
    assert.equal(translateAuthoredPageText(row.ru,'ru'),row.ru);
    assert.doesNotMatch(row.en,/[А-Яа-яЁё]/u);
  }
});

test('stage9: Anna portrait and noscript image labels are source-bound, RU unchanged',async()=>{
 const {localizeKnownLegacyPhotoHtml}=await import('../../src/lib/i18n/stage9-legacy-photo.mjs');
 const src='https://img.adatours.ru/media/people/anna-avanesova/photo-provided-20261009-v1.jpg';
 const tag='<img src="'+src+'" alt="Портрет Анны Аванесовой, основательницы Ada Tours" title="Анна Аванесова: портрет основательницы Ada Tours">';
 const original='<figure>'+tag+'<noscript>'+tag+'</noscript></figure>';
 const en=localizeKnownLegacyPhotoHtml(original,'en');
 assert.equal(en.includes('Портрет Анны'),false);
 assert.equal(en.includes('портрет основательницы'),false);
 assert.equal(en.split('Portrait of Anna Avanesova, founder of Ada Tours').length,3);
 assert.equal(localizeKnownLegacyPhotoHtml(original,'ru'),original);
 assert.equal(localizeKnownLegacyPhotoHtml(en,'en'),en);
});

test('stage9 one legacy photo is localized in EN ordinary and noscript IMG only, RU untouched',async()=>{
  const {localizeKnownLegacyPhotoHtml}=await import('../../src/lib/i18n/stage9-legacy-photo.mjs');
  const src='https://brasiltours.ru/image/catalog/category/B/N/BN713_10.jpg';
  const tag='<img src="'+src+'" alt="Двое мальчиков на оживленной улице среди прохожих" title="Уличная сцена: улыбающиеся дети у торговых рядов">';
  const ru='<html><body>'+tag+'<noscript>'+tag+'</noscript></body></html>';
  const en=localizeKnownLegacyPhotoHtml(ru,'en');
  assert.equal(en.includes('Двое мальчиков'),false);
  assert.equal(en.includes('Уличная сцена'),false);
  assert.equal(en.split('Two boys on a busy street among pedestrians').length,3);
  assert.equal(localizeKnownLegacyPhotoHtml(ru,'ru'),ru);
  assert.equal(localizeKnownLegacyPhotoHtml(en,'en'),en);
  assert.equal(localizeKnownLegacyPhotoHtml('<img src="https://other.com/other.jpg" alt="Двое мальчиков">','en'),'<img src="https://other.com/other.jpg" alt="Двое мальчиков">');
});

test('stage9: three verified Rio place names translate as whole source-bound labels only',()=>{
 const examples=[
 ['Арки Лапы','Arcos da Lapa'],
 ['Муниципальный театр (Рио-де-Жанейро)','Municipal Theatre of Rio de Janeiro'],
 ['Лестница Селарона','Selarón Steps']
 ];
 for(const [ru,en] of examples){
  assert.equal(translateAuthoredPageText(ru,'en'),en);
  assert.equal(translateAuthoredPageText(ru,'ru'),ru);
  assert.equal(translateAuthoredPageText('Были '+ru,'en'),'Были '+ru);
 }
});

test('stage9 P155 exact text leaves translate all 3 new Rio SEO articles and place previews',()=>{
 const source=[
  ['Арки Лапы в маршруте по Рио','Arcos da Lapa on the Rio itinerary'],
  ['Муниципальный театр в маршруте по Рио','Municipal Theatre on the Rio itinerary'],
  ['Лестница Селарона в маршруте по Рио','Selarón Steps on the Rio itinerary'],
  ['Арки старого акведука Кариока в районе Лапа.',"Arches of the former Carioca Aqueduct in Rio's Lapa district."],
  ['Мозаичная лестница между Лапой и Санта-Терезой.','Mosaic staircase between Lapa and Santa Teresa.'],
  ['Исторический театр на площади Флориану в центре Рио.','Historic theatre on Floriano Square in central Rio.'],
  ['наш 11-дневный VIP-тур на Карнавал','our 11-day VIP Rio Carnival tour'],
  ['. Даты поездки — 5–15 февраля 2027 года.','. The travel dates are 5–15 February 2027.']
 ];
 for(const [ru,en] of source){
  assert.equal(translateAuthoredPageText(ru,'en'),en);
  assert.equal(translateAuthoredPageText(ru,'ru'),ru);
  assert.equal(translateAuthoredPageText('Недругая '+ru,'en'),'Недругая '+ru);
 }
});
