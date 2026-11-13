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

test('stage9: source-bound EN presentation fixes in shared templates',()=>{
 const cases={
  'Собрать поездку: Antarctic Peninsula':'Plan a trip to Antarctic Peninsula',
  'Собрать путешествие по стране: Chile':'Plan a journey in Chile',
  'Туры через La Paz':'Tours visiting La Paz',
  'К этим турам можно добавить экскурсию в San Andrés':'Add an optional excursion in San Andrés to these tours',
  'San Andrés в фотографиях':'Photos of San Andrés',
  'Mendoza: все туры':'Mendoza: all tours',
  'Buenos Aires: все экскурсии':'Buenos Aires: all excursions',
  'Все туры с этой экскурсией':'All tours including this excursion',
  'Все туры с возможностью посетить это место':'Tours with an optional visit to this place',
  'Место · Brazil':'Place · Brazil',
  'Экскурсия · Chile':'Excursion · Chile',
  'Готовые маршруты · 113 tours':'Available itineraries · 113 tours',
  '12 days · Частный':'12 days · Private',
  'Argentina + Brazil · 12 days · Частный':'Argentina + Brazil · 12 days · Private',
  '12 days · Частный · Optional country visit':'12 days · Private · Optional country visit',
  'Сборный тур':'Group tour',
  'B2B-программа':'B2B programme',
  'Экспедиция':'Expedition',
  '1,5–2 часа':'1.5–2 hours',
  '2,5–3 часа':'2.5–3 hours',
  'Рассчитать программу для нашей группы':'Request a programme for our group',
  'Подробнее о круизе по фьордам Огненной Земли на 5 дней':'More about the five-day cruise through the fjords of Tierra del Fuego',
  'Городок':'Town',
  'Остров':'Island',
  'Маршрут и окрестности':'Route and surroundings',
  'Национальный парк':'National park',
  'Водно-болотная территория':'Wetland',
  'Археологический объект':'Archaeological site',
 };
 for(const [ru,en] of Object.entries(cases)){
  assert.equal(translateUiText(ru,'en'),en,ru);
  assert.equal(translateUiText(ru,'ru'),ru,ru);
 }
 assert.equal(translateUiText('Неизвестная сущность для перевода','en'),'Неизвестная сущность для перевода');
});

test('Stage 9 SEO disclosure buttons: exact EN labels and unchanged RU',()=>{
 const cases=[["Как спланировать 4 дня в Рио","How to plan 4 days in Rio"],["Подробнее о 6-дневном маршруте по Чили","More about the 6-day Chile itinerary"],["Подробнее о 6-часовой экскурсии по Кито","More about the 6-hour Quito excursion"],["Подробнее о VIP-туре в Амазонию на 3 дня","More about the 3-day VIP Amazon tour"],["Подробнее о Карнавале и Игуасу за 8 дней","More about Carnival and Iguazú in 8 days"],["Подробнее о маршруте по Бразилии на 9 дней","More about the 9-day Brazil itinerary"],["Подробнее о недельном туре Рио и Игуасу","More about the week-long Rio and Iguazú tour"],["Подробнее о поездке по 5 странам за 18 дней","More about the 18-day trip through 5 countries"],["Подробнее о поездке по Коста-Рике на 5 дней","More about the 5-day Costa Rica trip"],["Подробнее о природном туре по Бразилии на 8 дней","More about the 8-day nature tour in Brazil"],["Подробнее о путешествии Рио — Игуасу на 8 дней","More about the 8-day Rio–Iguazú journey"],["Подробнее о путешествии по 8 странам","More about the journey through 8 countries"],["Подробнее о турах с 4-часовой экскурсией по Сан-Луису","More about tours including a 4-hour São Luís excursion"],["Подробнее о турах с 6-часовой экскурсией по Кито","More about tours including a 6-hour Quito excursion"],["Подробнее о турах с 8-часовой экскурсией по Кито","More about tours including an 8-hour Quito excursion"],["Подробнее о туре Рио и Бузиос на 8 дней","More about the 8-day Rio and Búzios tour"],["Подробнее о туре по 5 странам","More about the 5-country tour"],["Подробнее об экскурсии по Боготе на 6 часов","More about the 6-hour Bogotá excursion"],["Туры с экскурсией на Корковаду на 4 часа","Tours including a 4-hour Corcovado excursion"],["Туры с экскурсией на Сахарную голову за 4 часа","Tours including a 4-hour Sugarloaf Mountain excursion"]];
 for(const [ru,en] of cases){
  assert.equal(translateUiText(ru,'en'),en,ru);
  assert.equal(translateUiText(ru,'ru'),ru,ru);
 }
});
