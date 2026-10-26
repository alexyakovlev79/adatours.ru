import test from 'node:test';
import assert from 'node:assert/strict';
import { DESTINATION_TYPES,sourceFingerprint,hash,take,validateResults,finish,requeueReview,requireLease } from '../scripts/destination-taxonomy-swarm-core.mjs';
const a='taxonomy-worker-test-A',at='taxonomy-worker-token-A',b='taxonomy-worker-test-B',bt='taxonomy-worker-token-B';
const row={id:'destination_brazil_sugarloaf_mountain',name:'Сахарная Голова',slug:'sugarloaf',
 url:'/brazil/place/sugarloaf/',countryId:'country_brazil',existingType:'natural_area',
 contentPath:'src/content/destinations/sugarloaf.md'};
row.fingerprint=sourceFingerprint(row);
const job={schemaVersion:1,packetId:'p001',records:[row],sourceFingerprint:hash(JSON.stringify([[row.id,row.fingerprint]]))};
const make=()=>({schemaVersion:1,shard:0,items:[
 {id:'p001',shard:0,status:'queued',generation:0,attempts:0,lease:null,sourceFingerprint:job.sourceFingerprint},
 {id:'p017',shard:0,status:'queued',generation:0,attempts:0,lease:null,sourceFingerprint:'other'}
]});
const decision={id:row.id,status:'ready',destinationType:'mountain',navigationRole:'sight',confidence:95,
 evidence:'Конкретная гора, экскурсионный объект в городе Рио-де-Жанейро.'};
test('36 types and independent role',()=>{assert.equal(DESTINATION_TYPES.length,36);
 assert.equal(validateResults(job,[decision])[0].navigationRole,'sight');
 assert.throws(()=>validateResults(job,[{...decision,confidence:65}]));});
test('distinct workers never receive same packet',()=>{const s=make();
 const x=take(s,{ownerId:a,token:at,nowMs:100000});
 const y=take(s,{ownerId:b,token:bt,nowMs:100000});
 assert.notEqual(x.item.id,y.item.id);});
test('expired lease uses fencing generation',()=>{const s=make();
 take(s,{ownerId:a,token:at,nowMs:100000,packetId:'p001'});
 const x=take(s,{ownerId:b,token:bt,nowMs:100000+91*60000,packetId:'p001'});
 assert.equal(x.item.generation,2);
 assert.throws(()=>requireLease(x.item,{ownerId:a,token:at,generation:1,nowMs:100000+91*60000}));});
test('submit is idempotent',()=>{const s=make();
 const p=take(s,{ownerId:a,token:at,nowMs:100000,packetId:'p001'}).item;
 const q={packetId:'p001',ownerId:a,token:at,generation:p.generation,submissionId:'taxonomy-submit-p001-g1',nowMs:101000,records:[decision]};
 assert.equal(finish(s,job,q).alreadySaved,false);
 assert.equal(finish(s,job,q).alreadySaved,true);
 assert.throws(()=>finish(s,job,{...q,submissionId:'different-submit-p001-g1'}));});
test('coordinator can reopen REVIEW without deleting old identity',()=>{const s=make();
 const p=take(s,{ownerId:a,token:at,nowMs:100000,packetId:'p001'}).item;
 const review={...decision,status:'review',destinationType:null,navigationRole:null,confidence:45,
 reason:'Требуется уточнение основного референта исходной страницы.'};
 finish(s,job,{packetId:'p001',ownerId:a,token:at,generation:p.generation,submissionId:'taxonomy-review-p001-g1',nowMs:101000,records:[review]});
 assert.equal(requeueReview(s,{packetId:'p001',expectedGeneration:1,reason:'Точно проверить неоднозначный референт.',nowMs:102000}).status,'queued');});
