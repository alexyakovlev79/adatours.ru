import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSessionRequest, sealUploadToken, openUploadToken, validateSessionRequest } from '../scripts/lib/media-token-envelope.mjs';
import { validateMediaKey, normalizedBatch } from '../scripts/media-work-session.mjs';
import { validateDirectAssetLedger, mergeDirectAssetReceipts } from '../scripts/lib/direct-media-ledger.mjs';
import { validateGeneratedSourceMaterials } from '../src/lib/generated-source-materials.mjs';
import fs from 'node:fs';

test('temporary IAM credential decrypts only with the one-time private key', () => {
  const now = Date.now();
  const { request, privatePem } = makeSessionRequest(now);
  const token = 'simulated-iam-token-' + 'A'.repeat(320);
  const sealed = sealUploadToken(token, request, now);
  assert.equal(openUploadToken(sealed, request, privatePem, now + 5000), token);
  const stranger = makeSessionRequest(now);
  assert.throws(() => openUploadToken(sealed, request, stranger.privatePem, now + 5000), /Private key/);
  assert.throws(() => openUploadToken({ ...sealed, requestId: '0'.repeat(32) }, request, privatePem, now + 5000));
});

test('expired request, expired token and tampered ciphertext are rejected', () => {
  const now = Date.now();
  const { request, privatePem } = makeSessionRequest(now);
  const sealed = sealUploadToken('simulated-iam-token-' + 'B'.repeat(320), request, now);
  assert.throws(() => validateSessionRequest(request, now + 22 * 60 * 1000), /expired/);
  assert.throws(() => openUploadToken(sealed, request, privatePem, now + 11 * 60 * 1000), /expired/);
  const tampered = { ...sealed, ciphertext: Buffer.from('tamper').toString('base64') };
  assert.throws(() => openUploadToken(tampered, request, privatePem, now + 1000));
});

test('new image and video keys must be safe and versioned', () => {
  assert.equal(validateMediaKey('media/tours/rio/hero-enhanced-20261009-v2.webp'), 'image/webp');
  assert.equal(validateMediaKey('media/countries/brazil/hero-background-20261009.mp4'), 'video/mp4');
  assert.equal(validateMediaKey('media/tours/rio/hero-background-20261009.webm'), 'video/webm');
  for (const bad of ['media/tours/rio/hero.webp', 'media/tours/../secret-20261009.webp',
    '/media/tours/x-20261009.webp', 'media/tours/../../etc/evil-20261009.webp',
    'media/tours/hero-20261009.exe', 'media/tours/rio/X-20261009?.jpg']) {
    assert.throws(() => validateMediaKey(bad), undefined, bad);
  }
});

test('batch cannot contain multiple copies of same key', () => {
  const entries = [{ file: '/tmp/a', key: 'media/tours/rio/day-01-20261009.webp' }];
  assert.equal(normalizedBatch(entries).length, 1);
  assert.throws(() => normalizedBatch([...entries, ...entries]), /Duplicate/);
});

test('S3 ledger accepts verified metadata, but not changes under existing key', () => {
  const entry = { key: 'media/tours/rio/day-01-20261009.webp', sha256: 'a'.repeat(64), bytes: 300,
    contentType: 'image/webp', uploadedAt: '2026-10-09T10:00:00Z', source: 'direct-s3' };
  const ledger = { version: 1, assets: [entry] };
  assert.deepEqual(validateDirectAssetLedger(ledger).errors, []);
  assert.equal(mergeDirectAssetReceipts(ledger, { assets: [entry] }).assets.length, 1);
  assert.throws(() => mergeDirectAssetReceipts(ledger, { assets: [{ ...entry, sha256: 'b'.repeat(64) }] }), /Different/);
  assert.ok(validateDirectAssetLedger({ version: 1, assets: [{ ...entry, sha256: 'none' }] }).errors.length);
});

test('generated destination can use a registered direct-S3 photograph without local binary', () => {
  const path = 'data/source-index/entries/destination_peru_moraj.json';
  const entry = JSON.parse(fs.readFileSync(path, 'utf8'));
  const dummyPath = '/media/destinations/moray/test-generated-20261009.webp';
  entry.media.images[0].url = dummyPath;
  assert.ok(validateGeneratedSourceMaterials(entry, { repoRoot: process.cwd() }).some(s => s.includes('missing')));
  assert.deepEqual(validateGeneratedSourceMaterials(entry, {
    repoRoot: process.cwd(), directAssets: new Set([dummyPath]),
  }), []);
});
