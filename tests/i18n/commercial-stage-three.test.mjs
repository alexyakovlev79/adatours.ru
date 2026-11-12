import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {commercialText,commercialTranslationCount} from '../../src/lib/i18n/commercial-copy.mjs';
const dirs=['mice-overview','mice-delegations','mice-programmes','dmc-overview','dmc-agencies','dmc-terms'];
const root=new URL('../../src/data/i18n/commercial/',import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name+'.en.json',root),'utf8'));
const dictionaries=dirs.map(read);
test('stage 3 covers six commercial pages with source-bound British-English visitor copy',()=>{
 assert.equal(dictionaries.length,6);
 const entries=dictionaries.flatMap(x=>x.entries);
 assert.equal(entries.length,463);
 assert.ok(commercialTranslationCount>=453);
 for(const {ru,en} of entries){
   assert.ok(ru&&en,'missing commercial translation');
   assert.doesNotMatch(en,/[А-Яа-яЁё]/u,'untranslated EN text: '+ru.slice(0,75));
   assert.equal(commercialText(ru,'en'),en,'EN source mismatch: '+ru.slice(0,75));
   assert.equal(commercialText(ru,'ru'),ru,'RU source changed');
 }
 assert.equal(commercialText('unmapped source','en'),'unmapped source');
});
test('MICE programme examples preserve all three authoritative IMEX links and commercial facts',()=>{
 const source=JSON.parse(readFileSync(new URL('../../src/data/commercial/mice-programme-examples.json',import.meta.url),'utf8'));
 assert.equal(source.length,3);
 assert.deepEqual(source.map(x=>x.id),['imex_buenos_aires_congress_5d','imex_iguazu_incentive_3d','imex_rio_angra_paraty_7d']);
 for(const x of source){
   assert.ok(x.url.startsWith('https://america.imexevents.com/product/'));
   for(const field of ['title','summary','duration']){
     const translated=commercialText(x[field],'en');
     assert.notEqual(translated,x[field],x.id+': missing translation '+field);
     assert.doesNotMatch(translated,/[А-Яа-яЁё]/u);
   }
 }
 assert.match(commercialText(source[0].summary,'en'),/45 participants/);
 assert.match(commercialText(source[1].summary,'en'),/two nights/);
});
test('all six source pages explicitly use locale-aware copy, language and one canonical layout',()=>{
 const ps=['mice/index.astro','mice/business-delegations/index.astro','mice/programmes/index.astro','dmc/index.astro','dmc/travel-agencies/index.astro','dmc/terms/index.astro'];
 for(const name of ps){
   const code=readFileSync(new URL('../../src/pages/'+name,import.meta.url),'utf8');
   assert.match(code,/import \{commercialText\}/);
   assert.match(code,/<BaseLayout lang=\{uiLocale\}/);
   assert.match(code,/const uiLocale=sharedUiLocale\(\)/);
   assert.equal((code.match(/<BaseLayout\b/g)||[]).length,1);
 }
});
test('commercial language labels and shared offers remain exact in RU',()=>{
 for(const [ru,en] of [['Английский','English'],['Русский','Russian'],['нетто-тариф','net rate'],['Для агентств','For agencies']]){
  assert.equal(commercialText(ru,'en'),en);
  assert.equal(commercialText(ru,'ru'),ru);
 }
});
