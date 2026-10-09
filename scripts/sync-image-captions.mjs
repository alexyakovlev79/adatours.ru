#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import { fileURLToPath } from 'node:url';
import { cleanCaption, logicalImagePath, selectCaption, diversifyCaptions, captionOverrideResult } from './lib/image-captions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apply = process.argv.includes('--apply');
const read = (name, fallback = {}) => fs.existsSync(path.join(root, name)) ? JSON.parse(fs.readFileSync(path.join(root, name), 'utf8')) : fallback;
const walkFiles = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walkFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]).sort() : [];
const relative = (name) => path.relative(root, name).split(path.sep).join('/');
const isImage = (s) => typeof s === 'string' && /\.(?:webp|jpe?g|png|svg|gif|ico|avif)(?:[?#]|$)/i.test(s);
const archiveIds = new Set((read('data/catalog-archive.json').entries ?? []).map((e) => e.id));
const records = new Map();
const usages = [];
const entries = new Map();
const entities = new Map();
const ensure = (value) => {
  const src = logicalImagePath(value);
  if (!src) return null;
  if (!records.has(src)) records.set(src, { src, storage: [], lineage: [], candidates: [], sourceRefs: [], generationRefs: [], usages: [] });
  return records.get(src);
};
const addRef = (r, ref) => { if (ref && !r.sourceRefs.includes(ref)) r.sourceRefs.push(ref); };
const candidate = (r, text, rank, kind, ref, context) => {
  if (text) r.candidates.push({ text: String(text), rank, kind, ref, context });
  addRef(r, ref);
};

// Inventory names only: binary files are never opened or downloaded.
const trackedImages = execFileSync('git', ['ls-files', '-z', 'public'], { cwd: root, encoding: 'utf8' }).split('\0').filter(isImage);
for (const filename of trackedImages) ensure(filename).storage.push('git');
for (const src of ['/brand/adatours-logo-black.svg', '/brand/adatours-logo-white.svg']) {
  if (records.has(src)) candidate(ensure(src), 'Логотип Ada Tours', 95, 'interface_identity', 'src/components/global/SiteHeader.astro', {});
}
for (const asset of read('src/data/media/direct-s3-uploads.json').assets ?? []) {
  if (!isImage(asset.key)) continue;
  const r = ensure(`/${asset.key}`);
  r.storage.push('s3'); r.sha256 = asset.sha256;
  addRef(r, `src/data/media/direct-s3-uploads.json#${asset.key}`);
}
for (const file of walkFiles(path.join(root, 'data/source-index/entries')).filter((s) => s.endsWith('.json'))) {
  const entry = JSON.parse(fs.readFileSync(file, 'utf8'));
  entries.set(entry.id, { ...entry, entryPath: relative(file) });
}
for (const file of walkFiles(path.join(root, 'src/content')).filter((s) => /\.mdx?$/.test(s))) {
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`Missing frontmatter: ${file}`);
  const data = yaml.load(match[1]);
  entities.set(data.id, { data, file: relative(file), body: text.slice(match[0].length), type: relative(file).split('/')[2] });
}
const usage = (entity, value, slot, media = {}, context = '') => {
  const r = ensure(value);
  if (!r) return;
  const d = entity.data;
  const entry = entries.get(d.id);
  const name = d.name ?? d.title ?? '';
  const archived = d.status === 'archived' || archiveIds.has(d.id);
  const u = {
    imageId: crypto.createHash('sha256').update(r.src).digest('hex').slice(0, 20), src: r.src,
    entityId: d.id, locale: d.locale ?? 'ru', type: entity.type, name, status: d.status,
    archived, contentPath: entity.file, slot, context: cleanCaption(context),
    originalAlt: String(media.alt ?? ''), originalCaption: String(media.caption ?? ''),
    sourceEntry: entry?.entryPath ?? '',
    textSource: entry?.text?.selected?.repositoryPath ?? entry?.text?.selected?.fileId ?? d.sourceSnapshot ?? '',
  };
  r.usages.push(u); usages.push(u);
  const stem = path.basename(entity.file).replace(/\.mdx?$/, '');
  const ownFolder = r.src.includes(`/${entity.type}/${stem}/`);
  const rank = ownFolder ? 80 : ['destinations', 'excursions', 'countries', 'people'].includes(entity.type) ? 70 : 60;
  candidate(r, media.alt, rank, 'production_alt', `${entity.file}#${slot}.alt`, { type: entity.type, name });
  candidate(r, media.caption, rank - 5, 'production_caption', `${entity.file}#${slot}.caption`, { type: entity.type, name });
  addRef(r, entry?.entryPath);
};
for (const entity of entities.values()) {
  const visit = (node, slot = '', context = entity.data.name ?? entity.data.title ?? '') => {
    if (Array.isArray(node)) return node.forEach((v, i) => visit(v, `${slot}[${i}]`, context));
    if (!node || typeof node !== 'object') return;
    const nearby = node.title ?? context;
    if (typeof node.src === 'string') usage(entity, node.src, slot, node, nearby);
    for (const [key, value] of Object.entries(node)) {
      const next = slot ? `${slot}.${key}` : key;
      if (['image', 'photo'].includes(key) && typeof value === 'string') usage(entity, value, next, {}, nearby);
      else visit(value, next, nearby);
    }
  };
  visit(entity.data);
  let n = 0;
  for (const m of entity.body.matchAll(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) usage(entity, m[2], `body.images[${n++}]`, { alt: m[1] });
}
// Static home/catalog/team/editorial templates also use images outside content collections.
for (const file of walkFiles(path.join(root, 'src')).filter((s) => s.endsWith('.astro'))) {
  const text = fs.readFileSync(file, 'utf8');
  const entity = { data: { id: `template:${relative(file)}`, locale: 'ru', name: relative(file), status: 'template' }, file: relative(file), type: 'template' };
  let n = 0;
  for (const m of text.matchAll(/["']((?:\/media\/|\/brand\/|https?:\/\/)[^"'\s]+\.(?:webp|jpe?g|png|svg|gif|avif)(?:\?[^"']*)?)["']/gi)) {
    usage(entity, m[1], `staticImages[${n++}]`);
  }
  for (const m of text.matchAll(/<img\b[^>]*>/g)) {
    const src = m[0].match(/["']((?:\/media\/|\/brand\/|https?:\/\/)[^"'\s]+\.(?:webp|jpe?g|png|svg|gif|avif))["']/i)?.[1];
    const alt = m[0].match(/\balt="([^"]+)"/)?.[1];
    if (src && alt) candidate(ensure(src), alt, 85, 'template_alt', `${relative(file)}#img.alt:${src}`, {});
  }
}
for (const entry of entries.values()) {
  for (const [i, image] of (entry.media?.images ?? []).entries()) {
    const r = ensure(image.url);
    if (!r) continue;
    candidate(r, image.alt, 50, 'source_image_alt', `${entry.entryPath}#media.images[${i}].alt`, { type: entry.type, name: entry.name });
    addRef(r, entry.entryPath);
  }
}
const transformations = read('src/data/media/photo-enhancements.json').enhancements ?? [];
for (const [i, item] of transformations.entries()) {
  const source = ensure(item.source), target = ensure(item.enhanced);
  if (!source || !target) continue;
  if (source.src !== target.src) target.lineage.push(source.src);
  const ref = `src/data/media/photo-enhancements.json#enhancements[${i}]`;
  addRef(source, ref); addRef(target, ref);
  candidate(target, item.alt ?? item.sceneDescription, 95, 'generation_description', ref, {});
  if (item.prompt) target.generationRefs.push({ ref, prompt: item.prompt });
}
// Only existing, completed generation records. English prompts stay evidence, never automatic Russian alt.
const logFiles = [...walkFiles(path.join(root, 'data/media')), ...walkFiles(path.join(root, 'docs/reports'))].filter((s) => s.endsWith('.json'));
for (const file of logFiles) {
  const visit = (node, slot = '') => {
    if (Array.isArray(node)) return node.forEach((n, i) => visit(n, `${slot}[${i}]`));
    if (!node || typeof node !== 'object') return;
    const target = node.asset ?? node.enhanced ?? node.path ?? node.newSrc;
    if (node.prompt && isImage(target) && node.accepted !== false && !/failed|pending|rejected/i.test(String(node.status ?? ''))) {
      const r = ensure(target); const ref = `${relative(file)}#${slot}`;
      r.generationRefs.push({ ref, prompt: node.prompt }); addRef(r, ref);
      candidate(r, node.alt ?? node.sceneDescription, 95, 'generation_description', ref, {});
    }
    for (const [k, v] of Object.entries(node)) visit(v, slot ? `${slot}.${k}` : k);
  };
  visit(JSON.parse(fs.readFileSync(file, 'utf8')));
}
// Original captions may inform an enhancement; never copy a changed generated scene back to the original.
for (let n = 0; n < 4; n++) {
  let changed = false;
  for (const r of records.values()) for (const source of r.lineage) {
    const origin = records.get(source);
    for (const c of origin?.candidates ?? []) {
      if (c.kind === 'inherited_source_alt') continue;
      if (!r.candidates.some((old) => old.ref === c.ref && old.text === c.text)) {
        r.candidates.push({ ...c, rank: Math.min(c.rank, 55), kind: 'inherited_source_alt' }); changed = true;
      }
    }
  }
  if (!changed) break;
}
const overrides = read('src/data/media/image-caption-overrides.json', { images: [] });
const reviewScope = read('data/media/image-caption-visual-review-155.json', { images: [] });
const blockedReviews = new Map((reviewScope.images ?? []).filter((r) => r.blocker).map((r) => [r.imageId, r.blocker]));
for (const item of overrides.images ?? []) {
  const r = ensure(item.src);
  captionOverrideResult(item);
  r.override = item;
}
const images = [...records.values()].map((r) => {
  let result = selectCaption(r.candidates);
  if (r.override) result = captionOverrideResult(r.override);
  if (!result.alt && r.usages.length) {
    const names = [...new Set(r.usages.map((u) => u.context || u.name).filter(Boolean))];
    if (names.length === 1 && !r.usages.every((u) => u.type === 'template')) result = { ...result, alt: `Иллюстрация: ${names[0]}`, hover: `Материал: ${names[0]}`, status: 'context_only', basis: 'page_context', evidence: r.usages.map((u) => ({ref: `${u.contentPath}#${u.slot}`, quote: u.context || u.name})) };
  }
  const activeUses = r.usages.filter((u) => !u.archived && u.status !== 'draft').length;
  return {
    id: crypto.createHash('sha256').update(r.src).digest('hex').slice(0, 20), src: r.src,
    alt: result.alt, hover: result.hover, status: result.status, basis: result.basis ?? null,
    visuallyReviewed: result.visuallyReviewed === true, activeUses, archivedUses: r.usages.filter((u) => u.archived).length,
    totalUses: r.usages.length, storage: [...new Set(r.storage)].sort(), sha256: r.sha256 ?? null,
    sourceImages: [...new Set(r.lineage)].sort(), evidence: result.evidence,
    alternatives: [...new Set(r.candidates.map((c) => cleanCaption(c.text)).filter(Boolean))].sort(),
    sourceRefs: r.sourceRefs.sort(), generationRefs: r.generationRefs,
  };
}).sort((a, b) => a.src.localeCompare(b.src, 'en'));
const wordingSummary = diversifyCaptions(images);
const statusCounts = (items) => Object.fromEntries([...new Set(items.map((r) => r.status))].sort().map((s) => [s, items.filter((r) => r.status === s).length]));
const registry = {
  version: 1,
  method: 'text_sources_and_explicit_visual_reviews; only visually_reviewed records are visually verified; conflict/context/missing rows are drafts',
  scope: 'all tracked public image paths, S3 image receipts, production content slots, source-index image URLs and recorded enhancements',
  summary: { images: images.length, contentUsages: usages.length, currentImages: images.filter((r) => r.totalUses).length, activeImages: images.filter((r) => r.activeUses).length, imagesByStatus: statusCounts(images), activeImagesByStatus: statusCounts(images.filter((r) => r.activeUses)), trackedImages: trackedImages.length, originalEmptyAltUsages: usages.filter((u) => !u.originalAlt).length, ...wordingSummary },
  images,
};
const reviewJobs = images.filter((r) => r.activeUses > 0 && r.reviewReasons.length).map((r) => ({
  imageId: r.id, src: r.src, reason: r.reviewReasons[0], reasons: r.reviewReasons, sourceDescription: r.sourceDescription, proposedAlt: r.alt, proposedHover: r.hover,
  alternatives: r.alternatives, sourceRefs: r.sourceRefs, generationRefs: r.generationRefs,
  ...(blockedReviews.has(r.id) ? { blocker: blockedReviews.get(r.id) } : {}),
  usages: usages.filter((u) => u.imageId === r.id && !u.archived && u.status !== 'draft'),
  task: 'Compare the exact image with its text sources, then provide a scene-specific Russian alt and hover. Never assume the route title describes the image.',
}));
const outputs = [
  ['src/data/media/image-captions.json', registry],
  ['data/media/image-caption-usages.json', { version: 1, usages: usages.sort((a, b) => a.contentPath.localeCompare(b.contentPath) || a.slot.localeCompare(b.slot)) }],
  ['data/media/image-caption-review-queue.json', { version: 1, scope: 'active_content_and_static_image_references_only; archived-only and unused originals excluded', status: reviewScope.images?.length ? 'explicit_155_review_recorded; remaining_jobs_need_review' : 'not_started; separate explicit Work image-review task required', count: reviewJobs.length, jobs: reviewJobs }],
];
const stale = [];
for (const [file, object] of outputs) {
  const content = JSON.stringify(object, null, 2) + '\n';
  if (!fs.existsSync(path.join(root, file)) || fs.readFileSync(path.join(root, file), 'utf8') !== content) {
    stale.push(file);
    if (apply) fs.writeFileSync(path.join(root, file), content);
  }
}
console.log(JSON.stringify({ ...registry.summary, mode: apply ? 'apply' : 'check', stale }));
if (stale.length && !apply) process.exitCode = 1;
