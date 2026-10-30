import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 validatePrivateExcursionManifest,validatePrivateExcursionOverlay,
 materializePrivateExcursion,pilotExcursionUrl,verifyPrivateExcursionSourceFiles
} from '../../src/lib/i18n/private-excursions.mjs';

const manifest=JSON.parse(await readFile('data/i18n/pilot-excursions/v1/manifest.json','utf8'));

test('eleven unique canonical stable IDs and safe preview-only routes',()=>{
 const entries=validatePrivateExcursionManifest(manifest);
 assert.equal(entries.length,11);
 assert.equal(new Set(entries.map(x=>x.id)).size,11);
 assert.equal(new Set(entries.map(x=>x.slug)).size,11);
 assert.match(pilotExcursionUrl('bogota-city-tour'),/^\/en-pilot-private\/excursion\//);
 assert.throws(()=>pilotExcursionUrl('../../malicious'),/Unsafe/);
 const invalid=structuredClone(manifest);invalid.publicationAuthorized=true;
 assert.throws(()=>validatePrivateExcursionManifest(invalid),/Manifest/);
});
test('all eleven EN overlay sources match immutable Git blobs in current feature source',async()=>{
 assert.equal(await verifyPrivateExcursionSourceFiles('.'),11);
});
test('untranslated optional details, prices and CDN source references cannot silently slip into EN',async()=>{
 const m=manifest.entries.find(x=>x.id==='excursion_source_siti_tur_v_bogote');
 const overlay=JSON.parse(await readFile(m.translationFile,'utf8'));
 // Unit fixture mirrors all visible text slot counts and shared nontext fields.
 const t=overlay.translation;
 const ru={data:{id:m.id,slug:m.slug,locale:'ru',status:'approved',
   hero:{src:'/media/tours/example/hero.webp',hover:'Original'},
   gallery:t.gallery.map((_,i)=>({src:'/media/tours/example/gallery-'+i+'.webp',hover:'Original'})),
   route:t.route.map(()=>'Source'),language:t.language.map(()=>'Source'),
   included:t.included.map(()=>'Source'),notIncluded:t.notIncluded.map(()=>'Source'),
   notes:t.notes.map(()=>'Source'),searchAliases:t.searchAliases.map(()=>'Source'),
   duration:'Original',priceNote:'Original',priceFrom:226,currency:'USD',
   country:'country_colombia',destination:'destination_colombia_bogota',destinationName:'Bogota'}};
 assert.equal(validatePrivateExcursionOverlay(m,overlay,ru),true);
 const en=materializePrivateExcursion(m,overlay,ru);
 assert.equal(en.data.priceFrom,226);
 assert.equal(en.data.currency,'USD');
 assert.equal(en.data.country,'country_colombia');
 assert.equal(en.data.hero.src,'https://img.adatours.ru/media/tours/example/hero.webp');
 assert.equal(en.data.title,t.title);
 const bad=structuredClone(overlay);bad.translation.included.pop();
 assert.throws(()=>validatePrivateExcursionOverlay(m,bad,ru),/included/);
 const cyr=structuredClone(overlay);cyr.translation.title='Русский';
 assert.throws(()=>validatePrivateExcursionOverlay(m,cyr,ru),/narrative|Cyrillic/);
 const price=structuredClone(overlay);price.translation.priceFrom=1;
 assert.throws(()=>validatePrivateExcursionOverlay(m,price,ru),/narrative/);
});
