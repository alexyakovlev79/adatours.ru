import test from 'node:test';
import assert from 'node:assert/strict';
import {parse,serialize} from 'parse5';
import {localizeSharedUiDocument,localizedEntityLabels} from '../../src/lib/i18n/shared-ui-html.mjs';
import {russianFallbackHtml} from '../../scripts/i18n/ru-fallback.mjs';

test('shared UI translations keep unknown Russian content and never alter scripts, URLs or media',()=>{
 const doc=parse('<html lang="ru"><head><title>Страны</title></head><body><nav><a href="/brazil/">Бразилия</a><a href="/tours/">Туры</a></nav><p>Этот текст ещё не переведён.</p><p>Играет музыка от моря.</p><img src="/media/shared.webp" alt="Панорама"><input placeholder="Ваше имя"><script>const title="Туры";</script><code>Туры</code><template><span>Поиск</span></template></body></html>');
 const count=localizeSharedUiDocument(doc,{entityLabels:new Map([['Бразилия','Brazil']])});
 const out=serialize(doc);
 assert.ok(count>=5);
 assert.match(out,/<a href="\/brazil\/">Brazil<\/a>/);
 assert.match(out,/<a href="\/tours\/">Tours<\/a>/);
 assert.match(out,/Этот текст ещё не переведён/);
 assert.match(out,/Играет музыка от моря/);
 assert.match(out,/src="\/media\/shared.webp"/);
 assert.match(out,/placeholder="Your name"/);
 assert.match(out,/<script>const title="Туры";<\/script>/);
 assert.match(out,/<code>Туры<\/code>/);
 assert.match(out,/<template><span>Search<\/span><\/template>/);
});

test('ambiguous or rejected entity names never become a global translation dictionary',()=>{
 const labels=localizedEntityLabels({entries:[
  {applied:3,sourceName:'Остров',displayName:'Island A'},
  {applied:2,sourceName:'Остров',displayName:'Island B'},
  {applied:0,sourceName:'Перу',displayName:'Peru'},
  {applied:8,sourceName:'Бразилия',displayName:'Brazil'},
 ]});
 assert.deepEqual([...labels],[['Бразилия','Brazil']]);
});

test('complete shared English and Russian fallback pages retain their own body language',()=>{
 const source=lang=>`<!doctype html><html lang="${lang}" data-ada-shared-locale="en"><head><meta name="robots" content="noindex, nofollow"></head><body><header><a href="/tours/">Туры</a></header><main><h1>${lang==='en'?'4 Days in Rio':'Непереведённый тур'}</h1><img src="/adatours-en/media/shared.webp"></main><footer>О нас</footer></body></html>`;
 const known=new Set(['/','/tours/']);
 for(const lang of ['ru','en']) {
  const html=russianFallbackHtml(source(lang),'/',known,{sharedContent:true});
  assert.match(html,new RegExp('lang="'+lang+'"'));
  assert.match(html,/href="\/adatours-en\/en\/tours\/">Tours/);
  assert.match(html,/https:\/\/img.adatours.ru\/media\/shared.webp/);
  assert.match(html,lang==='en'?/data-ada-en-content="true"/:/data-ada-ru-fallback="true"/);
 }
 assert.throws(()=>russianFallbackHtml(source('en'),'/',known),/Expected canonical RU HTML/);
});
