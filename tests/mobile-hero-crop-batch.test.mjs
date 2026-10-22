import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  canonicalJson, coverRectangle, cropForDecision, parseObjectPosition,
  inspectCropPacket, prepareCropBatch, previewGeometries, recipeIdentity, validateCrop,
  validateVisualDecisions, variantWidths,
} from '../scripts/mobile-hero-crop-batch.mjs';

const sharp = createRequire(import.meta.url)('sharp');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const usage = (id = 'u1', profile = 'standard') => ({ id, source: '/media/test/example.webp', pagePath: '/example/', profile, geometry: { fit: 'cover', heightCss: 'clamp(460px, 125vw, 560px)', minimumHeightOnly: true, cropSourceMaxWidth: 479 }, context: {} });
const asset = (usages = [usage()]) => ({ id: 'hero-test', source: '/media/test/example.webp', usages });
const recipe = (patch = {}) => ({ profile: 'standard', usageIds: ['u1'], left: 200, objectPosition: 'center top', focusReason: 'Keep the visible heads; intentional partial body framing is accepted.', inspection: { sourceViewed: true, notes: 'Viewed original and existing mobile hero focus.' }, ...patch });

test('a wide photograph uses a full-height strip; partial subjects need no full-body box', () => {
  assert.deepEqual(cropForDecision(recipe(), 1600, 800), { left: 200, top: 0, width: 600, height: 800 });
  assert.deepEqual(cropForDecision(recipe({ left: undefined }), 1600, 800), { left: 500, top: 0, width: 600, height: 800 });
  assert.deepEqual(cropForDecision(recipe({ crop: { left: 1000, top: 20, width: 500, height: 700 } }), 1600, 800), { left: 1000, top: 20, width: 500, height: 700 });
});

test('out-of-bounds, fractional and empty crops are rejected before encoding', () => {
  assert.throws(() => validateCrop({ left: 1000, top: 0, width: 601, height: 800 }, 1600, 800), /outside/);
  assert.throws(() => validateCrop({ left: 1.5, top: 0, width: 300, height: 400 }, 1600, 800), /integer/);
  assert.throws(() => validateCrop({ left: 0, top: 0, width: 0, height: 400 }, 1600, 800), /integer/);
  assert.throws(() => cropForDecision(recipe(), 300, 800), /narrower/);
});

test('photo-lead needs a separate explicit crop; group photograph keeps every edge', () => {
  assert.throws(() => cropForDecision(recipe({ profile: 'photo-lead' }), 1600, 800), /explicit/);
  assert.deepEqual(cropForDecision(recipe({ profile: 'photo-lead', crop: { left: 350, top: 0, width: 900, height: 800 } }), 1600, 800), { left: 350, top: 0, width: 900, height: 800 });
  assert.deepEqual(cropForDecision(recipe({ profile: 'preserve-full-image' }), 1600, 800), { left: 0, top: 0, width: 1600, height: 800 });
  assert.throws(() => cropForDecision(recipe({ profile: 'preserve-full-image', crop: { left: 1, top: 0, width: 1599, height: 800 } }), 1600, 800), /preserve all/);
});

test('responsive widths never enlarge small/narrow originals and include native width', () => {
  assert.deepEqual(variantWidths(300), [300]);
  assert.deepEqual(variantWidths(480), [480]);
  assert.deepEqual(variantWidths(636), [480, 636]);
  assert.deepEqual(variantWidths(1000), [480, 720, 1000]);
});

test('CSS percentages align free space rather than subject coordinates', () => {
  const cover = coverRectangle(1853, 849, 636, 849, '92% center');
  assert.equal(cover.width, 636);
  assert.equal(cover.left, (1853 - 636) * 0.92);
  assert.deepEqual(parseObjectPosition('top right'), { x: 1, y: 0 });
  assert.deepEqual(parseObjectPosition('bottom'), { x: 0.5, y: 1 });
  assert.throws(() => parseObjectPosition('101% center'), /Invalid/);
  assert.throws(() => parseObjectPosition('center expression(alert(1))'), /Invalid/);
});

test('secondary cover cropping protects a top-aligned head in a short block', () => {
  const top = coverRectangle(600, 800, 479, 400, 'center top');
  const center = coverRectangle(600, 800, 479, 400, 'center');
  assert.equal(top.top, 0);
  assert.ok(center.top > 100);
  assert.ok(top.height < 800);
  assert.ok(Math.abs(center.top * 2 + center.height - 800) < 1e-9);
});

test('previews include stress sizes plus each actual CSS minimum, and photo-lead stays short', () => {
  const sizes = previewGeometries('standard', [usage()]);
  assert.ok(sizes.some((size) => size.width === 320 && size.height === 700));
  assert.ok(sizes.some((size) => size.width === 320 && size.height === 460));
  assert.ok(sizes.some((size) => size.width === 479 && size.height === 560));
  assert.deepEqual(previewGeometries('photo-lead').map(({ width, height }) => [width, height]), [[320, 270], [412, 371], [479, 420]]);
  assert.throws(() => previewGeometries('standard', [usage('u1', 'photo-lead')]), /different geometry/);
});

test('recipe keys are deterministic, source- and focus-sensitive, and reject upscaling', () => {
  const properties = { assetId: 'hero-test', sourceSha256: 'a'.repeat(64), crop: { left: 200, top: 0, width: 600, height: 800 }, profile: 'standard', objectPosition: 'center top' };
  const first = recipeIdentity(properties), same = recipeIdentity({ ...properties, crop: { height: 800, width: 600, top: 0, left: 200 } });
  assert.equal(first.key(480), same.key(480));
  assert.match(first.key(480), /^media\/hero-mobile-swarm\/hero-test-standard-[a-f0-9]{20}-480-20261023-v1\.webp$/);
  assert.notEqual(first.id, recipeIdentity({ ...properties, sourceSha256: 'b'.repeat(64) }).id);
  assert.notEqual(first.id, recipeIdentity({ ...properties, objectPosition: 'center bottom' }).id);
  assert.throws(() => first.key(720), /upscaling/);
  assert.equal(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }));
});

test('visual decisions must cover exact usages and cannot mix photo-lead with tall geometry', () => {
  const job = asset([usage('u1'), usage('u2', 'photo-lead')]);
  assert.throws(() => validateVisualDecisions(job, { assetId: job.id, recipes: [recipe()] }), /omit/);
  assert.throws(() => validateVisualDecisions(job, { assetId: job.id, recipes: [recipe({ usageIds: ['u1', 'u2'] })] }), /Wrong source\/profile\/usage/);
  assert.throws(() => validateVisualDecisions(asset(), { assetId: 'hero-test', recipes: [recipe({ inspection: { sourceViewed: false, notes: 'not yet viewed' } })] }), /Visual inspection/);
  assert.throws(() => validateVisualDecisions(asset(), { assetId: 'hero-test', recipes: [recipe(), recipe()] }), /more than one/);
  assert.doesNotThrow(() => validateVisualDecisions(job, { assetId: job.id, recipes: [recipe(), recipe({ profile: 'photo-lead', usageIds: ['u2'], crop: { left: 200, top: 0, width: 1000, height: 800 } })] }));
});

test('batch generates real derivatives, cover previews and resumable matching immutable files', async (t) => {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'hero-crop-test-'));
  t.after(() => fs.rm(scratch, { recursive: true, force: true }));
  const bytes = await sharp({ create: { width: 800, height: 400, channels: 3, background: '#225544' } }).composite([{ input: await sharp({ create: { width: 100, height: 100, channels: 3, background: '#eeaa22' } }).png().toBuffer(), left: 230, top: 0 }]).webp({ quality: 95 }).toBuffer();
  const source = path.join(scratch, 'source.webp');
  await fs.writeFile(source, bytes);
  const job = { ...asset(), localSource: source, sourceSha256: hash(bytes) };
  const options = { packet: { id: 'packet-001', sourceCommit: 'a'.repeat(40), jobs: [job] }, decisions: [{ assetId: job.id, recipes: [recipe({ left: 200 })] }], outputDir: path.join(scratch, 'output') };
  const result = await prepareCropBatch(options);
  assert.equal(result.status, 'PREPARED');
  assert.equal(result.items[0].processing.sharpVersion, '0.35.5');
  assert.equal(result.items[0].recipes[0].variants.length, 1);
  assert.equal(result.items[0].recipes[0].variants[0].width, 300);
  assert.equal(result.items[0].recipes[0].variants[0].height, 400);
  assert.ok(result.items[0].recipes[0].previews.length >= 3);
  const preview = result.items[0].recipes[0].previews.find((item) => item.width === 479 && item.height === 400);
  const previewMetadata = await sharp(preview.file).metadata();
  assert.equal(previewMetadata.width, 479);
  assert.equal(previewMetadata.height, 400);
  assert.ok((await fs.readFile(result.reviewGallery, 'utf8')).includes('PREPARED'));
  assert.ok((await fs.stat(result.contactSheets[0])).size > 100);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(options.outputDir, 'upload-batch-1.json'), 'utf8')).map((item) => item.key), result.items[0].recipes[0].variants.map((item) => item.key));
  const second = await prepareCropBatch(options);
  assert.deepEqual(second.items[0].recipes[0].variants, result.items[0].recipes[0].variants);
  await fs.writeFile(result.items[0].recipes[0].variants[0].file, Buffer.from('different bytes'));
  await assert.rejects(() => prepareCropBatch(options), /immutable file has different bytes/);
});

test('download retries and verifies an expected source hash before deriving publishable files', async (t) => {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'hero-crop-download-'));
  t.after(() => fs.rm(scratch, { recursive: true, force: true }));
  const bytes = await sharp({ create: { width: 400, height: 200, channels: 3, background: '#ccc' } }).webp().toBuffer();
  let calls = 0;
  const options = { packet: { id: 'p1', jobs: [{ ...asset(), sourceSha256: 'a'.repeat(64) }] }, decisions: [{ assetId: 'hero-test', recipes: [recipe({ left: 100 })] }], outputDir: path.join(scratch, 'output'), fetchImpl: async () => { calls++; return new Response(calls === 1 ? 'temporary' : bytes, { status: calls === 1 ? 503 : 200 }); } };
  await assert.rejects(() => prepareCropBatch(options), /Changed original SHA-256/);
  assert.equal(calls, 2);
  assert.equal((await fs.readdir(options.outputDir)).filter((file) => file.endsWith('.webp')).length, 0);
});

test('inspect downloads once, preserves current contexts and feeds the verified cache into prepare', async (t) => {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'hero-crop-inspection-'));
  t.after(() => fs.rm(scratch, { recursive: true, force: true }));
  const bytes = await sharp({ create: { width: 800, height: 400, channels: 3, background: '#55aa77' } }).webp().toBuffer();
  const job = { ...asset(), sourceSha256: hash(bytes), sourceWidth: 800, sourceHeight: 400, existingCrops: [{ pagePath: '/old/', objectPosition: 'center top' }] };
  const packet = { id: 'packet-inspect', jobs: [job] };
  let calls = 0;
  const inspected = await inspectCropPacket({ packet, outputDir: path.join(scratch, 'inspect'), sourceDir: path.join(scratch, 'sources'), fetchImpl: async () => { calls++; return new Response(bytes, { status: 200 }); } });
  assert.equal(calls, 1);
  assert.equal(inspected.status, 'UNREVIEWED');
  assert.equal(inspected.items[0].visualReviewRequired, true);
  assert.deepEqual(inspected.items[0].usages, job.usages);
  assert.deepEqual(inspected.items[0].existingCrops, job.existingCrops);
  assert.equal(inspected.items[0].sourceSha256, hash(await fs.readFile(inspected.items[0].sourceFile)));
  assert.ok((await fs.readFile(inspected.inspectionGallery, 'utf8')).includes('UNREVIEWED'));
  assert.ok((await fs.stat(inspected.contactSheets[0])).size > 100);
  assert.equal((await fs.readdir(path.join(scratch, 'inspect'))).some((file) => file.startsWith('upload-batch-')), false);
  const prepared = await prepareCropBatch({ packet, decisions: [{ assetId: job.id, sourceSha256: inspected.items[0].sourceSha256, recipes: [recipe({ left: 200 })] }], outputDir: path.join(scratch, 'prepared'), sourceDir: inspected.sourceDir, fetchImpl: async () => { throw new Error('Inspection cache was not reused'); } });
  assert.equal(prepared.items[0].sourceSha256, inspected.items[0].sourceSha256);
  assert.equal(prepared.items[0].recipes[0].variants[0].width, 300);
  const cache = inspected.items[0].sourceFile;
  await fs.writeFile(cache, Buffer.from('changed source'));
  await assert.rejects(() => prepareCropBatch({ packet, decisions: [{ assetId: job.id, recipes: [recipe()] }], outputDir: path.join(scratch, 'prepared-again'), sourceDir: inspected.sourceDir }), /Changed original SHA-256/);
});

test('binary output inside checkout, duplicates and foreign decisions are refused', async () => {
  await assert.rejects(() => prepareCropBatch({ packet: { jobs: [asset()] }, decisions: [], outputDir: process.cwd() }), /outside the Git/);
  await assert.rejects(() => prepareCropBatch({ packet: { jobs: [asset(), asset()] }, decisions: [], outputDir: path.join(os.tmpdir(), 'hero-duplicate-test') }), /duplicate source/);
  await assert.rejects(() => prepareCropBatch({ packet: { jobs: [asset()] }, decisions: [{ assetId: 'foreign', recipes: [recipe()] }], outputDir: path.join(os.tmpdir(), 'hero-foreign-test') }), /foreign visual/);
});
