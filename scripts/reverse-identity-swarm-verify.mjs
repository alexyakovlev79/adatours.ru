#!/usr/bin/env node
/* Offline audit for frozen reverse-identity swarm, no network or writes. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateBatch,validatedResult,summary,DOMAINS,SWARM_ROOT} from './reverse-identity-swarm-core.mjs';

const base=process.cwd();
const read=(p)=>fs.readFileSync(path.join(base,p));
const json=(p)=>JSON.parse(read(p).toString('utf8'));
const blobSha=(p)=>{
  const b=read(p);
  return createHash('sha1').update(Buffer.from('blob '+b.length+'\0','utf8')).update(b).digest('hex');
};
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const root=SWARM_ROOT;
const manifest=json(root+'/manifest.json');
assert(manifest.version===1&&manifest.repository==='alexyakovlev79/adatours.ru','Wrong manifest/repository');
assert(manifest.batchSize===30&&manifest.leaseMinutes===90,'Unexpected lease/batch limits');
assert(manifest.batches.length===52&&manifest.initialPending===1540,'Incorrect intended VIP+EN scope');
assert(!manifest.byDomain['brasiltours.ru'],'Brasiltours must not enter the worker manifest');
assert(DOMAINS.length===2&&DOMAINS.every(x=>manifest.byDomain[x]),'Domain whitelist mismatch');
const statePath='data/external-identity/reverse-v1/state.json';
assert(blobSha(statePath)===manifest.baseStateSha,'Frozen historical state.json changed');
const historic=json(statePath);
let allUrls=new Set(),allBatchIds=new Set(),byDomain={},activeLeases=0,total=0,queued=0,done=0;
for(const domain of DOMAINS) {
  const sourcePath='data/external-identity/reverse-v1/inventories/'+domain+'.json';
  const meta=manifest.byDomain[domain];
  assert(blobSha(sourcePath)===meta.inventorySha,'Inventory source changed: '+domain);
  const inventory=json(sourcePath);
  const rows=inventory.rows||[];
  assert(rows.length===meta.inventory,'Wrong inventory length for '+domain);
  const expected=new Map();
  for(let i=0;i<rows.length;i++){
    const u=rows[i].sourceUrl;
    assert(typeof u==='string'&&!expected.has(u),'Duplicate original inventory URL '+u);
    if(!Object.hasOwn(historic.records,u))expected.set(u,i+1);
  }
  assert(expected.size===meta.queued,'Pending source count mismatch: '+domain);
  const batches=manifest.batches.filter(b=>b.domain===domain);
  assert(batches.length===meta.batches,'Wrong number of batches '+domain);
  const seen=new Set();let domainQueued=0,domainDone=0;
  for(const spec of batches){
    assert(!allBatchIds.has(spec.id),'Duplicate batch id '+spec.id);allBatchIds.add(spec.id);
    const batch=validateBatch(json(spec.path));
    assert(batch.batchId===spec.id&&batch.domain===domain,'Batch id/domain mismatch '+spec.id);
    assert(batch.records.length===spec.count,'Wrong batch length '+spec.id);
    assert(batch.baseStateSha===manifest.baseStateSha,'Batch baseline mismatch '+spec.id);
    assert(batch.sourceInventorySha===meta.inventorySha,'Batch inventory SHA mismatch '+spec.id);
    assert(batch.records[0].inventoryPosition===spec.firstPosition&&
      batch.records.at(-1).inventoryPosition===spec.lastPosition,'Batch position range changed '+spec.id);
    const counts=summary(batch);domainQueued+=counts.queued;domainDone+=counts.done;
    if(batch.lease){
      activeLeases++;
      assert(counts.queued>0,'Completed batch retains lease '+spec.id);
      assert(batch.lease.ownerId&&batch.lease.token&&batch.lease.expiresAt,
        'Incomplete lease record '+spec.id);
    }
    for(const item of batch.records){
      assert(!allUrls.has(item.sourceUrl),'Repeated URL across batches '+item.sourceUrl);
      assert(expected.get(item.sourceUrl)===item.inventoryPosition,'Changed source row '+item.sourceUrl);
      seen.add(item.sourceUrl);allUrls.add(item.sourceUrl);
      if(item.status!=='queued'){
        const r=validatedResult(domain,item);
        assert(r.relation===item.relation,'Wrong relation '+item.sourceUrl);
        assert(item.checkedAt&&item.checkedBy,'Missing review receipt '+item.sourceUrl);
      }
    }
  }
  assert(seen.size===expected.size,'Missing source URLs from domain '+domain);
  for(const u of expected.keys())assert(seen.has(u),'Unassigned source URL '+u);
  byDomain[domain]={inventory:rows.length,previouslyProcessed:meta.closed,
    totalQueuedAtStart:meta.queued,remaining:domainQueued,completed:domainDone,batches:batches.length};
  total+=seen.size;queued+=domainQueued;done+=domainDone;
}
assert(manifest.batches.every(b=>DOMAINS.includes(b.domain)),'Unexpected domain in manifest');
assert(total===manifest.initialPending&&total===queued+done,'Overall count mismatch');
console.log(JSON.stringify({status:'ok',branch:manifest.branch,initialPending:total,
  completed:done,remaining:queued,busyBatches:activeLeases,byDomain,excluded:['brasiltours.ru']},null,2));
