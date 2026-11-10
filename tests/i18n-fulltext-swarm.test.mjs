import test from "node:test";
import assert from "node:assert/strict";
import {fulltextPacketId,fulltextShardId,fulltextDefinitionPath,fulltextValidateDefinition,
 fulltextPick,fulltextClaim,fulltextRenew,fulltextRelease,fulltextReap,fulltextFail,
 fulltextValidateResult,fulltextSubmit} from "../scripts/i18n/fulltext-swarm-core.mjs";
const now="2026-11-10T16:00:00.000Z",later="2026-11-10T18:00:00.000Z";
const start=()=>({
 c:{schemaVersion:1,packets:1412,nextPacket:1,queued:1412,leased:0,saved:0,retryable:0,
  blocked_external:0,stale_source:0,failed_final:0,activeByOwner:{},retryQueue:[],completedByOwner:{}},
 s:{schemaVersion:1,shard:0,packets:{"1":{status:"queued",generation:0,attempts:0}}}
});
const worker={ownerId:"adaen-worker-0001",token:"adaen-token-0001"};
const packet={schemaVersion:1,packets:[{number:1,id:"ADAEN-P00001",sourceMainSha:"f".repeat(40),
 items:Array.from({length:5},(_,i)=>({number:i+1,packet:1,type:"excursion",path:"src/content/excursions/"+i+".md",sha:"a".repeat(40)}))}]};
test("exact packet boundaries and immutable source definition",()=>{
 assert.equal(fulltextPacketId(1),"ADAEN-P00001");assert.equal(fulltextShardId(17),"00");
 assert.equal(fulltextDefinitionPath(21),"definitions/0001.json");
 assert.equal(fulltextValidateDefinition(packet,1,{packets:1412,items:7056,sourceMainSha:"f".repeat(40)}).items.length,5);
});
test("claim, resume, renew, fencing and expiration",()=>{
 const {c,s}=start();
 const a=fulltextClaim(c,s,fulltextPick(c,worker.ownerId,worker.token,now),{...worker,now});
 assert.equal(a.control.leased,1);assert.equal(a.control.queued,1411);
 assert.equal(fulltextPick(a.control,worker.ownerId,worker.token,now).mode,"resumed");
 const b=fulltextRenew(a.control,a.shard,1,{...worker,now,generation:1});
 assert.equal(b.shard.packets["1"].generation,1);
 const expired=fulltextReap(b.control,b.shard,1,later);
 assert.equal(expired.shard.packets["1"].generation,2);
 assert.equal(expired.control.queued,1412);
 assert.throws(()=>fulltextSubmit(expired.control,expired.shard,1,{...worker,generation:1,now:later,submissionId:"submit-one",resultBlobSha:"a".repeat(40)}),/lease owner/);
});
test("all five translated full texts required, same original paths and shas",()=>{
 const p=packet.packets[0];
 const result={packetId:p.id,sourceMainSha:p.sourceMainSha,locale:"en",status:"review",
 texts:p.items.map(x=>({number:x.number,path:x.path,sourceBlobSha:x.sha,enMarkdown:"Complete English text of "+x.number}))};
 assert.equal(fulltextValidateResult(p,result),true);
 assert.throws(()=>fulltextValidateResult(p,{...result,texts:result.texts.slice(0,4)}),/all five/);
 assert.throws(()=>fulltextValidateResult(p,{...result,texts:result.texts.map((x,i)=>i===0?{...x,path:"altered.md"}:x)}),/source identity/);
});
test("one submission closes one lease and enforces ten packets per chat",()=>{
 const {c,s}=start(),a=fulltextClaim(c,s,fulltextPick(c,worker.ownerId,worker.token,now),{...worker,now});
 const b=fulltextSubmit(a.control,a.shard,1,{...worker,generation:1,now,submissionId:"submit-one",resultBlobSha:"a".repeat(40),resultPath:"results/00001/submit-one.json",sourceMainSha:"f".repeat(40)});
 assert.equal(b.control.saved,1);assert.equal(b.control.leased,0);
 assert.equal(b.control.completedByOwner[worker.ownerId],1);
 b.control.completedByOwner[worker.ownerId]=10;
 assert.equal(fulltextPick(b.control,worker.ownerId,worker.token,now).mode,"chat_limit");
});
test("release returns only owned packet to retry, other workers can claim it",()=>{
 const {c,s}=start(),a=fulltextClaim(c,s,fulltextPick(c,worker.ownerId,worker.token,now),{...worker,now});
 const b=fulltextRelease(a.control,a.shard,1,{...worker,generation:1,now});
 const other={ownerId:"adaen-worker-0002",token:"adaen-token-0002"};
 const picked=fulltextPick(b.control,other.ownerId,other.token,now);
 assert.deepEqual(picked,{mode:"retry",number:1});
 assert.equal(fulltextClaim(b.control,b.shard,picked,{...other,now}).shard.packets["1"].generation,3);
});
test("stale source and external blockers stay separate from saved work",()=>{
 const {c,s}=start(),a=fulltextClaim(c,s,fulltextPick(c,worker.ownerId,worker.token,now),{...worker,now});
 const b=fulltextFail(a.control,a.shard,1,{...worker,generation:1,now,status:"stale_source",reason:"Source SHA changed"});
 assert.equal(b.control.stale_source,1);assert.equal(b.control.saved,0);
 assert.equal(b.shard.packets["1"].status,"stale_source");
});
