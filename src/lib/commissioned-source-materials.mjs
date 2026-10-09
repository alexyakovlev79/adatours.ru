import fs from 'node:fs';
import path from 'node:path';

// Explicitly commissioned place descriptions may combine Word photographs,
// existing tour assets and GPT Images. Keep each image's origin independently.
export function validateCommissionedSourceMaterials(entry, { repoRoot, directAssets = new Set() } = {}) {
  if (entry.text?.selected?.kind !== 'commissioned_editorial') return [];
  const errors = [];
  const fail = (message) => errors.push(`${entry.id}: ${message}`);
  const selected = entry.text.selected;
  const provenance = entry.text.provenance;
  const expected = `data/source-index/materials/${entry.id}.md`;
  if (entry.type !== 'destination' || !/^destination_[a-z0-9_]+$/.test(entry.id)) fail('commissioned editorial is limited to canonical destinations');
  if (selected.repositoryPath !== expected || selected.mimeType !== 'text/markdown' || !selected.name?.trim() || selected.driveId || selected.url) fail('commissioned text must identify its exact local Markdown file');
  if (provenance?.kind !== 'commissioned_editorial' || !/^tour_[a-z0-9_]+$/.test(provenance.parentTourId ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(provenance.createdAt ?? '')) fail('commissioned text needs parent tour and creation date');
  if (!Array.isArray(provenance?.sources) || !provenance.sources.length || provenance.sources.some((url) => { try { return new URL(url).protocol !== 'https:'; } catch { return true; } })) fail('commissioned text needs factual HTTPS source URLs');
  if (entry.readiness?.text !== 'commissioned_editorial' || entry.readiness?.media !== 'ready' || entry.media?.status !== 'ready') fail('readiness must match commissioned text and selected media');
  if (entry.media?.provenance?.kind !== 'source_aware_selection' || entry.media.provenance.parentTourId !== provenance?.parentTourId || entry.media.provenance.createdAt !== provenance?.createdAt) fail('selected media needs matching parent tour and date');
  const images = entry.media?.images;
  if (!Array.isArray(images) || images.filter((image) => image.role === 'hero').length !== 1) fail('selected media requires exactly one hero');
  for (const image of Array.isArray(images) ? images : []) {
    if (!['gpt_image', 'anna_word_embedded', 'existing_archive_tour'].includes(image.origin)) fail('every image needs its truthful individual origin');
    if (!/^\/media\/[A-Za-z0-9_/-]+\.webp$/.test(image.url ?? '') || image.url.includes('..') || !['hero', 'gallery'].includes(image.role) || !Number.isInteger(image.order) || image.order < 1 || !image.alt?.trim()) fail('selected images need exact WebP path, role, order and alt');
    else if (repoRoot && !directAssets.has(image.url) && !fs.existsSync(path.join(repoRoot, 'public', image.url))) fail(`missing selected image ${image.url}`);
  }
  if (repoRoot && selected.repositoryPath === expected && (!fs.existsSync(path.join(repoRoot, expected)) || !fs.readFileSync(path.join(repoRoot, expected), 'utf8').trim())) fail('commissioned material is missing or empty');
  return errors;
}
