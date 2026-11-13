import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import legacy from '../../src/data/i18n/media-captions.en.json' with {type:'json'};
import manifest from '../../src/data/i18n/stage6-shards/manifest.json' with {type:'json'};
import s1 from '../../src/data/i18n/stage6-shards/6-1.en.json' with {type:'json'};
import s2 from '../../src/data/i18n/stage6-shards/6-2.en.json' with {type:'json'};
import s3 from '../../src/data/i18n/stage6-shards/6-3.en.json' with {type:'json'};
import s4 from '../../src/data/i18n/stage6-shards/6-4.en.json' with {type:'json'};
import s5 from '../../src/data/i18n/stage6-shards/6-5.en.json' with {type:'json'};
import s6 from '../../src/data/i18n/stage6-shards/6-6.en.json' with {type:'json'};
import s7 from '../../src/data/i18n/stage6-shards/6-7.en.json' with {type:'json'};
import s8 from '../../src/data/i18n/stage6-shards/6-8.en.json' with {type:'json'};
import s9 from '../../src/data/i18n/stage6-shards/6-9.en.json' with {type:'json'};
const shards=[s1,s2,s3,s4,s5,s6,s7,s8,s9];
const assigned=src=>'6.'+(createHash('sha256').update(src,'utf8').digest().readUInt32BE(28)%9+1);
test('nine shard files have one owner per media src and never overwrite legacy translations',()=>{
 assert.equal(shards.length,9);
 assert.equal(manifest.expectedUntranslatedMediaSources,701);
 assert.equal(manifest.expectedRussianAltOccurrences,1507);
 assert.equal(Object.keys(legacy.entries).length,1243);
 const encountered=new Set(Object.keys(legacy.entries));
 for(const [i,shard] of shards.entries()){
  const stage='6.'+(i+1);
  assert.equal(shard.stage,stage);
  assert.equal(shard.schemaVersion,1);
  for(const [src,item] of Object.entries(shard.entries)){
   assert.equal(assigned(src),stage,src);
   assert.ok(!encountered.has(src),'Duplicate EN src '+src);
   encountered.add(src);
   assert.equal(item.source,'stage6-shard-'+stage);
   assert.equal(item.sourceKey,src);
   assert.ok(typeof item.sourceAlt==='string'&&item.sourceAlt.length>0);
   assert.ok(typeof item.alt==='string'&&item.alt.length>=8&&!/[А-Яа-яЁё]/u.test(item.alt),src);
  }
 }
});
