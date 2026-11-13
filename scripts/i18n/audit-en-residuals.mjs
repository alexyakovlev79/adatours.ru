#!/usr/bin/env node
/**
 * Stage 9: evidence-only inventory of Cyrillic in every generated noindex EN
 * document, plus source candidates for JS-controlled user-visible states.
 * Never changes canonical RU, translation queues, receipts, images or routes.
 * A language detector is NOT a translation verifier: every hit is classified,
 * and permissive RU content fallbacks are kept separate from UI/SEO defects.
 */
import fs from 'node:fs';
import path from 'node:path';
import {parse} from 'parse5';
import {classifyEnResidual} from './classify-en-residual.mjs';

const root=path.resolve(process.argv[2]??'../en-pages-site');
const reportPath=path.resolve(process.argv[3]??'../stage9-residual-audit.json');
const detailsPath=path.resolve(process.argv[4]??'../stage9-residual-urls.ndjson');
const jsPath=path.resolve(process.argv[5]??'../stage9-js-sources.json');
const cyr=/[\u0400-\u052f]/u;
const normalized=value=>String(value??'').replace(/\s+/gu,' ').trim();
const get=(node,key)=>node?.attrs?.find(x=>x.name===key)?.value??null;
const tag=node=>node?.tagName??'';
const skip=new Set(['style','svg','math','code','pre','textarea']);
const interactive=new Set(['button','label','option','summary','select']);
const uiAttributes=new Set(['aria-label','aria-description','placeholder','title','aria-valuetext']);
const jsAttribute=/^data-(?:.*(?:message|label|loading|empty|error|success|text|count|result|status))$/i;
const pages=[],groups=new Map(),byClass={},errors=[],topSamples={};
let occurrences=0,englishPages=0,fallbackPages=0,pagesWithCyrillic=0,plainEnglishPages=0;
let headCyrillic=0,jsStateCandidates=0,sitePages=0;
const MAX_GROUP_SAMPLES=5;
function findPages(folder){
 if(!fs.existsSync(folder))throw Error('Missing generated EN route tree: '+folder);
 for(const ent of fs.readdirSync(folder,{withFileTypes:true})){
  if(ent.isSymbolicLink())throw Error('Symlink in EN output: '+ent.name);
  const p=path.join(folder,ent.name);
  if(ent.isDirectory())findPages(p);
  else if(ent.isFile()&&ent.name==='index.html')pages.push(p);
 }
}
findPages(path.join(root,'en'));pages.sort();
if(pages.length<1000)throw Error('Incomplete EN tree: only '+pages.length+' pages');
fs.mkdirSync(path.dirname(reportPath),{recursive:true});
const fd=fs.openSync(detailsPath,'w');
function selector(stack){
 const items=stack.filter(x=>x.tagName).slice(-5);
 return items.map(x=>{
  const id=get(x,'id'),className=(get(x,'class')??'').trim().split(/\s+/).slice(0,2).filter(Boolean);
  return x.tagName+(id?'#'+id:'')+(className.length?'.'+className.join('.'):'');
 }).join(' > ');
}
function sourceHint(route,category){
 if(category==='seo_pending_stage7')return 'src/lib/seo-meta.mjs / src/layouts/BaseLayout.astro';
 if(category==='media_pending_stage6')return 'src/lib/i18n/media-copy.mjs / src/data/media/';
 if(category==='ui_localization_gap')return 'src/data/i18n/ui-copy.json / src/components/';
 if(category==='tour_itinerary_source_review')return 'src/content/tours/ / source-bound Tour translations';
 if(category==='entity_breadcrumb_source_review')return 'src/content/ / localized entity labels and Tour fields';
 if(category==='seo_article_heading_source_review')return 'data/seo-geo/articles/ / EN FULLTEXT source overlay';
 if(route.includes('/press/')||route.includes('/webinars/')||route.includes('/partners/'))
  return 'src/data/i18n/authority-pages.*.en.json / src/pages/';
 if(route.includes('/mice/')||route.includes('/dmc/'))
  return 'src/lib/i18n/commercial-copy.mjs / src/pages/';
 return 'src/content/ (RU fallback) or src/pages/ (check route owner)';
}

function record(item){
 occurrences++;byClass[item.classification]=(byClass[item.classification]??0)+1;
 if(item.classification==='seo_pending_stage7')headCyrillic++;
 const key=item.classification+'\u001f'+item.field+'\u001f'+normalized(item.value).slice(0,700);
 let row=groups.get(key);
 if(!row){
  row={classification:item.classification,field:item.field,value:item.value.slice(0,280),
   sourceHint:item.sourceHint,occurrences:0,sampleUrls:[],sampleSelectors:[]};
  groups.set(key,row);
 }
 row.occurrences++;
 if(row.sampleUrls.length<MAX_GROUP_SAMPLES&&!row.sampleUrls.includes(item.url))row.sampleUrls.push(item.url);
 if(row.sampleSelectors.length<3&&!row.sampleSelectors.includes(item.selector))row.sampleSelectors.push(item.selector);
 if((topSamples[item.classification]?.length??0)<8){
  topSamples[item.classification]??=[];
  topSamples[item.classification].push({url:item.url,selector:item.selector,value:item.value.slice(0,160)});
 }
 fs.writeSync(fd,JSON.stringify(item)+'\n');
}
for(const file of pages){
 const local=path.relative(path.join(root,'en'),file).split(path.sep).join('/');
 const route='/en/'+local.replace(/index\.html$/,'');
 const url='https://alexyakovlev79.github.io/adatours-en'+route;
 const dom=parse(fs.readFileSync(file,'utf8'));
 const html=(dom.childNodes??[]).find(x=>tag(x)==='html');
 if(!html){errors.push({url,problem:'missing-html'});continue;}
 const fallback=get(html,'data-ada-ru-fallback')==='true';
 const english=get(html,'data-ada-en-content')==='true';
 if(fallback)fallbackPages++;else if(english)englishPages++;
 else errors.push({url,problem:'missing-locale-marker'});
 if(!['en','ru'].includes(get(html,'lang')))errors.push({url,problem:'invalid-html-lang',value:get(html,'lang')});
 const head=(html.childNodes??[]).find(x=>tag(x)==='head');
 const metas=(head?.childNodes??[]).filter(x=>tag(x)==='meta');
 if(!metas.some(x=>get(x,'name')==='robots'&&get(x,'content')?.includes('noindex')))
  errors.push({url,problem:'missing-noindex'});
 if((head?.childNodes??[]).some(x=>tag(x)==='link'&&['canonical','alternate'].includes(get(x,'rel'))))
  errors.push({url,problem:'premature-canonical-or-hreflang'});
 let found=0;
 function hit(value,stack,field){
  const trimmed=normalized(value);
  if(!trimmed||!cyr.test(trimmed))return;
  found++;
  const classification=classifyEnResidual({stack,field,fallback,route});
  record({url,route,selector:selector(stack),field,value:trimmed.slice(0,950),
   classification,sourceHint:sourceHint(route,classification),pageMode:fallback?'RU fallback':'mixed EN'});
 }
 function visit(node,stack=[]){
  const t=tag(node);
  if(skip.has(t))return;
  if(t==='script'){
   // The owner authorised test-only JSON-LD on the noindex EN staging site.
   // Its full structure is validated by verify-en-schema-output.mjs.
   if(get(node,'type')==='application/ld+json'&&!get(node,'data-schema-version'))
    errors.push({url,problem:'unversioned-english-schema'});
   return;
  }
  if(node.nodeName==='#text'){
   hit(node.value,stack,'text');
   return;
  }
  const next=t?[...stack,node]:stack;
  for(const a of node.attrs??[]){
   if(a.name==='content'&&t==='meta'&&
     ['description','og:title','og:description','twitter:title','twitter:description'].includes(get(node,'name')??get(node,'property')))
     hit(a.value,next,'meta-content');
   else if(a.name==='alt'||uiAttributes.has(a.name)||
     (a.name==='value'&&['button','option'].includes(t)))
     hit(a.value,next,a.name);
   else if(jsAttribute.test(a.name))hit(a.value,next,'js-data');
  }
  for(const child of node.childNodes??[])visit(child,next);
  if(node.content)visit(node.content,next);
 }
 visit(dom);
 if(found)pagesWithCyrillic++;else plainEnglishPages++;
 sitePages++;
}
fs.closeSync(fd);
function scanSource(dir,values){
 if(!fs.existsSync(dir))return;
 for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  if(item.isSymbolicLink())continue;
  const full=path.join(dir,item.name);
  if(item.isDirectory())scanSource(full,values);
  else if(item.isFile()&&/\.(?:js|ts|mjs|astro)$/.test(item.name)){
   const lines=fs.readFileSync(full,'utf8').split('\n');
   for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    if(!cyr.test(line)||line.startsWith('//')||line.startsWith('*')||line.startsWith('<!--'))continue;
    values.push({path:path.relative(process.cwd(),full).split(path.sep).join('/'),
     line:i+1,value:line.slice(0,350),classification:'js_source_candidate_not_runtime_verified'});
   }
  }
 }
}
const jsSources=[];
for(const dir of ['src/scripts','src/components','src/lib/i18n'])scanSource(path.resolve(dir),jsSources);
fs.writeFileSync(jsPath,JSON.stringify({
 schemaVersion:1,disclaimer:'Source candidates only; interactive browser states not exercised by this audit',
 candidates:jsSources},null,2)+'\n');
const sortedGroups=[...groups.values()].sort((a,b)=>b.occurrences-a.occurrences);
const report={schemaVersion:1,
 sourceMainSha:process.env.ADA_CANONICAL_SHA??null,
 sourceStagingSha:process.env.EN_MASS_SNAPSHOT_SHA??null,
 site:'https://alexyakovlev79.github.io/adatours-en/en/',
 scope:'all canonical EN index.html under /en/; script-literal source inventory is separate',
 policy:'noindex EN, RU fallback permitted, test-only JSON-LD enabled 2026-11-13, canonical/hreflang suppressed',
 totalPages:sitePages,englishContentPages:englishPages,ruFallbackPages:fallbackPages,
 pagesWithCyrillic,plainEnglishPages,occurrences,uniqueTextFieldGroups:groups.size,
 byClassification:byClass,seoCyrillicFields:headCyrillic,
 expectedMetaGate:'EN noindex SEO and JSON-LD are independently testable; public indexing and hreflang remain gated',
 jsSourceCandidates:jsSources.length,
 jsRuntimeInteractionsVerified:false,
 structuralProblems:errors,
 topGroups:sortedGroups.slice(0,1000),
 examplesByClassification:topSamples,
 detailsFile:path.basename(detailsPath),
 jsSourcesFile:path.basename(jsPath),
 machineAuditedAt:new Date().toISOString(),
};
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
const headline={pages:sitePages,englishContentPages:englishPages,ruFallbackPages:fallbackPages,
 pagesWithCyrillic,occurrences,distinctGroups:groups.size,
 categories:byClass,jsSourceCandidates:jsSources.length,structuralProblems:errors.length};
console.log('Stage 9 EN residual audit: '+JSON.stringify(headline));
console.log('Stage 9 top unresolved examples: '+JSON.stringify(Object.entries(topSamples)
 .filter(([k])=>['ui_localization_gap','standard_page_heading_review','js_state_candidate'].includes(k))
 .flatMap(([k,v])=>v.slice(0,3).map(x=>({category:k,...x})))));
if(errors.length)process.exitCode=1;
