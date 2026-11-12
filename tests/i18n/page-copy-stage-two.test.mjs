import test from 'node:test';
import assert from 'node:assert/strict';
import { parse,serialize } from 'parse5';
import { readFileSync } from 'node:fs';
import { translateAuthoredPageText,localizeAuthoredPageDocument,authoredPageCopyCount } from '../../src/lib/i18n/page-copy.mjs';
import { interestCopy,interestTourCount,relatedInterestCount } from '../../src/lib/interest-copy.mjs';
import { russianFallbackHtml } from '../../scripts/i18n/ru-fallback.mjs';

const ru=JSON.parse(readFileSync('src/data/interest-copy.json','utf8'));
const en=JSON.parse(readFileSync('src/data/i18n/interest-copy.en.json','utf8'));
test('all fifteen approved English interest records are reused without changing RU copy',()=>{
  assert.equal(Object.keys(ru).length,15);
  assert.equal(Object.keys(en.entries).length,15);
  for(const id of Object.keys(ru)){
    assert.equal(interestCopy(id,'ru').tourIntro,ru[id].tourIntro);
    assert.equal(interestCopy(id,'en').tourIntro,en.entries[id].tourIntro);
    assert.equal(interestTourCount(id,1,'en'),`1 ${en.entries[id].tourForms[0]}`);
    assert.equal(interestTourCount(id,2,'en'),`2 ${en.entries[id].tourForms[1]}`);
    for(const field of ['toursTitle','tourIntro','geographyIntro','catalogIntro']){
      assert.equal(translateAuthoredPageText(ru[id][field]),en.entries[id][field]);
      assert.equal(translateAuthoredPageText(ru[id][field],'ru'),ru[id][field]);
    }
  }
  assert.equal(relatedInterestCount(2,'en'),'2 tours connect these interests');
  assert.equal(relatedInterestCount(1,'ru'),'1 тур объединяет эти интересы');
});
test('page copy covers 180 exact source phrases and has no dynamic substring replacements',()=>{
  assert.ok(authoredPageCopyCount>=180+60);
  assert.equal(translateAuthoredPageText('Латинская Америка. Ваша история путешествия'),'Latin America. Your travel story');
  assert.equal(translateAuthoredPageText('  Латинская Америка на ваших условиях  '),'  Latin America, on your terms  ');
  assert.equal(translateAuthoredPageText('Латинская Америка на ваших условиях','ru'),'Латинская Америка на ваших условиях');
  assert.equal(translateAuthoredPageText('Это авторский текст туриста, он не переведён'),'Это авторский текст туриста, он не переведён');
  assert.equal(translateAuthoredPageText('Путешествие начинается с одной страны'),'Путешествие начинается с одной страны');
});
test('curated page translation edits only known body nodes, never head, scripts, original quotes, URLs or unknown prose',()=>{
 const html='<html lang="ru"><head><title>Латинская Америка на ваших условиях</title><meta name="description" content="Латинская Америка на ваших условиях"></head><body><section><h1>Латинская Америка на ваших условиях</h1><a href="/country/" aria-label="Как выбрать путешествие">Выбрать путешествие</a><p>Авторский текст без готового перевода</p><blockquote>Хочу готовый маршрут</blockquote><script>const s="Хочу готовый маршрут"</script></section></body></html>';
 const doc=parse(html);const count=localizeAuthoredPageDocument(doc,{locale:'en'});const out=serialize(doc);
 assert.ok(count>=3);
 assert.match(out,/<h1>Latin America, on your terms<\/h1>/);
 assert.match(out,/aria-label="How to choose your journey"/);
 assert.match(out,/>Choose your journey<\/a>/);
 assert.match(out,/<title>Латинская Америка на ваших условиях<\/title>/);
 assert.match(out,/content="Латинская Америка на ваших условиях"/);
 assert.match(out,/href="\/country\/"/);
 assert.match(out,/Авторский текст без готового перевода/);
 assert.match(out,/<blockquote>Хочу готовый маршрут<\/blockquote>/);
 assert.match(out,/<script>const s="Хочу готовый маршрут"<\/script>/);
});
test('existing EN noindex builder applies page copy without turning on canonical or schema',()=>{
 const src='<!doctype html><html lang="ru" data-ada-shared-locale="en"><head><meta name="robots" content="noindex, nofollow"></head><body><h1>Латинская Америка на ваших условиях</h1><p>Новый текст с русским fallback</p><a href="/country/">Страны</a></body></html>';
 const result=russianFallbackHtml(src,'/',new Set(['/','/country/']),{sharedContent:true});
 assert.match(result,/Latin America, on your terms/);
 assert.match(result,/Новый текст с русским fallback/);
 assert.match(result,/noindex,nofollow,noarchive,nosnippet/);
 assert.doesNotMatch(result,/rel="canonical"|application\/ld\+json/);
});
