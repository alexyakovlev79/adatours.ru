import test from 'node:test';
import assert from 'node:assert/strict';
import {translateAuthoredPageText} from '../../src/lib/i18n/page-copy.mjs';

test('Stage 9: strict entity receipt matches exact EN-rendered H1 and never random heading',()=>{
 const ru='Тур в Аргентину на 12 дней: Буэнос-Айрес, Патагония, Ушуайя и Игуасу';
 const accepted=translateAuthoredPageText(ru,'en');
 assert.notEqual(accepted,ru);
 assert.equal(accepted,'12-Day Argentina Tour: Buenos Aires, Patagonia, Ushuaia and Iguazú');
 assert.notEqual('A journey in Argentina',accepted);
 assert.equal(translateAuthoredPageText('Неизвестный тур','en'),'Неизвестный тур');
});
