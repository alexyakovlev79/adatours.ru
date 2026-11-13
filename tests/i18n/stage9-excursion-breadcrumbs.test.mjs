import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import yaml from 'js-yaml';
import {translateUiText} from '../../src/lib/i18n/shared-ui-locale.mjs';
import dictionary from '../../src/data/i18n/ui-copy.json' with {type:'json'};

const cases=[
  {
    "id": "excursion_buenos_aires_three_hours_russian_group",
    "sourcePath": "src/content/excursions/buenos-aires-three-hours-russian-group.md",
    "sourceTitle": "Буэнос-Айрес: обзорная экскурсия на 3 часа в группе",
    "englishTitle": "Buenos Aires: Three-Hour Group Sightseeing Tour"
  },
  {
    "id": "excursion_argentina_lujan_three_wineries_lunch",
    "sourcePath": "src/content/excursions/argentina-lujan-three-wineries-lunch.md",
    "sourceTitle": "Лухан-де-Куйо: 3 винодельни с дегустациями и обедом",
    "englishTitle": "Luján de Cuyo: Three Wineries with Tastings and Lunch"
  },
  {
    "id": "excursion_uyuni_incahuasi_tahua_salt_flat_lunch",
    "sourcePath": "src/content/excursions/uyuni-incahuasi-tahua-salt-flat-lunch.md",
    "sourceTitle": "Уюни на внедорожниках: Инкауаси, Тахуа и обед на солончаке",
    "englishTitle": "Uyuni by 4×4: Incahuasi, Tahua and Lunch on the Salt Flat"
  },
  {
    "id": "excursion_rio_favela_community_four_hours",
    "sourcePath": "src/content/excursions/favela-community-four-hours.md",
    "sourceTitle": "Фавелы Рио: знакомство с жизнью сообществ за 4 часа",
    "englishTitle": "Rio Favelas: Four Hours Exploring Community Life"
  },
  {
    "id": "excursion_rio_sugarloaf_cable_car_four_hours",
    "sourcePath": "src/content/excursions/sugarloaf-cable-car-four-hours.md",
    "sourceTitle": "Сахарная Голова: подъем по канатной дороге за 4 часа",
    "englishTitle": "Sugarloaf Mountain: Four-Hour Cable Car Excursion"
  },
  {
    "id": "excursion_sao_luis_city_tour_four_hours",
    "sourcePath": "src/content/excursions/obzornaya-ekskursiya-po-san-luisu-4-chasa.md",
    "sourceTitle": "Обзорная экскурсия по Сан-Луису на 4 часа",
    "englishTitle": "São Luís: Four-Hour City Tour"
  },
  {
    "id": "excursion_sao_paulo_city_tour_six_hours",
    "sourcePath": "src/content/excursions/obzornaya-ekskursiya-po-san-paulu-6-chasov.md",
    "sourceTitle": "Обзорная экскурсия по Сан-Паулу на 6 часов",
    "englishTitle": "São Paulo: Six-Hour City Tour"
  },
  {
    "id": "excursion_sao_paulo_historical_four_hours",
    "sourcePath": "src/content/excursions/sao-paulo-historical-four-hours.md",
    "sourceTitle": "Исторический Сан-Паулу: экскурсия на 4 часа",
    "englishTitle": "Historic São Paulo: Four-Hour Tour"
  },
  {
    "id": "excursion_sao_paulo_paulista_four_hours",
    "sourcePath": "src/content/excursions/sao-paulo-paulista-four-hours.md",
    "sourceTitle": "Сан-Паулу и авенида Паулиста: экскурсия на 4 часа",
    "englishTitle": "São Paulo and Paulista Avenue: Four-Hour Tour"
  },
  {
    "id": "excursion_source_ekskursiya_na_raduzhnuyu_goru_vinikunka",
    "sourcePath": "src/content/excursions/ekskursiya-na-raduzhnuyu-goru-vinikunka.md",
    "sourceTitle": "Экскурсия Радужные Горы в Перу из города Куско на 6 часов",
    "englishTitle": "Rainbow Mountain in Peru: Six-Hour Excursion from Cusco"
  }
];
test('stage9: ten exact excursion titles use distinct, source-checked English names',()=>{
 const keys=new Set();
 for(const row of cases){
  const key='stage9.exactExcursion.'+row.id;
  const content=fs.readFileSync(new URL('../../'+row.sourcePath,import.meta.url),'utf8');
  const front=content.match(/^---\r?\n([\s\S]*?)\r?\n---/u);
  assert.ok(front,row.id);
  const source=yaml.load(front[1]);
  assert.equal(source.id,row.id);
  assert.equal(source.title,row.sourceTitle);
  assert.ok(['approved','published'].includes(source.status??'approved'));
  assert.deepEqual(dictionary.messages[key],{ru:row.sourceTitle,en:row.englishTitle});
  assert.equal(translateUiText(row.sourceTitle,'en'),row.englishTitle);
  assert.equal(translateUiText(row.sourceTitle,'ru'),row.sourceTitle);
  assert.ok(!/[\u0400-\u052f]/u.test(row.englishTitle));
  assert.ok(!keys.has(row.id));
  keys.add(row.id);
 }
 assert.equal(keys.size,10);
});
test('stage9: exact place names and cruise format use English only in EN',()=>{
 for(const [ru,en] of [['Круиз','Cruise'],['Илья-Гранди','Ilha Grande'],['Парати','Paraty']]){
   assert.equal(translateUiText(ru,'en'),en);
   assert.equal(translateUiText(ru,'ru'),ru);
 }
});
