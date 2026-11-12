import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {translateUiText} from '../../src/lib/i18n/shared-ui-locale.mjs';

const cases={
 'Места экскурсии':'Places visited on this excursion',
 'Можно добавить':'Optional additions',
 'Место':'Place',
 'Направление':'Destination',
 'Экскурсия':'Excursion',
 'Тур':'Tour',
 'Заказать экскурсию':'Enquire about this excursion',
 'Рядом':'Nearby',
 'Получить расчет и адаптировать маршрут под ваши даты':'Get a quote tailored to your travel dates',
 'Индивидуальный тур':'Private tour',
 'Экскурсия в кадрах':'Excursion gallery',
 'Город':'City',
 '1 день':'1 day',
 '2 дня':'2 days',
 '12 дней':'12 days',
 '32 дней · Combined: group and private tours':'32 days · Combined: group and private tours'
};
test('stage9: exact recurring EN UI texts, dynamic duration and RU isolation',()=>{
 for(const [ru,en] of Object.entries(cases)){
  assert.equal(translateUiText(ru,'en'),en,ru);
  assert.equal(translateUiText(ru,'ru'),ru,ru);
 }
});
test('stage9: search map providers use visitor locale, not hard-coded Russian',()=>{
 const script=fs.readFileSync(new URL('../../src/scripts/search-places-map.mjs',import.meta.url),'utf8');
 assert.match(script,/renderYandexMap\([\s\S]{0,160}createPin,locale\)/);
 assert.match(script,/renderGoogleMap\([\s\S]{0,180}createPin,locale\)/);
 assert.doesNotMatch(script,/createPin,'ru'\)/);
});
