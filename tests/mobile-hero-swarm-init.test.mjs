import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {freezeHeroSwarm,SWARM_ROOT} from '../scripts/mobile-hero-swarm-init.mjs';
const asset=i=>({id:'hero-'+i,source:'/media/test/'+i+'.webp',status:'PENDING',profiles:['standard'],usages:[{id:'u'+i,pagePath:'/p'+i+'/',source:'/media/test/'+i+'.webp',profile:'standard',objectPosition:'center',geometry:{fit:'cover'},context:{title:'Page '+i,manualObjectPosition:null}}]});
const inv=assets=>({schemaVersion:1,sourceCommit:'a'.repeat(40),assets,counts:{assets:assets.length},provenance:{method:'rendered-astro-html'},excluded:[],videoPosters:[]});
test('frozen packets own unique assets, leave prepared/preserve outside work, and keep lease files tiny',()=>{
  const items=Array.from({length:23},(_,i)=>asset(i));items[0].status='PREPARED';items[1].status='PRESERVE_ORIGINAL';
  const a=freezeHeroSwarm(inv(items),{createdAt:'2026-10-23T00:00:00Z'}),b=freezeHeroSwarm(inv(items.reverse()),{createdAt:'2026-10-23T00:00:00Z'});
  assert.equal(a.manifest.packets.length,3);assert.equal(a.manifest.counts.queuedAssets,21);
  assert.deepEqual(a.manifest.packets,b.manifest.packets);
  const seen=new Set();for(const p of a.manifest.packets){const state=JSON.parse(a.files[p.path]),jobs=JSON.parse(a.files[p.jobsPath]);assert.equal(state.jobs,undefined);assert.ok(a.files[p.path].length<2000);assert.ok(jobs.jobs.length<=10);for(const j of jobs.jobs){assert.ok(!seen.has(j.id));seen.add(j.id);}const content=a.files[p.jobsPath];assert.equal(p.jobsBlobSha,createHash('sha1').update('blob '+Buffer.byteLength(content)+'\0').update(content).digest('hex'));}
  assert.equal(seen.size,21);assert.equal(JSON.parse(a.files[SWARM_ROOT+'/retained.json']).assets.length,2);
});
test('duplicate sources are rejected rather than assigned to different workers',()=>{
  const a=asset(1),b={...asset(2),source:a.source};assert.throws(()=>freezeHeroSwarm(inv([a,b])),/Duplicate/);
});
