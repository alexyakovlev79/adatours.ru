import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const bucket = 'img.adatours.ru';
const publicRoot = 'https://img.adatours.ru';
const s3Root = 'https://storage.yandexcloud.net/' + bucket;
const mediaRoot = path.resolve('public/media');
const token = process.env.YC_IAM_TOKEN;
const manifestName = 'media-sync-manifest.json';
if (!token) throw new Error('Missing temporary Yandex IAM token');

// The full snapshot is already in S3; production runs only mirror deltas.
// Omitting MEDIA_BASELINE_COMMIT retains the full disaster-recovery mode.
const baseline = process.env.MEDIA_BASELINE_COMMIT?.trim();
const gitArgs = baseline
  ? ['diff', '--name-only', '--no-renames', '--diff-filter=AM', '-z', baseline, 'HEAD', '--', 'public/media']
  : ['ls-files', '-z', '--', 'public/media'];
const files = execFileSync('git', gitArgs, {
  encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
}).split('\0').filter(Boolean).sort();
if (!files.length) {
  if (!baseline) throw new Error('No tracked files under public/media');
  await fs.writeFile('media-sync-manifest.json', JSON.stringify({
    version: 1, mode: 'incremental-no-changes',
    sourceCommit: process.env.GITHUB_SHA || null,
    baseline, bucket, totalFiles: 0, uploaded: 0,
    alreadyMatching: 0, incomplete: 0, verifiedBytes: 0,
  }, null, 2) + '\n');
  console.log('No new or changed media since replicated baseline; S3 sync is complete.');
  process.exit(0);
}

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const encodeKey = (key) => key.split('/').map(encodeURIComponent).join('/');
const mimeMap = {
  webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png', avif: 'image/avif', gif: 'image/gif',
  svg: 'image/svg+xml', ico: 'image/x-icon', mp4: 'video/mp4',
  webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/x-m4v',
};
const mimeType = (key) => mimeMap[path.extname(key).slice(1).toLowerCase()] || 'application/octet-stream';

async function request(url, init = {}) {
  let error;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(60000) });
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 3) return response;
      await response.body?.cancel();
      error = new Error('HTTP ' + response.status);
    } catch (cause) {
      error = cause;
      if (attempt === 3) break;
    }
    await sleep(750 * 2 ** attempt);
  }
  throw error;
}

const report = {
  version: 1, mode: 'copy-only',
  sourceCommit: process.env.GITHUB_SHA || null,
  bucket, createdAt: new Date().toISOString(),
  totalFiles: files.length, files: new Array(files.length),
};
let uploaded = 0, unchanged = 0, verifiedBytes = 0, failures = 0;
let cursor = 0, halt = false;

async function copyOne(file) {
  if (!file.startsWith('public/media/')) throw new Error('Unsafe source path ' + file);
  const absolute = path.resolve(file);
  if (!absolute.startsWith(mediaRoot + path.sep)) throw new Error('Unsafe local path ' + file);
  const content = await fs.readFile(absolute);
  const hash = sha(content);
  const key = file.slice('public/'.length);
  const encodedKey = encodeKey(key);
  const s3Url = s3Root + '/' + encodedKey;
  const publicUrl = publicRoot + '/' + encodedKey;

  const head = await request(s3Url, { method: 'HEAD' });
  if (head.status === 200) {
    const metadataHash = head.headers.get('x-amz-meta-sha256');
    const metadataSize = Number(head.headers.get('content-length'));
    if (metadataHash !== hash || metadataSize !== content.length) {
      const get = await request(publicUrl, { method: 'GET', cache: 'no-store' });
      if (!get.ok) throw new Error('Cannot read existing object (HTTP ' + get.status + ')');
      if (sha(Buffer.from(await get.arrayBuffer())) !== hash)
        throw new Error('REMOTE FILE DIFFERS: no overwriting permitted for ' + key);
    }
    unchanged++;
  } else if (head.status === 403 || head.status === 404) {
    const put = await request(s3Url, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + token,
        'If-None-Match': '*', // S3 rejects writes if the key was created meanwhile.
        'Content-Type': mimeType(key),
        'x-amz-meta-sha256': hash,
        'Cache-Control': /-(?:enhanced|generated)-\d{8}/.test(key)
          ? 'public, max-age=31536000, immutable' : 'public, max-age=604800',
      },
      body: content,
    });
    if (!put.ok) throw new Error('Upload failed (HTTP ' + put.status + ')');
    const test = await request(publicUrl, { method: 'GET', cache: 'no-store' });
    if (!test.ok) throw new Error('Uploaded object cannot be read (HTTP ' + test.status + ')');
    if (sha(Buffer.from(await test.arrayBuffer())) !== hash)
      throw new Error('SHA-256 mismatch after upload');
    uploaded++;
  } else throw new Error('Unexpected HEAD status ' + head.status);
  verifiedBytes += content.length;
  return { key, bytes: content.length, sha256: hash,
    result: head.status === 200 ? 'already-matching' : 'uploaded-and-verified' };
}

async function worker() {
  while (!halt) {
    const index = cursor++;
    if (index >= files.length) break;
    try {
      report.files[index] = await copyOne(files[index]);
    } catch (e) {
      failures++;
      report.files[index] = { key: files[index].slice('public/'.length),
        result: 'failed', error: String(e.message || e) };
      console.error('FAILED: ' + files[index] + ' — ' + String(e.message || e));
      if (failures >= 10) halt = true;
    }
    const done = uploaded + unchanged + failures;
    if (done % 50 === 0 || done === files.length)
      console.log('Progress: ' + done + '/' + files.length +
        '; uploaded=' + uploaded + '; already=' + unchanged + '; failed=' + failures);
  }
}

try {
  await Promise.all(Array.from({ length: 6 }, worker));
} finally {
  report.completedAt = new Date().toISOString();
  report.uploaded = uploaded;
  report.alreadyMatching = unchanged;
  report.failed = failures;
  report.incomplete = files.length - (uploaded + unchanged);
  report.verifiedBytes = verifiedBytes;
  await fs.writeFile(manifestName, JSON.stringify(report, null, 2) + '\n');
  console.log('SUMMARY: total=' + files.length + ', uploaded=' + uploaded +
    ', already-matching=' + unchanged + ', incomplete=' + report.incomplete +
    ', verified-bytes=' + verifiedBytes);
}
if (report.incomplete) throw new Error('Some media could not be verified; existing website unchanged');
console.log('All public/media files from this exact Git commit are present in Object Storage.');
