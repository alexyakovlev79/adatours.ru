#!/usr/bin/env node
/** Verify full shared pages, accepted English fields and explicit RU fallback. */
import fs from 'node:fs';
import path from 'node:path';
import {parse} from 'parse5';
import {EN_STAGING_BASE} from '../../src/lib/i18n/en-staging-site.mjs';
import uiCopy from '../../src/data/i18n/ui-copy.json' with {type:'json'};
const root=path.resolve(process.argv[2]||'pages-site');
const fail=m=>{throw Error('Shared EN output: '+m)};
const find=(n,p)=>{const r=[];const visit=x=>{if(p(x))r.push(x);for(const c of x.childNodes??[])visit(c)};visit(n);return r};
const attr=(n,k)=>n?.attrs?.find(a=>a.name===k)?.value??null;
const textOf=n=>n?.nodeName==='#text'?n.value:(n?.childNodes??[]).map(textOf).join(' ');
const clean=s=>s.replace(/\s+/gu,' ').trim();
const receiptPath=path.join(root,'translation-receipt.json');
const receipt=fs.existsSync(receiptPath)?JSON.parse(fs.readFileSync(receiptPath,'utf8')):null;
const sharedContent=receipt?.mode==='shared-canonical-english';
if(process.env.EN_SHARED_CONTENT==='1' && !sharedContent)fail('Missing shared translation receipt');
if(sharedContent && (!/^[a-f0-9]{40}$/.test(receipt.canonicalSourceSha??'') || receipt.counts.invalid!==0 || !receipt.counts.translatedFields))
 fail('Invalid or empty accepted translation receipt');
const translated=new Map((receipt?.entries??[]).filter(x=>x.applied>0).map(x=>[x.sourceId,x]));
const verifiedEntities=new Map();
const readyInterestLabels=new Set(Object.entries(uiCopy.messages)
 .filter(([key,row])=>key.startsWith('interest.') && row.ru!==row.en)
 .map(([,row])=>clean(row.ru).toLocaleLowerCase('ru')));
let count=0,englishPages=0,russianPages=0,checkedInternalLinks=0,relatedCatalogueLabels=0;
const visit=p=>{for(const e of fs.readdirSync(p,{withFileTypes:true})){
 if(e.isDirectory())visit(path.join(p,e.name));
 else if(e.name==='index.html'){
  const name=path.join(p,e.name),source=fs.readFileSync(name,'utf8');
  const dom=parse(source),html=find(dom,x=>x.tagName==='html')[0];
  const lang=attr(html,'lang');
  if(sharedContent ? attr(html,'data-ada-shared-locale')!=='en' : attr(html,'data-ada-ru-fallback')!=='true')
   fail('Page escaped the complete shared renderer '+name);
  count++; if(lang==='en')englishPages++; else if(lang==='ru')russianPages++; else fail('Unknown body language '+name);
  if(source.includes(EN_STAGING_BASE+'media/'))fail('Unresolved local media '+name);
  const robots=find(dom,x=>x.tagName==='meta'&&attr(x,'name')==='robots');
  if((lang==='ru' && attr(html,'data-ada-ru-fallback')!=='true') ||
     (lang==='en' && attr(html,'data-ada-en-content')!=='true') ||
     robots.length!==1 || attr(robots[0],'content')!=='noindex,nofollow,noarchive,nosnippet' ||
     find(dom,x=>x.tagName==='aside'&&attr(x,'data-ada-translation-notice')!==null).length ||
     find(dom,x=>x.tagName==='form'&&(
       attr(x,'data-ada-staging-inert-form')!=='true'||attr(x,'inert')===null||
       attr(x,'data-lead-form')!==null||attr(x,'method')==='post')||
       x.tagName==='script'&&!attr(x,'src')?.startsWith(EN_STAGING_BASE+'_astro/')).length ||
     find(dom,x=>x.tagName==='link'&&['canonical','alternate'].includes(attr(x,'rel'))).length)
   fail('Staging boundaries or content language '+name);
  const id=attr(html,'data-ada-entity-id'),item=translated.get(id);
  if(item){
   const heading=find(dom,x=>x.tagName==='h1').map(textOf).map(clean);
   if(heading.includes(clean(item.displayName??''))){
    if(!source.includes('class="hero')||!find(dom,x=>x.tagName==='main').length||!find(dom,x=>x.tagName==='footer').length)
     fail('Incomplete shared entity layout '+id);
    verifiedEntities.set(id,path.relative(root,name));
   }
  }
  if(sharedContent)for(const section of find(dom,node=>attr(node,'data-multi-country-related')!==null)){
   for(const details of find(section,node=>node.tagName==='details')){
    for(const link of find(details,node=>node.tagName==='a')){
     const label=clean(textOf(link)),parts=label.split(/\s+·\s+/u);
     const interest=parts[0].split(':').at(-1).trim().toLocaleLowerCase('ru');
     if(readyInterestLabels.has(interest) || /^\d+\s+(?:тур|тура|туров)$/u.test(parts.at(-1)))
      fail('Prepared related-catalogue label reverted: '+label+' / '+name);
     relatedCatalogueLabels++;
    }
   }
  }
  for(const link of find(dom,x=>x.tagName==='a')){
   const href=attr(link,'href');
   if(!href?.startsWith(EN_STAGING_BASE+'en/'))continue;
   const pathname=href.split(/[?#]/,1)[0],route=pathname.slice(EN_STAGING_BASE.length);
   const segments=route.split('/').filter(Boolean);
   if(segments.some(s=>s==='.'||s==='..'||s.includes('\\')||s.includes('%')))
    fail('Unsafe EN link '+href+' in '+name);
   if(!fs.existsSync(path.join(root,route,'index.html')))
    fail('Missing shared EN link '+href+' in '+name);
   checkedInternalLinks++;
  }
 }
}};
visit(path.join(root,'en'));
if(count<6000)fail('Incomplete canonical catalogue: '+count);
if(!fs.existsSync(path.join(root,'pagefind/pagefind.js')))fail('Missing full-site Pagefind search assets');
for(const target of ['en/index.html','en/brazil/index.html','en/about/index.html','en/tours/index.html','en/country/index.html','en/places/index.html','en/excursions/index.html','en/interests/index.html','en/multi-country/index.html','en/mice/index.html','en/dmc/index.html']){
 const file=path.join(root,target);
 if(!fs.existsSync(file))fail('Missing canonical page: '+target);
}
const fullTours=fs.readFileSync(path.join(root,'en/tours/index.html'),'utf8');
if(fullTours.includes('data-ada-translation-notice') ||
   (sharedContent && (!fullTours.includes('Journeys through Latin America') ||
    !fullTours.includes('Choose a country') || !fullTours.includes('Choose an interest') ||
    Number(fullTours.match(/data-catalog-total="([0-9]+)"/)?.[1]??0)<300)))
 fail('Full translated catalogue or filters lost');
for(const [id,item] of translated)if(!verifiedEntities.has(id))
 fail('Accepted English content did not reach its canonical page: '+id+' / '+item.displayName);
// The landing page and later catalogue pages use separate render paths. Check
// their structured card labels, without applying substitutions to tour titles
// or to untranslated editorial prose.
let multiCountryCardPages=0;
if(sharedContent){
 const readyCountries=[...translated.values()].filter(item=>item.collection==='countries' &&
  item.sourceName && item.displayName && item.sourceName!==item.displayName);
 for(const target of ['en/multi-country/index.html','en/multi-country/page/2/index.html']){
  const dom=parse(fs.readFileSync(path.join(root,target),'utf8'));
  const cards=find(dom,node=>attr(node,'data-catalog-item')!==null);
  const labels=cards.flatMap(card=>find(card,node=>node.tagName==='p' &&
   (attr(node,'class')??'').split(/\s+/u).includes('eyebrow'))).map(textOf).map(clean);
  if(!labels.length)fail('Missing multi-country card metadata '+target);
  for(const label of labels){
   const parts=label.split(/\s+·\s+/u);
   for(const country of readyCountries)if(parts[0].includes(country.sourceName))
    fail('Prepared country name reverted in card metadata: '+country.sourceName+' / '+target);
   if(/^\d+\s+(?:дней|дня|день)$/u.test(parts[1]??''))
    fail('Prepared day label reverted in card metadata: '+target);
  }
  multiCountryCardPages++;
 }
}
const homepage=fs.readFileSync(path.join(root,'en/index.html'),'utf8');
if(!homepage.includes('data-site-shell-src="'+EN_STAGING_BASE+'shared/site-shell-')||
   !homepage.includes('data-site-shell="search"'))fail('Shared header/search/footer loader missing');
const shared=path.join(root,'shared');
const fragments=fs.existsSync(shared)?fs.readdirSync(shared).filter(p=>/^site-shell-[a-f0-9]+\.html$/.test(p)):[];
if(fragments.length!==1)fail('Expected exactly one shared site shell');
const sharedHtml=fs.readFileSync(path.join(shared,fragments[0]),'utf8');
if(!sharedHtml.includes('data-search-overlay')||!sharedHtml.includes('data-search-open')||
   !sharedHtml.includes('data-search-base="'+EN_STAGING_BASE+'en/"'))fail('Shared navigation/search missing');
if(sharedContent && (!sharedHtml.includes('Travel interests') || !sharedHtml.includes('Send an enquiry')))
 fail('Shared interface reverted to Russian');
if(/data-lazy-src=|data-lazy-srcset=|data-lazy-style=/.test(homepage))fail('Staged homepage retains image placeholders');
if(!homepage.includes('https://img.adatours.ru/media/'))fail('Shared CDN assets missing');
if(/data-ada-translation-notice|This page is currently available in Russian/i.test(homepage))fail('Unrequested translation banner');
const result={status:'passed',canonicalFullSite:true,canonicalPages:count,englishPages,russianFallbackPages:russianPages,
 translatedEntities:verifiedEntities.size,translatedFields:receipt?.counts.translatedFields??0,
 noindex:true,canonicalSuppressed:true,formsDisabled:true,checkedInternalLinks,multiCountryCardPages,relatedCatalogueLabels};
if(receipt){receipt.outputVerification={...result,entityPages:Object.fromEntries(verifiedEntities)};
 fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify(result));

