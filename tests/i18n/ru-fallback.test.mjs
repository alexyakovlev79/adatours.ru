import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {russianFallbackHtml,discoverRussianPages,stageRussianFallback} from '../../scripts/i18n/ru-fallback.mjs';

const source=route=>'<!doctype html><html lang="ru"><head><meta name="robots" content="noindex, nofollow"><link rel="canonical" href="https://adatours.ru'+route+'"><meta property="og:title" content="RU"><script type="application/ld+json">{"@type":"TouristTrip"}</script></head><body><header>Ада Турс</header><a href="/adatours-en/brazil/">Страна</a><a href="/adatours-en/contacts/">Контакты</a><a href="#request">Оставить заявку</a><form action="/live"><input name="phone"></form><script src="https://www.googletagmanager.com/gtag.js"></script><script src="/adatours-en/_astro/menu.js"></script><img src="/adatours-en/media/home/test.webp" alt="Тур"></body></html>';
test('EN fallback keeps RU language, noindex and verified links while disabling forms/analytics',()=>{
 const known=new Set(['/','/brazil/','/contacts/']),html=russianFallbackHtml(source('/'), '/', known);
 assert.match(html,/<html lang="ru" data-ada-ru-fallback="true"/);
 assert.match(html,/data-ada-translation-notice="ru"/);
 assert.match(html,/noindex,nofollow,noarchive,nosnippet/);
 assert.match(html,/\/adatours-en\/en\/brazil\//);
 assert.match(html,/\/adatours-en\/en\/contacts\//);
 assert.match(html,/https:\/\/img\.adatours\.ru\/media\/home\/test\.webp/);
 assert.match(html,/mailto:info@adatours\.ru/);
 assert.match(html,/_astro\/menu\.js/);
 assert.doesNotMatch(html,/rel="canonical"|application\/ld\+json|<form|googletagmanager/);
});
test('known source routes are mirrored once, translated routes take priority',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ada-ru-fallback-'));
 const dist=path.join(dir,'dist'),out=path.join(dir,'out');
 try{
  for(const part of ['', 'brazil','en/tours','en-pilot-private/tour','_astro']){
   const folder=path.join(dist,part);fs.mkdirSync(folder,{recursive:true});
   fs.writeFileSync(path.join(folder,'index.html'),source('/'));
  }
  fs.mkdirSync(path.join(out,'en','brazil'),{recursive:true});
  fs.writeFileSync(path.join(out,'en','brazil','index.html'),'<!doctype html><html lang="en">Translated</html>');
  const inventory=discoverRussianPages(dist);
  assert.deepEqual(inventory.map(x=>x.route),['/','/brazil/']);
  const result=stageRussianFallback({dist,output:out,minPages:2});
  assert.equal(result.ruSourcePages,2);assert.equal(result.englishPrecedence,1);
  assert.equal(result.ruFallbackPages,1);
  assert.match(fs.readFileSync(path.join(out,'en','index.html'),'utf8'),/data-ada-ru-fallback/);
  assert.match(fs.readFileSync(path.join(out,'en','brazil','index.html'),'utf8'),/Translated/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('Russian content cannot masquerade as English or bypass completeness checks',()=>{
 assert.throws(()=>russianFallbackHtml(source('/').replace('lang="ru"','lang="en"'), '/', new Set(['/'])),/RU HTML/);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ada-ru-fallback-'));
 try{fs.writeFileSync(path.join(dir,'index.html'),source('/'));
  assert.throws(()=>stageRussianFallback({dist:dir,output:path.join(dir,'out')}),/Incomplete RU build|Unsafe output/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
