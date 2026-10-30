import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizedBatch,validateReceiptProgress} from '../scripts/media-work-session.mjs';
const asset={file:'/tmp/photo.webp',key:'media/people/geovani/picture-20261030.webp'};
const item=normalizedBatch([asset]);
const verified={key:asset.key,sha256:'a'.repeat(64),bytes:100,contentType:'image/webp',
  uploadedAt:'2026-10-30T12:00:00Z',source:'direct-s3',status:'uploaded-and-verified'};
test('one media session supports a batch of distinct photos',()=>{
  assert.equal(normalizedBatch([asset,{file:'/tmp/other.webp',key:'media/people/olga/picture-20261030.webp'}]).length,2);
  assert.throws(()=>normalizedBatch([asset,asset]),/Duplicate/);
  assert.throws(()=>normalizedBatch(Array.from({length:31},(_,i)=>({file:'/tmp/p'+i+'.webp',key:'media/people/geovani/p'+i+'-20261030.webp'}))),/Batch/);
});
test('partial receipt checkpoint resumes only exact batch keys',()=>{
  assert.equal(validateReceiptProgress({version:1,assets:[verified]},item).get(asset.key).sha256,verified.sha256);
  assert.throws(()=>validateReceiptProgress({version:1,assets:[{...verified,key:'media/people/olga/wrong-20261030.webp'}]},item),/exact batch/);
  assert.throws(()=>validateReceiptProgress({version:1,assets:[verified,verified]},item),/exact batch/);
});
