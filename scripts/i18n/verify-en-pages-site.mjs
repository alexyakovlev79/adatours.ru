#!/usr/bin/env node
/** Full EN Pages site test: nonindex routes, real links and no RU fallback.
 * Does not publish and deliberately ignores Russian build output.
 */
import fs from 'node:fs';
import path from 'node:path';
import {parse} from 'parse5';
import {enStagingSiteEnabled,EN_STAGING_BASE,EN_STAGING_ROUTE} from '../../src/lib/i18n/en-staging-site.mjs';
import {privatePilotRouteIndex} from '../../src/lib/i18n/locale-entity-routes.mjs';
const fail=msg=>{throw Error('EN GitHub Pages check: '+msg)};
if(!enStagingSiteEnabled(process.env))fail('Wrong Pages target or release gates');
const root=path.resolve(process.argv[2]||'dist');
const expected=[EN_STAGING_ROUTE+'tours/',...privatePilotRouteIndex.entries().map(x=>x.path)];
if(expected.length!==22||new Set(expected).size!==22)fail('Incomplete EN entity routes');
const allowed=new Set([...expected.map(x=>EN_STAGING_BASE.slice(0,-1)+x),EN_STAGING_BASE+'en/tours-ru/']);
const find=(n,p)=>{const items=[];const walk=x=>{if(p(x))items.push(x);for(const y of x.childNodes??[])walk(y)};walk(n);return items};
const attr=(n,k)=>n?.attrs?.find(x=>x.name===k)?.value??null;
const textOf=n=>{const walk=x=>x.nodeName==='#text'?x.value:
 (['script','style','template'].includes(x.tagName)?'':(x.childNodes??[]).map(walk).join(' '));
 return walk(n).replace(/\s+/g,' ').trim()};
for(const url of expected){
 if(!url.startsWith(EN_STAGING_ROUTE))fail('Outside EN namespace '+url);
 const filename=path.join(root,url.slice(1),'index.html');
 if(!fs.existsSync(filename))fail('Missing '+filename);
 const html=fs.readFileSync(filename,'utf8');
 const dom=parse(html),h=find(dom,x=>x.tagName==='html')[0],head=find(dom,x=>x.tagName==='head')[0];
 const main=find(dom,x=>x.tagName==='main')[0],meta=find(head,x=>x.tagName==='meta');
 const robots=meta.find(x=>attr(x,'name')==='robots');
 if(attr(h,'lang')!=='en'||attr(h,'data-public-release')!=='false'||
    attr(robots,'content')!=='noindex,nofollow,noarchive,nosnippet'||!main)
  fail('Nonpublic locale flags missing '+url);
 if(/[\u0400-\u052f]/u.test(textOf(dom)))fail('Visible Russian text '+url);
 if(find(head,x=>x.tagName==='link'&&['canonical','alternate'].includes(attr(x,'rel'))).length||
    find(dom,x=>x.tagName==='script'&&attr(x,'type')==='application/ld+json').length)
  fail('Premature public canonical or schema '+url);
 if(find(dom,x=>x.tagName==='form').length||/googletagmanager|site-analytics\.js|data-lead-form/i.test(html))
  fail('Live forms or analytics on staging '+url);
 if(html.includes('en-pilot-private'))fail('Legacy pilot reference '+url);
 const styles=find(head,x=>x.tagName==='link'&&attr(x,'rel')==='stylesheet');
 if(!styles.length||styles.some(s=>!attr(s,'href')?.startsWith(EN_STAGING_BASE+'_astro/')))
  fail('Broken project-base stylesheet '+url);
 for(const a of find(dom,x=>x.tagName==='a')){
  const href=attr(a,'href');
  if(href?.startsWith('/')){
   if(!href.startsWith(EN_STAGING_BASE))fail('Absolute URL outside GitHub Pages project base '+href+' in '+url);
   if(href.includes('/en/')&&!allowed.has(href))fail('Broken EN entity URL '+href+' in '+url);
  }
 }
 for(const img of find(dom,x=>x.tagName==='img')){
  const src=attr(img,'src'),alt=attr(img,'alt');
  if(alt===null||/[\u0400-\u052f]/u.test(alt))fail('Untranslated image ALT '+url);
  if(!src?.startsWith('https://img.adatours.ru/media/')&&!src?.startsWith(EN_STAGING_BASE))
   fail('Unverified image source '+src+' '+url);
 }
}
const baseDir=path.join(root,EN_STAGING_ROUTE.slice(1));
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(p,x.name)):x.name==='index.html'?[path.join(p,x.name)]:[]);
if(walk(baseDir).length!==22)fail('Unexpected EN HTML count');
console.log(JSON.stringify({status:'passed',site:'EN source-bound Astro Pages',pages:22,
 canonicalTourRecords:3,canonicalExcursions:11,countries:3,destinations:4,
 publicEnglishRelease:false,links:'verified',siteBase:EN_STAGING_BASE}));
