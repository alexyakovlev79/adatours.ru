// Public manifest of verified, immutable social-preview objects from the last Pages release.
// Existing keys are trusted during normal builds; a weekly job verifies all of them again.
import { createHash } from 'node:crypto';

export const SOCIAL_PREVIEW_VERSION = 'v1';
export const SOCIAL_IMAGE_ORIGIN = 'https://img.adatours.ru';
export const SOCIAL_MANIFEST_URL = 'https://adatours.ru/social-preview-manifest.json';
const MANIFEST_LIMIT = 1_000_000;
const keyPattern = /^media\/social-previews\/v1\/[a-f0-9]{28}\.jpg$/;

export function previewKey(photo) {
  const digest = createHash('sha256').update(SOCIAL_PREVIEW_VERSION + '\0' + photo).digest('hex').slice(0, 28);
  return 'media/social-previews/' + SOCIAL_PREVIEW_VERSION + '/' + digest + '.jpg';
}

export function socialPreviewUrl(key) {
  if (typeof key !== 'string' || !keyPattern.test(key)) throw new Error('Invalid social-preview key: ' + key);
  return SOCIAL_IMAGE_ORIGIN + '/' + key;
}

export function makeSocialManifest(keys) {
  if (!Array.isArray(keys) || keys.length === 0) throw new Error('Social-preview manifest cannot be empty');
  for (const key of keys) socialPreviewUrl(key);
  const unique = [...new Set(keys)].sort();
  if (unique.length !== keys.length) throw new Error('Duplicate social-preview key');
  return { version: SOCIAL_PREVIEW_VERSION, keys: unique };
}

export function parseSocialManifest(value) {
  const manifest = typeof value === 'string' ? JSON.parse(value) : value;
  if (!manifest || typeof manifest !== 'object' || manifest.version !== SOCIAL_PREVIEW_VERSION)
    throw new Error('Unrecognized social-preview manifest version');
  if (!Array.isArray(manifest.keys) || manifest.keys.length === 0 || manifest.keys.length > 20_000)
    throw new Error('Invalid social-preview manifest size');
  for (const key of manifest.keys) socialPreviewUrl(key);
  const keys = new Set(manifest.keys);
  if (keys.size !== manifest.keys.length) throw new Error('Duplicate social-preview manifest key');
  return keys;
}

export function unverifiedSocialKeys(keys, previouslyVerified = new Set()) {
  return keys.filter((key) => !previouslyVerified.has(key));
}

export async function socialRequest(url, init = {}) {
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(45_000) });
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 3) return response;
      await response.body?.cancel();
      last = new Error('HTTP ' + response.status);
    } catch (error) { last = error; }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 850 * (attempt + 1)));
  }
  throw last;
}

export async function readPublishedSocialManifest() {
  const response = await socialRequest(SOCIAL_MANIFEST_URL, {
    cache: 'no-store', headers: { 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) throw new Error('Public social-preview manifest HTTP ' + response.status);
  const bytes = Number(response.headers.get('content-length') || 0);
  if (bytes > MANIFEST_LIMIT) throw new Error('Public social-preview manifest too large');
  const text = await response.text();
  if (text.length > MANIFEST_LIMIT) throw new Error('Public social-preview manifest too large');
  return parseSocialManifest(text);
}

export function assertSocialPreviewHead(response, key) {
  socialPreviewUrl(key);
  if (!response.ok) throw new Error('Social-preview HEAD HTTP ' + response.status + ': ' + key);
  const type = (response.headers.get('content-type') || '').split(';')[0].trim();
  if (type !== 'image/jpeg' || Number(response.headers.get('content-length') || 0) < 200)
    throw new Error('Existing social-preview object invalid: ' + key);
}

export async function verifySocialPreview(key) {
  const response = await socialRequest(socialPreviewUrl(key), { method: 'HEAD' });
  assertSocialPreviewHead(response, key);
}
