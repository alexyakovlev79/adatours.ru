#!/usr/bin/env node
/** Bounded, offline recovery of expired EN bulk leases and eligible retries.
 * Run only against a checkout of i18n/translation-mass-staging. It never
 * changes result blobs or repurposes expired generations.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {massReap,massRebuildIndex} from './translation-mass-core.mjs';
const fail=m=>{throw Error('EN mass reaper: '+m)};
const root=path.resolve(process.argv[2]||'data/i18n/translation-mass/v2');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,v)=>fs.writeFileSync(path.join(root,p),JSON.stringify(v,null,2)+'\n');
export function reapMassQueue(rootPath,now,{writeChanges=false}={}){
 const get=p=>JSON.parse(fs.readFileSync(path.join(rootPath,p),'utf8'));
 const index=get('index.json');
 if(index.schemaVersion!==2||index.publicationEnabled!==false)fail('Wrong queue or publication gate');
 if(!index.dispatcherEnabled)return{status:'disabled',restored:0,shards:[]};
 let next=structuredClone(index),restored=0;
 const changed=[];
 const stamp=new Date(now).toISOString();
 for(const [sid,summary] of Object.entries(next.shards)){
  const expiration=summary.earliestExpiryAt, retry=summary.earliestRetryAt;
  if((!expiration||Date.parse(expiration)>Date.parse(stamp))&&
     (!retry||Date.parse(retry)>Date.parse(stamp)))continue;
  const old=get('state/'+sid+'.json');
  const result=massReap(old,stamp);
  if(!result.restored)continue;
  next=massRebuildIndex(next,sid,result.shard,stamp);
  changed.push({sid,shard:result.shard});
  restored+=result.restored;
 }
 if(!changed.length)return{status:'unchanged',restored:0,shards:[]};
 for(const [owner,lease] of Object.entries(next.activeOwners||{}))
  if(Date.parse(lease.expiresAt)<=Date.parse(stamp))delete next.activeOwners[owner];
 if(writeChanges){
  for(const row of changed)fs.writeFileSync(path.join(rootPath,'state/'+row.sid+'.json'),
   JSON.stringify(row.shard,null,2)+'\n');
  fs.writeFileSync(path.join(rootPath,'index.json'),JSON.stringify(next,null,2)+'\n');
 }
 return{status:writeChanges?'updated':'dry_run',restored,
  shards:changed.map(x=>x.sid),counts:next.counts};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url))){
 const current=new Date().toISOString();
 const report=reapMassQueue(root,current,{writeChanges:process.argv.includes('--write')});
 console.log(JSON.stringify({...report,now:current}));
}
