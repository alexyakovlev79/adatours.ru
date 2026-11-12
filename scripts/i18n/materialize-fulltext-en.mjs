#!/usr/bin/env node
/** Materialize immutable full-text EN translations in a disposable, noindex EN
 * build checkout only. Never edit the Git source branch or the RU deployment.
 * All identity, prices, dates, routes, links and media come from current main.
 */
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, join, dirname, sep} from 'node:path';
import {createHash} from 'node:crypto';
import yaml from 'js-yaml';

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
const mergeTexts=(old,translated,counter,path='')=>{
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
export function applyFulltextToSource(source,english,kind,expectedSha){
 const original=splitFulltextMarkdown(source),en=splitFulltextMarkdown(english);
 if(kind==='seo_geo_article'){
  if(en.data.targetPath!==original.data.targetPath || en.data.kind!==original.data.kind ||
     en.data.status!==original.data.status)throw new Error('SEO/GEO identity changed');
 }else if(en.data.id!==original.data.id || en.data.locale!=='en' ||
          original.data.locale!=='ru' || en.data.slug!==original.data.slug)
   throw new Error('Content identity or language changed');
 if(original.data.status==='archived'||original.data.status==='draft')return {status:'excluded'};
 if(original.body.trim()&&!en.body.trim())throw new Error('EN body is empty');
 const tally={changed:0},merged=mergeTexts(original.data,en.data,tally);
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
 const states=await Promise.all(Array.from({length:16},(_,i)=>
  json(snapPath(ROOT+'state/'+i.toString(16).padStart(2,'0')+'.json'))));
 const defs=new Map();
 const summary={schemaVersion:1,kind:'noindex-fulltext-materialization',
  sourceStagingSha:process.env.EN_MASS_SNAPSHOT_SHA,
  canonicalSourceSha:process.env.ADA_CANONICAL_SHA||null,
  expectedPackets:manifest.packets,expectedTexts:manifest.items,
  verifiedPackets:0,verifiedTexts:0,applied:0,partial:0,withheld:0,excluded:0,
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
   if(text?.number!==item.number||text.path!==item.path||text.sourceBlobSha!==item.sha||
      typeof text.enMarkdown!=='string'||text.enMarkdown.length<5)
      f('Text identity differs from frozen definition '+n+'/'+k);
   summary.verifiedTexts++;
   const kind=fulltextSourceKind(item.path);
   if(!kind)f('Unexpected fulltext path '+item.path);
   const group=summary.byKind[kind]??={applied:0,partial:0,withheld:0,excluded:0};
   try{
    const file=srcPath(item.path),raw=await readFile(file);
    if(sha(raw)!==item.sha)throw new Error('source_changed');
    const projected=applyFulltextToSource(raw.toString('utf8'),text.enMarkdown,kind,item.sha);
    if(projected.status==='excluded'){summary.excluded++;group.excluded++;continue;}
    await writeFile(file,projected.content,'utf8');
    summary[projected.status]++;group[projected.status]++;
    if(summary.appliedSample.length<10)summary.appliedSample.push(item.path);
    if(projected.status==='partial'&&summary.withheldSamples.length<80)
     summary.withheldSamples.push({path:item.path,reason:'body_untranslated_or_link_mismatch'});
   }catch(error){
    summary.withheld++;group.withheld++;
    if(summary.withheldSamples.length<80)summary.withheldSamples.push({path:item.path,reason:String(error.message).slice(0,150)});
   }
  }
 }
 if(summary.verifiedTexts!==manifest.items)f('Text inventory total mismatch');
 const receipt=resolve(sourceRoot,'../en-fulltext-receipt.json');
 await mkdir(dirname(receipt),{recursive:true});await writeFile(receipt,JSON.stringify(summary,null,2)+'\n');
 console.log('ADA_EN_FULLTEXT='+JSON.stringify({applied:summary.applied,partial:summary.partial,
  withheld:summary.withheld,excluded:summary.excluded,verified:summary.verifiedTexts,receipt}));
}
if(process.argv[1] && resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname))
 main().catch(error=>{console.error(error);process.exitCode=1;});
