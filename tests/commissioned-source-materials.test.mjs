import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateCommissionedSourceMaterials } from '../src/lib/commissioned-source-materials.mjs';

const source = JSON.parse(fs.readFileSync(new URL('../data/source-index/entries/destination_ecuador_tigua.json', import.meta.url), 'utf8'));
const valid = () => structuredClone(source);
test('commissioned description accepts truthful mixed image origins', () => {
  const entry = valid();
  entry.media.images.push({ ...entry.media.images[0], role: 'gallery', order: 2, origin: 'anna_word_embedded' });
  entry.media.images.push({ ...entry.media.images[0], role: 'gallery', order: 3, origin: 'existing_archive_tour' });
  assert.deepEqual(validateCommissionedSourceMaterials(entry), []);
});
test('commissioned source cannot masquerade as a supplied original', () => {
  const entry = valid(); entry.media.images[0].origin = 'user_provided';
  assert.ok(validateCommissionedSourceMaterials(entry).some((error) => error.includes('individual origin')));
});
test('commissioned text needs its own factual sources and exact local file', () => {
  const entry = valid(); entry.text.provenance.sources = []; entry.text.selected.repositoryPath = '../other.md';
  assert.ok(validateCommissionedSourceMaterials(entry).length >= 2);
});
test('missing assets fail while a verified cloud object can satisfy the check', () => {
  const entry = valid(); entry.media.images[0].url = '/media/destinations/tigua/missing-20261009.webp';
  assert.ok(validateCommissionedSourceMaterials(entry, { repoRoot: process.cwd() }).some((error) => error.includes('missing selected image')));
  assert.deepEqual(validateCommissionedSourceMaterials(entry, { repoRoot: process.cwd(), directAssets: new Set([entry.media.images[0].url]) }), []);
});
