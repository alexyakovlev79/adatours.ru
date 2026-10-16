import fs from 'node:fs';
import path from 'node:path';
import {digest} from './schema-geo-core.mjs';
const root=process.cwd(), dir='data/geo-knowledge';
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const index=read('data/seo-geo/registry/index.json');
const records=index.phases.flatMap(p=>read(p.path).entries.map(r=>({...r,registryPath:p.path})));
const inventory=read(dir+'/source-inventory.json');
const archived=new Set(read('data/catalog-archive.json').entries.filter(e=>e.status==='archived').map(e=>e.id));
let previous={jobs:[]};try{previous=read(dir+'/queue.json');}catch{}
const byId=new Map(records.filter(r=>r.id).map(r=>[r.id,r]));
const stages={country:1,destination:2,tour:3,excursion:4};
const jobs=[];
for(const e of inventory.entities){
 const r=byId.get(e.id),stage=stages[e.type];if(!stage)continue;
 const available=Boolean(e.sourceBlobSha)&&!archived.has(e.id)&&e.status!=='archived'&&r?.work!=='archived'&&!['missing','temporarily_unavailable'].includes(r?.availability);
 const source={stableId:e.id,kind:e.type,url:e.url,sourceBlobSha:e.sourceBlobSha,countryIds:e.countryIds||[],destinationIds:e.destinationIds||[]};
 jobs.push({jobId:`geo-${e.type}-${e.id}`,stage,sourceOrder:r?.order||100000+jobs.length,kind:e.type,stableId:e.id,url:e.url,name:e.name,available,reason:available?'':!e.sourceBlobSha?'content_file_missing':'archived_or_unavailable',contentPath:e.contentPath,entryPath:e.entryPath,countryIds:e.countryIds||[],destinationIds:e.destinationIds||[],sourceBlobSha:e.sourceBlobSha,sourceFingerprint:digest(source),registryPath:r?.registryPath||null});
}
const families={themes:r=>r.phase===2,countryInterest:r=>r.phase===3||r.phase===4,multiCountry:r=>r.kind.startsWith('multi_country'),tourCatalogues:r=>r.phase===5&&!r.kind.startsWith('multi_country')&&r.kind!=='tour',placeCatalogues:r=>r.phase===6&&r.kind!=='destination',excursionCatalogues:r=>r.phase===7&&r.kind!=='excursion'};
const coverage=[];
for(const [family,test]of Object.entries(families)){
 const pages=records.filter(test).map(r=>({url:r.url,kind:r.kind,order:r.order,available:!['archived','temporarily_unavailable','waiting_for_page'].includes(r.work)})).filter(r=>! /\/page\/\d+\//.test(r.url));
 const jobId=`geo-template-${family}`;
 jobs.push({jobId,stage:5,sourceOrder:Math.min(...pages.map(p=>p.order)),kind:'template',stableId:jobId,url:pages[0]?.url||'/',name:`Проверка шаблона: ${family}`,available:true,coveredPages:pages.length,sourceFingerprint:digest(pages),contentPath:null,entryPath:null});
 coverage.push({jobId,family,pages});
}
jobs.push({jobId:'geo-template-editorial-services',stage:6,sourceOrder:200000,kind:'template',stableId:'geo-template-editorial-services',url:'/',name:'Адресная проверка Article/about/mentions и Service.areaServed',available:true,sourceFingerprint:digest({files:['src/lib/page-schema.ts','src/lib/structured-data.mjs'],snapshot:inventory.snapshotCommit}),contentPath:null,entryPath:null});
const current=new Set(jobs.map(j=>j.jobId));
for(const old of previous.jobs)if(!current.has(old.jobId)){
 const parent=old.amendmentOf&&jobs.find(j=>j.jobId===old.amendmentOf);
 if(parent){
  // A scoped follow-up keeps its own state/result while inheriting current identity.
  jobs.push({...old,available:parent.available,reason:parent.reason||'',stage:parent.stage,
   sourceOrder:parent.sourceOrder,url:parent.url,contentPath:parent.contentPath,entryPath:parent.entryPath,
   countryIds:parent.countryIds,destinationIds:parent.destinationIds,
   sourceBlobSha:parent.sourceBlobSha,sourceFingerprint:parent.sourceFingerprint});
 }else jobs.push({...old,available:false,reason:'no_longer_in_inventory'});
}
jobs.sort((a,b)=>a.stage-b.stage||a.sourceOrder-b.sourceOrder||a.jobId.localeCompare(b.jobId));
const queue={schemaVersion:2,snapshotCommit:inventory.snapshotCommit,sourceRegistryRows:records.length,generatedAt:process.env.GEO_SNAPSHOT_AT||new Date().toISOString(),jobs};
const report={sourceRegistryRows:records.length,totalJobs:jobs.length,availableJobs:jobs.filter(j=>j.available).length,byStage:Object.fromEntries([1,2,3,4,5,6].map(s=>[s,{total:jobs.filter(j=>j.stage===s).length,available:jobs.filter(j=>j.stage===s&&j.available).length}]))};
if(process.argv.includes('--write')){
 fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(dir+'/queue.json',JSON.stringify(queue,null,2)+'\n');fs.writeFileSync(dir+'/coverage.json',JSON.stringify({schemaVersion:2,families:coverage},null,2)+'\n');fs.writeFileSync(dir+'/queue-report.json',JSON.stringify(report,null,2)+'\n');
 // Queue definitions are separate from mutable state. Preserve leases/results/history;
 // changed definitions fence active leases and require explicit revalidation of old results.
 let state;try{state=read(dir+'/state.json');}catch{state={schemaVersion:2,jobs:{},leases:{},publications:[]};}
 const oldById=new Map(previous.jobs.map(j=>[j.jobId,j]));
 for(const j of jobs){const old=oldById.get(j.jobId);if(old&&old.sourceFingerprint!==j.sourceFingerprint&&state.jobs[j.jobId]&&!['DEPLOYING','PUBLISHING'].includes(state.jobs[j.jobId].status)){state.jobs[j.jobId]={...state.jobs[j.jobId],status:'STALE',note:'Source changed; old result kept for revalidation'};delete state.leases[j.jobId];}}
 fs.writeFileSync(dir+'/state.json',JSON.stringify(state,null,2)+'\n');
}
console.log(JSON.stringify(report,null,2));
