#!/usr/bin/env node
/** Deterministic processing after visual focus selection; no generated/redrawn pixels. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const sharp = createRequire(import.meta.url)('sharp');
const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const SHARP_VERSION = '0.35.5';
export const WEBP_QUALITY = 78;
export const PROFILES = ['standard', 'compact', 'home', 'content-sized', 'photo-lead', 'preserve-full-image'];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => JSON.stringify(value, null, 2) + '\n';
const safeName = (value) => /^[a-z0-9][a-z0-9_-]{0,100}$/.test(value ?? '');
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function integer(value, name, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`${name} must be an integer >= ${minimum}`);
  return value;
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

/** CSS percentages align the free space, not a coordinate on the photograph. */
export function parseObjectPosition(value = 'center') {
  const tokens = String(value).trim().toLowerCase().split(/\s+/);
  if (!tokens.length || tokens.length > 2) throw new Error('Use one/two object-position keywords or percentages');
  const fraction = (token, axis) => {
    const keywords = axis === 'x' ? { left: 0, center: 0.5, right: 1 } : { top: 0, center: 0.5, bottom: 1 };
    if (Object.hasOwn(keywords, token)) return keywords[token];
    if (/^(?:\d+(?:\.\d+)?|\.\d+)%$/.test(token)) {
      const result = Number(token.slice(0, -1)) / 100;
      if (result >= 0 && result <= 1) return result;
    }
    throw new Error(`Invalid ${axis} object-position: ${token}`);
  };
  let [x, y] = tokens;
  if (tokens.length === 1) {
    if (['top', 'bottom'].includes(x)) { y = x; x = 'center'; }
    else y = 'center';
  } else if (['top', 'bottom'].includes(x) || ['left', 'right'].includes(y)) [x, y] = [y, x];
  return { x: fraction(x, 'x'), y: fraction(y, 'y') };
}

export function validateCrop(crop, sourceWidth, sourceHeight) {
  integer(sourceWidth, 'sourceWidth', 1); integer(sourceHeight, 'sourceHeight', 1);
  if (!crop || typeof crop !== 'object') throw new Error('A crop rectangle is required');
  const result = {
    left: integer(crop.left, 'crop.left'), top: integer(crop.top, 'crop.top'),
    width: integer(crop.width, 'crop.width', 1), height: integer(crop.height, 'crop.height', 1),
  };
  if (result.left + result.width > sourceWidth || result.top + result.height > sourceHeight) throw new Error('Crop rectangle extends outside the original');
  return result;
}

export function cropForDecision(decision, sourceWidth, sourceHeight) {
  if (!PROFILES.includes(decision?.profile)) throw new Error('Unknown hero geometry profile');
  if (decision.profile === 'preserve-full-image') {
    const full = { left: 0, top: 0, width: sourceWidth, height: sourceHeight };
    if (decision.crop && canonicalJson(validateCrop(decision.crop, sourceWidth, sourceHeight)) !== canonicalJson(full)) throw new Error('The complete group photograph must preserve all original edges');
    return full;
  }
  if (decision.crop) return validateCrop(decision.crop, sourceWidth, sourceHeight);
  if (decision.profile === 'photo-lead') throw new Error('Photo-lead requires an explicit rectangle reviewed for its short hero geometry');
  const width = Math.floor(sourceHeight * 3 / 4);
  if (width > sourceWidth) throw new Error('Original is narrower than full-height 3:4; choose an explicit in-bounds rectangle');
  return validateCrop({ left: decision.left ?? Math.floor((sourceWidth - width) / 2), top: 0, width, height: sourceHeight }, sourceWidth, sourceHeight);
}

export function variantWidths(cropWidth) {
  integer(cropWidth, 'cropWidth', 1);
  return [...new Set([480, 720, cropWidth].filter((width) => width <= cropWidth))].sort((a, b) => a - b);
}

/** Exact browser-cover source rectangle, in image pixels before integer rasterization. */
export function coverRectangle(sourceWidth, sourceHeight, targetWidth, targetHeight, objectPosition = 'center') {
  for (const [name, value] of Object.entries({ sourceWidth, sourceHeight, targetWidth, targetHeight })) {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`);
  }
  const position = parseObjectPosition(objectPosition);
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = targetWidth / scale, height = targetHeight / scale;
  return { left: (sourceWidth - width) * position.x, top: (sourceHeight - height) * position.y, width, height, scale };
}

export function previewGeometries(profile, usages = []) {
  if (!PROFILES.includes(profile)) throw new Error('Unknown hero geometry profile');
  if (profile === 'preserve-full-image') return [];
  const cases = profile === 'photo-lead'
    ? [{ width: 320, height: 270, reason: 'short photo-lead' }, { width: 412, height: 371, reason: 'short photo-lead' }, { width: 479, height: 420, reason: 'short photo-lead' }]
    : [{ width: 320, height: 700, reason: 'tall stress case' }, { width: 412, height: 556, reason: 'middle stress case' }, { width: 479, height: 400, reason: 'short stress case' }];
  // Minimum-height heroes can become taller because of text. Keep the stress
  // cases above and add the actual CSS minimum at every boundary width.
  for (const usage of usages) {
    if (usage.profile !== profile) throw new Error('Preview usage has a different geometry profile');
    const geometry = usage.geometry ?? {};
    if (geometry.fit && geometry.fit !== 'cover') throw new Error('Cover previews require object-fit: cover');
    if (geometry.cropSourceMaxWidth && geometry.cropSourceMaxWidth !== 479) throw new Error('Unreviewed crop breakpoint');
    const match = String(geometry.heightCss ?? '').match(/^clamp\((\d+(?:\.\d+)?)px,\s*(\d+(?:\.\d+)?)vw,\s*(\d+(?:\.\d+)?)px\)$/);
    if (match) for (const width of [320, 412, 479]) {
      const height = Math.round(Math.min(Number(match[3]), Math.max(Number(match[1]), width * Number(match[2]) / 100)));
      cases.push({ width, height, reason: geometry.minimumHeightOnly ? 'actual CSS minimum; content may grow' : 'actual CSS height' });
    }
    for (const size of geometry.previewSizes ?? []) {
      integer(size.width, 'preview width', 1); integer(size.height, 'preview height', 1);
      if (size.width > 479) throw new Error('Mobile derivative previews must stay within 479 CSS px');
      cases.push({ width: size.width, height: size.height, reason: 'observed rendered block' });
    }
  }
  return [...new Map(cases.map((item) => [`${item.width}x${item.height}`, item])).values()];
}

export function recipeIdentity({ assetId, sourceSha256, crop, profile, objectPosition = 'center', versionDate = '20261023' }) {
  if (!safeName(assetId) || !PROFILES.includes(profile)) throw new Error('Unsafe asset/profile identifier');
  if (!/^[a-f0-9]{64}$/.test(sourceSha256 ?? '')) throw new Error('Source SHA-256 is required');
  if (!/^\d{8}$/.test(versionDate)) throw new Error('Version date must have eight digits');
  parseObjectPosition(objectPosition);
  const recipeDigest = hash(canonicalJson({ sourceSha256, crop, profile, objectPosition: parseObjectPosition(objectPosition), sharpVersion: SHARP_VERSION, quality: WEBP_QUALITY, widths: variantWidths(crop.width), versionDate })).slice(0, 20);
  return {
    id: `${assetId}-${profile}-${recipeDigest}`,
    digest: recipeDigest,
    key: (width) => {
      if (!variantWidths(crop.width).includes(width)) throw new Error('Unapproved width or upscaling');
      return `media/hero-mobile-swarm/${assetId}-${profile}-${recipeDigest}-${width}-${versionDate}-v1.webp`;
    },
  };
}

export function validateVisualDecisions(asset, decision) {
  if (!asset || !safeName(asset.id) || typeof asset.source !== 'string') throw new Error('Invalid frozen asset job');
  if (!decision || (decision.assetId ?? decision.id) !== asset.id || !Array.isArray(decision.recipes) || !decision.recipes.length) throw new Error(`Missing visual decisions: ${asset.id}`);
  if (decision.sourceSha256 && !/^[a-f0-9]{64}$/.test(decision.sourceSha256)) throw new Error('Invalid visual-decision source hash');
  const usages = new Map((asset.usages ?? []).map((usage) => [usage.id, usage]));
  if (!usages.size) throw new Error(`No frozen hero usages: ${asset.id}`);
  const covered = new Set();
  for (const recipe of decision.recipes) {
    if (!PROFILES.includes(recipe.profile)) throw new Error('Unknown hero geometry profile');
    if (!Array.isArray(recipe.usageIds) || !recipe.usageIds.length) throw new Error('Every recipe must name its exact hero usages');
    if (typeof recipe.focusReason !== 'string' || recipe.focusReason.trim().length < 8) throw new Error('Record the visual focus rationale, including intentional partial framing');
    if (recipe.inspection?.sourceViewed !== true || typeof recipe.inspection?.notes !== 'string' || recipe.inspection.notes.trim().length < 8) throw new Error('Visual inspection of the original and current block is required before encoding');
    parseObjectPosition(recipe.objectPosition ?? 'center');
    for (const id of recipe.usageIds) {
      const usage = usages.get(id);
      if (!usage || usage.source !== asset.source || usage.profile !== recipe.profile) throw new Error(`Wrong source/profile/usage: ${id}`);
      if (covered.has(id)) throw new Error(`Hero usage appears in more than one recipe: ${id}`);
      covered.add(id);
    }
  }
  const missing = [...usages.values()].filter((usage) => !covered.has(usage.id) && !usage.context?.preparedCrop && usage.profile !== 'preserve-full-image');
  if (missing.length) throw new Error(`Visual decisions omit ${missing.length} uncovered hero usages: ${asset.id}`);
  return decision;
}

async function immutableWrite(file, bytes) {
  try {
    await fs.writeFile(file, bytes, { flag: 'wx' });
    return 'written';
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (hash(await fs.readFile(file)) !== hash(bytes)) throw new Error(`Existing immutable file has different bytes: ${file}`);
    return 'already-matching';
  }
}

async function sourceBytes(asset, sourceDir, fetchImpl) {
  const cacheFile = sourceDir ? path.resolve(sourceDir, `${asset.id}.source.bin`) : null;
  if (asset.localSource) return fs.readFile(path.resolve(asset.localSource));
  if (cacheFile) {
    try { return await fs.readFile(cacheFile); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const url = asset.source.startsWith('/media/') ? `https://img.adatours.ru${asset.source}` : asset.source;
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Source must be an HTTP(S) photograph URL');
  let bytes;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(60000), cache: 'no-store' });
      if (!response.ok) throw new Error(`Original download HTTP ${response.status}: ${asset.id}`);
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > 30_000_000) throw new Error(`Original exceeds 30 MB: ${asset.id}`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 30_000_000) throw new Error(`Original empty or exceeds 30 MB: ${asset.id}`);
      break;
    } catch (error) { if (attempt === 3) throw error; }
  }
  if (cacheFile) { await fs.mkdir(sourceDir, { recursive: true }); await immutableWrite(cacheFile, bytes); }
  return bytes;
}

function packetJobs(packet) {
  const jobs = packet?.jobs ?? packet?.assets ?? packet?.items;
  if (!Array.isArray(jobs) || !jobs.length || jobs.length > 10) throw new Error('Frozen packet must contain 1–10 unique source jobs');
  const result = new Map(jobs.map((asset) => [asset.id ?? asset.assetId, { ...asset, id: asset.id ?? asset.assetId }]));
  if (result.size !== jobs.length || new Set(jobs.map((asset) => asset.source)).size !== jobs.length) throw new Error('Packet contains duplicate source jobs');
  for (const asset of result.values()) if (!safeName(asset.id) || typeof asset.source !== 'string') throw new Error('Invalid frozen asset job');
  return result;
}

async function initializeWorkspace({ outputDir, sourceDir, rootDir = ROOT }) {
  if (sharp.versions.sharp !== SHARP_VERSION) throw new Error(`Mobile hero crops require Sharp ${SHARP_VERSION}; found ${sharp.versions.sharp}`);
  const out = path.resolve(outputDir ?? ''), root = path.resolve(rootDir);
  if (!outputDir || out === root || out.startsWith(root + path.sep)) throw new Error('Binary output directory must be outside the Git checkout');
  if (sourceDir && (path.resolve(sourceDir) === root || path.resolve(sourceDir).startsWith(root + path.sep))) throw new Error('Original source cache must be outside the Git checkout');
  await fs.mkdir(out, { recursive: true });
  const actualOut = await fs.realpath(out), actualRoot = await fs.realpath(root);
  if (actualOut === actualRoot || actualOut.startsWith(actualRoot + path.sep)) throw new Error('Binary output resolves inside the Git checkout');
  sourceDir = path.resolve(sourceDir ?? path.join(out, 'sources'));
  await fs.mkdir(sourceDir, { recursive: true });
  const actualSources = await fs.realpath(sourceDir);
  if (actualSources === actualRoot || actualSources.startsWith(actualRoot + path.sep)) throw new Error('Original cache resolves inside the Git checkout');
  return { out, sourceDir };
}

async function validatedOriginal(asset, { sourceDir, fetchImpl, expectedSha256 }) {
  const bytes = await sourceBytes(asset, sourceDir, fetchImpl), sourceSha256 = hash(bytes);
  if ((asset.sourceSha256 && asset.sourceSha256 !== sourceSha256) || (expectedSha256 && expectedSha256 !== sourceSha256)) throw new Error(`Changed original SHA-256: ${asset.id}`);
  if (!bytes.length || bytes.length > 30_000_000) throw new Error(`Original empty or exceeds 30 MB: ${asset.id}`);
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1) throw new Error(`Invalid or animated original: ${asset.id}`);
  if (metadata.orientation && metadata.orientation !== 1) throw new Error(`Original has orientation metadata; normalize explicitly before choosing pixel coordinates: ${asset.id}`);
  if ((asset.sourceWidth && asset.sourceWidth !== metadata.width) || (asset.sourceHeight && asset.sourceHeight !== metadata.height)) throw new Error(`Changed original dimensions: ${asset.id}`);
  return { bytes, sourceSha256, metadata, sourceFile: asset.localSource ? path.resolve(asset.localSource) : path.join(sourceDir, `${asset.id}.source.bin`) };
}

async function originalPreviewFile(out, assetId, sourceSha256, bytes, width) {
  const file = path.join(out, `${assetId}-${sourceSha256.slice(0, 12)}-original.webp`);
  await immutableWrite(file, await sharp(bytes).resize({ width: Math.min(1200, width), withoutEnlargement: true }).webp({ quality: 85 }).toBuffer());
  return file;
}

/** Download and show untouched compositions before any focal coordinates exist. */
export async function inspectCropPacket({ packet, outputDir, sourceDir, fetchImpl = fetch, rootDir = ROOT }) {
  const workspace = await initializeWorkspace({ outputDir, sourceDir, rootDir });
  const jobs = packetJobs(packet), items = [], tiles = [], articles = [];
  for (const [assetId, asset] of jobs) {
    const { bytes, sourceSha256, metadata, sourceFile } = await validatedOriginal(asset, { sourceDir: workspace.sourceDir, fetchImpl });
    const originalPreview = await originalPreviewFile(workspace.out, assetId, sourceSha256, bytes, metadata.width);
    const item = {
      assetId, source: asset.source, sourceFile, sourceSha256, sourceWidth: metadata.width,
      sourceHeight: metadata.height, sourceBytes: bytes.length, originalPreview,
      status: 'UNREVIEWED', visualReviewRequired: true,
      profiles: asset.profiles ?? [...new Set((asset.usages ?? []).map((usage) => usage.profile))],
      usages: asset.usages ?? [], existingCrops: asset.existingCrops ?? [],
    };
    items.push(item);
    const thumb = await sharp(originalPreview).resize(480, 320, { fit: 'contain', background: '#eee' }).png().toBuffer();
    const label = Buffer.from(`<svg width="480" height="54"><rect width="100%" height="100%" fill="white"/><text x="10" y="20" font-family="sans-serif" font-size="15">${escape(assetId)}</text><text x="10" y="43" font-family="sans-serif" font-size="13">${metadata.width} × ${metadata.height}; ${escape(item.profiles.join(', '))}; UNREVIEWED</text></svg>`);
    tiles.push(await sharp({ create: { width: 480, height: 374, channels: 3, background: 'white' } }).composite([{ input: thumb, top: 0, left: 0 }, { input: label, top: 320, left: 0 }]).png().toBuffer());
    const uses = item.usages.map((usage) => `<li>${escape(usage.pagePath)} — ${escape(usage.profile)}; object-position: ${escape(usage.objectPosition ?? 'center')}; manual: ${escape(usage.context?.manualObjectPosition ?? 'none')}; ${escape(usage.context?.title ?? '')}</li>`).join('');
    articles.push(`<article><h2>${escape(assetId)}</h2><p>${escape(asset.source)} — ${metadata.width} × ${metadata.height}</p><img src="${escape(path.basename(originalPreview))}" alt="Uncropped original photograph"><p>UNREVIEWED. View the original and current block before recording a focus. Existing crops: ${item.existingCrops.length}.</p><ul>${uses}</ul><details><summary>Existing crop decisions</summary><pre>${escape(JSON.stringify(item.existingCrops, null, 2))}</pre></details></article>`);
    await fs.writeFile(path.join(workspace.out, 'inspection-checkpoint.json'), json({ schemaVersion: 1, packetId: packet.id ?? packet.packetId, status: 'UNREVIEWED', sourceDir: workspace.sourceDir, items }));
  }
  const contactSheet = path.join(workspace.out, 'source-contact-sheet.webp');
  await sharp({ create: { width: 960, height: Math.ceil(tiles.length / 2) * 374, channels: 3, background: '#ddd' } }).composite(tiles.map((input, index) => ({ input, left: index % 2 * 480, top: Math.floor(index / 2) * 374 }))).webp({ quality: 85 }).toFile(contactSheet);
  const inspectionGallery = path.join(workspace.out, 'inspection.html');
  await fs.writeFile(inspectionGallery, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Original hero inspection</title><style>body{font:16px system-ui;background:#eee;margin:24px}article{background:white;padding:20px;margin-bottom:24px}img{max-width:100%;height:auto}p,li,pre{overflow-wrap:anywhere}pre{white-space:pre-wrap}</style><h1>Original hero photographs — UNREVIEWED</h1><p>No focal coordinates, mobile crops or upload batches have been created. Inspect these originals and their current blocks before choosing crop decisions.</p>${articles.join('\n')}</html>\n`);
  const result = { schemaVersion: 1, packetId: packet.id ?? packet.packetId, status: 'UNREVIEWED', sourceCommit: packet.sourceCommit ?? null, sourceDir: workspace.sourceDir, items, inspectionGallery, contactSheets: [contactSheet] };
  await fs.writeFile(path.join(workspace.out, 'inspection.json'), json(result));
  return result;
}

async function renderCover(bytes, size, position) {
  const metadata = await sharp(bytes).metadata();
  const visible = coverRectangle(metadata.width, metadata.height, size.width, size.height, position);
  const crop = {
    left: Math.max(0, Math.round(visible.left)), top: Math.max(0, Math.round(visible.top)),
    width: Math.max(1, Math.floor(visible.width)), height: Math.max(1, Math.floor(visible.height)),
  };
  crop.left = Math.min(crop.left, metadata.width - crop.width);
  crop.top = Math.min(crop.top, metadata.height - crop.height);
  return {
    bytes: await sharp(bytes).extract(crop).resize(size.width, size.height, { fit: 'fill' }).webp({ quality: WEBP_QUALITY }).toBuffer(),
    visibleRectangle: visible,
  };
}

async function gallery(outputDir, records) {
  const cards = [], tiles = [];
  for (const item of records) for (const recipe of item.recipes) {
    if (recipe.status === 'PRESERVED') continue;
    const original = path.basename(item.originalPreview);
    const native = path.basename(recipe.variants.at(-1).file);
    const block = recipe.previews.map((preview) => `<figure><img src="${escape(path.basename(preview.file))}" width="${preview.width}" height="${preview.height}" loading="lazy"><figcaption>${preview.width} × ${preview.height}; ${escape(preview.reason)}</figcaption></figure>`).join('');
    cards.push(`<article><h2>${escape(item.assetId)} — ${escape(recipe.profile)}</h2><p>${escape(item.source)}</p><p>${escape(recipe.focusReason)}; object-position: ${escape(recipe.objectPosition)}</p><p>PREPARED: inspect all covers before marking REVIEWED and uploading.</p><div class="previews"><figure><img class="original" src="${escape(original)}"><figcaption>Original; crop ${escape(JSON.stringify(recipe.crop))}</figcaption></figure><figure><img src="${escape(native)}"><figcaption>Prepared portrait/short crop</figcaption></figure>${block}</div><p>Usages: ${escape(recipe.usageIds.join(', '))}</p></article>`);
    const selected = [item.originalPreview, recipe.variants.at(-1).file, ...recipe.previews.slice(0, 3).map((preview) => preview.file)];
    for (const [index, file] of selected.entries()) {
      const thumb = await sharp(file).resize(240, 260, { fit: 'contain', background: '#eee' }).png().toBuffer();
      const label = Buffer.from(`<svg width="240" height="42"><rect width="100%" height="100%" fill="white"/><text x="8" y="17" font-family="sans-serif" font-size="11">${escape(item.assetId.slice(0, 26))}</text><text x="8" y="33" font-family="sans-serif" font-size="11">${escape(recipe.profile)}: ${index === 0 ? 'original' : index === 1 ? 'crop' : 'cover ' + (index - 1)}</text></svg>`);
      tiles.push(await sharp({ create: { width: 240, height: 302, channels: 3, background: 'white' } }).composite([{ input: thumb, top: 0, left: 0 }, { input: label, top: 260, left: 0 }]).png().toBuffer());
    }
  }
  await fs.writeFile(path.join(outputDir, 'gallery.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mobile hero crop review</title><style>body{font:16px system-ui;margin:24px;background:#f6f6f6;color:#222}article{background:white;padding:20px;margin:0 0 28px;border:1px solid #ddd}.previews{display:flex;align-items:start;gap:16px;overflow-x:auto}figure{margin:0;flex:none}img{display:block;max-height:700px;max-width:479px;object-fit:contain;background:#eee}.original{width:479px;height:auto}figcaption{font-size:13px;margin-top:8px;max-width:320px}p{overflow-wrap:anywhere}</style><h1>Mobile hero crop review</h1><p>Encoding alone does not approve composition. Open originals and all real cover simulations; record visual review separately.</p>${cards.join('\n')}</html>\n`);
  if (tiles.length) {
    const columns = 5, rows = Math.ceil(tiles.length / columns);
    // Limit sheet height for large batches while retaining separate full-resolution previews.
    const sheetParts = [];
    for (let first = 0; first < rows; first += 20) {
      const slice = tiles.slice(first * columns, (first + 20) * columns), height = Math.ceil(slice.length / columns) * 302;
      const file = path.join(outputDir, `contact-sheet-${1 + first / 20}.webp`);
      await sharp({ create: { width: columns * 240, height, channels: 3, background: '#ddd' } }).composite(slice.map((input, index) => ({ input, left: index % columns * 240, top: Math.floor(index / columns) * 302 }))).webp({ quality: 85 }).toFile(file);
      sheetParts.push(file);
    }
    return sheetParts;
  }
  return [];
}

/** All binary outputs must live outside the checkout; results remain PREPARED. */
export async function prepareCropBatch({ packet, decisions, outputDir, sourceDir, versionDate = '20261023', fetchImpl = fetch, rootDir = ROOT }) {
  const { out, sourceDir: cacheDir } = await initializeWorkspace({ outputDir, sourceDir, rootDir });
  const jobsById = packetJobs(packet);
  const choices = Array.isArray(decisions) ? decisions : decisions?.items ?? decisions?.decisions;
  if (!Array.isArray(choices)) throw new Error('Visual decisions must be an array');
  const choiceById = new Map(choices.map((decision) => [decision.assetId ?? decision.id, decision]));
  if (choiceById.size !== choices.length || choices.some((decision) => !jobsById.has(decision.assetId ?? decision.id))) throw new Error('Duplicate or foreign visual decisions');
  const records = [], uploads = [];
  for (const [assetId, asset] of jobsById) {
    const decision = validateVisualDecisions(asset, choiceById.get(assetId));
    const { bytes, sourceSha256, metadata } = await validatedOriginal(asset, { sourceDir: cacheDir, fetchImpl, expectedSha256: decision.sourceSha256 });
    const originalPreview = await originalPreviewFile(out, assetId, sourceSha256, bytes, metadata.width);
    const record = { assetId, source: asset.source, sourceSha256, sourceWidth: metadata.width, sourceHeight: metadata.height, sourceBytes: bytes.length, status: 'PREPARED', processing: { sharpVersion: SHARP_VERSION, format: 'webp', quality: WEBP_QUALITY, withoutEnlargement: true }, originalPreview, recipes: [] };
    for (const chosen of decision.recipes) {
      const crop = cropForDecision(chosen, metadata.width, metadata.height), objectPosition = chosen.objectPosition ?? 'center';
      const identity = recipeIdentity({ assetId, sourceSha256, crop, profile: chosen.profile, objectPosition, versionDate });
      const usages = asset.usages.filter((usage) => chosen.usageIds.includes(usage.id));
      const recipe = {
        id: identity.id, profile: chosen.profile, usageIds: [...chosen.usageIds].sort(), crop, objectPosition,
        focusReason: chosen.focusReason.trim(), sourceInspection: chosen.inspection,
        status: chosen.profile === 'preserve-full-image' ? 'PRESERVED' : 'PREPARED', variants: [], previews: [],
      };
      if (recipe.status !== 'PRESERVED') {
        for (const width of variantWidths(crop.width)) {
          const key = identity.key(width), file = path.join(out, path.basename(key));
          const encoded = await sharp(bytes).extract(crop).resize({ width, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true });
          if (encoded.info.width > crop.width || encoded.info.height > crop.height) throw new Error('Unexpected enlargement');
          await immutableWrite(file, encoded.data);
          recipe.variants.push({ key, file, width: encoded.info.width, height: encoded.info.height, bytes: encoded.data.length, sha256: hash(encoded.data), contentType: 'image/webp' });
          uploads.push({ key, file });
        }
        const prepared = await fs.readFile(recipe.variants.at(-1).file);
        for (const size of previewGeometries(recipe.profile, usages)) {
          const preview = await renderCover(prepared, size, objectPosition), file = path.join(out, `${identity.id}-cover-${size.width}x${size.height}.webp`);
          await immutableWrite(file, preview.bytes);
          recipe.previews.push({ ...size, file, sha256: hash(preview.bytes), bytes: preview.bytes.length, visibleRectangle: preview.visibleRectangle });
        }
      }
      record.recipes.push(recipe);
    }
    records.push(record);
    // Recoverable checkpoint after each unique original; never a publication registry.
    await fs.writeFile(path.join(out, 'prepared-checkpoint.json'), json({ schemaVersion: 1, packetId: packet.id ?? packet.packetId, status: 'PREPARED', items: records }));
  }
  const contactSheets = await gallery(out, records);
  const result = { schemaVersion: 1, packetId: packet.id ?? packet.packetId, status: 'PREPARED', sourceCommit: packet.sourceCommit ?? null, sharpVersion: SHARP_VERSION, quality: WEBP_QUALITY, mobileMaxWidth: 479, items: records, reviewGallery: path.join(out, 'gallery.html'), contactSheets };
  await fs.writeFile(path.join(out, 'result.json'), json(result));
  for (let i = 0; i < uploads.length; i += 30) await fs.writeFile(path.join(out, `upload-batch-${1 + i / 30}.json`), json(uploads.slice(i, i + 30)));
  return result;
}

async function main(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || argv[i + 1] === undefined) throw new Error('Use --packet FILE --decisions FILE --out DIRECTORY [--sources DIRECTORY] [--version-date YYYYMMDD]');
    const name = argv[i].slice(2);
    if (!['mode', 'packet', 'decisions', 'out', 'sources', 'version-date'].includes(name)) throw new Error(`Unknown option: ${argv[i]}`);
    flags[name] = argv[i + 1];
  }
  const mode = flags.mode ?? 'prepare';
  if (!['inspect', 'prepare'].includes(mode)) throw new Error('Use --mode inspect or --mode prepare');
  if (!flags.packet || !flags.out || (mode === 'prepare' && !flags.decisions)) throw new Error('Use --mode inspect --packet FILE --out DIRECTORY [--sources DIRECTORY]; then --mode prepare --packet FILE --decisions FILE --out DIRECTORY --sources DIRECTORY');
  if (mode === 'inspect') {
    const result = await inspectCropPacket({ packet: JSON.parse(await fs.readFile(flags.packet, 'utf8')), outputDir: flags.out, sourceDir: flags.sources });
    console.log(json({ packetId: result.packetId, status: result.status, originals: result.items.length, inspection: path.join(path.resolve(flags.out), 'inspection.json'), gallery: result.inspectionGallery, sourceDir: result.sourceDir, contactSheets: result.contactSheets }));
    return;
  }
  const result = await prepareCropBatch({ packet: JSON.parse(await fs.readFile(flags.packet, 'utf8')), decisions: JSON.parse(await fs.readFile(flags.decisions, 'utf8')), outputDir: flags.out, sourceDir: flags.sources, versionDate: flags['version-date'] ?? '20261023' });
  console.log(json({ packetId: result.packetId, status: result.status, originals: result.items.length, files: result.items.reduce((sum, item) => sum + item.recipes.reduce((count, recipe) => count + recipe.variants.length, 0), 0), result: path.join(path.resolve(flags.out), 'result.json'), gallery: result.reviewGallery, contactSheets: result.contactSheets }));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
