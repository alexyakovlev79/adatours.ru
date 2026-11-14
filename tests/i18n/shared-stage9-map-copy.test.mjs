import test from 'node:test';
import assert from 'node:assert/strict';
import {translateUiText} from '../../src/lib/i18n/shared-ui-locale.mjs';
const labels=new Map([
 ['Место и куда поехать дальше','The place and where to go next'],
 ['Экскурсия на карте','Excursion map'],
 ['Маршрут путешествия','Travel itinerary'],
 ['Место на карте','Location on the map'],
]);
test('new English Google Maps headings and accessibility labels use the shared dictionary',()=>{
 for(const [source,english] of labels){
  assert.equal(translateUiText(source,'en'),english);
  assert.equal(translateUiText(source,'ru'),source);
 }
});
