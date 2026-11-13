#!/usr/bin/env node
/** Validate the actual publishable noindex EN Pages HTML Schema.org graph.
 * Checks every emitted EN page, not a sample or only the standalone builder.
 */
import fs from 'node:fs';
import path from 'node:path';
import {parse} from 'parse5';
import {EN_STAGING_BASE} from '../../src/lib/i18n/en-staging-site.mjs';
import {hasType} from '../../src/lib/structured-data.mjs';

const fail=message=>{throw Error('EN Schema.org output: '+message)};
const base=path.resolve(process.argv[2]??'en-pages-site');
const site=path.join(base,'en');
const absoluteRoot='https://alexyakovlev79.github.io'+EN_STAGING_BASE+'en/';
const get=(node,key)=>node.attrs?.find(x=>x.name===key)?.value;
const collect=(node,predicate)=>{
 const result=[];const visit=n=>{if(predicate(n))result.push(n);for(const c of n.childNodes??[])visit(c)};
 visit(node);return result;
};
const list=folder=>fs.readdirSync(folder,{withFileTypes:true}).flatMap(row=>
 row.isDirectory()?list(path.join(folder,row.name)):
 row.isFile()&&row.name==='index.html'?[path.join(folder,row.name)]:[]);
if(!fs.existsSync(site))fail('EN route tree is missing');
let pages=0,withTrips=0,withService=0,withOffers=0,withFAQ=0,withBreadcrumbs=0,totalNodes=0;
const typeCounts={};
for(const filename of list(site)){
 const relative=path.relative(site,filename).split(path.sep).join('/');
 const route=relative==='index.html'?'':relative.replace(/index\.html$/,'');
 const expected=absoluteRoot+route;
 const doc=parse(fs.readFileSync(filename,'utf8'));
 const head=collect(doc,n=>n.tagName==='head')[0];
 const schema=collect(head,n=>n.tagName==='script'&&get(n,'type')==='application/ld+json');
 if(schema.length!==1||!get(schema[0],'data-schema-version'))
  fail('Expected one versioned JSON-LD script: '+route);
 const raw=schema[0].childNodes?.map(n=>n.value??'').join('')??'';
 let graph;
 try{graph=JSON.parse(raw)}catch{fail('Invalid JSON in '+route)}
 if(graph?.['@context']!=='https://schema.org'||!Array.isArray(graph?.['@graph'])||!graph['@graph'].length)
  fail('Invalid Schema.org graph '+route);
 const nodeById=new Map();
 for(const node of graph['@graph']){
  const id=node['@id'];
  if(typeof id!=='string'||!id||nodeById.has(id))fail('Duplicate Schema.org @id '+route);
  nodeById.set(id,node);
  for(const kind of [node['@type']].flat())typeCounts[kind]=(typeCounts[kind]||0)+1;
  if(hasType(node,'Offer')&&
   (!Number.isFinite(node.priceSpecification?.minPrice)||node.priceSpecification.minPrice<=0))
    fail('Invalid advertised tour price '+route);
  if(id.startsWith('https://alexyakovlev79.github.io'+EN_STAGING_BASE)&&!id.startsWith(absoluteRoot))
    fail('Non-English @id route in Schema.org graph '+route+': '+id);
 }
 const page=nodeById.get(expected+'#webpage');
 if(!page||page.url!==expected||page.inLanguage!=='en')
  fail('WebPage URL, identity or language mismatches real page '+route);
 if(![page['@type']].flat().some(t=>['WebPage','CollectionPage','ProfilePage','ContactPage','AboutPage'].includes(t)))
  fail('Missing WebPage type '+route);
 if(!nodeById.has(absoluteRoot+'#website')||!nodeById.has('https://adatours.ru/#organization'))
  fail('Shared canonical organisation/EN website identity lost '+route);
 if(collect(head,n=>n.tagName==='link'&&['canonical','alternate'].includes(get(n,'rel'))).length)
  fail('Premature canonical or hreflang on EN noindex '+route);
 const robots=collect(head,n=>n.tagName==='meta'&&get(n,'name')==='robots');
 if(robots.length!==1||get(robots[0],'content')!=='noindex,nofollow,noarchive,nosnippet')
  fail('Nonindex gate lost on '+route);
 const image=graph['@graph'].filter(n=>hasType(n,'ImageObject'));
 for(const n of image)for(const key of ['url','contentUrl']){
  const address=n[key]??'';
  if(address.includes(EN_STAGING_BASE+'media/'))fail('Unresolved local image in Schema.org '+route);
 }
 pages++;totalNodes+=nodeById.size;
 if([...nodeById.values()].some(n=>hasType(n,'TouristTrip')))withTrips++;
 if([...nodeById.values()].some(n=>hasType(n,'Service')))withService++;
 if([...nodeById.values()].some(n=>hasType(n,'Offer')))withOffers++;
 if([...nodeById.values()].some(n=>hasType(n,'FAQPage')))withFAQ++;
 if([...nodeById.values()].some(n=>hasType(n,'BreadcrumbList')))withBreadcrumbs++;
}
if(pages<6000)fail('Incomplete canonical EN site: '+pages);
if(!withTrips||!withService||!withOffers||!withBreadcrumbs)
 fail('Required kinds of Schema.org content missing');
const receipt={
 status:'passed',noindex:true,canonicalSuppressed:true,
 canonicalSourceSha:fs.existsSync(path.join(base,'translation-receipt.json'))
   ?JSON.parse(fs.readFileSync(path.join(base,'translation-receipt.json'),'utf8')).canonicalSourceSha:null,
 checkedPages:pages,totalNodes,withTrips,withService,withOffers,withFAQ,withBreadcrumbs,
 typeCounts
};
fs.writeFileSync(path.join(base,'en-schema-verification.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
