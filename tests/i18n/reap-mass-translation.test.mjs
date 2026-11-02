import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createMassTranslationState,planTourTranslation} from '../../src/lib/i18n/translation-mass-plan.mjs';
import {massClaim,massRebuildIndex} from '../../scripts/i18n/translation-mass-core.mjs';
import {reapMassQueue} from '../../scripts/i18n/reap-mass-translation.mjs';
const sha='a'.repeat(40),full='b'.repeat(64);
function seed(){
 const map={entityId:'tour_one',entityType:'tour',sourceContentPath:'src/content/tours/x.md',
  ruBlobSha256:full,paths:[{path:'/title',blockId:'block:title',field:'title',dependsOn:[]}]};
 const row=planTourTranslation({id:'tour_one',map,
  slots:[{path:'/title',field:'title',text:'Рио'}],contentSha256:full,sourceBlobSha:sha,
  match:{entityId:'tour_one',sourceFingerprint:'git:source',outcome:'selected_2027',
   selectedSource:{driveFileId:'file-1',sourceSha256:full}}});
 return createMassTranslationState([row],{sourceCommit:sha,matchingCommit:sha,pilotCommit:sha});
}
test('expired active lease returns to queue, preserving immutable job and ownership history',()=>{
 const q=seed();q.index.dispatcherEnabled=true;q.index.translationMassLaunchAllowed=true;
 const sid=Object.keys(q.shards).find(k=>q.shards[k].items.length);
 const one=massClaim(q.shards[sid],{stage:'word_2027',
  ownerId:'owner1',token:'token1',now:'2026-11-02T12:00:00Z'});
 q.shards[sid]=one.shard;
 q.index=massRebuildIndex(q.index,sid,one.shard,'2026-11-02T12:00:00Z');
 q.index.activeOwners.owner1={jobId:one.item.jobId,token:'token1',
  expiresAt:one.item.lease.expiresAt,generation:one.item.generation};
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ada-en-reaper-'));
 try{
  fs.mkdirSync(path.join(root,'state'));
  fs.writeFileSync(path.join(root,'index.json'),JSON.stringify(q.index));
  fs.writeFileSync(path.join(root,'state/'+sid+'.json'),JSON.stringify(one.shard));
  const result=reapMassQueue(root,'2026-11-02T13:31:00Z',{writeChanges:true});
  assert.equal(result.status,'updated');assert.equal(result.restored,1);
  const index=JSON.parse(fs.readFileSync(path.join(root,'index.json'),'utf8'));
  assert.equal(index.counts.queued,1);assert.equal(index.counts.leased,0);
  assert.deepEqual(index.activeOwners,{});
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
