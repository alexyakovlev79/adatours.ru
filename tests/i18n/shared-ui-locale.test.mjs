import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedUiLocale, translateUiText, sharedInterestName } from '../../src/lib/i18n/shared-ui-locale.mjs';

const staging = {
  EN_SHARED_CONTENT:'1', EN_STAGING_PAGES:'1', SITE_LOCALE:'en',
  SITE_ORIGIN:'https://alexyakovlev79.github.io', SITE_BASE:'/adatours-en/', PUBLIC_EN_RELEASE:'0',
};

test('English shared UI requires both the content switch and the dedicated staging host', () => {
  assert.equal(sharedUiLocale(staging),'en');
  for (const env of [{},{...staging,EN_SHARED_CONTENT:'0'},{...staging,SITE_LOCALE:'ru'},
    {...staging,SITE_ORIGIN:'https://adatours.ru'},{...staging,PUBLIC_EN_RELEASE:'1'}]) {
    assert.equal(sharedUiLocale(env),'ru');
  }
});

test('existing copy is used and unknown content keeps its Russian fallback', () => {
  assert.equal(translateUiText('Туры','en'),'Tours');
  assert.equal(translateUiText('  Оставить заявку\n','en'),'  Send an enquiry\n');
  assert.equal(translateUiText('Содержательная программа ещё не переведена','en'),'Содержательная программа ещё не переведена');
  assert.equal(translateUiText('от непереведённого содержательного текста','en'),'от непереведённого содержательного текста');
  assert.equal(translateUiText('Туры','ru'),'Туры');
});

test('parameterised interface copy keeps the same counts and only translates known labels', () => {
  assert.equal(translateUiText('Показано 1–12 из 353','en'),'Showing 1–12 of 353');
  assert.equal(translateUiText('Страница 2, текущая','en'),'Page 2, current page');
  assert.equal(translateUiText('от $1,255','en'),'from $1,255');
  assert.equal(translateUiText('4 дня путешествия','en'),'Your journey: 4 days');
  assert.equal(sharedInterestName('theme_nature','Природа','en'),'Nature');
  assert.equal(sharedInterestName('untranslated','Новое направление','en'),'Новое направление');
});
