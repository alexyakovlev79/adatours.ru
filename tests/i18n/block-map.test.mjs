import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStableBlockMap} from '../../src/lib/i18n/block-map.mjs';
import {sourceFromContentEntry} from '../../src/lib/i18n/content-adapter.mjs';
const tour={id:'ru:tour_alpha',data:{
  id:'tour_alpha',locale:'ru',slug:'alpha',title:'Тест',lead:'Знакомство',
  priceFrom:1908,currency:'USD',priceNote:'От $1908',
  route:['Рио','Игуасу'],included:['Трансфер'],notIncluded:['Перелет'],
  itinerary:[
   {day:1,title:'День 1',text:'Прибытие',places:['Рио'],images:[{src:'/media/a.webp',alt:'Фото Рио'}]},
   {excursionRef:'excursion_iguazu',places:['Игуасу'],title:'Водопады',text:'Экскурсия'}
  ],hero:{src:'/media/hero.webp',alt:'Панорама'}},body:'Наш тур'};
const map=e=>createStableBlockMap(e,'tour');
const get=(m,path)=>m.paths.find(x=>x.path===path).blockId;
test('full source map passes adapter; priceNote depends on common price',()=>{
 const m=map(tour);assert.ok(m.paths.length>10);
 assert.equal(sourceFromContentEntry(tour,'tour',m).blocks.length,m.paths.length);
 assert.ok(m.paths.find(x=>x.path==='/priceNote').dependsOn.includes('/facts/priceFrom'));
});
test('inserting day at start preserves IDs of existing day and excursion',()=>{
 const before=map(tour);
 const changed=structuredClone(tour);
 changed.data.itinerary.unshift({day:0,title:'Новое прибытие',text:'Новый текст'});
 const after=map(changed);
 assert.equal(get(before,'/itinerary/0/title'),get(after,'/itinerary/1/title'));
 assert.equal(get(before,'/itinerary/1/title'),get(after,'/itinerary/2/title'));
});
test('changing prose within day keeps same semantic block ID',()=>{
 const old=map(tour),changed=structuredClone(tour);
 changed.data.itinerary[0].text='Новый маршрут';
 assert.equal(get(old,'/itinerary/0/text'),get(map(changed),'/itinerary/0/text'));
});
test('reordering gallery/route preserves content-based IDs',()=>{
 const old=map(tour),changed=structuredClone(tour);
 changed.data.route.reverse();
 assert.equal(get(old,'/route/0'),get(map(changed),'/route/1'));
});
test('repeated identical semantic list content is blocked, not silently assigned same ID',()=>{
 const changed=structuredClone(tour);
 changed.data.included=['Трансфер','Трансфер'];
 assert.throws(()=>map(changed),/Ambiguous repeated semantic block/);
});
test('missing semantic owner fails safely',()=>{
 const changed=structuredClone(tour);
 changed.data.itinerary.push({text:'День без идентификатора'});
 assert.throws(()=>map(changed),/Ambiguous itinerary owner/);
});
