#!/usr/bin/env node
// Staged, reversible archive migration. Intended ONLY for disposable feature checkout.
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
const root=process.cwd(),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,x)=>fs.writeFileSync(path.join(root,p),JSON.stringify(x,null,2)+'\n');
const apply=process.argv.includes('--apply');
const reportAt=process.argv.indexOf('--report');
const report=reportAt>=0?path.resolve(process.argv[reportAt+1]):null;
const manifest=read('data/audits/word-duplicates-20261030.json');
const archive=read('data/catalog-archive.json');
const catalogue=read('data/source-index/catalogs/tours.json').entries;
const byId=new Map(catalogue.map(x=>[x.id,x]));
const already=new Set(archive.entries.map(x=>x.id));
const decided=[],changed=[],dual=[],errors=[],counts={archives:0,seoRows:0,articleFiles:0,articleReplacements:0,macros:0};
const requireOk=(v,msg)=>{if(!v)throw Error('Archive preflight: '+msg);};
const gitSha=p=>cp.execFileSync('git',['rev-parse','HEAD:'+p],{encoding:'utf8'}).trim();
const getfm=(x)=>x.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
const field=(fm,k)=>fm?.match(new RegExp('^'+k+':\\s*(.+)$','m'))?.[1]?.trim().replace(/^['"]|['"]$/g,'');
requireOk(manifest.duplicates.length===6,'Expected six validated pairs');
for(const caseInfo of manifest.duplicates){
 const a=byId.get(caseInfo.loser),b=byId.get(caseInfo.winner);
 requireOk(a&&b&&!already.has(a.id)&&!already.has(b.id),'Missing/archived identity '+caseInfo.loser);
 requireOk(a.id!==b.id&&caseInfo.confidence>0.80,'Invalid duplicate assessment '+caseInfo.loser);
 requireOk(gitSha(a.contentPath)===caseInfo.expectedBlob,'MD changed since approval '+a.id);
 const loserRaw=fs.readFileSync(path.join(root,a.contentPath),'utf8');
 const winRaw=fs.readFileSync(path.join(root,b.contentPath),'utf8');
 const loserFm=getfm(loserRaw),winnerFm=getfm(winRaw);
 requireOk(loserFm&&winnerFm&&field(loserFm,'id')===a.id&&field(winnerFm,'id')===b.id,
  'Invalid frontmatter identity '+a.id);
 const previousStatus=field(loserFm,'status'),winnerStatus=field(winnerFm,'status');
 requireOk(previousStatus===caseInfo.oldStatus,'Unexpected old status '+a.id);
 requireOk(['published','approved'].includes(winnerStatus),'Replacement not active '+b.id);
 const days=Number(field(loserFm,'durationDays')),winnerDays=Number(field(winnerFm,'durationDays'));
 requireOk(days===winnerDays,'Different programme duration '+a.id);
 const source=read('data/source-index/entries/'+a.id+'.json');
 requireOk(source.id===a.id&&source.url===a.url,'Source index identity mismatch '+a.id);
 const body=loserRaw.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,'');
 const entry={
  id:a.id,type:'tour',name:a.name,url:a.url,contentPath:a.contentPath,
  ...(a.sourceUrl?{sourceUrl:a.sourceUrl}:{}),
  legacyUrls:a.legacyUrls||[],status:'archived',archivedAt:'2026-10-30',
  reason:'duplicate',evidence:caseInfo.reason+'; match Word '+caseInfo.word+
   '; expert identity assessment '+Math.round(caseInfo.confidence*100)+'%; kept '+b.id,
  hadPage:true,previousStatus,duplicateOf:b.id,
  originalBodySha256:crypto.createHash('sha256').update(body).digest('hex'),
  quality:{publishedPhotos:(loserRaw.match(/^\s*src:/gm)||[]).length,
   descriptionChars:body.length,priceFrom:Number(field(loserFm,'priceFrom')||0),durationDays:days},
 };
 if(source.text?.selected?.driveId){
  entry.sourceText={driveId:source.text.selected.driveId,url:source.text.selected.url,
   name:source.text.selected.name};
 }
 archive.entries.push(entry);already.add(a.id);
 decided.push({id:a.id,activeId:b.id,oldUrl:a.url,newUrl:b.url,
  name:a.name,activeName:b.name,confidence:caseInfo.confidence,
  previously:previousStatus,sourceWord:caseInfo.word});
 counts.archives++;
}
const registryFile='data/seo-geo/registry/05-tours.json';
const seo=read(registryFile);
for(const row of seo.entries){
 const d=decided.find(x=>x.id===row.id);if(!d)continue;
 requireOk(row.url===d.oldUrl,'SEO URL mismatch '+row.id);
 const work=row.work;row.work='archived';
 row.note=[row.note,'Архив 30.10.2026: дубль '+d.activeId+
  ' ('+Math.round(d.confidence*100)+'%); прежний статус '+work+
  '; Word '+d.sourceWord+'; историю публикации сохранить.'].filter(Boolean).join('\n');
 counts.seoRows++;
}
requireOk(counts.seoRows===6,'Missing rows in SEO registry');
const articles=[];
const walk=folder=>{if(!fs.existsSync(folder))return;for(const e of fs.readdirSync(folder,{withFileTypes:true})){
 const p=path.join(folder,e.name);
 if(e.isDirectory())walk(p);else if(e.name==='index.md')articles.push(p);
}};
walk('data/seo-geo/articles');
const archPaths=new Set(archive.entries.map(x=>x.url));
for(const file of articles){
 const s=fs.readFileSync(file,'utf8');
 const target=s.match(/^targetPath:\s*(.+)$/m)?.[1]?.trim();
 if(!target||archPaths.has(target))continue;
 let next=s,hits=0,macros=0;
 const both=decided.filter(d=>s.includes(d.oldUrl)&&s.includes(d.newUrl));
 next=next.replace(/\{\{catalog\.tourTable:([^}]+)\}\}/g,(whole,value)=>{
  const ids=value.split(',').map(x=>x.trim()).filter(Boolean);
  const mapped=[...new Set(ids.map(x=>decided.find(d=>d.id===x)?.activeId||x))];
  if(ids.join(',')===mapped.join(','))return whole;
  macros++;return '{{catalog.tourTable:'+mapped.join(',')+'}}';
 });
 for(const d of decided){
  const a=next.split(d.oldUrl);if(a.length>1){hits+=a.length-1;next=a.join(d.newUrl);}
  // Exact stable ID only: never rewrite a longer active ID with this prefix.
  const word=new RegExp('(?<![A-Za-z0-9_])'+d.id+'(?![A-Za-z0-9_])','g');
  const matched=next.match(word)||[];
  if(matched.length){hits+=matched.length;next=next.replace(word,d.activeId);}
 }
 if(next!==s){
  counts.articleFiles++;counts.articleReplacements+=hits;counts.macros+=macros;
  const rel=path.relative(root,file);
  changed.push({file:rel,hits,macros,hadBoth:both.map(d=>d.id)});
  if(both.length)dual.push({file:rel,affected:both.map(d=>d.id),
    oldLines:s.split('\n').filter(x=>both.some(d=>x.includes(d.oldUrl)||x.includes(d.newUrl))).slice(0,7)});
  if(apply)fs.writeFileSync(file,next);
 }
}
if(apply){
 for(const file of articles){
  const s=fs.readFileSync(file,'utf8');
  const target=s.match(/^targetPath:\s*(.+)$/m)?.[1]?.trim();
  if(!target||archPaths.has(target))continue;
  for(const d of decided){
    const exactId=new RegExp('(?<![A-Za-z0-9_])'+d.id+'(?![A-Za-z0-9_])');
    if(s.includes(d.oldUrl)||exactId.test(s))errors.push({file:path.relative(root,file),oldId:d.id});
  }
 }
}
const summary={...counts,candidates:decided,dualMentionArticles:dual.length,
  errors,mode:apply?'staged':'dry-run',mainPublished:false,
  humanVoiceQA:'SEO pages with both active and archived variants need semantic review; this machine step only rewrites exact references'};
if(report){
 fs.mkdirSync(report,{recursive:true});
 for(const [name,obj] of [['summary',summary],['article-changes',changed],['dual-mentions',dual]])
 fs.writeFileSync(path.join(report,name+'.json'),JSON.stringify(obj,null,2)+'\n');
}
if(!apply){console.log(JSON.stringify(summary));process.exit(0);}
write('data/catalog-archive.json',archive);
write(registryFile,seo);
const run=(...cmd)=>cp.execFileSync(process.execPath,cmd,{cwd:root,stdio:'inherit'});
run('scripts/sync-archives.mjs','--apply');
run('scripts/sync-tour-inventory.mjs','--apply');
console.log(JSON.stringify({archives:counts.archives,seoRows:counts.seoRows,
  articleFiles:counts.articleFiles,replacements:counts.articleReplacements,
  macros:counts.macros,ambiguousSeoArticles:dual.length,
  errors:errors.length},null,2));
if(errors.length)process.exitCode=1;
