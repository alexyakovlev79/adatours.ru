import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePortraitRequest,chooseAliasAction} from '../src/lib/person-photo-alias.mjs';
const h1='a'.repeat(64),h2='b'.repeat(64);
const sample={version:1,requestId:'e'.repeat(32),personId:'person_geovani',
  sourceKey:'media/people/geovani/photo-20261030-v2.webp',expectedPreviousSha256:null};
test('portrait aliases accept only dated immutable source for the same person',()=>{
  assert.equal(parsePortraitRequest(sample).aliasKey,'media/people/geovani/current.webp');
  assert.throws(()=>parsePortraitRequest({...sample,sourceKey:'media/people/olga/photo-20261030.webp'}));
  assert.throws(()=>parsePortraitRequest({...sample,sourceKey:'media/people/geovani/current.webp'}));
  assert.throws(()=>parsePortraitRequest({...sample,extra:'bad'}));
});
test('alias updates are CAS guarded and repeated requests are idempotent',()=>{
  assert.equal(chooseAliasAction(null,h1,null),'create');
  assert.equal(chooseAliasAction(h1,h1,null),'already-matching');
  assert.equal(chooseAliasAction(h1,h2,h1),'replace');
  assert.throws(()=>chooseAliasAction(h1,h2,null),/Stale/);
});
