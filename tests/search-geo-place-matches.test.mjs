import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalGeoSearchPath,indexSearchGeoPlaces,searchGeoPoints}
  from '../src/lib/search-geo-place-matches.mjs';

test('Pagefind URLs match GEO rows regardless of host, query and trailing slash',()=>{
  const index=indexSearchGeoPlaces([
    {url:'/brazil/place/rio-de-janeiro/',coordinates:[-43.2,-22.9]},
    {url:'/argentina/place/puerto-iguazu/',coordinates:[-54.5,-25.6]},
    {url:'/bad/',coordinates:[300,0]},
  ]);
  assert.equal(index.size,2);
  assert.equal(canonicalGeoSearchPath('https://adatours.ru/brazil/place/rio-de-janeiro/?utm_x=1'),
    '/brazil/place/rio-de-janeiro/');
  const result=searchGeoPoints([
    {url:'/argentina/place/puerto-iguazu/',meta:{title:'Пуэрто-Игуасу'}},
    {url:'/brazil/place/rio-de-janeiro/?utm_source=search',
      meta:{title:'Рио',image:'/media/rio.webp',summary:'Город на побережье'}},
    {url:'/brazil/place/rio-de-janeiro/',meta:{title:'Дубль'}},
    {url:'/colombia/place/unknown/',meta:{title:'Без паспорта'}},
  ],index);
  assert.deepEqual(result.map(x=>x.name),['Пуэрто-Игуасу','Рио']);
  assert.deepEqual(result.map(x=>x.position),[1,2]);
  assert.ok(result.every(x=>x.isSearchResult));
  assert.equal(result[1].image,'/media/rio.webp');
  assert.equal(result[1].description,'Город на побережье');
});
test('empty and non-GEO search results do not create markers',()=>{
  assert.deepEqual(searchGeoPoints([],new Map()),[]);
  assert.deepEqual(searchGeoPoints([{url:'/x/'}],new Map()),[]);
  assert.equal(indexSearchGeoPlaces([{url:'/a/',coordinates:[1,NaN]}]).size,0);
});

test('staged English search matches the canonical GEO index and keeps English destination links',()=>{
  const canonical='/brazil/place/rio-de-janeiro/';
  const english='/adatours-en/en/brazil/place/rio-de-janeiro/';
  const coordinates=[-43.2,-22.9];
  const index=indexSearchGeoPlaces([{url:canonical,coordinates}]);
  assert.equal(canonicalGeoSearchPath('https://alexyakovlev79.github.io'+english+'?from=search'),canonical);
  assert.equal(canonicalGeoSearchPath(canonical),canonical);
  assert.equal(canonicalGeoSearchPath('/another-project/en/brazil/place/rio-de-janeiro/'),
    '/another-project/en/brazil/place/rio-de-janeiro/');
  const points=searchGeoPoints([
    {url:english,meta:{title:'Rio de Janeiro',summary:'City on the coast',image:'/media/rio.webp'}},
    {url:canonical,meta:{title:'Duplicate canonical match'}},
  ],index);
  assert.equal(points.length,1);
  assert.equal(points[0].id,canonical);
  assert.equal(points[0].href,english);
  assert.equal(points[0].name,'Rio de Janeiro');
  assert.equal(points[0].description,'City on the coast');
  assert.equal(points[0].image,'/media/rio.webp');
  assert.deepEqual(points[0].coordinates,coordinates);
  assert.equal(points[0].position,1);
});

