import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGeneratedSourceMaterials } from '../src/lib/generated-source-materials.mjs';

const valid = () => ({
  id: 'destination_peru_moraj', type: 'destination',
  text: {
    selected: { kind: 'editorial_generated', repositoryPath: 'data/source-index/materials/destination_peru_moraj.md', name: 'Морай', mimeType: 'text/markdown' },
    provenance: { kind: 'editorial_generated', sources: ['https://www.peru.travel/attractions/maras-moray'], parentTourId: 'tour_example', createdAt: '2026-10-08' },
  },
  media: { status: 'generated', sourceUrl: null, provenance: { kind: 'gpt_image', createdAt: '2026-10-08' }, images: [{ url: '/media/destinations/moray/hero.webp', role: 'hero', order: 1, alt: 'Террасы Морая' }] },
  readiness: { text: 'editorial_generated', media: 'generated' },
});

test('valid editorial destination with GPT Image media is accepted', () => assert.deepEqual(validateGeneratedSourceMaterials(valid()), []));
test('existing donor entries do not opt into generated mode', () => assert.deepEqual(validateGeneratedSourceMaterials({ id: 'tour_example', media: { status: 'ready' } }), []));
test('GPT Image cannot be disguised as user-provided originals', () => { const e = valid(); e.media.status = 'provided_originals'; assert.ok(validateGeneratedSourceMaterials(e).length); });
test('generated mode rejects a different entity or mismatched material pointer', () => { const e = valid(); e.type = 'tour'; e.text.selected.repositoryPath = 'data/source-index/materials/destination_peru_other.md'; assert.ok(validateGeneratedSourceMaterials(e).length >= 2); });
test('generated mode rejects donor, cache and traversal media paths', () => { for (const url of ['https://brasiltours.ru/image/test.jpg', '/media/../private.webp', '/media/%2e%2e/private.webp', '/media/image/cache/test.webp']) { const e = valid(); e.media.images[0].url = url; assert.ok(validateGeneratedSourceMaterials(e).length, url); } });
test('generated mode requires factual sources and a hero', () => { const e = valid(); e.text.provenance.sources = []; e.media.images[0].role = 'gallery'; assert.ok(validateGeneratedSourceMaterials(e).length >= 2); });

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
test('published Moray editorial materials and asset are available', () => {
  const repoRoot = fileURLToPath(new URL('../', import.meta.url));
  const entry = JSON.parse(fs.readFileSync(new URL('../data/source-index/entries/destination_peru_moraj.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateGeneratedSourceMaterials(entry, { repoRoot }), []);
});
