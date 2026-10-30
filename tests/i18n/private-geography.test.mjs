import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateGeoManifest,validateGeoOverlay,materializePrivateGeo,
 verifyPrivateGeoSources} from '../../src/lib/i18n/private-geography.mjs';
const m=JSON.parse(await readFile('data/i18n/pilot-geography/v1/manifest.json','utf8'));
test('only source-bound private Brazil and Rio geography',async()=>{
 assert.equal(validateGeoManifest(m).length,2);
 assert.equal(await verifyPrivateGeoSources('.'),2);
});
test('shared geography media paths and stable IDs are never translated',async()=>{
 const item=m.items[0], overlay=JSON.parse(await readFile(item.file,'utf8')),t=overlay.translation;
 const entry={data:{id:item.id,slug:item.slug,status:'approved',locale:'ru',
  hero:{src:'/media/test/hero.webp',hover:'Source'},gallery:t.gallery.map(()=>({src:'/media/test/photo.webp',hover:'Source'})),
  featureBands:t.featureBands.map(()=>({image:'/media/test/band.webp'})),
  regions:t.regions.map(()=>'RU'),languages:t.languages.map(()=>'RU'),
  searchAliases:['Бразилия','Brazil']}};
 assert.equal(validateGeoOverlay(item,overlay,entry),true);
 const en=materializePrivateGeo(item,overlay,entry);
 assert.equal(en.data.id,item.id);
 assert.equal(en.data.hero.src,'https://img.adatours.ru/media/test/hero.webp');
 assert.equal(en.data.searchAliases.length,1);
 assert.equal(en.data.featureBands[0].href,'/en-pilot-private/place/rio-de-janeiro/');
 const changed=structuredClone(overlay);changed.translation.summary='Русский';
 assert.throws(()=>validateGeoOverlay(item,changed,entry),/Russian|Missing English core/);
});
