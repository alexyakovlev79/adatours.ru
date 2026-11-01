import test from 'node:test';
import assert from 'node:assert/strict';
import { frozenMediaKeys, migratedLegacyAssetExists } from '../src/lib/frozen-legacy-media.mjs';

test('sparse checkout validates historically migrated S3 media by the Git tree', () => {
  const root = process.cwd();
  const known = '/media/home/hero-rio-generated-20261008-v2.webp';
  assert.ok(frozenMediaKeys(root).has(known), 'The migration-era hero is tracked in the Git tree');
  assert.equal(migratedLegacyAssetExists(root, known), true);
});

test('the Git-tree fallback never legitimizes an unregistered or unsafe media path', () => {
  const root = process.cwd();
  assert.equal(migratedLegacyAssetExists(root, '/media/nonexistent/unregistered-20261030.webp'), false);
  assert.equal(migratedLegacyAssetExists(root, '/media/../missing.webp'), false);
  assert.equal(migratedLegacyAssetExists(root, 'https://adatours.ru/media/missing.webp'), false);
});
