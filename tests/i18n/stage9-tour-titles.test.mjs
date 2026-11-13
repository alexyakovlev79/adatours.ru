import test from 'node:test';
import assert from 'node:assert/strict';
import {parse,serialize} from 'parse5';
import source from '../../src/data/i18n/page-copy.en.json' with {type:'json'};
import {translateAuthoredPageText,localizeAuthoredPageDocument} from '../../src/lib/i18n/page-copy.mjs';
const expected=[
'Аргентина и Бразилия: От льда к солнцу',
'Тур в Аргентину на 10 дней: Буэнос-Айрес, Патагония и Игуасу',
'Тур в Аргентину на 12 дней: Буэнос-Айрес, Патагония, Ушуайя и Игуасу',
'Аргентина, Чили и Боливия: Патагония и Уюни за 12 дней',
'VIP-тур по Аргентине на 11 дней: Патагония, Ушуайя и водопады Игуасу',
'Бразилия и Аргентина Фан',
'Тур в Бразилию и Аргентину: Водопады Игуасу и ледники Патагонии',
'Тур в Бразилию и Аргентину: Рио-де-Жанейро, Фоз де Игуасу, Буэнос Айрес',
'Круиз через мыс Горн и пролив Дрейка в Антарктиду',
'Тур в Центральную Америку: лучшие достопримечательности',
'Чили & Аргентина Делюкс',
'Почувствуйте Перу-Эквадор',
'Чудеса Гватемалы & Белиза',
'Роскошная Бразилия и Аргентина',
'Аргентина и Чили: путешествие по Патагонии на 13 дней',
'Перу и Бразилия',
'Тур в Венесуэлу и Колумбию на 12 дней (групповой с русским гидом)'
];
test('stage 9: the 17 observed multi-country H1 fallbacks have exact English text',()=>{
 for(const ru of expected){
  const row=source.messages.find(x=>x.ru===ru);
  assert.ok(row,ru);
  assert.ok(row.en.trim());
  assert.doesNotMatch(row.en,/[А-Яа-яЁё]/u);
  assert.equal(translateAuthoredPageText(ru,'en'),row.en);
  assert.equal(translateAuthoredPageText(ru,'ru'),ru);
 }
 const doc=parse('<!doctype html><html lang="en"><head><title>Тур в Аргентину на 10 дней: Буэнос-Айрес, Патагония и Игуасу</title></head><body><h1>Тур в Аргентину на 10 дней: Буэнос-Айрес, Патагония и Игуасу</h1></body></html>');
 localizeAuthoredPageDocument(doc);
 const result=serialize(doc);
 assert.match(result,/<h1>10-Day Argentina Tour: Buenos Aires, Patagonia and Iguazú<\/h1>/);
 assert.match(result,/<title>Тур в Аргентину на 10 дней/);
});
