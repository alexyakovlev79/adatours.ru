#!/usr/bin/env node
/** Promote verified EN Astro HTML over canonical RU routes on the staging site.
 * Routing is resolved by stable ID from the existing source-index catalogues.
 * There are no second Tour records, media assets, prices or relation models.
 */
import fs from 'node:fs';
import path from 'node:path';
import {parse,serialize} from 'parse5';
import {privatePilotRouteIndex} from '../../src/lib/i18n/locale-entity-routes.mjs';
import {EN_STAGING_BASE} from '../../src/lib/i18n/en-staging-site.mjs';

const fail=m=>{throw Error('EN translation staging: '+m)};
const catalogues={country:'countries',destination:'destinations',tour:'tours',excursion:'excursions'};
const safeRoute=s=>typeof s==='string'&&/^\/[a-z0-9_/-]+\/$/.test(s)&&
 !s.includes('//')&&!s.includes('/../')&&!s.includes('/./');
const walk=(n,f)=>{f(n);for(const c of n.childNodes??[])walk(c,f)};
const attr=(n,key)=>n.attrs?.find(x=>x.name===key)?.value??null;
const normalizedSource=old=>{
 const tail=old.replace(/^\/(?:en|en-pilot-private)\//,'');
 if(tail===old||!safeRoute('/'+tail))fail('Invalid pilot source path '+old);
 return '/en/'+tail;
};

/** The source catalogue and exact entry must agree on identity and URL. */
export function verifiedEnglishRoutes(repoRoot=process.cwd()){
 const cached=new Map();
 const getCatalogue=kind=>{
  if(cached.has(kind))return cached.get(kind);
  const filename=path.join(repoRoot,'data/source-index/catalogs',catalogues[kind]+'.json');
  const records=JSON.parse(fs.readFileSync(filename,'utf8')).entries;
  if(!Array.isArray(records))fail('Invalid source catalogue '+kind);
  const map=new Map(records.map(x=>[x.id,x]));
  if(map.size!==records.length)fail('Duplicate source IDs in '+kind);
  cached.set(kind,map);return map;
 };
 const routes=[{id:null,kind:'catalog',source:'/en/tours/',target:'/en/tours/',canonical:'/tours/'}];
 const targets=new Set(['/en/tours/']),sources=new Set(['/en/tours/']);
 for(const row of privatePilotRouteIndex.entries()){
  const record=getCatalogue(row.kind).get(row.id);
  if(!record||record.id!==row.id||!safeRoute(record.url))fail('Unresolved canonical route '+row.id);
  const entry=JSON.parse(fs.readFileSync(path.join(repoRoot,'data/source-index/entries',row.id+'.json'),'utf8'));
  if(entry.id!==row.id||entry.url!==record.url||entry.slug!==record.slug)
   fail('Canonical source entry drift '+row.id);
  const source=normalizedSource(row.path),target='/en'+record.url;
  if(targets.has(target)||sources.has(source))fail('Duplicate source/target EN route '+row.id);
  sources.add(source);targets.add(target);
  routes.push({id:row.id,kind:row.kind,source,target,canonical:record.url});
 }
 if(routes.length!==22||targets.size!==22)fail('Expected 21 distinct translated entities and one catalogue');
 return routes;
}

/** Only explicit pilot links are rebased; all other shared asset URLs stay intact. */
export function rewriteEnglishPilotLinks(html,translations){
 if(typeof html!=='string'||!(translations instanceof Map))fail('Invalid HTML/route map');
 const doc=parse(html),root=doc.childNodes?.find(x=>x.tagName==='html');
 if(attr(root,'lang')!=='en'||attr(root,'data-ada-en-pilot')!=='true')
  fail('Source is not the sealed translated English page');
 const base=EN_STAGING_BASE.slice(0,-1);
 const rewritable=new Set(['href','data-href','data-root-href','data-current-root-href']);
 walk(doc,node=>{
  for(const field of node.attrs??[]){
   if(!rewritable.has(field.name)||!field.value.startsWith('/'))continue;
   const i=field.value.search(/[?#]/),raw=i<0?field.value:field.value.slice(0,i);
   const suffix=i<0?'':field.value.slice(i);
   const logical=raw.startsWith(EN_STAGING_BASE)?'/'+raw.slice(EN_STAGING_BASE.length):raw;
   const target=translations.get(logical);
   if(target)field.value=base+target+suffix;
  }
 });
 const out=serialize(doc);
 if(out.includes('/en-pilot-private/'))fail('Unresolved legacy private preview route');
 return out;
}

/** Exactly one translated HTML is placed at the canonical EN path for each ID. */
export function stageEnglishTranslations({dist,output,repoRoot=process.cwd(),routes=verifiedEnglishRoutes(repoRoot)}={}){
 if(!dist||!output||path.resolve(dist)===path.resolve(output))fail('Unsafe staging paths');
 const rewrite=new Map(),translatedNames=new Map(),targets=new Set();
 for(const row of routes){
  if(!safeRoute(row.source)||!safeRoute(row.target)||!safeRoute(row.canonical)||
     !row.target.startsWith('/en/')||targets.has(row.target))fail('Bad translation route '+row.id);
  targets.add(row.target);
  rewrite.set(row.source,row.target);
  rewrite.set('/en-pilot-private/'+row.source.slice('/en/'.length),row.target);
 }
 for(const row of routes){
  const ru=path.join(dist,row.canonical.slice(1),'index.html');
  const source=path.join(dist,row.source.slice(1),'index.html');
  const target=path.join(output,row.target.slice(1),'index.html');
  if(!fs.existsSync(ru)||!fs.existsSync(source)||fs.existsSync(target))
   fail('Missing source, canonical RU route or duplicate EN target '+row.target);
  const rendered=rewriteEnglishPilotLinks(fs.readFileSync(source,'utf8'),rewrite);
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,rendered);
  if(row.kind==='country'||row.kind==='destination'){
   const overlay=JSON.parse(fs.readFileSync(path.join(repoRoot,'data/i18n/pilot-geography/v1',row.id+'.json'),'utf8'));
   const label=overlay?.translation?.name;
   if(overlay.entityId!==row.id||typeof label!=='string'||!label.trim()||/[\u0400-\u052f]/u.test(label))
    fail('Missing confirmed English geography name '+row.id);
   translatedNames.set(row.target,label);
  }
 }
 return {pages:routes.length,canonicalEntityPages:routes.filter(x=>x.id).length,translatedNames};
}
