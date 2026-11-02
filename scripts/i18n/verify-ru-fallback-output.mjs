#!/usr/bin/env node
/** Validate the noindex RU-content mirror, without treating fallback as translation. */
import fs from 'node:fs';
import path from 'node:path';
import {parse} from 'parse5';
import {EN_STAGING_BASE} from '../../src/lib/i18n/en-staging-site.mjs';
const root=path.resolve(process.argv[2]||'pages-site');
const fail=m=>{throw Error('RU fallback output: '+m)};
const find=(n,p)=>{const r=[];const visit=x=>{if(p(x))r.push(x);for(const c of x.childNodes??[])visit(c)};visit(n);return r};
const attr=(n,k)=>n?.attrs?.find(a=>a.name===k)?.value??null;
let count=0;
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
     !find(dom,x=>x.tagName==='aside'&&attr(x,'data-ada-translation-notice')==='ru').length||
     find(dom,x=>x.tagName==='form'||x.tagName==='iframe'||x.tagName==='script'&&
       !attr(x,'src')?.startsWith(EN_STAGING_BASE+'_astro/')).length||
     find(dom,x=>x.tagName==='link'&&attr(x,'rel')==='canonical').length)
     fail('Fallback security/identity '+name);
  }
 }
}};
visit(path.join(root,'en'));
if(count<1000)fail('Missing Russian fallback pages: '+count);
for(const target of ['en/index.html','en/brazil/index.html','en/about/index.html','en/tours-ru/index.html']){
 const file=path.join(root,target);
 if(!fs.existsSync(file)||!fs.readFileSync(file,'utf8').includes('data-ada-ru-fallback'))
  fail('Missing expected Russian fallback: '+target);
}
const english=fs.readFileSync(path.join(root,'en/tours/index.html'),'utf8');
if(!english.includes('lang="en"')||english.includes('data-ada-ru-fallback'))
 fail('Native EN route was overwritten by RU fallback');
console.log(JSON.stringify({status:'passed',russianFallbackPages:count,englishPagesRetained:true,
 noindex:true,canonicalSuppressed:true,formsDisabled:true}));
