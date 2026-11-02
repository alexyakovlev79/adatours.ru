#!/usr/bin/env node
/** Read-only 3-Tour pilot seed; never creates a remote queue or publishes. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {seedTranslationPilot} from './translation-core.mjs';
const root=path.resolve(process.argv[2]||'.');
const outputFlag=process.argv.indexOf('--output');
const out=outputFlag<0?null:path.resolve(process.argv[outputFlag+1]);
const ids=['tour_brazil_rio_four_days','tour_chile_easter_island_3_days_2027',
 'tour_colombia_essential_5_days'];
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const jobs=[];
for(const id of ids){
 const packet=read('data/i18n/word-block-alignments/pilot/'+id+'.json');
 const map=read('data/i18n/block-maps/tours/'+id+'.json');
 if(packet.entityId!==id||packet.state!=='pilot_prepared'||packet.releaseEligible!==false)
  throw Error('Pilot alignment is missing/unverified: '+id);
 for(let i=0;i<packet.blocks.length;i+=8){
  const blocks=packet.blocks.slice(i,i+8);
  const source={driveFileId:packet.word.driveFileId,wordSha256:packet.word.documentSha256,
   ruSha256:map.ruBlobSha256,ruContentPath:packet.ruContentPath,
   ruGitBlobSha:packet.ruGitBlobSha};
  jobs.push({jobId:'en:tour:'+id+':p'+(1+Math.floor(i/8)),
   entityId:id,entityType:'tour',locale:'en',stage:'word_2027',
   sourceFingerprint:hash({id,source,blocks}),source,blocks});
 }
}
const r=seedTranslationPilot(jobs);
const result={pilots:ids.length,packets:jobs.length,blocks:jobs.reduce((s,j)=>s+j.blocks.length,0),
 opened:r.index.dispatcherEnabled,published:r.index.publicationEnabled,
 sharded:Object.values(r.shards).filter(s=>s.items.length).length};
if(out){
 const write=(p,x)=>{const f=path.join(out,p);fs.mkdirSync(path.dirname(f),{recursive:true});
  fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n');};
 write('manifest.json',r.manifest);write('index.json',r.index);
 for(const [sid,state] of Object.entries(r.shards))write('state/'+sid+'.json',state);
 for(const [sid,packet] of Object.entries(r.packets))write('jobs/'+sid+'.json',packet);
}
console.log(JSON.stringify(result));
