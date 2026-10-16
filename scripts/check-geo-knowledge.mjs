import fs from 'node:fs';
import path from 'node:path';
import {validateResult,digest} from './schema-geo-core.mjs';
const dir='data/geo-knowledge';
const queue=JSON.parse(fs.readFileSync(dir+'/queue.json','utf8'));
const state=JSON.parse(fs.readFileSync(dir+'/state.json','utf8'));
const errors=[],ids=new Set(),qids=new Map(),parents=new Map();
for(const job of queue.jobs){if(ids.has(job.jobId))errors.push('Duplicate job '+job.jobId);ids.add(job.jobId);if(/\/page\/\d+\//.test(job.url))errors.push('Pagination job '+job.jobId);}
for(const [jobId,s]of Object.entries(state.jobs)){
 if(!s.resultPath)continue;
 const job=queue.jobs.find(j=>j.jobId===jobId);if(!job){errors.push('Missing job '+jobId);continue;}
 const r=JSON.parse(fs.readFileSync(s.resultPath,'utf8'));
 if(digest(r)!==s.resultHash)errors.push('Hash mismatch '+jobId);
 if(!['STALE','UNAVAILABLE'].includes(s.status))errors.push(...validateResult(r,job).map(e=>jobId+': '+e));
 if(r.status!=='READY')continue;
 const q=r.external?.wikidataQid;
 if(q){if(qids.has(q)&&qids.get(q)!==job.stableId)errors.push('QID collision requires review: '+q);qids.set(q,job.stableId);}
 for(const rel of r.relationships||[])if(rel.type==='containedInPlace'){
  const target=queue.jobs.find(j=>j.stableId===rel.targetId&&j.available);
  if(!target)errors.push('Unresolved geographical parent '+rel.targetId);
  const ownCountries=job.countryIds||[];
  const targetCountries=target?.countryIds||[];
  if(ownCountries.length&&targetCountries.length&&!ownCountries.some(id=>targetCountries.includes(id)))errors.push('Cross-country containment '+jobId);
  if(!parents.has(job.stableId))parents.set(job.stableId,[]);parents.get(job.stableId).push(rel.targetId);
 }
}
function visit(id,ancestors=new Set()){
 if(ancestors.has(id)){errors.push('Containment cycle '+id);return;}
 for(const p of parents.get(id)||[])visit(p,new Set([...ancestors,id]));
}
for(const id of parents.keys())visit(id);
console.log(JSON.stringify({jobs:queue.jobs.length,results:Object.values(state.jobs).filter(s=>s.resultPath).length,errors},null,2));
if(errors.length)process.exitCode=1;
