#!/usr/bin/env node
/** Validate the noindex RU-content mirror, without treating fallback as translation. */
import fs from 'node:fs';
import path from 'node:path';
import {parse} from 'parse5';
import {EN_STAGING_BASE} from '../../src/lib/i18n/en-staging-site.mjs';
import {verifiedEnglishRoutes} from './stage-en-translations.mjs';
const root=path.resolve(process.argv[2]||'pages-site');
const fail=m=>{throw Error('RU fallback output: '+m)};
const find=(n,p)=>{const r=[];const visit=x=>{if(p(x))r.push(x);for(const c of x.childNodes??[])visit(c)};visit(n);return r};
const attr=(n,k)=>n?.attrs?.find(a=>a.name===k)?.value??null;
let count=0,checkedInternalLinks=0;
const visit=p=>{for(const e of fs.readdirSync(p,{withFileTypes:true})){
 if(e.isDirectory())visit(path.join(p,e.name));
 else if(e.name==='index.html'){
  const name=path.join(p,e.name),source=fs.readFileSync(name,'utf8');
  if(source.includes('data-ada-ru-fallback')){
   if(source.includes(EN_STAGING_BASE+'media/'))fail('Unresolved local media '+name);
   count++;const dom=parse(source),html=find(dom,x=>x.tagName==='html')[0];
   const robots=find(dom,x=>x.tagName==='meta'&&attr(x,'name')==='robots');
   if(attr(html,'lang')!=='ru'||attr(html,'data-ada-ru-fallback')!=='true'||
     robots.length!==1||attr(robots[0],'content')!=='noindex,nofollow,noarchive,nosnippet'||
     find(dom,x=>x.tagName==='aside'&&attr(x,'data-ada-translation-notice')!==null).length||
     find(dom,x=>x.tagName==='form'&&(
       attr(x,'data-ada-staging-inert-form')!=='true'||attr(x,'inert')===null||
       attr(x,'data-lead-form')!==null||attr(x,'method')==='post')||
       x.tagName==='script'&&!attr(x,'src')?.startsWith(EN_STAGING_BASE+'_astro/')).length||
     find(dom,x=>x.tagName==='link'&&attr(x,'rel')==='canonical').length)
     fail('Fallback security/identity '+name);
   for(const link of find(dom,x=>x.tagName==='a')){
    const href=attr(link,'href');
    if(!href?.startsWith(EN_STAGING_BASE+'en/'))continue;
    const pathname=href.split(/[?#]/,1)[0];
    const route=pathname.slice(EN_STAGING_BASE.length);
    const segments=route.split('/').filter(Boolean);
    if(!route.startsWith('en/')||segments.some(s=>s==='.'||s==='..'||s.includes('\\')||s.includes('%')))
     fail('Unsafe EN link '+href+' in '+name);
    if(!fs.existsSync(path.join(root,route,'index.html')))
     fail('Missing staged EN link '+href+' in '+name);
    checkedInternalLinks++;
   }
  }
 }
}};
visit(path.join(root,'en'));
if(count<6000)fail('Incomplete canonical RU mirror: '+count);
if(!fs.existsSync(path.join(root,'pagefind/pagefind.js')))fail('Missing full-site Pagefind search assets');
for(const target of ['en/index.html','en/about/index.html','en/country/index.html','en/places/index.html','en/excursions/index.html','en/interests/index.html','en/multi-country/index.html','en/mice/index.html','en/dmc/index.html','en/tours-ru/index.html']){
 const file=path.join(root,target);
 if(!fs.existsSync(file)||!fs.readFileSync(file,'utf8').includes('data-ada-ru-fallback'))
  fail('Missing expected Russian fallback: '+target);
}
const englishRoutes=verifiedEnglishRoutes();
for(const row of englishRoutes){
 const file=path.join(root,row.target.slice(1),'index.html');
 if(!fs.existsSync(file))fail('Missing verified English '+row.target);
 const html=fs.readFileSync(file,'utf8');
 if(!html.includes('lang="en"')||!html.includes('data-ada-en-pilot="true"')||
    html.includes('data-ada-ru-fallback')||html.includes('/en-pilot-private/'))
  fail('English precedence/route identity '+row.target);
 const dom=parse(html);
 for(const link of find(dom,x=>x.tagName==='a')){
  const href=attr(link,'href');
  if(!href?.startsWith(EN_STAGING_BASE+'en/'))continue;
  const target=href.slice(EN_STAGING_BASE.length).split(/[?#]/,1)[0];
  if(!fs.existsSync(path.join(root,target,'index.html')))
   fail('Broken translated-page navigation '+href+' in '+row.target);
 }
}
const fullTours=fs.readFileSync(path.join(root,'en/tours-ru/index.html'),'utf8');
if(!fullTours.includes('lang="ru"')||!fullTours.includes('data-ada-ru-fallback'))
 fail('The complete untranslated catalogue must remain reachable');
const homepage=fs.readFileSync(path.join(root,'en/index.html'),'utf8');
if(!homepage.includes('data-site-shell-src="'+EN_STAGING_BASE+'shared/site-shell-')||
   !homepage.includes('data-site-shell="search"'))
 fail('Shared header/search/footer loader missing');
const shared=path.join(root,'shared');
const fragments=fs.existsSync(shared)?fs.readdirSync(shared).filter(p=>/^site-shell-[a-f0-9]+\.html$/.test(p)):[];
if(fragments.length!==1)fail('Expected exactly one copied shared site shell');
const sharedHtml=fs.readFileSync(path.join(shared,fragments[0]),'utf8');
if(!sharedHtml.includes('data-search-overlay')||!sharedHtml.includes('data-search-open')||
   !sharedHtml.includes('Tours')||!sharedHtml.includes('Countries')||
   !sharedHtml.includes('data-search-base="'+EN_STAGING_BASE+'en/"'))
 fail('Shared navigation/search not mirrored for English routes');
if(/data-lazy-src=|data-lazy-srcset=|data-lazy-style=/.test(homepage))
 fail('Staged homepage retains unloaded image placeholders');
if(!homepage.includes('https://img.adatours.ru/media/'))
 fail('Shared CDN hero/photo assets missing from homepage');
if(/data-ada-translation-notice|This page is currently available in Russian/i.test(homepage))
 fail('Unrequested translation banner');
console.log(JSON.stringify({status:'passed',russianFallbackPages:count,englishPages:englishRoutes.length,
 canonicalFullSite:true,
 noindex:true,canonicalSuppressed:true,formsDisabled:true,checkedInternalLinks}));
