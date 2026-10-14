import assert from 'node:assert/strict';
import test from 'node:test';
import {
  previewKey, makeSocialManifest, parseSocialManifest,
  socialPreviewUrl, unverifiedSocialKeys, assertSocialPreviewHead,
} from '../scripts/lib/social-preview-manifest.mjs';

const sourceA = '/media/tours/brazil/hero-20261014.webp';
const sourceB = '/media/tours/peru/hero-20261014.webp';
const sourceC = '/media/tours/brazil/hero-20261015.webp';
const a = previewKey(sourceA);
const b = previewKey(sourceB);
const c = previewKey(sourceC);

test('published manifest stores validated hashed keys, without media URLs that rewriting changes', () => {
  const manifest = makeSocialManifest([b, a]);
  assert.deepEqual(manifest.keys, [a, b].sort());
  assert.equal(manifest.version, 'v1');
  assert.ok(manifest.keys.every((key) => !key.startsWith('/media/')));
  assert.deepEqual([...parseSocialManifest(JSON.stringify(manifest))].sort(), [a, b].sort());
  assert.equal(socialPreviewUrl(a), 'https://img.adatours.ru/' + a);
});

test('an already published OG stays unchecked, while a newly assigned image is verified', () => {
  const known = parseSocialManifest(makeSocialManifest([a, b]));
  assert.deepEqual(unverifiedSocialKeys([a, b], known), []);
  assert.deepEqual(unverifiedSocialKeys([a, c], known), [c]);
  assert.deepEqual(unverifiedSocialKeys([a, b], new Set()), [a, b]);
});

test('missing, wrong-version, duplicate and unsafe manifest keys fail closed', () => {
  assert.throws(() => parseSocialManifest({ version: 'v0', keys: [a] }));
  assert.throws(() => parseSocialManifest({ version: 'v1', keys: [] }));
  assert.throws(() => parseSocialManifest({ version: 'v1', keys: [a, a] }));
  assert.throws(() => parseSocialManifest({ version: 'v1', keys: ['https://other.host/media/a.jpg'] }));
  assert.throws(() => socialPreviewUrl('../secret'));
  assert.throws(() => makeSocialManifest([a, a]));
});

test('weekly HEAD audit rejects missing or wrong-format images', () => {
  const head = (status, type, bytes) => ({ ok: status >= 200 && status < 300, status,
    headers: new Headers({ 'content-type': type, 'content-length': String(bytes) }) });
  assert.doesNotThrow(() => assertSocialPreviewHead(head(200, 'image/jpeg', 14000), a));
  assert.throws(() => assertSocialPreviewHead(head(404, 'image/jpeg', 0), a));
  assert.throws(() => assertSocialPreviewHead(head(200, 'text/html', 1200), a));
  assert.throws(() => assertSocialPreviewHead(head(200, 'image/jpeg', 20), a));
});
