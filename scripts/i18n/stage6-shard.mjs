#!/usr/bin/env node
/** Stage 6: nine-way independent, frozen-source English image-label work. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd();
const dataRoot=path.join(root,'src/data/i18n');
const manifest=JSON.parse(fs.readFileSync(path.join(dataRoot,'stage6-shards/manifest.json'),'utf8'));
const main=JSON.parse(fs.readFileSync(path.join(dataRoot,'media-captions.en.json'),'utf8'));
const [action,stage,auditFile,requestedLimit]=process.argv.slice(2);
const fail=msg=>{throw Error('Stage 6 shards: '+msg)};
if(!['list','status','verify'].includes(action))fail('Usage: node scripts/i18n/stage6-shard.mjs list|status|verify 6.1 /absolute/path/stage6-media-audit.json [limit]');
if(!/^6\.[1-9]$/.test(stage||''))fail('Expected one stage in 6.1 through 6.9');
if(!auditFile)fail('Audit JSON path is required');
const digest=b=>createHash('sha256').update(b).digest('hex');
const assign=src=>6+'.'+(createHash('sha256').update(src,'utf8').digest().readUInt32BE(28)%9+1);
const input=fs.readFileSync(path.resolve(auditFile));
if(digest(input)!==manifest.auditSha256)fail('Audit SHA256 does not match the frozen source; do not use a different build');
const audit=JSON.parse(input.toString('utf8'));
if(audit.pagesScanned!==6149||audit.uniqueImagesWithRussianAlt!==701||
 audit.translatedKnownMediaStillWithRussianAlt!==0)fail('Frozen audit summary mismatch');
const bySrc=new Map();
for(const row of audit.residualBySrc||[]){
 if(!row.src?.startsWith('/media/')||bySrc.has(row.src))fail('Invalid/duplicate audit media src '+row.src);
 bySrc.set(row.src,{...row,titles:[]});
}
for(const row of audit.residualHoverBySrc||[]){
 const current=bySrc.get(row.src);
 if(current)current.titles=row.titles||[];
 else bySrc.set(row.src,{src:row.src,occurrences:row.occurrences||0,alts:[],samplePages:[],titles:row.titles||[]});
}
const known=new Set(Object.keys(main.entries||{}));
const problems=[];
const stages=new Map();
for(let n=1;n<=9;n++){
 const name='6.'+n;
 const file=path.join(dataRoot,'stage6-shards','6-'+n+'.en.json');
 const shard=JSON.parse(fs.readFileSync(file,'utf8'));
 if(shard.schemaVersion!==1||shard.stage!==name)problems.push('Invalid shard header '+name);
 stages.set(name,shard);
 for(const [src,v] of Object.entries(shard.entries||{})){
  if(assign(src)!==name)problems.push('Wrong shard ownership '+src+' in '+name);
  if(known.has(src))problems.push('Duplicate EN media key '+src);
  known.add(src);
  if(v.sourceKey!==src||v.source!=='stage6-shard-'+name||
    typeof v.alt!=='string'||v.alt.trim().length<8||/[А-Яа-яЁё]/u.test(v.alt))
   problems.push('Invalid EN label '+src);
  if(typeof v.sourceAlt!=='string'||!bySrc.get(src)?.alts?.includes(v.sourceAlt))
   problems.push('Unverified original RU alt '+src);
  for(const k of ['title','ariaLabel','caption'])if(v[k]!==undefined&&
    (typeof v[k]!=='string'||/[А-Яа-яЁё]/u.test(v[k])))problems.push('Invalid optional '+k+' '+src);
 }
 for(const [src,reason] of Object.entries(shard.review||{}))
  if(assign(src)!==name||!bySrc.has(src)||typeof reason!=='string'||!reason.trim())
   problems.push('Invalid review entry '+src);
}
const owned=[...bySrc.values()].filter(r=>assign(r.src)===stage)
 .sort((a,b)=>b.occurrences-a.occurrences||a.src.localeCompare(b.src));
const remaining=owned.filter(r=>!known.has(r.src));
const own=stages.get(stage);
const reviewed=remaining.filter(r=>Object.hasOwn(own.review||{},r.src)).length;
const summary={stage,baselineCommit:manifest.baselineCommit,auditSha256:manifest.auditSha256,
 totalOwned:owned.length,alreadySaved:owned.length-remaining.length,remaining:remaining.length,
 reviewedUnresolved:reviewed,occurrencesBaseline:owned.reduce((v,r)=>v+r.occurrences,0),
 invalid:problems.length};
if(action==='verify'){
 console.log(JSON.stringify({...summary,problems},null,2));
 if(problems.length)process.exitCode=1;
}else if(action==='status'){
 console.log(JSON.stringify(summary,null,2));
}else{
 if(problems.length)fail('Invalid saved entries: '+problems.slice(0,10).join('; '));
 const limit=requestedLimit===undefined?25:Number(requestedLimit);
 if(!Number.isInteger(limit)||limit<1||limit>100)fail('limit must be 1..100');
 console.log(JSON.stringify({...summary,tasks:remaining.slice(0,limit).map(r=>({
  src:r.src,ruAlts:r.alts,ruTitles:r.titles,occurrences:r.occurrences,
  samplePages:r.samplePages,reviewReason:own.review?.[r.src]||null
 }))},null,2));
}
