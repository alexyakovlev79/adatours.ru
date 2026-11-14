import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {geoMapProvider,geoMapProviderOrder} from '../src/lib/geo-map-provider.mjs';

test('EN uses only Google Maps, RU retains only Yandex Maps',()=>{
  assert.equal(geoMapProvider('en'),'google');
  assert.deepEqual(geoMapProviderOrder('en'),['google']);
  assert.equal(geoMapProvider('ru'),'yandex');
  assert.deepEqual(geoMapProviderOrder('ru'),['yandex']);
});

test('both map clients select their provider from the site locale',()=>{
  for(const file of ['src/scripts/geo-map-client.mjs','src/scripts/search-places-map.mjs']){
    const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
    assert.match(source,/geoMapProviderOrder\(/);
    assert.doesNotMatch(source,/\['google', 'yandex'\]|\['yandex','google'\]/);
  }
});

test('EN publishing passes the Google Maps API configuration to Astro',()=>{
  const file=readFileSync(new URL('../.github/workflows/en-pages-reusable-deploy.yml',import.meta.url),'utf8');
  assert.ok(file.includes('PUBLIC_GOOGLE_MAPS_API_KEY: ${{ secrets.GOOGLE_MAPS_JS_API_KEY }}'));
});
