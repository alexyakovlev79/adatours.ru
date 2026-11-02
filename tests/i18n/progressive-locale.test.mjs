import test from 'node:test';
import assert from 'node:assert/strict';
import {planProgressiveEnglishCollection} from '../../src/lib/i18n/progressive-locale.mjs';
import {getAstroLocalizedCollection} from '../../src/lib/i18n/astro-locale-collection.mjs';
import {sourceFromContentEntry} from '../../src/lib/i18n/content-adapter.mjs';
import {sourceBlockEvidence,translationApprovalHash} from '../../src/lib/i18n/content-overlay.mjs';

const blockMap={schemaVersion:1,entityType:'theme',entityId:'theme_a',paths:[
 {blockId:'name',path:'/name',field:'name'},
 {blockId:'summary',path:'/summary',field:'summary'},
 {blockId:'hero_alt',path:'/hero/alt',field:'media.alt'},
]};
const entry=(id='theme_a',summary='Русский текст')=>({
 id:'ru:'+id,body:'',data:{id,locale:'ru',status:'approved',
 name:'Тема',summary,hero:{src:'/media/themes/example.webp',alt:'Картинка'},
 priceFrom:1255,currency:'USD'}
});
function approved(sourceEntry,{state='approved'}={}){
 const map={...blockMap,entityId:sourceEntry.data.id};
 const source=sourceFromContentEntry(sourceEntry,'theme',map);
 const blocks=source.blocks.map(block=>{
  const evidence=sourceBlockEvidence(source,block.blockId);
  const translation={blockId:block.blockId,field:block.field,
   text:({name:'Theme',summary:'A verified description',hero_alt:'Landscape'})[block.blockId],
   state,sourceTextHash:evidence.sourceTextHash,
   dependencyHashes:evidence.dependencyHashes,
   provenance:{kind:'ai_translation',model:'gpt-6',runId:'test-only'}};
  if(state==='approved')translation.approval={
   reviewerId:'test-qa',reviewedAt:'2026-11-02T15:00:00Z',
   checks:{meaning:true,voice:true,facts:true},
   approvedContentHash:translationApprovalHash(translation)};
  return translation;
 });
 return {blockMap:map,overlay:{schemaVersion:1,
  entityId:sourceEntry.data.id,entityType:'theme',locale:'en',sourceLocale:'ru',blocks},
  wordSources:{}};
}
test('approved complete overlay promotes one page while leaving missing pages in RU fallback',async()=>{
 const a=entry(),b=entry('theme_b'),resA=approved(a);
 const result=await planProgressiveEnglishCollection('themes',async()=>[a,b],
  async id=>id==='theme_a'?resA:null);
 assert.deepEqual(result.decisions.map(x=>x.status),['ready','missing']);
 assert.equal(result.english.length,1);
 assert.equal(result.russianFallback[0],b);
 assert.equal(result.english[0].data.locale,'en');
 assert.equal(result.english[0].data.name,'Theme');
 assert.equal(result.english[0].data.priceFrom,1255);
 assert.equal(result.english[0].data.hero.src,a.data.hero.src);
 assert.equal(a.data.name,'Тема');
});
test('changed RU text and unapproved text cannot silently produce English pages',async()=>{
 const original=entry(),changed=entry('theme_a','Русский обновленный текст');
 const fromOld=approved(original);
 const stale=await planProgressiveEnglishCollection('themes',async()=>[changed],async()=>fromOld);
 assert.equal(stale.decisions[0].status,'stale');
 assert.ok(stale.decisions[0].issueCodes.includes('source_text_changed'));
 assert.equal(stale.english.length,0);
 assert.equal(stale.russianFallback[0],changed);
 const pending=approved(original,{state:'review'});
 const review=await planProgressiveEnglishCollection('themes',async()=>[original],async()=>pending);
 assert.equal(review.decisions[0].status,'review');
 assert.equal(review.english.length,0);
});
test('independent shared fact changes do not invalidate a text overlay',async()=>{
 const original=entry(),changed=entry();
 changed.data.priceFrom=1999;
 const plan=await planProgressiveEnglishCollection('themes',async()=>[changed],
  async()=>approved(original));
 assert.equal(plan.decisions[0].status,'ready');
 assert.equal(plan.english[0].data.priceFrom,1999);
});
test('an untranslated embedded dependency demotes the page and its dependants',async()=>{
 const a=entry(),b=entry('theme_b');
 const candidates={theme_a:approved(a),theme_b:approved(b)};
 const deps=id=>id==='theme_a'?['theme_b']:['excursion_missing'];
 const result=await planProgressiveEnglishCollection('themes',async()=>[a,b],
  async id=>candidates[id],{dependsOnEnglish:deps});
 assert.deepEqual(result.decisions.map(x=>x.status),
  ['untranslated_dependency','untranslated_dependency']);
 assert.equal(result.english.length,0);
 assert.deepEqual(result.decisions[0].missingIds,['theme_b']);
 const accepted=await planProgressiveEnglishCollection('themes',async()=>[a,b],
  async id=>candidates[id],{dependsOnEnglish:deps,
   readyExternalIds:['excursion_missing']});
 assert.equal(accepted.english.length,2);
});
test('duplicate IDs and source errors fail closed',async()=>{
 const a=entry();
 await assert.rejects(()=>planProgressiveEnglishCollection('themes',
  async()=>[a,a],async()=>null),/duplicate stable ID/);
 const invalid=await planProgressiveEnglishCollection('themes',async()=>[a],
  async()=>({blockMap:{...blockMap,paths:[]},overlay:{}}));
 assert.equal(invalid.decisions[0].status,'stale_map');
 assert.equal(invalid.english.length,0);
});
test('progressive Astro mode is restricted to the verified nonpublic EN staging host',async()=>{
 const read=async()=>[];
 await assert.rejects(()=>getAstroLocalizedCollection('themes','en',read,{
  progressivePreview:true,resolveApprovedEnglish:async()=>null,
  env:{SITE_LOCALE:'en',SITE_ORIGIN:'https://adatours.com',
   SITE_BASE:'/',EN_STAGING_PAGES:'1',PUBLIC_EN_RELEASE:'0'}
 }),/nonpublic staging/);
 const rows=await getAstroLocalizedCollection('themes','en',read,{
  progressivePreview:true,resolveApprovedEnglish:async()=>null,
  env:{SITE_LOCALE:'en',SITE_ORIGIN:'https://alexyakovlev79.github.io',
   SITE_BASE:'/adatours-en/',EN_STAGING_PAGES:'1',PUBLIC_EN_RELEASE:'0'}
 });
 assert.deepEqual(rows,[]);
});
