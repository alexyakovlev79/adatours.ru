import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { uiText, validateUiCatalog } from '../../src/lib/i18n/messages.mjs';
import { translateUiText, sharedCountryName } from '../../src/lib/i18n/shared-ui-locale.mjs';

const file = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');

test('stage 1 translations use typed placeholders and retain RU UI strings', () => {
  assert.deepEqual(validateUiCatalog(), []);
  const examples = [
    ['ui.view', 'Смотреть', 'View'],
    ['ui.photos', 'Фотографии', 'Photos'],
    ['ui.collapse', 'Свернуть', 'Collapse'],
    ['geo.day', 'День', 'Day'],
    ['geo.days', 'Дни', 'Days'],
    ['reviews.previous', 'Предыдущие отзывы', 'Previous reviews'],
    ['reviews.next', 'Следующие отзывы', 'Next reviews'],
  ];
  for (const [key, ru, en] of examples) {
    assert.equal(uiText('ru', key), ru);
    assert.equal(uiText('en', key), en);
    assert.equal(translateUiText(ru, 'en'), en);
    assert.equal(translateUiText(ru, 'ru'), ru);
  }
  assert.equal(uiText('en','multi.addTo',{countries:'Brazil + Chile'}),'Add a country to Brazil + Chile');
  assert.equal(uiText('ru','multi.addTo',{countries:'Бразилия + Чили'}),'Добавить страну к сочетанию Бразилия + Чили');
  assert.equal(uiText('en','multi.addSecond',{country:'Brazil'}),'Add a second country to Brazil');
  assert.equal(uiText('en','geo.errorCode',{code:'GOOGLE_INIT'}),'The map is temporarily unavailable. Error code: GOOGLE_INIT.');
  assert.equal(uiText('en','reviews.count',{count:12}),'Reviews: 12');
  assert.equal(uiText('en','reviews.sourceAria',{author:'Anna'}),'Review source: Anna');
});

test('stage 1 reuses existing country names and keeps canonical Russian copy', () => {
  assert.equal(sharedCountryName('brazil','Бразилия','en'),'Brazil');
  assert.equal(sharedCountryName('brazil','Бразилия','ru'),'Бразилия');
  assert.match(file('src/components/catalog/MultiCountrySelector.astro'), /sharedCountryName\(country\.slug, country\.name, uiLocale\)/);
  assert.doesNotMatch(file('src/components/catalog/MultiCountrySelector.astro'), /translatedNames\.get\(country\.slug\)/);
  assert.match(file('src/components/catalog/MultiCountryRelated.astro'), /row\.countries\.map\(nameFor\)/);
});

test('stage 1 client labels use keyed localisation after user actions', () => {
  const menu=file('src/scripts/multi-country-menu.ts');
  const map=file('src/scripts/geo-map-client.mjs');
  const places=file('src/scripts/search-places-map.mjs');
  const phone=file('src/components/forms/PhoneField.astro');
  const seo=file('src/components/editorial/SeoGeoSection.astro');
  assert.match(menu, /uiText\(locale,'multi\.addTo'/);
  assert.match(menu, /uiText\(locale,'multi\.addSecond'/);
  assert.match(map, /uiText\(uiLocale\(\),'geo\.errorCode'/);
  assert.match(map, /uiText\(uiLocale\(\),'map\.showDescription'/);
  assert.match(places, /uiText\(locale,'map\.showPlace'/);
  assert.match(phone, /uiText\(sharedUiLocale\(\),'phone\.chooseCountry'/);
  assert.match(seo, /translateUiText\('Свернуть'/);
});

test('stage 1 common components bind shared chrome without touching user content', () => {
  assert.match(file('src/components/global/CookieNotice.astro'), /uiText\(uiLocale,'cookie\.message'\)/);
  assert.match(file('src/components/global/Breadcrumbs.astro'), /uiText\(uiLocale,'nav\.breadcrumbs'\)/);
  assert.match(file('src/components/forms/LeadForm.astro'), /uiText\(uiLocale,'form\.consentIntro'\)/);
  assert.match(file('src/components/editorial/DestinationBand.astro'), /translateUiText\('Смотреть'\)/);
  assert.match(file('src/components/proof/ReviewCarousel.astro'), /uiText\(uiLocale,'reviews\.title'\)/);
  assert.match(file('src/components/tour/VipBadge.astro'), /uiText\(sharedUiLocale\(\),'tour\.vipAria'\)/);
  assert.equal(translateUiText('Неизвестное описание путешествия','en'),'Неизвестное описание путешествия');
});
