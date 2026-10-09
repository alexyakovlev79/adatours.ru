import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { makeSessionRequest, openUploadToken } from './lib/media-token-envelope.mjs';

const MIME = {
  webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png', avif: 'image/avif', gif: 'image/gif',
  mp4: 'video/mp4', webm: 'video/webm',
};
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function validateMediaKey(key) {
  if (typeof key !== 'string' || !/^media\/[a-z0-9_-]+\/[A-Za-z0-9_.\/-]+$/.test(key)
    || key.includes('//') || key.split('/').some((v) => v === '.' || v === '..'))
    throw new Error('Invalid media object key: ' + key);
  const ext = key.split('.').pop().toLowerCase();
  if (!MIME[ext]) {
    if (/^media\/tech\/[a-zA-Z0-9_.-]+\.txt$/.test(key)) return 'text/plain; charset=utf-8';
    throw new Error('Unsupported file type in ' + key);
  }
  if (!/\d{8}/.test(path.posix.basename(key)))
    throw new Error('New media keys must include an 8-digit version date: ' + key);
  return MIME[ext];
}

export function normalizedBatch(input) {
  if (!Array.isArray(input) || !input.length || input.length > 30)
    throw new Error('Batch must contain between 1 and 30 objects');
  const keys = new Set();
  return input.map((item) => {
    if (!item || typeof item.file !== 'string' || typeof item.key !== 'string')
      throw new Error('Each batch item must contain local file and media object key');
    const contentType = validateMediaKey(item.key);
    if (keys.has(item.key)) throw new Error('Duplicate object key in batch: ' + item.key);
    keys.add(item.key);
    return { file: item.file, key: item.key, contentType };
  });
}

function parseFlags(args) {
  const flags = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!key?.startsWith('--') || args[index + 1] === undefined)
      throw new Error('Arguments must be --flag value pairs');
    flags[key.slice(2)] = args[index + 1];
  }
  return flags;
}
function urlFor(key, root) {
  return root + '/' + key.split('/').map(encodeURIComponent).join('/');
}
async function request(url, options = {}) {
  let lastError;
  for (let retry = 0; retry < 4; retry++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(120000) });
      if (![429, 500, 502, 503, 504].includes(response.status) || retry === 3)
        return response;
      await response.body?.cancel();
      lastError = new Error('HTTP ' + response.status);
    } catch (cause) {
      lastError = cause;
      if (retry === 3) break;
    }
    await pause(500 * 2 ** retry);
  }
  throw lastError;
}
async function pushOne(asset, iamToken) {
  const bytes = await fs.readFile(asset.file);
  const limit = asset.contentType.startsWith('video/') ? 50_000_000 : 15_000_000;
  if (!bytes.length || bytes.length > limit)
    throw new Error('File empty or too large for direct upload: ' + asset.key);
  const digest = sha(bytes);
  const publicUrl = urlFor(asset.key, 'https://img.adatours.ru');
  const storageUrl = urlFor(asset.key, 'https://storage.yandexcloud.net/img.adatours.ru');

  const head = await request(publicUrl, { method: 'HEAD' });
  let status;
  if (head.status === 200) {
    const response = await request(publicUrl, { method: 'GET', cache: 'no-store' });
    if (!response.ok) throw new Error('Could not verify existing asset ' + asset.key);
    if (sha(Buffer.from(await response.arrayBuffer())) !== digest)
      throw new Error('Object already exists with different bytes; choose a NEW versioned filename: ' + asset.key);
    status = 'already-matching';
  } else if ([403, 404].includes(head.status)) {
    const response = await request(storageUrl, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + iamToken,
        'If-None-Match': '*',
        'Content-Type': asset.contentType,
        'Content-Length': String(bytes.length),
        'x-amz-meta-sha256': digest,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      body: bytes,
    });
    if (!response.ok) throw new Error('S3 PUT failed (HTTP ' + response.status + '): ' + asset.key);
    const verify = await request(publicUrl, { method: 'GET', cache: 'no-store' });
    if (!verify.ok || sha(Buffer.from(await verify.arrayBuffer())) !== digest)
      throw new Error('S3 verification failed: ' + asset.key);
    status = 'uploaded-and-verified';
  } else throw new Error('Unexpected S3 response HTTP ' + head.status + ': ' + asset.key);

  return {
    key: asset.key,
    sha256: digest,
    bytes: bytes.length,
    contentType: asset.contentType,
    uploadedAt: new Date().toISOString(),
    source: 'direct-s3',
    status,
  };
}

async function main() {
  const command = process.argv[2];
  const flags = parseFlags(process.argv.slice(3));
  if (command === 'init') {
    const baseDir = path.resolve(flags.out || path.join(os.tmpdir(), 'adatours-upload-session'));
    const { request, privatePem } = makeSessionRequest();
    await fs.mkdir(baseDir, { recursive: true, mode: 0o700 });
    const requestFile = path.join(baseDir, request.requestId + '.request.json');
    const privateFile = path.join(baseDir, request.requestId + '.private.pem');
    await fs.writeFile(requestFile, JSON.stringify(request, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await fs.writeFile(privateFile, privatePem, { mode: 0o600, flag: 'wx' });
    console.log(JSON.stringify({ requestFile, privateFile, requestId: request.requestId,
      githubRequestPath: 'data/media/upload-session-request.json' }, null, 2));
    console.log('Post ONLY requestFile JSON to GitHub. Never commit privateFile.');
    return;
  }
  if (command !== 'upload') throw new Error('Use: init or upload');
  for (const needed of ['request', 'private', 'envelope', 'batch', 'receipt']) {
    if (!flags[needed]) throw new Error('Missing --' + needed);
  }
  const request = JSON.parse(await fs.readFile(flags.request, 'utf8'));
  const privatePem = await fs.readFile(flags.private, 'utf8');
  const envelope = JSON.parse(Buffer.from(flags.envelope, 'base64').toString('utf8'));
  const iamToken = openUploadToken(envelope, request, privatePem);
  const items = normalizedBatch(JSON.parse(await fs.readFile(flags.batch, 'utf8')));
  const receipts = [];
  for (const asset of items) {
    const receipt = await pushOne(asset, iamToken);
    receipts.push(receipt);
    console.log(receipt.status + ': /' + receipt.key + ' (' + receipt.bytes + ' B)');
  }
  await fs.writeFile(flags.receipt, JSON.stringify({ version: 1, assets: receipts }, null, 2) + '\n',
    { mode: 0o600, flag: 'wx' });
  console.log('Verified receipt: ' + path.resolve(flags.receipt) +
    '\nCommit only the receipt records and MD/JSON pointers, not the source binaries.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  await main().catch((error) => {
    console.error('Media upload failed: ' + String(error.message || error));
    process.exitCode = 1;
  });
}
