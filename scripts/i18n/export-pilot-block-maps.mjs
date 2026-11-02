#!/usr/bin/env node
/* Build stable RU text block sidecars for the original Word identity pilot.
 * No translations are generated. A missing or ambiguous slot is a failure.
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import yaml from 'js-yaml';
import {createStableBlockMap} from '../../src/lib/i18n/block-map.mjs';
import {sourceFromContentEntry} from '../../src/lib/i18n/content-adapter.mjs';
const base=resolve(process.argv[2]||'.');
const dest=process.argv.includes('--output')?resolve(process.argv[process.argv.indexOf('--output')+1]):null;
const write=process.argv.includes('--write');
const ids=[
 'tour_brazil_rio_four_days','tour_brazil_foz_iguazu_three_days',
 'tour_brazil_best_rio_express_six_days','tour_mexico_lindo_eight_days',
 'tour_chile_easter_island_3_days_2027','tour_colombia_essential_5_days',
 'tour_guatemala_discover_8_days','tour_panama_city_gamboa_6_days',
];
const manifest=JSON.parse(await readFile(join(base,'data/i18n/tour-word-matches.json'),'utf8'));
const byId=new Map(manifest.matches.map(x=>[x.entityId,x]));
const successes=[],issues=[];
if(write&&!dest)throw Error('--write requires --output');
for(const id of ids){
 try{
  const source=byId.get(id);
  if(!source||source.ruStatus==='archived')throw Error('Tour absent or archived');
  const raw=await readFile(join(base,source.ruContentPath),'utf8');
  const match=/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/u.exec(raw);
  if(!match)throw Error('Frontmatter missing or malformed');
  const data=yaml.load(match[1]);
  if(data.id!==id||data.locale!=='ru')throw Error('Wrong source locale or ID');
  const entry={id:'ru:'+id,data,body:match[2]};
  const map=createStableBlockMap(entry,'tour');
  const sourceSnapshot=sourceFromContentEntry(entry,'tour',map);
  map.sourceContentPath=source.ruContentPath;
  map.ruBlobSha256=createHash('sha256').update(raw,'utf8').digest('hex');
  map.sourceFingerprint=sourceSnapshot.blocks.length;
  if(write){
   const path=join(dest,id+'.json');
   await mkdir(dest,{recursive:true});
   await writeFile(path,JSON.stringify(map,null,2)+'\n');
  }
  successes.push({id,blocks:map.paths.length,contentPath:source.ruContentPath,hash:map.ruBlobSha256});
 }catch(e){issues.push({id,error:String(e)});}
}
const report={schemaVersion:1,sourceManifestCommit:manifest.repositoryCommit,
 requested:ids.length,succeeded:successes.length,failed:issues.length,entries:successes,issues};
if(dest)await writeFile(join(dest,'manifest.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(issues.length)process.exitCode=1;
