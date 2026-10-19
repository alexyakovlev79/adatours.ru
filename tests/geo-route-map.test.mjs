import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeGeoIndex, verifiedCoordinate, resolvePlace, tourVisits, excursionVisits, finalizeGeoMap,
} from '../src/lib/geo-route-data.mjs';

const catalogue = [
  {id:'rio',name:'Рио-де-Жанейро',countryId:'br',url:'/br/place/rio/',aliases:['Рио']},
  {id:'cocora',name:'Долина Кокора',countryId:'co',url:'/co/place/cocora/'},
  {id:'salento',name:'Саленто',countryId:'co',url:'/co/place/salento/'},
  {id:'weak',name:'Сомнительное место',countryId:'co',url:'/co/place/weak/'},
  {id:'inactive',name:'Резерв',countryId:'co',url:'/co/place/inactive/'},
];
const destinations = new Map(catalogue.filter(p => p.id !== 'inactive').map(p => [p.id, {
  name:p.name,countryId:p.countryId,status:'approved',
  destinationType:'city',summary:'Путешествие в '+p.name,
  hero:{src:'/media/'+p.id+'.webp'},
}]));
function passport(id, lat, lng, probability=98) {
  return {schemaVersion:2,kind:'destination',stableId:id,status:'READY',
    decisionPolicy:'probability-70-v1',
    assessments:[{field:'identity',probability:99},{field:'location',probability}],
    location:{latitude:lat,longitude:lng},
    evidence:[{field:'location',sourceUrl:'https://www.wikidata.org/wiki/Q1'}]};
}
const passports = new Map([
  ['rio', passport('rio', -22.91,-43.2)],
  ['cocora', passport('cocora',4.63,-75.48)],
  ['salento', passport('salento',4.64,-75.57)],
  ['weak', passport('weak',4.6,-75.5,69)],
  ['inactive', passport('inactive',4.5,-75.4)],
]);
const index = makeGeoIndex({catalog:catalogue,destinations,passports});

test('only confirmed coordinates of published destinations become points', () => {
  assert.equal(index.entries.size,3);
  assert.equal(verifiedCoordinate(passports.get('weak'),'weak'),null);
  assert.equal(index.entries.get('rio').image,'/media/rio.webp');
  assert.equal(resolvePlace('РИО', index,{countryIds:['br']}).point.id,'rio');
});

test('tour day order, consecutive visits, return visits and map bounds', () => {
  const tour = {countries:['br','co'],destinations:['rio','cocora','salento'],
    itinerary:[
      {day:1,places:['Рио']},
      {day:2,places:['Рио-де-Жанейро','Долина Кокора']},
      {day:3,places:['Саленто']},
      {day:4,places:['Рио']},
    ]};
  const visits = tourVisits(tour,index);
  assert.deepEqual(visits.map(v=>v.id),['rio','cocora','salento','rio']);
  assert.deepEqual(visits[0].days,[1,2]);
  const map = finalizeGeoMap(visits,index);
  assert.equal(map.points.length,3);
  assert.equal(map.route.length,4);
  assert.deepEqual(map.points[0].days,[1,2,4]);
  assert.equal(map.bounds.west,-75.57);
  assert.equal(map.geojson.features.length,4);
});

test('excursion route[] takes precedence over destinationIds and title', () => {
  const ex={country:'co',destination:'cocora',relatedDestinations:['salento'],
    route:['Саленто','Долина Кокора'],title:'Кокора и Саленто'};
  assert.deepEqual(excursionVisits(ex,index).map(v=>v.id),['salento','cocora']);
});

test('excursion falls back to title mention order above 70%', () => {
  const ex={country:'co',destination:'cocora',relatedDestinations:['salento'],
    route:[],title:'Саленто и Долина Кокора'};
  assert.deepEqual(excursionVisits(ex,index).map(v=>v.id),['salento','cocora']);
});

test('single point has no route line and retains destination URL', () => {
  const map=finalizeGeoMap([{id:'rio',days:[]}],index);
  assert.equal(map.route.length,1);
  assert.equal(map.geojson.features.length,1);
  assert.equal(map.points[0].href,'/br/place/rio/');
  assert.equal(map.zoom,10);
});


// Recommendations share the destination page's sorted IDs, not an invented route.
import {destinationNeighborhoodMap} from '../src/lib/geo-route-data.mjs';
test('destination neighborhood maps the current place plus only eligible recommendations', () => {
  const model=destinationNeighborhoodMap('cocora',
    ['salento','rio','weak','inactive','salento','cocora'], index);
  assert.deepEqual(model.points.map(p => p.id), ['cocora','salento','rio']);
  assert.deepEqual(model.points.map(p => p.isPrimary), [true,false,false]);
  assert.deepEqual(model.points.map(p => p.isRelated), [false,true,true]);
  assert.deepEqual(model.route, []);
  assert.ok(model.geojson.features.every(f => f.properties.kind === 'point'));
  assert.equal(model.geojson.features.filter(f => f.properties.isPrimary).length, 1);
  assert.equal(model.bounds.west, -75.57);
  assert.equal(destinationNeighborhoodMap('weak',['rio'],index),null);
});
