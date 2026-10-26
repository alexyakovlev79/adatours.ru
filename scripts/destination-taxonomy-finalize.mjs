#!/usr/bin/env node
/** Staged, offline, all-or-nothing taxonomy cutover; no push or deployment. */
import fs from 'node:fs';
import path from 'node:path';
import { DESTINATION_TYPES,NAVIGATION_ROLES,sourceFingerprint,validateJob,validateResults,recordChecksum } from './destination-taxonomy-swarm-core.mjs';
const ROOT=process.cwd(),S='data/migrations/destination-taxonomy-20261026/swarm';
const full=p=>path.join(ROOT,p),exists=p=>fs.existsSync(full(p)),str=p=>fs.readFileSync(full(p),'utf8'),get=p=>JSON.parse(str(p));
const stringify=x=>JSON.stringify(x,null,2)+'\n';
const change=new Map(),issues=[];
const set=(p,c)=>{if(str(p)!==c)change.set(p,c);};
const once=(s,oldValue,newValue)=>{if(!s.includes(oldValue)||s.indexOf(oldValue)!==s.lastIndexOf(oldValue))throw Error('Source code drift: '+oldValue.slice(0,65));return s.replace(oldValue,newValue);};
const manifest=get(S+'/manifest.json');
if(manifest.schemaVersion!==1||manifest.destinationCount!==1018||manifest.packetCount!==51||manifest.status!=='active')throw Error('Unexpected taxonomy swarm state');
if(JSON.stringify(manifest.types)!==JSON.stringify(DESTINATION_TYPES)||JSON.stringify(manifest.roles)!==JSON.stringify(NAVIGATION_ROLES))throw Error('Taxonomy enum differs from immutable manifest');
const shards=Array.from({length:16},(_,n)=>get(S+'/shards/'+String(n).padStart(2,'0')+'.json'));
const packetState=new Map(shards.flatMap(sh=>sh.items.map(p=>[p.id,p])));
const catalogPath='src/data/catalog/destinations.json',compactPath='data/source-index/catalogs/destinations.json';
const catalog=get(catalogPath),compact=get(compactPath);
const nowById=new Map(catalog.map(x=>[x.id,x])),sourceById=new Map(compact.entries.map(x=>[x.id,x]));
const results=new Map();
for(const meta of manifest.packets){
 const job=validateJob(get(meta.jobPath)),p=packetState.get(meta.id);
 if(!p||p.status!=='completed'||!p.resultPath||!exists(p.resultPath)){issues.push(meta.id+': unfinished');continue;}
 const receipt=get(p.resultPath),rows=validateResults(job,receipt.records);
 if(receipt.generation!==p.generation||receipt.submissionId!==p.submissionId||receipt.sourceCatalogSha!==manifest.sourceCatalogSha||
    receipt.sourceFingerprint!==job.sourceFingerprint||receipt.recordChecksum!==recordChecksum(job,rows)){
   issues.push(meta.id+': broken receipt');continue;
 }
 for(let i=0;i<rows.length;i++){
  const r=rows[i],frozen=job.records[i],live=nowById.get(r.id),source=sourceById.get(r.id);
  if(r.status!=='ready'){issues.push(r.id+': REVIEW '+r.reason);continue;}
  if(results.has(r.id)||!live||!source||source.url!==frozen.url||
    sourceFingerprint({...live,existingType:live.destinationType??null,contentPath:source.contentPath??null})!==frozen.fingerprint){
    issues.push(r.id+': duplicate, missing or stale');continue;
  }
  results.set(r.id,{...r,contentPath:source.contentPath,entryPath:source.entryPath});
 }
}
if(results.size!==1018||catalog.length!==1018||compact.entries.length!==1018)issues.push('Unresolved/missing/new inventory');
if(issues.length){console.error(JSON.stringify({status:'BLOCKED',ready:results.size,issues:issues.slice(0,45),additional:Math.max(0,issues.length-45)},null,2));process.exit(2);}
for(const c of catalog){const x=results.get(c.id);c.destinationType=x.destinationType;c.navigationRole=x.navigationRole;}
for(const c of compact.entries){const x=results.get(c.id);c.destinationType=x.destinationType;c.navigationRole=x.navigationRole;}
set(catalogPath,stringify(catalog));set(compactPath,stringify(compact));
const stats={sourceEntries:0,contentMd:0,files:0};
for(const x of results.values()){
 if(x.entryPath&&exists(x.entryPath)){
  const doc=get(x.entryPath);if(doc.id!==x.id||doc.type!=='destination')throw Error('Source entry mismatch '+x.id);
  doc.destinationType=x.destinationType;doc.navigationRole=x.navigationRole;set(x.entryPath,stringify(doc));stats.sourceEntries++;
 }
 if(x.contentPath&&exists(x.contentPath)){
  const before=str(x.contentPath),match=before.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if(!match)throw Error('Missing YAML frontmatter '+x.id);
  let front=match[1];
  for(const key of ['destinationType','navigationRole']){
   const re=new RegExp('^'+key+':\\s*[^\\r\\n]*$','gm');
   const list=[...front.matchAll(re)];if(list.length>1)throw Error('Duplicate '+key+' '+x.id);
   front=list.length?front.replace(re,key+': '+x[key]):front+'\n'+key+': '+x[key];
  }
  set(x.contentPath,before.slice(0,match.index)+match[0].replace(match[1],front)+before.slice(match.index+match[0].length));
  stats.contentMd++;
 }
}
/* Enforce the vocabulary in Astro, source index and all future reservations. */
let contentSchema=str('src/content.config.ts');
const first=contentSchema.indexOf('const destinations = defineCollection('),last=contentSchema.indexOf('const tours = defineCollection(');
if(first<0||last<first)throw Error('Missing Astro collection anchors');
let section=contentSchema.slice(first,last);
const pattern=/destinationType:\s*z\.enum\(\[[\s\S]*?\]\),/;
if(!pattern.test(section))throw Error('Missing old destination enum');
section=section.replace(pattern,'destinationType: z.enum([\n      '+
 DESTINATION_TYPES.map(t=>"'"+t+"'").join(',\n      ')+
 '\n    ]),\n    navigationRole: z.enum([\'hub\', \'sight\']),');
set('src/content.config.ts',contentSchema.slice(0,first)+section+contentSchema.slice(last));
const sourceSchema=get('data/source-index/entry.schema.json');
sourceSchema.properties.destinationType={type:'string',enum:DESTINATION_TYPES};
sourceSchema.properties.navigationRole={type:'string',enum:NAVIGATION_ROLES};
sourceSchema.allOf.push({if:{properties:{type:{const:'destination'}},required:['type']},then:{required:['destinationType','navigationRole']}});
set('data/source-index/entry.schema.json',stringify(sourceSchema));
const reserveSchema=get('data/schemas/destination-reservation-request.schema.json');
reserveSchema.$defs.request.properties.destinationType={type:'string',enum:DESTINATION_TYPES,description:'Required when new; existing matches reuse canonical type'};
reserveSchema.$defs.request.properties.navigationRole={type:'string',enum:NAVIGATION_ROLES,description:'Required when new; existing matches reuse canonical role'};
set('data/schemas/destination-reservation-request.schema.json',stringify(reserveSchema));
let reserve=str('src/lib/destination-reservations.mjs');
reserve="import { isDestinationType, isNavigationRole } from './destination-taxonomy.mjs';\n"+reserve;
reserve=once(reserve,"    if (!/^destination_[a-z0-9_]+$/.test(item.id)) errors.push",
 "    if (!isDestinationType(item.destinationType)) errors.push(label+': invalid destinationType.');\n    if (!isNavigationRole(item.navigationRole)) errors.push(label+': invalid navigationRole.');\n    if (!/^destination_[a-z0-9_]+$/.test(item.id)) errors.push");
reserve=once(reserve,"    let outcome = 'existing';\n    if (!destination) {",
 "    let outcome = 'existing';\n    if (destination && ((request.destinationType && request.destinationType !== destination.destinationType) || (request.navigationRole && request.navigationRole !== destination.navigationRole))) return fail({outcome:'invalid',requestIndex,errors:['Existing classification must be preserved.']});\n    if (!destination) {\n      if (!isDestinationType(request.destinationType) || !isNavigationRole(request.navigationRole)) return fail({outcome:'invalid',requestIndex,errors:['New place requires destinationType and navigationRole.']});");
reserve=once(reserve,
 "destination = { id, name: request.name.trim(), slug, countryId: country.id, countrySlug: country.slug, url, sourceUrl: null };",
 "destination = { id, name: request.name.trim(), slug, countryId: country.id, countrySlug: country.slug, url, sourceUrl: null, destinationType: request.destinationType, navigationRole: request.navigationRole };");
set('src/lib/destination-reservations.mjs',reserve);
/* The existing country labels cover 7 types. Reuse the full shared taxonomy. */
let country=str('src/layouts/CountryLayout.astro');
const titleBlock="const destinationTypeLabel = {\n  city: 'Город',\n  region: 'Регион',\n  island: 'Остров',\n  national_park: 'Национальный парк',\n  resort: 'Курорт',\n  natural_area: 'Природная территория',\n  route_cluster: 'Маршрут',\n};";
country=once(country,titleBlock,'');
country=once(country,'{destinationTypeLabel[item.data.destinationType]}','{destinationTypeLabel(item.data.destinationType)}');
country=once(country,'---\nimport ',"---\nimport { destinationTypeLabel } from '../lib/destination-taxonomy.mjs';\nimport ");
set('src/layouts/CountryLayout.astro',country);
const marker='## Классификация Destination: тип и роль (26.10.2026)';
for(const doc of ['docs/workflows/destinations.md','docs/workflows/destination-reservations.md','docs/workflows/master.md','AGENTS.md']){
 const old=str(doc);
 if(!old.includes(marker))set(doc,old.trimEnd()+'\n\n'+marker+'\n\nНовый Destination при создании/резервировании обязательно получает destinationType из закрытого справочника src/lib/destination-taxonomy.mjs и независимый navigationRole (hub/sight). Два атрибута классифицируются по реальному объекту, не выводятся один из другого. При наличии существующего ID использовать его утвержденные значения; смена типа/роли требует адресной содержательной проверки. Старые ID, URL и связи экскурсии с основным destination не меняются из-за разметки.\n');
}
const completed={...manifest,status:'prepared',classification:{ready:1018,review:0,published:false}};
change.set(S+'/manifest.json',stringify(completed));
stats.files=change.size;
if(process.argv.includes('--apply')){
 for(const [p,data] of change){fs.mkdirSync(path.dirname(full(p)),{recursive:true});fs.writeFileSync(full(p),data);}
 fs.writeFileSync(full(S+'/cutover-preview.json'),stringify({status:'PREPARED_NOT_DEPLOYED',sourceCommit:manifest.sourceCommit,ready:1018,files:[...change.keys()].sort()}));
}
console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'validate',...stats,ready:1018,review:0},null,2));
