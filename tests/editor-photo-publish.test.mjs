import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorialPhotoPlan, locatePriorGptEnhancement } from '../scripts/editor-photo-publish.mjs';

const source = Buffer.concat([Buffer.from('ffd8ff', 'hex'), Buffer.alloc(30, 1)]);
const enhanced = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4, 0), Buffer.from('WEBP'), Buffer.alloc(24, 2)]);

test('editor photos get stable versioned S3 keys without Git media output', () => {
  const planned = createEditorialPhotoPlan({owner:'people/geovani', slot:'portrait', date:'20261030',
    originalName:'Anna-original.jpg', originalBytes:source, enhancedBytes:enhanced});
  assert.match(planned.source, /^\/media\/people\/geovani\/portrait-original-20261030-[a-f0-9]{12}\.jpg$/);
  assert.match(planned.enhanced, /^\/media\/people\/geovani\/portrait-enhanced-20261030-[a-f0-9]{12}\.webp$/);
  assert.deepEqual(planned, createEditorialPhotoPlan({owner:'people/geovani',slot:'portrait',date:'20261030',
    originalName:'Anna-original.jpg',originalBytes:source,enhancedBytes:enhanced}));
});

test('deduplication detects a previously GPT-Image-enhanced exact original', () => {
  const plan = createEditorialPhotoPlan({owner:'people/geovani',slot:'portrait',date:'20261030',
    originalName:'a.jpg',originalBytes:source,enhancedBytes:enhanced});
  const ledger = {assets:[{key:plan.originalKey,sha256:plan.originalHash},
    {key:plan.enhancedKey,sha256:plan.enhancedHash}]};
  const history = {enhancements:[{source:plan.source,enhanced:plan.enhanced,method:'gpt-image'}]};
  assert.deepEqual(locatePriorGptEnhancement(plan.originalHash,ledger,history),
    {status:'already-enhanced',source:plan.source,enhanced:plan.enhanced});
  assert.equal(locatePriorGptEnhancement('f'.repeat(64),ledger,history), null);
  assert.equal(locatePriorGptEnhancement(plan.originalHash,ledger,{enhancements:[{...history.enhancements[0],method:'deterministic-restoration'}]}),null);
});

test('reject fake files, unsafe paths, identical bytes and invalid slots', () => {
  const args = {owner:'people/geovani',slot:'portrait',date:'20261030',originalName:'a.jpg',
    originalBytes:source,enhancedBytes:enhanced};
  assert.throws(()=>createEditorialPhotoPlan({...args,owner:'../evil'}));
  assert.throws(()=>createEditorialPhotoPlan({...args,slot:'../portrait'}));
  assert.throws(()=>createEditorialPhotoPlan({...args,originalName:'a.txt'}));
  assert.throws(()=>createEditorialPhotoPlan({...args,originalBytes:Buffer.from('not a jpeg')}));
  assert.throws(()=>createEditorialPhotoPlan({...args,enhancedBytes:source}));
  assert.throws(()=>createEditorialPhotoPlan({...args,originalName:'a.webp',originalBytes:enhanced,enhancedBytes:enhanced}));
});
