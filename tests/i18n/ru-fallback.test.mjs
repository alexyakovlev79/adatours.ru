import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parse} from 'parse5';
import {russianFallbackHtml,discoverRussianPages,stageRussianFallback} from '../../scripts/i18n/ru-fallback.mjs';

const source=()=>[
 '<!doctype html><html lang="ru"><head>',
 '<meta name="robots" content="noindex, nofollow">',
 '<link rel="canonical" href="https://adatours.ru/">',
 '<meta property="og:title" content="RU">',
 '<script type="application/ld+json">{"@type":"TouristTrip"}</script>',
 '</head><body><header data-site-shell-src="/shared/site-shell-123.html"><button data-search-open>Поиск</button></header>',
 '<div data-search-overlay data-pagefind-bundle="/adatours-en/pagefind/" data-search-base="/adatours-en/"></div>',
 '<section class="hero"><img class="hero__media" src="/adatours-en/media/home/hero.webp" fetchpriority="high"></section>',
 '<hero-background-video><template data-static-hero><img src="/adatours-en/media/home/video-hero.webp"></template><video data-src="/adatours-en/media/video/hero.mp4"></video></hero-background-video>',
 '<a href="/adatours-en/brazil/">Страна</a><a href="/adatours-en/tours/">Туры</a><a href="/about/">О нас</a>',
 '<div data-multi-country-picker data-root-href="/adatours-en/multi-country/" data-current-root-href="/multi-country/"></div>',
 '<input data-tour-vip-toggle data-href="/adatours-en/vip/">',
 '<a href="#request">Оставить заявку</a><a href="/adatours-en/old-brazil/">Alias</a>',
 '<form data-lead-form action="/live" method="post"><input name="phone"><button type="submit">Submit</button></form>',
 '<script src="https://www.googletagmanager.com/gtag.js"></script>',
 '<script src="/adatours-en/_astro/site.js" type="module"></script>',
 '<img data-lazy-src="/adatours-en/media/home/test.webp" src="data:image/svg+xml,empty">',
 '<picture data-lazy-picture><source data-lazy-srcset="/adatours-en/media/phone.webp 400w"><img src="data:image/svg+xml,empty" data-lazy-src="/adatours-en/media/other.webp"></picture>',
 '<div data-lazy-style="background-image:url(/adatours-en/media/home/bg.webp)" data-lazy-background="1"></div>',
 '</body></html>'
].join('');

test('canonical mirror keeps Hero, videos, lazy images, full search and safe visible form',()=>{
 const known=new Set(['/','/brazil/','/tours/','/about/','/multi-country/','/vip/']),html=russianFallbackHtml(source(),'/',known);
 assert.match(html,/<html lang="ru" data-ada-ru-fallback="true"/);
 assert.match(html,/noindex,nofollow,noarchive,nosnippet/);
 assert.match(html,/\/adatours-en\/en\/brazil\//);
 assert.match(html,/\/adatours-en\/en\/tours\//);
 assert.match(html,/\/adatours-en\/en\/about\//);
 assert.match(html,/data-root-href="\/adatours-en\/en\/multi-country\/"/);
 assert.match(html,/data-current-root-href="\/adatours-en\/en\/multi-country\/"/);
 assert.match(html,/data-href="\/adatours-en\/en\/vip\/"/);
 for(const image of ['hero.webp','video-hero.webp','test.webp','phone.webp','other.webp','bg.webp'])
  assert.ok(html.includes('https://img.adatours.ru/media/'),image);
 assert.match(html,/https:\/\/img\.adatours\.ru\/media\/home\/hero\.webp/);
 assert.match(html,/https:\/\/img\.adatours\.ru\/media\/home\/bg\.webp/);
 assert.match(html,/data-search-open/);
 assert.match(html,/data-site-shell-src="\/adatours-en\/shared\/site-shell-123\.html"/);
 assert.match(html,/data-search-overlay/);
 assert.match(html,/data-search-base="\/adatours-en\/en\/"/);
 assert.match(html,/_astro\/site\.js/);
 assert.match(html,/<form[^>]+inert/);
 assert.match(html,/data-ada-staging-inert-form="true"/);
 assert.match(html,/<button type="button">Submit/);
 assert.match(html,/mailto:info@adatours\.ru/);
 assert.doesNotMatch(html,/data-lazy-src=|data-lazy-style=|data-lazy-srcset=/);
 assert.doesNotMatch(html,/data-ada-translation-notice|currently available in Russian/);
 assert.doesNotMatch(html,/data-lead-form|method="post"|application\/ld\+json|<link rel="canonical"|googletagmanager/);
});
test('route-map popups reuse canonical EN links without cloning or changing geographic data',()=>{
 const payload={points:[{id:'rio',href:'/adatours-en/brazil/',coordinates:[-43.2,-22.9],image:'https://img.adatours.ru/media/rio.webp'}],route:['rio'],center:[-43.2,-22.9],zoom:8};
 const input=source().replace('</body>',`<section data-geo-map-payload='${JSON.stringify(payload)}'></section></body>`);
 const html=russianFallbackHtml(input,'/',new Set(['/','/brazil/','/tours/','/about/','/multi-country/','/vip/']));
 let encoded;
 const walk=node=>{const a=node.attrs?.find(a=>a.name==='data-geo-map-payload');if(a)encoded=a.value;for(const child of node.childNodes??[])walk(child)};
 walk(parse(html));
 const actual=JSON.parse(encoded);
 assert.equal(actual.points[0].href,'/adatours-en/en/brazil/');
 actual.points[0].href=payload.points[0].href;
 assert.deepEqual(actual,payload);
});
test('all public canonical RU routes mirror exactly once and old aliases are excluded',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ada-full-stage-'));
 const dist=path.join(dir,'dist'),out=path.join(dir,'out');
 try{
  for(const part of ['', 'brazil','tours','_astro','en/tours']){
   const folder=path.join(dist,part);fs.mkdirSync(folder,{recursive:true});
   fs.writeFileSync(path.join(folder,'index.html'),source());
  }
  fs.mkdirSync(path.join(dist,'shared'),{recursive:true});
  fs.writeFileSync(path.join(dist,'shared/site-shell-123.html'),source());
  fs.mkdirSync(path.join(dist,'old-brazil'),{recursive:true});
  fs.writeFileSync(path.join(dist,'old-brazil','index.html'),
   '<!doctype html><html lang="ru"><head><meta http-equiv="refresh" content="0;url=/adatours-en/brazil/"></head><body>Redirect</body></html>');
  const inventory=discoverRussianPages(dist);
  assert.deepEqual(inventory.map(x=>x.route),['/','/brazil/','/old-brazil/','/tours/']);
  const r=stageRussianFallback({dist,output:out,minPages:2});
  assert.equal(r.ruSourcePages,4);
  assert.equal(r.englishPrecedence,0);
  assert.equal(r.redirectAliases,1);
  assert.equal(r.ruFallbackPages,3);
  assert.equal(r.fullCatalogueAlias,0);
  assert.equal(r.sharedFragments,1);
  assert.ok(fs.existsSync(path.join(out,'shared/site-shell-123.html')));
  const html=fs.readFileSync(path.join(out,'en','index.html'),'utf8');
  assert.match(html,/data-ada-ru-fallback/);
  assert.match(html,/https:\/\/adatours\.ru\/old-brazil\//);
  assert.equal(fs.existsSync(path.join(out,'en','old-brazil','index.html')),false);
  assert.ok(fs.existsSync(path.join(out,'en','tours','index.html')));
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('non-Russian HTML and incomplete source are rejected',()=>{
 assert.throws(()=>russianFallbackHtml(source().replace('lang="ru"','lang="en"'),'/',new Set(['/'])),/RU HTML/);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ada-full-stage-'));
 try{fs.writeFileSync(path.join(dir,'index.html'),source());
  assert.throws(()=>stageRussianFallback({dist:dir,output:path.join(dir,'out')}),/Incomplete RU build|Unsafe output/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});


test('shared English projection keeps the live lead form and modal triggers',()=>{
 const known=new Set(['/','/brazil/','/tours/','/about/','/multi-country/','/vip/']);
 const input=source().replace('lang="ru"','lang="en" data-ada-shared-locale="en"')
   .replace('<script src="/adatours-en/_astro/site.js"', '<script src="/adatours-en/form-config.js?v=1"></script><script src="/adatours-en/_astro/site.js"')
   .replace('<a href="#request">','<a href="#request" data-lead-modal="true">');
 const html=russianFallbackHtml(input,'/',known,{sharedContent:true});
 assert.match(html,/data-lead-form/);
 assert.match(html,/method="post"/);
 assert.match(html,/type="submit"/);
 assert.match(html,/data-lead-modal="true"/);
 assert.match(html,/href="#request"/);
 assert.ok(html.includes('/adatours-en/form-config.js?v=1'));
 assert.doesNotMatch(html,/data-ada-staging-inert-form|mailto:info@adatours\\.ru/);
});
