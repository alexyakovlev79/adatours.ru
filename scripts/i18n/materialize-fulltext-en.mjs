#!/usr/bin/env node
/** Materialize immutable full-text EN translations in a disposable, noindex EN
 * build checkout only. Never edit the Git source branch or the RU deployment.
 * All identity, prices, dates, routes, links and media come from current main.
 */
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, join, dirname, sep} from 'node:path';
import {createHash} from 'node:crypto';
import yaml from 'js-yaml';
import {parseSeoGeoArticle} from '../../src/lib/seo-geo.mjs';
import {
 authorizeFulltextSource,repairFulltextEnglishSyntax,repairedFulltextBody
} from './fulltext-publication-repairs.mjs';

const ROOT='data/i18n/fulltext-swarm/v1/';
const CYR=/[\u0400-\u052f]/u;
const f=message=>{throw new Error('Ada EN fulltext materializer: '+message);};
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const sha=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const noIndex=process.env.SITE_LOCALE==='en' &&
 process.env.EN_STAGING_PAGES==='1' && process.env.EN_SHARED_CONTENT==='1' &&
 process.env.PUBLIC_EN_RELEASE==='0' && process.env.EN_PUBLISH_FULLTEXT==='1';
const sourceRoot=resolve(process.cwd());
const snapshotRoot=resolve(sourceRoot,process.env.EN_ACCEPTED_TRANSLATIONS_ROOT||'../translation-preview');
const srcPath=p=>{const file=resolve(sourceRoot,p);
 if(!file.startsWith(sourceRoot+sep))f('Unsafe source path '+p);return file;};
const snapPath=p=>{const file=resolve(snapshotRoot,p);
 if(!file.startsWith(snapshotRoot+sep))f('Unsafe snapshot path '+p);return file;};

export function fulltextSourceKind(p) {
 const c=/^src\/content\/(countries|destinations|excursions|themes|cases|people)\/[a-z0-9_/-]+\.md$/.exec(p);
 if(c&&!p.includes('//'))return c[1];
 if(/^data\/seo-geo\/articles\/[a-z0-9_/-]+\/index\.md$/.test(p) && !p.includes('//'))
   return 'seo_geo_article';
 return null;
}
export function splitFulltextMarkdown(text){
 const m=/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/u.exec(text);
 if(!m)throw new Error('Markdown frontmatter not found');
 const data=yaml.load(m[1]);
 if(!data || typeof data!=='object' || Array.isArray(data))
   throw new Error('Markdown frontmatter is not a map');
 return {data,body:m[2]};
}
const visible=[
 /^\/(?:name|title|summary|lead|role|segment|description|bestTime|entryNotes|destinationName|duration|format|priceNote|groupSize)$/,
 /^\/(?:regions|languages|expertise|proof|included|notIncluded|notes|route)\/\d+$/,
 /^\/(?:hero|photo|gallery\/\d+)\/(?:alt|hover|caption)$/,
 /^\/featureBands\/\d+\/(?:eyebrow|title|text)$/,
 /^\/facts\/\d+\/(?:label|value)$/,
 /^\/testimonial\/(?:quote|caption)$/,
 /^\/(?:buttonLabel)$/,
];
const numbers=s=>(String(s).match(/\d+(?:[.,]\d+)*/g)||[]);
const safeValue=(old,value)=>typeof value==='string'&&value.trim()!==''
 && !CYR.test(value) && eq(numbers(old),numbers(value));

// Stage 9: permit only numerical *formatting* changes in an immutable
// source-bound EN SEO lead, never a change in numeric facts or their order.
// RU 1050 / EN 1,050 and RU 67,5 / EN 67.5 are equivalent. A differing
// price, duration, year or a new digit not in the RU source stays fallback.
const seoNumberPattern=/\d{1,3}(?:[\s\u00a0\u202f,.]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/gu;
const seoNumberFacts=value=>[...String(value).matchAll(seoNumberPattern)].map(([raw])=>{
 const n=raw.replace(/[\s\u00a0\u202f]/gu,'');
 if(/^\d{1,3}(?:[,.]\d{3})+$/u.test(n))return n.replace(/[,.]/gu,'');
 if(/^\d{1,3}(?:,\d{3})+\.\d+$/u.test(n))return n.replace(/,/gu,'');
 if(/^\d{1,3}(?:\.\d{3})+,\d+$/u.test(n))return n.replace(/\./gu,'').replace(',','.');
 return n.replace(/,(\d{1,2})$/u,'.$1');
});
// An approved, source-bound translation may spell a number differently:
 // Russian 'четырнадцатидневный' and English '14-day' refer to the same fact.
 // Recognise only known numeral tokens and duration compounds. Any added,
 // missing, reordered or genuinely changed numerical fact still falls back.
const ruNumbers=new Map([
 ['один',1],['одна',1],['одно',1],['одного',1],['одной',1],['одну',1],['одним',1],
 ['первый',1],['первого',1],['первой',1],['первом',1],['первую',1],
 ['два',2],['две',2],['двух',2],['двумя',2],['второй',2],['второго',2],['вторую',2],
 ['три',3],['трех',3],['трёх',3],['тремя',3],['третий',3],['третьей',3],
 ['четыре',4],['четырех',4],['четырёх',4],['четырьмя',4],
 ['пять',5],['пяти',5],['шесть',6],['шести',6],['семь',7],['семи',7],
 ['восемь',8],['восьми',8],['девять',9],['девяти',9],['десять',10],['десяти',10],
 ['одиннадцать',11],['одиннадцати',11],['двенадцать',12],['двенадцати',12],
 ['тринадцать',13],['тринадцати',13],['четырнадцать',14],['четырнадцати',14],
 ['пятнадцать',15],['пятнадцати',15],['шестнадцать',16],['шестнадцати',16],
 ['семнадцать',17],['семнадцати',17],['восемнадцать',18],['восемнадцати',18],
 ['девятнадцать',19],['девятнадцати',19],['двадцать',20],['двадцати',20],
 ['тридцать',30],['тридцати',30],['сорок',40],['пятьдесят',50],
 ['сто',100],['сотни',100]
]);
const ruCompoundRoots=[
 ['девятнадцати',19],['восемнадцати',18],['семнадцати',17],
 ['шестнадцати',16],['пятнадцати',15],['четырнадцати',14],
 ['тринадцати',13],['двенадцати',12],['одиннадцати',11],
 ['двадцати',20],['десяти',10],['девяти',9],['восьми',8],
 ['семи',7],['шести',6],['пяти',5],['четырёх',4],['четырех',4],
 ['трёх',3],['трех',3],['двух',2],['одно',1]
];
const enNumbers=new Map([
 ['one',1],['first',1],['two',2],['second',2],['three',3],['third',3],
 ['four',4],['fourth',4],['five',5],['fifth',5],['six',6],['sixth',6],
 ['seven',7],['seventh',7],['eight',8],['eighth',8],['nine',9],['ninth',9],
 ['ten',10],['tenth',10],['eleven',11],['twelfth',12],['twelve',12],
 ['thirteen',13],['fourteen',14],['fifteen',15],['sixteen',16],
 ['seventeen',17],['eighteen',18],['nineteen',19],['twenty',20],
 ['thirty',30],['forty',40],['fifty',50],['hundred',100]
]);
function romanCentury(token){
 if(!/^[IVXLCDM]{2,8}$/u.test(token))return null;
 const values={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};
 let sum=0;
 for(let i=0;i<token.length;i++)sum+=values[token[i]]<(values[token[i+1]]??0)?-values[token[i]]:values[token[i]];
 return sum>=2&&sum<=250?sum:null;
}
export function seoNumberSemanticFacts(value,language){
 const hits=[];
 for(const match of String(value).matchAll(seoNumberPattern)){
   const number=seoNumberFacts(match[0])[0];
   hits.push({at:match.index,n:number});
 }
 for(const match of String(value).matchAll(/[a-zA-Z]+|[а-яёА-ЯЁ]+/gu)){
   const raw=match[0],token=raw.toLocaleLowerCase(language==='ru'?'ru':'en');
   let n=null;
   if(language==='ru'){
     n=ruNumbers.get(token)??romanCentury(raw);
     if(n===null){
       for(const [root,num] of ruCompoundRoots){
         if(token.startsWith(root)&&/^(?:днев|час|недель|летн|месяч)/u.test(token.slice(root.length))){
           n=num;break;
         }
       }
     }
   }else{
     n=enNumbers.get(token)??romanCentury(raw);
   }
   if(n!==null)hits.push({at:match.index,n:String(n)});
 }
 return hits.sort((a,b)=>a.at-b.at).map(x=>String(x.n));
}
export const sameSeoLeadNumerals=(old,value)=>typeof value==='string'&&value.trim()!==''
 && !CYR.test(value)&&
   eq(seoNumberSemanticFacts(old,'ru'),seoNumberSemanticFacts(value,'en'));

const mergeTexts=(old,translated,counter,path='')=>{
 if(old instanceof Date)return old; // YAML timestamps are canonical facts, not plain maps.
 if(typeof old==='string'){
  if(visible.some(re=>re.test(path))&&safeValue(old,translated)){
   counter.changed++;return translated;
  }
  return old;
 }
 if(Array.isArray(old)){
  if(!Array.isArray(translated)||old.length!==translated.length)return old;
  return old.map((v,i)=>mergeTexts(v,translated[i],counter,path+'/'+i));
 }
 if(old&&typeof old==='object'&&!Array.isArray(old)){
  const next={...old};if(translated&&typeof translated==='object'&&!Array.isArray(translated))
   for(const k of Object.keys(old))if(Object.hasOwn(translated,k))
    next[k]=mergeTexts(old[k],translated[k],counter,path+'/'+k);
  return next;
 }
 return old;
};
export function applyFulltextToSource(source,english,kind,expectedSha,options={}){
 const original=splitFulltextMarkdown(source),en=splitFulltextMarkdown(english);
 if(kind==='seo_geo_article'){
  if(en.data.targetPath!==original.data.targetPath ||
     (en.data.kind!==original.data.kind&&!options.seoKindAllowed) ||
     en.data.status!==original.data.status)throw new Error('SEO/GEO identity changed');
 }else if(en.data.id!==original.data.id || original.data.locale!=='ru' ||
          (en.data.locale!=='en'&&!(options.ruLocaleAllowed&&en.data.locale==='ru'))||
          en.data.slug!==original.data.slug)
   throw new Error('Content identity or language changed');
 if(original.data.status==='archived'||original.data.status==='draft')return {status:'excluded'};
 if(original.body.trim()&&!en.body.trim())throw new Error('EN body is empty');
 const tally={changed:0},merged=mergeTexts(original.data,en.data,tally);
 // A previously saved EN lead may have been rejected solely because its
 // thousands separators or decimal punctuation differ from canonical RU.
 if(kind==='seo_geo_article' && typeof original.data.lead==='string' &&
    typeof en.data.lead==='string' && merged.lead===original.data.lead &&
    sameSeoLeadNumerals(original.data.lead,en.data.lead) &&
    original.data.lead!==en.data.lead){
   merged.lead=en.data.lead;tally.changed++;
 }

 // Only source-verified, reviewed new factual text is allowed to supersede
 // a changed country feature band. Media, href, IDs and canonical facts remain RU.
 for(const [pointer,text] of Object.entries(options.textOverrides??{})){
   if(!/^\/featureBands\/\d+\/(?:title|text)$/.test(pointer))
     throw new Error('Unapproved country replacement pointer');
   const segments=pointer.slice(1).split('/');
   let canonical=original.data,target=merged;
   for(const key of segments.slice(0,-1)){canonical=canonical?.[key];target=target?.[key];}
   const last=segments.at(-1);
   if(!canonical||!target||!safeValue(canonical[last],text)||typeof target[last]!=='string')
     throw new Error('Changed country field cannot be safely translated');
   target[last]=text;tally.changed++;
 }
 let body=original.body,bodyApplied=false;
 if(!CYR.test(en.body)){
  const references=t=>(t.match(/\]\(([^)]*)\)/g)||[]).sort();
  const dynamic=t=>(t.match(/\{\{[^}]*\}\}/g)||[]).sort();
  if(eq(references(original.body),references(en.body))&&eq(dynamic(original.body),dynamic(en.body))){
   body=en.body;bodyApplied=true;
  }
 }
 if(kind!=='seo_geo_article'){
  merged._i18n={contentLanguage:bodyApplied?'en':'ru',translatedFields:tally.changed+Number(bodyApplied),
   sourceId:original.data.id,sourceName:original.data.name??original.data.title??'',
   sourceFingerprint:'git:'+expectedSha,
   ...(bodyApplied?{}:{fallbackReason:'fulltext_body_incomplete_or_unverified'})};
 }
 const content='---\n'+yaml.dump(merged,{lineWidth:-1,noRefs:true})+'---\n'+body;
 return {status:bodyApplied?'applied':'partial',content,fields:tally.changed,bodyApplied};
}

async function main(){
 if(!noIndex)f('Requires the dedicated noindex shared-EN Pages build');
 if(!/^[a-f0-9]{40}$/.test(process.env.EN_MASS_SNAPSHOT_SHA||''))f('Pinned staging commit is required');
 const detached=(await readFile(join(snapshotRoot,'.git/HEAD'),'utf8')).trim();
 if(detached!==process.env.EN_MASS_SNAPSHOT_SHA)f('Translation checkout not detached at declared SHA');
 const [manifest,control]=await Promise.all([json(snapPath(ROOT+'manifest.json')),json(snapPath(ROOT+'control.json'))]);
 if(manifest?.schemaVersion!==1||manifest.packets!==1412||manifest.items!==7056||
    !manifest.enabled||control.packets!==manifest.packets||control.saved!==manifest.packets||
    control.leased!==0||control.queued!==0||control.failed_final!==0||
    control.sourceMainSha!==manifest.sourceMainSha)f('Full-text queue not wholly saved and idle');
 const repairs=await json(join(sourceRoot,'data/i18n/fulltext-publication-repairs/2026-11-12.json'));
 if(repairs?.schemaVersion!==1||repairs.sourceMainSha!==manifest.sourceMainSha||
    repairs.stagingSha!==process.env.EN_MASS_SNAPSHOT_SHA)
   f('Pinned fulltext repair authorizations missing or changed');
 const states=await Promise.all(Array.from({length:16},(_,i)=>
  json(snapPath(ROOT+'state/'+i.toString(16).padStart(2,'0')+'.json'))));
 const defs=new Map();
 const summary={schemaVersion:1,kind:'noindex-fulltext-materialization',
  sourceStagingSha:process.env.EN_MASS_SNAPSHOT_SHA,
  canonicalSourceSha:process.env.ADA_CANONICAL_SHA||null,
  expectedPackets:manifest.packets,expectedTexts:manifest.items,
  verifiedPackets:0,checkedTexts:0,verifiedTexts:0,applied:0,partial:0,withheld:0,excluded:0,
  repairedSourceDrifts:0,repairedReceipts:0,repairedSyntax:0,repairedLinks:0,repairedLocale:0,repairedRevisions:0,
  byKind:{},withheldSamples:[],appliedSample:[]};
 for(let n=1;n<=manifest.packets;n++){
  const shard=states[(n-1)%16],row=shard.packets?.[String(n)];
  if(row?.status!=='saved'||!/^data\/i18n\/fulltext-swarm\/v1\/results\/[0-9]{5}\/[a-zA-Z0-9_.:-]+\.json$/.test(row.resultPath??''))
   f('Missing immutable saved result for packet '+n);
  const part=Math.floor((n-1)/20);
  if(!defs.has(part))defs.set(part,await json(snapPath(ROOT+'definitions/'+String(part).padStart(4,'0')+'.json')));
  const def=defs.get(part).packets.find(x=>x.number===n);
  if(!def||def.id!=='ADAEN-P'+String(n).padStart(5,'0')||def.sourceMainSha!==manifest.sourceMainSha)f('Packet definition drift '+n);
  const bytes=await readFile(snapPath(row.resultPath));
  if(sha(bytes)!==row.resultBlobSha)f('Immutable result checksum changed '+n);
  const stored=JSON.parse(bytes.toString('utf8')),result=stored.result;
  if(stored.schemaVersion!==1||stored.submissionId!==row.submissionId||
     result?.packetId!==def.id||result.sourceMainSha!==manifest.sourceMainSha||
     result.locale!=='en'||result.status!=='review'||result.texts?.length!==def.items.length)
    f('Invalid saved result envelope '+n);
  summary.verifiedPackets++;
  for(let k=0;k<def.items.length;k++){
   const item=def.items[k],text=result.texts[k];
   summary.checkedTexts++;
   const kind=fulltextSourceKind(item.path);
   if(!kind)f('Unexpected fulltext path '+item.path);
   const group=summary.byKind[kind]??={applied:0,partial:0,withheld:0,excluded:0};
   if(text?.number!==item.number||text.path!==item.path||
      typeof text.enMarkdown!=='string'||text.enMarkdown.length<5){
     summary.withheld++;group.withheld++;
     if(summary.withheldSamples.length<200)
       summary.withheldSamples.push({path:item.path,number:item.number,packet:n,reason:'saved_result_source_identity_mismatch',expected:item.sha,received:text?.sourceBlobSha});
     continue;
   }
   try{
    const file=srcPath(item.path),raw=await readFile(file),actualSha=sha(raw);
    const auth=authorizeFulltextSource(item.number,item.sha,actualSha,text.sourceBlobSha,repairs);
    summary.verifiedTexts++;
    // Recover the five substantially off-source historical outputs with new
    // full translations. Old receipts remain immutable; corrected revisions
    // carry their own exact canonical Git blob SHA and source path.
    let workingEnglish=text.enMarkdown;
    if(auth.compatiblePersonComplete){
      const revision=auth.compatiblePersonComplete;
      if(revision.path!==item.path||revision.number!==item.number||
         typeof revision.enMarkdown!=='string'||CYR.test(revision.enMarkdown))
        throw new Error('Unverified complete person revision');
      workingEnglish=revision.enMarkdown;
    }
    if(auth.compatiblePerson){
      const revision=auth.compatiblePerson;
      const russian=splitFulltextMarkdown(raw.toString('utf8'));
      const translated=splitFulltextMarkdown(workingEnglish);
      if(revision.path!==item.path||
         !russian.body.trimEnd().endsWith('\n\n'+revision.originalSuffix)||
         translated.body.includes(revision.englishSuffix)||
         /[\u0400-\u052f]/u.test(revision.englishSuffix))
        throw new Error('Unverified person appended sentence');
      workingEnglish=workingEnglish.trimEnd()+'\n\n'+revision.englishSuffix+'\n';
    }
    if(repairs.complexNeedsRevisions.includes(item.number)){
      const revisionPath='data/i18n/fulltext-publication-repairs/entries/'+String(item.number).padStart(5,'0')+'.json';
      const revisionBytes=await readFile(join(sourceRoot,revisionPath));
      if(sha(revisionBytes)!==repairs.revisionBlobs?.[String(item.number)])
        throw new Error('Pinned complete English revision checksum mismatch');
      const revision=JSON.parse(revisionBytes.toString('utf8'));
      if(revision?.schemaVersion!==1||revision.number!==item.number||
         revision.path!==item.path||revision.sourceBlobSha!==item.sha||
         revision.locale!=='en'||revision.status!=='review'||
         typeof revision.enMarkdown!=='string'||CYR.test(revision.enMarkdown))
        throw new Error('Fulltext revision identity or language invalid');
      workingEnglish=revision.enMarkdown;
    }
    const repairedSyntax=repairFulltextEnglishSyntax(workingEnglish,item.number,repairs);
    const repairedLinks=repairedFulltextBody(raw.toString('utf8'),repairedSyntax,item.number,repairs);
    const projected=applyFulltextToSource(raw.toString('utf8'),repairedLinks,kind,actualSha,{
     ruLocaleAllowed:repairs.ruLocaleInEnglish.includes(item.number),
     seoKindAllowed:false,
     textOverrides:auth.compatibleCountry?.textOverrides
    });
    if(projected.status==='excluded'){summary.excluded++;group.excluded++;continue;}
    if(kind==='seo_geo_article')parseSeoGeoArticle(projected.content,item.path);
    await writeFile(file,projected.content,'utf8');
    summary[projected.status]++;group[projected.status]++;
    if(auth.sourceReconciled)summary.repairedSourceDrifts++;
    if(auth.recoveredReceipt)summary.repairedReceipts++;
    if(repairedSyntax!==workingEnglish)summary.repairedSyntax++;
    if(repairedLinks!==repairedSyntax)summary.repairedLinks++;
    if(workingEnglish!==text.enMarkdown)summary.repairedRevisions++;
    if(repairs.ruLocaleInEnglish.includes(item.number))summary.repairedLocale++;
    if(summary.appliedSample.length<10)summary.appliedSample.push(item.path);
    if(projected.status==='partial'&&summary.withheldSamples.length<200)
     summary.withheldSamples.push({path:item.path,number:item.number,packet:n,reason:'body_untranslated_or_link_mismatch',englishCyrillic:/[\u0400-\u052f]/u.test(text.enMarkdown),bodyCyrillic:/[\u0400-\u052f]/u.test(splitFulltextMarkdown(text.enMarkdown).body),bodyLinksOriginal:(splitFulltextMarkdown(raw.toString('utf8')).body.match(/\]\(([^)]*)\)/g)||[]).length,bodyLinksEN:(splitFulltextMarkdown(text.enMarkdown).body.match(/\]\(([^)]*)\)/g)||[]).length});
   }catch(error){
    summary.withheld++;group.withheld++;
    if(summary.withheldSamples.length<200)summary.withheldSamples.push({path:item.path,number:item.number,packet:n,reason:String(error.message).slice(0,200)});
   }
  }
 }
 if(summary.checkedTexts!==manifest.items)f('Text inventory total mismatch');
 console.log('ADA_EN_FULLTEXT_ISSUES='+JSON.stringify(summary.withheldSamples));
 const receipt=resolve(sourceRoot,'../en-fulltext-receipt.json');
 await mkdir(dirname(receipt),{recursive:true});await writeFile(receipt,JSON.stringify(summary,null,2)+'\n');
 console.log('ADA_EN_FULLTEXT='+JSON.stringify({applied:summary.applied,partial:summary.partial,
  withheld:summary.withheld,excluded:summary.excluded,verified:summary.verifiedTexts,receipt}));
}
if(process.argv[1] && resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname))
 main().catch(error=>{console.error(error);process.exitCode=1;});
