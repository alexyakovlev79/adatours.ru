#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { shardFor, summaryForShard } from './matching-core.mjs';
const read=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const root='../../data/i18n/matching/v1/';
const [idx,manifest,source]=await Promise.all([read(root+'index.json'),read(root+'manifest.json'),read('../../data/i18n/tour-word-matches.json')]);
const failures=[],totals={},seen=new Set(),pilot=[];
for(let i=0;i<16;i++){
 const key=i.toString(16).padStart(2,'0');
 const [job,shard]=await Promise.all([read(root+'jobs/'+key+'.json'),read(root+'state/'+key+'.json')]);
 const expect=summaryForShard(shard),actual=idx.shards[key];
 if(JSON.stringify(expect)!==JSON.stringify(actual))failures.push('shard summary mismatch '+key);
 if(job.jobs.length!==shard.items.length)failures.push('descriptor/state mismatch '+key);
 const ids=new Set(job.jobs.map(j=>j.jobId));
 for(const item of shard.items){
  if(!ids.has(item.jobId))failures.push('missing job descriptor '+item.jobId);
  if(shardFor(item.jobId)!==key)failures.push('wrong shard '+item.jobId);
  if(seen.has(item.jobId))failures.push('duplicate job '+item.jobId);
  if(item.status==='queued')pilot.push(item.jobId);
  seen.add(item.jobId);
 }
 for(const [state,count] of Object.entries(expect.counts))totals[state]=(totals[state]||0)+count;
}
for(const [k,v] of Object.entries(idx.counts))if(totals[k]!==v)failures.push('overall count mismatch '+k);
if(manifest.jobCount!==seen.size||seen.size!==source.counts.activeTours)failures.push('active Tour count mismatch');
if(idx.pilotOnly&&pilot.length>manifest.pilotJobCount)failures.push('pilot exceeded permission');
if(idx.translationEnabled!==false)failures.push('translation must remain disabled');
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
else console.log(JSON.stringify({status:'matching_seed_valid',activeTours:seen.size,queued:idx.counts.queued,held:idx.counts.held,pilotOnly:idx.pilotOnly,matchingEnabled:idx.matchingEnabled}));
