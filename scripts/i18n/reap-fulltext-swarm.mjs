#!/usr/bin/env node
/**
 * Independent, bounded recovery for Ada Tours full-document EN swarm.
 * Source of truth: the frozen manifest, global control and exact state shards.
 * Intended for GitHub Actions checkout of i18n/translation-mass-staging.
 * No network, no worker start, no translation, no writes to main or results.
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {fulltextReap,fulltextShardId} from "./fulltext-swarm-core.mjs";

const fail=m=>{throw Error("Fulltext reaper: "+m);};
const clone=x=>JSON.parse(JSON.stringify(x));
const validDate=x=>Number.isFinite(Date.parse(x));
const encode=x=>JSON.stringify(x,null,2)+"\n";

/** Pure reconciliation: read only the state shards referenced by expired leases. */
export function reconcileFulltextExpiry(manifest,control,loadShard,now){
 if(manifest.schemaVersion!==1||control.schemaVersion!==1||
    manifest.sourceMainSha!==control.sourceMainSha||manifest.packets!==control.packets)
   fail("manifest/control mismatch");
 if(!validDate(now))fail("invalid clock");
 const expired=Object.entries(control.activeByOwner||{})
   .filter(([,lease])=>validDate(lease.expiresAt)&&Date.parse(lease.expiresAt)<=Date.parse(now))
   .map(([owner,lease])=>({owner,number:lease.number,...lease}))
   .sort((a,b)=>a.number-b.number);
 if(!expired.length)return {status:"unchanged",control,changed:{},restored:[],dueRetries:(control.retryQueue||[]).filter(x=>validDate(x.nextAttemptAt)&&Date.parse(x.nextAttemptAt)<=Date.parse(now)).length};
 let c=clone(control),changed={};
 const restored=[];
 for(const lease of expired){
   if(!Number.isInteger(lease.number)||lease.number<1||lease.number>manifest.packets)
     fail("invalid active packet number");
   const sid=fulltextShardId(lease.number);
   const shard=changed[sid]??clone(loadShard(sid));
   const state=shard.packets?.[String(lease.number)];
   if(state?.status!=="leased"||state.ownerId!==lease.owner||
       state.generation!==lease.generation||state.token!==lease.token)
     fail("inconsistent expired lease: "+lease.number);
   if(!validDate(state.expiresAt)||Date.parse(state.expiresAt)>Date.parse(now))
     fail("lease has not expired on shard: "+lease.number);
   const next=fulltextReap(c,shard,lease.number,now);
   c=next.control;changed[sid]=next.shard;
   restored.push({packet:lease.number,previousGeneration:lease.generation,
     newGeneration:next.shard.packets[String(lease.number)].generation});
 }
 const dueRetries=(c.retryQueue||[]).filter(x=>validDate(x.nextAttemptAt)&&Date.parse(x.nextAttemptAt)<=Date.parse(now)).length;
 return {status:"recovered",control:c,changed,restored,dueRetries};
}
export function reapFulltextQueue(root,now,{write=false}={}){
 const read=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),"utf8"));
 const manifest=read("manifest.json"),control=read("control.json");
 const output=reconcileFulltextExpiry(manifest,control,sid=>read("state/"+sid+".json"),now);
 if(write&&output.restored.length){
   for(const [sid,shard] of Object.entries(output.changed))
     fs.writeFileSync(path.join(root,"state/"+sid+".json"),encode(shard));
   fs.writeFileSync(path.join(root,"control.json"),encode(output.control));
 }
 return {status:output.status,write,restored:output.restored,
    shards:Object.keys(output.changed),dueRetries:output.dueRetries,
    counts:{queued:output.control.queued,leased:output.control.leased,
      saved:output.control.saved,retryable:output.control.retryable}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url))){
 const root=path.resolve(process.argv[2]||"data/i18n/fulltext-swarm/v1");
 const now=new Date().toISOString();
 console.log(JSON.stringify({...reapFulltextQueue(root,now,{write:process.argv.includes("--write")}),now}));
}
