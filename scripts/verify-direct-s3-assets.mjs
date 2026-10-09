import fs from 'node:fs';
import { validateDirectAssetLedger } from './lib/direct-media-ledger.mjs';

const source = 'src/data/media/direct-s3-uploads.json';
const ledger = JSON.parse(fs.readFileSync(source, 'utf8'));
const { errors, byPath } = validateDirectAssetLedger(ledger);
if (errors.length) throw new Error('Invalid direct-S3 ledger: ' + errors.join('; '));

const assets = [...byPath.values()];
if (process.argv.includes('--local')) {
  console.log('Valid direct-S3 receipt records: ' + assets.length);
  process.exit(0);
}
if (!assets.length) {
  console.log('Direct-S3 ledger is empty. No remote receipts to check.');
  process.exit(0);
}

let next = 0;
const errorsRemote = [];
const retry = async (url) => {
  let last;
  for (let n = 0; n < 3; n++) {
    try {
      const response = await fetch(url, { method: 'HEAD', cache: 'no-store',
        signal: AbortSignal.timeout(25000) });
      if (![429, 500, 502, 503, 504].includes(response.status) || n === 2) return response;
      last = new Error('HTTP ' + response.status);
    } catch (e) { last = e; }
    await new Promise((r) => setTimeout(r, (n + 1) * 750));
  }
  throw last;
};
await Promise.all(Array.from({ length: 8 }, async () => {
  while (true) {
    const index = next++;
    if (index >= assets.length) return;
    const entry = assets[index];
    try {
      const url = 'https://img.adatours.ru/' + entry.key.split('/').map(encodeURIComponent).join('/');
      const response = await retry(url);
      if (!response.ok) throw new Error('HTTP ' + response.status);
      if (Number(response.headers.get('content-length')) !== entry.bytes)
        throw new Error('Incorrect Content-Length');
      const headerHash = response.headers.get('x-amz-meta-sha256');
      if (headerHash && headerHash !== entry.sha256) throw new Error('Incorrect x-amz-meta-sha256');
      if (!headerHash) {
        const body = await fetch(url, { method: 'GET', cache: 'no-store',
          signal: AbortSignal.timeout(45000) });
        if (!body.ok) throw new Error('Unable to check SHA-256 without S3 metadata');
        const { createHash } = await import('node:crypto');
        const actual = createHash('sha256').update(Buffer.from(await body.arrayBuffer())).digest('hex');
        if (actual !== entry.sha256) throw new Error('Incorrect SHA-256 for object without metadata');
      }
      const contentType = (response.headers.get('content-type') || '').split(';')[0].trim();
      if (contentType !== entry.contentType.split(';')[0].trim())
        throw new Error('Unexpected Content-Type ' + contentType);
    } catch (e) {
      errorsRemote.push(entry.key + ': ' + (e.message || e));
    }
  }
}));
if (errorsRemote.length) {
  throw new Error('Unverified cloud objects (' + errorsRemote.length +
    '): ' + errorsRemote.slice(0, 15).join('; '));
}
console.log('All ' + assets.length + ' direct-S3 receipts verified through public HTTPS HEAD.');
