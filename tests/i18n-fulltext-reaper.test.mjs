import test from "node:test";
import assert from "node:assert/strict";
import {fulltextClaim,fulltextPick} from "../scripts/i18n/fulltext-swarm-core.mjs";
import {reconcileFulltextExpiry} from "../scripts/i18n/reap-fulltext-swarm.mjs";
const t0="2026-11-10T16:00:00.000Z",t1="2026-11-10T18:00:00.000Z";
const manifest={schemaVersion:1,sourceMainSha:"e".repeat(40),packets:1412};
const init=()=>({c:{schemaVersion:1,sourceMainSha:manifest.sourceMainSha,packets:1412,nextPacket:1,queued:1412,leased:0,saved:0,
 retryable:0,blocked_external:0,stale_source:0,failed_final:0,activeByOwner:{},retryQueue:[],completedByOwner:{}},
 s:{schemaVersion:1,shard:0,packets:{"1":{status:"queued",generation:0,attempts:0}}}});
test("no expired leases: no writes, no changed shard",()=>{
 const {c,s}=init();
 const r=reconcileFulltextExpiry(manifest,c,()=>s,t0);
 assert.equal(r.status,"unchanged");
 assert.equal(r.restored.length,0);
 assert.deepEqual(r.changed,{});
});
test("independent recovery increments fencing, preserves saved count and requeues one task",()=>{
 const {c,s}=init(),owner={ownerId:"adaen-reaper-test",token:"adaen-token-1111"};
 const leased=fulltextClaim(c,s,fulltextPick(c,owner.ownerId,owner.token,t0),{...owner,now:t0});
 const result=reconcileFulltextExpiry(manifest,leased.control,()=>leased.shard,t1);
 assert.equal(result.status,"recovered");
 assert.equal(result.restored.length,1);
 assert.equal(result.control.queued,1412);
 assert.equal(result.control.leased,0);
 assert.equal(result.control.saved,0);
 assert.deepEqual(result.control.activeByOwner,{});
 assert.equal(result.changed["00"].packets["1"].generation,2);
 const next=fulltextClaim(result.control,result.changed["00"],fulltextPick(result.control,"adaen-other-owner","adaen-other-token",t1),{
 ownerId:"adaen-other-owner",token:"adaen-other-token",now:t1});
 assert.equal(next.shard.packets["1"].generation,3);
});
test("active lease is never released early",()=>{
 const {c,s}=init(),owner={ownerId:"adaen-reaper-test",token:"adaen-token-1111"};
 const lease=fulltextClaim(c,s,fulltextPick(c,owner.ownerId,owner.token,t0),{...owner,now:t0});
 const atHalf="2026-11-10T16:30:00.000Z";
 const r=reconcileFulltextExpiry(manifest,lease.control,()=>lease.shard,atHalf);
 assert.equal(r.status,"unchanged");assert.equal(r.control.leased,1);
});
test("corrupted state does not masquerade as recovered",()=>{
 const {c,s}=init(),owner={ownerId:"adaen-reaper-test",token:"adaen-token-1111"};
 const lease=fulltextClaim(c,s,fulltextPick(c,owner.ownerId,owner.token,t0),{...owner,now:t0});
 const wrong=structuredClone(lease.shard);wrong.packets["1"].generation=11;
 assert.throws(()=>reconcileFulltextExpiry(manifest,lease.control,()=>wrong,t1),/inconsistent expired lease/);
});
