import test from 'node:test';
import assert from 'node:assert/strict';
import {
  batchPath,claimBatch,changeLease,submitResults,summary,
  validatedResult,LEASE_MINUTES,validateBatch
} from '../scripts/reverse-identity-swarm-core.mjs';

const make=()=>({
  version:1,batchId:'vip-999',domain:'vipdeluxetravel.ru',
  lease:null,claimGeneration:0,records:[
    {sourceUrl:'https://vipdeluxetravel.ru/source-a',inventoryPosition:11,status:'queued'},
    {sourceUrl:'https://vipdeluxetravel.ru/source-b',inventoryPosition:12,status:'queued'}
  ]
});
const a={ownerId:'identity-worker-aaa',token:'identity-token-aaa'};
const b={ownerId:'identity-worker-bbb',token:'identity-token-bbb'};
const t=1800000000000;
const ready={
  sourceUrl:'https://vipdeluxetravel.ru/source-a',status:'redirect_ready',
  ruUrl:'https://adatours.ru/brazil/',note:'Same destination and visit intent.',
  evidence:['Original source contains Brazil country hub',
    'Current RU canonical points to the verified Brazil Country entity']
};
const review={
  sourceUrl:'https://vipdeluxetravel.ru/source-b',status:'review',
  note:'No active equivalent destination catalogue; decide parent or 410.'
};
test('strict batch identity and domain validation',()=>{
  assert.equal(batchPath('vip-002').endsWith('/batches/vip-002.json'),true);
  assert.throws(()=>batchPath('../state.json'));
  assert.throws(()=>validateBatch({...make(),domain:'adatours.com'}));
});
test('batch claim prevents second live worker and can resume same credentials',()=>{
  const batch=make();
  assert.equal(claimBatch(batch,{...a,nowMs:t}).status,'reserved');
  assert.equal(claimBatch(batch,{...b,nowMs:t+1}).status,'busy');
  assert.equal(claimBatch(batch,{...a,nowMs:t+2}).status,'resumed');
  assert.equal(batch.lease.generation,1);
});
test('each completed URL persists and cannot be overwritten',()=>{
  const batch=make();claimBatch(batch,{...a,nowMs:t});
  assert.equal(submitResults(batch,{...a,nowMs:t+10,results:[ready]}).newCount,1);
  assert.equal(summary(batch).queued,1);
  assert.equal(submitResults(batch,{...a,nowMs:t+11,results:[ready]}).status,'already_saved');
  assert.throws(()=>submitResults(batch,{...a,nowMs:t+12,results:[
    {...ready,ruUrl:'https://adatours.ru/argentina/'}]}),/immutable/);
});
test('expiration never authorizes a stale worker to overwrite completed results',()=>{
  const batch=make();claimBatch(batch,{...a,nowMs:t});
  submitResults(batch,{...a,nowMs:t+10,results:[ready]});
  assert.equal(claimBatch(batch,{...b,nowMs:t+(LEASE_MINUTES+1)*60000}).status,'reclaimed');
  assert.equal(summary(batch).done,1);
  assert.throws(()=>submitResults(batch,{...a,nowMs:t+(LEASE_MINUTES+2)*60000,
    results:[review]}),/Not an owned/);
  assert.equal(submitResults(batch,{...b,nowMs:t+(LEASE_MINUTES+2)*60000,
    results:[review]}).counts.done,2);
  assert.equal(batch.lease,null);
  assert.ok(batch.completedAt);
  assert.equal(claimBatch(batch,{...a,nowMs:t+2e7}).status,'completed');
});
test('voluntary release and renewal keep completed rows',()=>{
  const batch=make();claimBatch(batch,{...a,nowMs:t});
  submitResults(batch,{...a,nowMs:t+10,results:[ready]});
  assert.equal(changeLease(batch,{...a,nowMs:t+11,action:'renew'}).status,'renewed');
  assert.equal(changeLease(batch,{...a,nowMs:t+12,action:'release'}).status,'released');
  assert.equal(claimBatch(batch,{...b,nowMs:t+13}).status,'reserved');
  assert.equal(batch.records[0].status,'redirect_ready');
});
test('verified external identity is domain-specific with evidence',()=>{
  assert.equal(validatedResult('vipdeluxetravel.ru',ready).relation,'redirect_301');
  assert.throws(()=>validatedResult('adatours.com',ready),/301/);
  assert.throws(()=>validatedResult('vipdeluxetravel.ru',{
    ...ready,status:'matched_exact'}),/sameAs/);
  assert.throws(()=>validatedResult('vipdeluxetravel.ru',{
    ...ready,evidence:['Only title']}),/evidence/);
  assert.throws(()=>validatedResult('vipdeluxetravel.ru',{
    ...review,ruUrl:'https://adatours.ru/brazil/'}),/Unconfirmed/);
});

test('Brasiltours donor site is excluded from worker batch identity',()=>{
  assert.throws(()=>batchPath('br-001'),/Invalid batchId/);
  assert.throws(()=>validateBatch({version:1,batchId:'br-001',domain:'brasiltours.ru',records:[{sourceUrl:'https://brasiltours.ru/',inventoryPosition:1,status:'queued'}]}));
});
