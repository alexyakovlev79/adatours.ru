import fs from 'node:fs';
import path from 'node:path';

// Narrow extension for destinations filled during the tour-day photo workflow.
// Existing donor and user-provided modes keep their own schema restrictions.
export function validateGeneratedSourceMaterials(entry, { repoRoot, directAssets = new Set() } = {}) {
  const selected = entry.text?.selected;
  const generated = entry.media?.status === 'generated';
  const editorial = selected?.kind === 'editorial_generated';
  const provenance = entry.media?.provenance;
  if (!generated && !editorial && provenance?.kind !== 'gpt_image') return [];
  const errors = [];
  const fail = (message) => errors.push(`${entry.id}: ${message}`);
  if (entry.type !== 'destination') fail('generated source materials are limited to destinations');
  if (!generated || !editorial) fail('editorial_generated text and generated media must be used together');
  if (entry.readiness?.media !== 'generated' || entry.readiness?.text !== 'editorial_generated') fail('readiness must match generated materials');
  const expected = `data/source-index/materials/${entry.id}.md`;
  if (selected?.repositoryPath !== expected || selected.mimeType !== 'text/markdown' || !selected.name?.trim() || selected.driveId || selected.url) fail('editorial pointer must identify the exact local Markdown material');
  const textProvenance = entry.text?.provenance;
  if (textProvenance?.kind !== 'editorial_generated' || !Array.isArray(textProvenance.sources) || !textProvenance.sources.length || textProvenance.sources.some((url) => !/^https:\/\//.test(url))) fail('editorial provenance needs factual source URLs');
  if (!/^tour_[a-z0-9_]+$/.test(textProvenance?.parentTourId ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(textProvenance?.createdAt ?? '')) fail('editorial provenance needs parent tour and date');
  if (provenance?.kind !== 'gpt_image' || !/^\d{4}-\d{2}-\d{2}$/.test(provenance?.createdAt ?? '')) fail('media provenance must identify GPT Image and date');
  if (entry.media?.sourceUrl != null) fail('generated media cannot claim a donor image inventory');
  const images = entry.media?.images;
  if (!Array.isArray(images) || !images.length || images.filter((item) => item.role === 'hero').length !== 1) fail('generated media requires exactly one hero');
  for (const item of images ?? []) {
    if (!/^\/media\/[a-zA-Z0-9_/-]+\.webp$/.test(item.url ?? '') || item.url.includes('..') || item.url.includes('/image/cache/') || !['hero', 'gallery'].includes(item.role) || !Number.isInteger(item.order) || item.order < 1 || !item.alt?.trim()) fail('generated images need a local WebP path, role, order and alt');
    else if (repoRoot && !fs.existsSync(path.join(repoRoot, 'public', item.url)) && !directAssets.has(item.url)) fail(`missing generated asset ${item.url}`);
  }
  if (repoRoot && selected?.repositoryPath === expected) {
    const material = path.join(repoRoot, expected);
    if (!fs.existsSync(material) || !fs.readFileSync(material, 'utf8').trim()) fail('editorial material is missing or empty');
  }
  return errors;
}
