import test from 'node:test';
import assert from 'node:assert/strict';
import {localizeNoscriptMediaHtml} from '../../src/lib/i18n/media-copy.mjs';
import {translateUiText} from '../../src/lib/i18n/shared-ui-locale.mjs';

test('stage9: known image in no-JS fallback uses its approved source-bound EN alt',()=>{
 const html='<noscript><img src="https://img.adatours.ru/media/catalog/tury/hero-enhanced-20260930.webp" alt="Панорама Рио-де-Жанейро с заливом, горой Сахарная Голова и городской застройкой, Бразилия"></noscript>';
 const result=localizeNoscriptMediaHtml(html,{locale:'en'});
 assert.match(result,/alt="Panorama of Rio de Janeiro, Guanabara Bay, Sugarloaf Mountain and the city, Brazil"/);
 assert.doesNotMatch(result,/[А-Яа-яЁё]/u);
 assert.equal(localizeNoscriptMediaHtml(html,{locale:'ru'}),html);
});
test('stage9: no-JS fallback never reuses one ALT for a different image or outside noscript',()=>{
 const source='<img src="https://img.adatours.ru/media/catalog/tury/hero-enhanced-20260930.webp" alt="Русский текст">'+
  '<noscript><img src="/media/unknown-asset.webp" alt="Русский текст">'+
  '<img src="/media/catalog/tury/hero-enhanced-20260930.webp" alt="Русский текст"></noscript>';
 const output=localizeNoscriptMediaHtml(source);
 assert.match(output,/^<img[^>]+alt="Русский текст"/);
 assert.match(output,/src="\/media\/unknown-asset.webp" alt="Русский текст"/);
 assert.match(output,/src="\/media\/catalog\/tury\/hero-enhanced-20260930.webp" alt="Panorama of Rio de Janeiro/);
});
test('stage9: expedition type is localized with the original RU preserved',()=>{
 assert.equal(translateUiText('Экспедиция','en'),'Expedition');
 assert.equal(translateUiText('Экспедиция','ru'),'Экспедиция');
});
