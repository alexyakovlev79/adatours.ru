#!/usr/bin/env node
/** Offline audit and generation of stable RU Tour localization block maps.
 * Derives IDs from current authoritative Tour MD, but never translates texts.
 * No files are considered approved until all active Tours validate and
 * source identity agrees with the frozen match manifest.
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import yaml from 'js-yaml';
import {createStableBlockMap} from '../../src/lib/i18n/block-map.mjs';
import {sourceFromContentEntry} from '../../src/lib/i18n/content-adapter.mjs';
const base=resolve(process.argv[2]||'.');
const out=process.argv.includes('--output')?resolve(process.argv[process.argv.indexOf('--output')+1]):null;
const publish=process.argv.includes('--write');
if(publish&&!out)throw Error('--write requires --output');
const content=async p=>readFile(join(base,p),'utf8');
const [matching,archive]=await Promise.all([
  content('data/i18n/tour-word-matches.json').then(JSON.parse),
  content('data/catalog-archive.json').then(JSON.parse)
]);
const archived=new Set(Array.isArray(archive)?archive.map(x=>x.id):
  Array.isArray(archive.entries)?archive.entries.map(x=>x.id):[]);
const active=matching.matches.filter(x=>x.ruStatus!=='archived');
const issues=[],success=[],paths=new Set();
for(const row of active){
 try{
  const {entityId:id,ruContentPath:p}=row;
  if(!p?.startsWith('src/content/tours/')||!p.endsWith('.md'))throw Error('Missing exact Tour source path');
  if(paths.has(p))throw Error('Duplicate contentPath');
  paths.add(p);
  const raw=await content(p);
  const match=/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/u.exec(raw);
  if(!match)throw Error('Invalid frontmatter');
  const data=yaml.load(match[1]);
  if(data.id!==id||data.locale!=='ru'||data.status==='archived'||archived.has(id))throw Error('Tour identity/status changed since matching');
  const entry={id:'ru:'+id,data,body:match[2]};
  const map=createStableBlockMap(entry,'tour');
  const snapshot=sourceFromContentEntry(entry,'tour',map);
  if(map.paths.length!==snapshot.blocks.length)throw Error('Incomplete block coverage');
  map.sourceContentPath=p;
  map.ruBlobSha256=createHash('sha256').update(raw,'utf8').digest('hex');
  map.sourceBlocksCount=snapshot.blocks.length;
  map.matchingJobId='match:'+id;
  const dataBytes=JSON.stringify(map,null,2)+'\n';
  success.push({entityId:id,path:p,blocks:map.paths.length,sourceSha256:map.ruBlobSha256,
    mapSha256:createHash('sha256').update(dataBytes).digest('hex')});
  if(publish){
   await mkdir(out,{recursive:true});
   await writeFile(join(out,id+'.json'),dataBytes);
  }
 }catch(e){issues.push({entityId:row.entityId,reason:String(e)});}
}
const report={schemaVersion:1,sourceManifestCommit:matching.repositoryCommit,
 activeTours:active.length,processed:success.length,errors:issues.length,
 totalBlocks:success.reduce((n,x)=>n+x.blocks,0),
 bySize:{minimum:Math.min(...success.map(x=>x.blocks)),maximum:Math.max(...success.map(x=>x.blocks))},
 entries:success,issues};
if(out){
 await mkdir(out,{recursive:true});
 await writeFile(join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({activeTours:report.activeTours,processed:report.processed,errors:report.errors,
 totalBlocks:report.totalBlocks,blockSizes:report.bySize,issueSample:issues.slice(0,35)},null,2));
if(issues.length||success.length!==active.length)process.exitCode=1;