#!/usr/bin/env node
/**
 * Read-only duplicate evidence and archive dependency inventory.
 * Run in main checkout with matching checkout as argv[2]. No site edits.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const yaml=createRequire(path.join(process.cwd(),'package.json'))('js-yaml');
const root=process.cwd(),match=path.resolve(process.argv[2]||'../matching');
const out=path.resolve(process.argv[3]||'/tmp/ada-duplicates');
fs.mkdirSync(out,{recursive:true});
const read=(base,p)=>JSON.parse(fs.readFileSync(path.join(base,p),'utf8'));
const cats=read(root,'data/source-index/catalogs/tours.json').entries;
const archives=read(root,'data/catalog-archive.json').entries;
const archiveBy=new Map(archives.map(a=>[a.id,a]));
const catBy=new Map(cats.map(t=>[t.id,t]));
const index=read(match,'data/i18n/matching/v1/index.json');
const byWord=new Map();const missing=[];const problems=[];
const readMd = id =>{
 const record=catBy.get(id);
 if(!record){problems.push({id,problem:'missing_catalog'});return null;}
 const file=path.join(root,record.contentPath);
 if(!fs.existsSync(file)){problems.push({id,problem:'missing_content'});return null;}
 const data=fs.readFileSync(file,'utf8');
 const sections=data.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
 if(!sections){problems.push({id,problem:'no_frontmatter'});return null;}
 const fm=yaml.load(sections[1]);
 const itinerary=(fm.itinerary||[]).filter(i=>Number.isInteger(i.day)).map(i=>({
    day:i.day,title:i.title||'',places:i.places||[],text:String(i.text||''),
    linkedExcursionIds:(i.contentBlocks||[]).map(b=>b.excursionRef).filter(Boolean),
    sourceRefs:(fm.itinerary||[]).filter(x=>x.excursionRef).map(x=>x.excursionRef)
 }));
 const images=[];const walk=v=>{
   if(!v || typeof v!=='object')return;
   if(typeof v.src==='string')images.push(v.src);
   for(const vv of Object.values(v))if(typeof vv==='object')walk(vv);
 };
 walk({hero:fm.hero,gallery:fm.gallery,itinerary:fm.itinerary,highlights:fm.highlights});
 return {
  id,contentPath:record.contentPath,url:record.url,sourceUrl:record.sourceUrl,
  status:fm.status,archivedInRegistry:archiveBy.has(id),title:fm.title,
  durationDays:fm.durationDays??null,durationNights:fm.durationNights??null,
  countries:fm.countries,routeCountries:fm.routeCountries||null,
  destinations:fm.destinations||[],routeDestinations:fm.routeDestinations||null,
  route:fm.route||[],priceFrom:fm.priceFrom??null,currency:fm.currency||'',
  priceNote:fm.priceNote||'',dates:fm.dates||[],updatedAt:fm.updatedAt||'',
  itinerary,notes:fm.notes||[],included:fm.included||[],notIncluded:fm.notIncluded||[],
  hero:fm.hero?.src||null,uniqueImageCount:new Set(images).size,
  bodyChars:sections[2].length,lead:fm.lead||'',body:sections[2],
  faqCount:(fm.faq||[]).length,primaryThemes:fm.primaryThemes||[],themes:fm.themes||[],
 };
};
for(let i=0;i<16;i++){
 const sid=i.toString(16).padStart(2,'0');
 const shard=read(match,'data/i18n/matching/v1/state/'+sid+'.json');
 for(const item of shard.items){
  if(item.status!=='ready'){missing.push(item.jobId);continue;}
  const rr=read(match,item.submission.resultPath);
  if(rr.jobId!==item.jobId)problems.push({jobId:item.jobId,problem:'receipt_identity_mismatch'});
  const sel=rr.result?.selectedSource;
  if(!sel?.driveFileId)continue;
  const group=byWord.get(sel.driveFileId)||[];
  group.push({id:rr.result.entityId,matchYear:sel.sourceYearFolder,docId:sel.driveFileId,
   sourceSha256:sel.sourceSha256,resultPath:item.submission.resultPath});
  byWord.set(sel.driveFileId,group);
 }
}
const stop=new Set(['и','на','в','по','для','от','из','and','the','of','in','to','with','тур','дней','дня','туре','travel']);
const words=s=>new Set(String(s).toLowerCase().replace(/ё/g,'е').split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>2&&!stop.has(x)));
const jaccard=(a,b)=>{const A=words(a),B=words(b);const inter=[...A].filter(x=>B.has(x)).length;return A.size||B.size?Number((inter/(A.size+B.size-inter)).toFixed(3)):1;};
const textSummary=t=>t.itinerary.map(d=>[d.title,...d.places,d.text].join(' ')).join(' ');
const groups=[];
for(const [docId,items] of byWord){
 if(items.length<2)continue;
 const a=items.map(i=>({...i,tour:readMd(i.id)}));
 const comparison=[];
 for(let x=0;x<a.length;x++)for(let y=x+1;y<a.length;y++){
  const X=a[x].tour,Y=a[y].tour;
  if(!X||!Y)continue;
  comparison.push({
    ids:[a[x].id,a[y].id],sameDayCount:X.durationDays===Y.durationDays,
    dayCountDiff:Math.abs((X.durationDays||0)-(Y.durationDays||0)),
    routeSimilarity:jaccard(X.route.join(' '),Y.route.join(' ')),
    placesSimilarity:jaccard(X.destinations.join(' '),Y.destinations.join(' ')),
    dayTitlesSimilarity:jaccard(X.itinerary.map(d=>d.title).join(' '),Y.itinerary.map(d=>d.title).join(' ')),
    dayDescriptionsSimilarity:jaccard(textSummary(X),textSummary(Y)),
    itineraryDays:[X.itinerary.length,Y.itinerary.length],
    sharedImages:X.hero===Y.hero&&!!X.hero,
    priceFrom:[X.priceFrom,Y.priceFrom],
  });
 }
 groups.push({docId,matches:a,comparison});
}
groups.sort((a,b)=>a.docId.localeCompare(b.docId));
const seoFiles=[];
const articleRoot=path.join(root,'data/seo-geo/articles');
function walk(dir){if(!fs.existsSync(dir))return;for(const n of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,n.name);if(n.isDirectory())walk(f);else if(n.isFile()&&n.name.endsWith('.md'))seoFiles.push(f)}}
walk(articleRoot);
const occurrences=[];
const allDupTours=groups.flatMap(g=>g.matches.map(x=>x.tour).filter(Boolean));
for(const f of seoFiles){
 const src=fs.readFileSync(f,'utf8');
 for(const t of allDupTours){
  const targets=[t.url,t.id];
  const hits=targets.filter(x=>src.includes(x));
  if(hits.length)occurrences.push({article:path.relative(root,f),tourId:t.id,url:t.url,exactHits:hits});
 }
}
const summary={source:'i18n/matching-staging',matchingReady:index.counts.ready,unresolved:missing.length,
 distinctWordIds:byWord.size,collisionGroups:groups.length,collisionTourUsages:groups.reduce((n,g)=>n+g.matches.length,0),
 maxPotentialExtraCopies:groups.reduce((n,g)=>n+g.matches.length-1,0),
 seoArticleCount:seoFiles.length,seoExactReferences:occurrences.length,issues:problems};
const compact=groups.map((g,i)=>{
 const info=g.matches.map(x=>x.tour);
 return {group:i+1,document:g.docId,
   tours:info.map(t=>t&&({id:t.id,title:t.title,days:t.durationDays,status:t.status,
     imageCount:t.uniqueImageCount,bodyChars:t.bodyChars,priceFrom:t.priceFrom,
     daysText:t.itinerary.map(d=>d.title+' ['+d.places.join(',')+']'),
     route:t.route, lead:t.lead.slice(0,250),url:t.url})),
   comparisons:g.comparison};
});
for(const [name,value] of [['summary.json',summary],['groups-full.json',groups],['groups-compact.json',compact],
  ['seo-references.json',occurrences]])fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify({...summary,
  quickGroups:compact.map(x=>({group:x.group,tours:x.tours.map(t=>t?.id),
   days:x.tours.map(t=>t?.days),compare:x.comparisons.map(c=>({
    sameDays:c.sameDayCount,route:c.routeSimilarity,places:c.placesSimilarity,descriptions:c.dayDescriptionsSimilarity}))}))},null,2));
if(problems.length||missing.length)process.exitCode=1;
