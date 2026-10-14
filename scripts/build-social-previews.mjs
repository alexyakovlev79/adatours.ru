// Create uncropped, social-friendly images from existing Ada Tours photos.
// Generated JPEGs go directly to Yandex Object Storage, not into Git or Pages.
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

export const SOCIAL_WIDTH = 1200;
export const SOCIAL_HEIGHT = 630;
export const DEFAULT_PHOTO = '/media/home/hero-rio-generated-20261008-v2.webp';
const VERSION = 'v1';
const SITE = 'https://adatours.ru';
const IMAGE_ORIGIN = 'https://img.adatours.ru';
const STORAGE_ORIGIN = 'https://storage.yandexcloud.net/img.adatours.ru';
const DIST = path.resolve('dist');
const MEDIA_ROOT = path.resolve('public/media');
const TOKEN = process.env.YC_IAM_TOKEN || '';
const REQUIRED = process.env.SOCIAL_PREVIEW_REQUIRED === '1';

function attribute(tag, key) {
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    if (match[1].toLowerCase() === key.toLowerCase()) return match[2] ?? match[3];
  }
  return '';
}

function ogSource(html) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
  for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
    if (attribute(tag, 'property').toLowerCase() === 'og:image') return attribute(tag, 'content');
  }
  return '';
}

export function mediaPhotoPath(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    const url = new URL(value, SITE);
    if (url.protocol !== 'https:' ||
        !['adatours.ru', 'www.adatours.ru', 'img.adatours.ru'].includes(url.hostname)) return null;
    const pathname = decodeURIComponent(url.pathname);
    if (!pathname.startsWith('/media/') || !/\.(?:webp|jpe?g|png|avif)$/i.test(pathname) ||
        pathname.startsWith('/media/social-previews/') || pathname.includes('\\')) return null;
    return pathname;
  } catch { return null; }
}

export function chooseSocialPhoto(html) {
  const hero = (html.match(/<img\b[^>]*>/gi) || []).find((tag) =>
    attribute(tag, 'class').split(/\s+/).includes('hero__media'));
  return mediaPhotoPath(ogSource(html)) ||
    mediaPhotoPath(hero ? attribute(hero, 'src') : '') || DEFAULT_PHOTO;
}

const properties = new Set([
  'og:image', 'og:image:secure_url', 'og:image:type',
  'og:image:width', 'og:image:height', 'og:image:alt',
]);
const names = new Set(['twitter:image', 'twitter:image:alt', 'twitter:card']);
const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;');

export function setSocialMetadata(html, url) {
  const match = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html);
  if (!match) throw new Error('HTML is missing its <head>');
  const inner = match[1].replace(/<meta\b[^>]*>/gi, (tag) =>
    properties.has(attribute(tag, 'property')) || names.has(attribute(tag, 'name')) ? '' : tag).trimEnd();
  const values = [
    ['property', 'og:image', url],
    ['property', 'og:image:secure_url', url],
    ['property', 'og:image:type', 'image/jpeg'],
    ['property', 'og:image:width', String(SOCIAL_WIDTH)],
    ['property', 'og:image:height', String(SOCIAL_HEIGHT)],
    ['property', 'og:image:alt', 'Ada Tours — изображение страницы'],
    ['name', 'twitter:image', url],
    ['name', 'twitter:image:alt', 'Ada Tours — изображение страницы'],
    ['name', 'twitter:card', 'summary_large_image'],
  ];
  const tags = values.map(([type, key, value]) =>
    '<meta ' + type + '="' + key + '" content="' + escapeHtml(value) + '">').join('\n');
  const updated = match[0].replace(match[1], inner + '\n' + tags + '\n');
  return html.slice(0, match.index) + updated + html.slice(match.index + match[0].length);
}

export function previewKey(photo) {
  const id = createHash('sha256').update(VERSION + '\0' + photo).digest('hex').slice(0, 28);
  return 'media/social-previews/' + VERSION + '/' + id + '.jpg';
}

export function fitPhoto(width, height) {
  if (!(width > 0 && height > 0)) throw new Error('Invalid source dimensions');
  const factor = Math.min(1152 / width, 562 / height);
  return { width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)) };
}

export async function renderPreview(bytes, logoSvg) {
  const { width, height, orientation } = await sharp(bytes).metadata();
  const actualWidth = orientation && orientation >= 5 ? height : width;
  const actualHeight = orientation && orientation >= 5 ? width : height;
  const size = fitPhoto(actualWidth, actualHeight);
  const background = await sharp(bytes).rotate()
    .resize(SOCIAL_WIDTH, SOCIAL_HEIGHT, { fit: 'cover' })
    .blur(32).modulate({ brightness: 0.63, saturation: 0.84 }).toBuffer();
  // Entire original photo is visible. The blurred BACKGROUND alone is cropped.
  const foreground = await sharp(bytes).rotate()
    .resize(size.width, size.height, { fit: 'fill' }).toBuffer();
  const x = Math.floor((SOCIAL_WIDTH - size.width) / 2);
  const y = Math.floor((SOCIAL_HEIGHT - size.height) / 2);
  const frame = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + (size.width + 8) +
    '" height="' + (size.height + 8) +
    '"><rect width="100%" height="100%" rx="3" fill="white" fill-opacity=".92"/></svg>');
  const plate = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="76">' +
    '<rect width="200" height="76" rx="12" fill="#10191c" fill-opacity=".82"/></svg>');
  const logo = await sharp(logoSvg).resize({ width: 154 }).png().toBuffer();
  return sharp(background).composite([
    { input: frame, left: x - 4, top: y - 4 },
    { input: foreground, left: x, top: y },
    { input: plate, left: 22, top: 532 },
    { input: logo, left: 45, top: 544 },
  ]).jpeg({ quality: 80, progressive: true, mozjpeg: true }).toBuffer();
}

async function request(url, init = {}) {
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(45000) });
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 3) return response;
      await response.body?.cancel();
      last = new Error('HTTP ' + response.status);
    } catch (e) { last = e; }
    if (attempt !== 3) await new Promise((r) => setTimeout(r, 850 * (attempt + 1)));
  }
  throw last;
}

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const encodeKey = (key) => key.split('/').map(encodeURIComponent).join('/');

async function photoBytes(photo) {
  const absolute = path.resolve('public', '.' + photo);
  if (!absolute.startsWith(MEDIA_ROOT + path.sep)) throw new Error('Unsafe photo path');
  try { return await fs.readFile(absolute); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  // Photos imported after 09.10 live exclusively in Object Storage.
  const remote = await request(IMAGE_ORIGIN + photo);
  if (!remote.ok) throw new Error('Photo not accessible ' + photo + ', HTTP ' + remote.status);
  const bytes = Buffer.from(await remote.arrayBuffer());
  if (!bytes.length || bytes.length > 16_000_000) throw new Error('Invalid photo size ' + photo);
  return bytes;
}

async function ensureObject(photo, logoSvg) {
  const key = previewKey(photo);
  const encoded = encodeKey(key);
  const url = IMAGE_ORIGIN + '/' + encoded;
  const head = await request(url, { method: 'HEAD' });
  if (head.ok) {
    const type = (head.headers.get('content-type') || '').split(';')[0];
    if (type !== 'image/jpeg' || Number(head.headers.get('content-length') || 0) < 200)
      throw new Error('Existing social object invalid: ' + key);
    return { url, status: 'reused', key };
  }
  if (head.status !== 403 && head.status !== 404)
    throw new Error('Social image HEAD: ' + head.status + ' ' + key);
  if (!TOKEN) throw new Error('Social preview missing, and YC_IAM_TOKEN unavailable: ' + key);
  const bytes = await renderPreview(await photoBytes(photo), logoSvg);
  const checksum = sha(bytes);
  const put = await request(STORAGE_ORIGIN + '/' + encoded, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + TOKEN,
      'If-None-Match': '*',
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'x-amz-meta-sha256': checksum,
    },
    body: bytes,
  });
  if (!put.ok && put.status !== 412)
    throw new Error('Social image PUT: ' + put.status + ' ' + key);
  const readback = await request(url, { cache: 'no-store' });
  if (!readback.ok || sha(Buffer.from(await readback.arrayBuffer())) !== checksum)
    throw new Error('Social image readback SHA-256 mismatch: ' + key);
  return { url, status: 'uploaded-and-verified', bytes: bytes.length, sha256: checksum, key };
}

async function htmlFiles(root, files = []) {
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const filename = path.join(root, entry.name);
    if (entry.isDirectory() && entry.name !== 'media') await htmlFiles(filename, files);
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(filename);
  }
  return files;
}

async function main() {
  if (!TOKEN) {
    if (!REQUIRED) {
      console.log('Social previews: CI/local mode without upload token; publishing skipped.');
      return;
    }
    console.warn('Social previews: no IAM token; checking existing S3 previews in strict reuse-only mode.');
  }
  const logo = await fs.readFile('public/brand/adatours-logo-white.svg');
  const pages = [];
  for (const file of await htmlFiles(DIST)) {
    const html = await fs.readFile(file, 'utf8');
    pages.push({ file, html, photo: chooseSocialPhoto(html) });
  }
  const photos = [...new Set(pages.map((p) => p.photo))].sort();
  const result = new Map();
  let cursor = 0, finished = 0, uploaded = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (cursor < photos.length) {
      const photo = photos[cursor++];
      const status = await ensureObject(photo, logo);
      result.set(photo, status);
      if (status.status === 'uploaded-and-verified') uploaded++;
      if (++finished % 50 === 0 || finished === photos.length)
        console.log('Social OG images verified: ' + finished + '/' + photos.length);
    }
  }));
  for (const page of pages) {
    const item = result.get(page.photo);
    if (!item) throw new Error('Social image missing ' + page.photo);
    await fs.writeFile(page.file, setSocialMetadata(page.html, item.url));
  }
  const summary = { pages: pages.length, distinctImages: photos.length,
    uploaded, reused: photos.length - uploaded, sourcePhotosUnchanged: true,
    host: IMAGE_ORIGIN, version: VERSION };
  await fs.writeFile(path.join(DIST, 'social-preview-report.json'),
    JSON.stringify(summary, null, 2) + '\n');
  console.log('Social Open Graph previews: ' + JSON.stringify(summary));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await main();
