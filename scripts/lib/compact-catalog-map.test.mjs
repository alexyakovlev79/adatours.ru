import assert from 'node:assert/strict';
import test from 'node:test';
import { compactCatalogById } from './compact-catalog-map.mjs';

test('Samaipata self-reference cannot replace the record with its themes', () => {
  const id = 'destination_bolivia_samaipata';
  const record = {
    id, type: 'destination', themes: ['theme_culture'],
    destinations: [{ id, name: 'Самаипата', countryId: 'country_bolivia' }],
  };
  const records = compactCatalogById({ entries: [record] });
  assert.strictEqual(records.get(id), record);
  assert.deepEqual(records.get(id).themes, ['theme_culture']);
  assert.equal(records.size, 1);
});

test('nested references to another entry cannot shadow that entry', () => {
  const first = { id: 'destination_one', themes: ['theme_culture'] };
  const second = {
    id: 'destination_two', themes: ['theme_beach'],
    destinations: [{ id: first.id }],
  };
  assert.strictEqual(compactCatalogById({ entries: [first, second] }).get(first.id), first);
});

test('duplicate source records fail explicitly instead of silently replacing one another', () => {
  assert.throws(() => compactCatalogById({ entries: [{ id: 'same' }, { id: 'same' }] }),
    /Duplicate compact catalog entry: same/);
});
