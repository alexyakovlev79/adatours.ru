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
    {url:'/brazil/place/rio-de-janeiro/?utm_source=search',meta:{title:'Рио'}},
    {url:'/brazil/place/rio-de-janeiro/',meta:{title:'Дубль'}},
    {url:'/colombia/place/unknown/',meta:{title:'Без паспорта'}},
  ],index);
  assert.deepEqual(result.map(x=>x.name),['Пуэрто-Игуасу','Рио']);
  assert.deepEqual(result.map(x=>x.position),[1,2]);
  assert.ok(result.every(x=>x.isSearchResult));
});
test('empty and non-GEO search results do not create markers',()=>{
  assert.deepEqual(searchGeoPoints([],new Map()),[]);
  assert.deepEqual(searchGeoPoints([{url:'/x/'}],new Map()),[]);
  assert.equal(indexSearchGeoPlaces([{url:'/a/',coordinates:[1,NaN]}]).size,0);
});
