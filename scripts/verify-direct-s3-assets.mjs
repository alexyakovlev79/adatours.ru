import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { validateDirectAssetLedger, newlyAddedDirectAssetReceipts } from './lib/direct-media-ledger.mjs';
import { verifyDirectS3Assets } from './lib/verify-direct-s3-assets.mjs';

const source = 'src/data/media/direct-s3-uploads.json';
const ledger = JSON.parse(fs.readFileSync(source, 'utf8'));
const { errors, byPath } = validateDirectAssetLedger(ledger);
if (errors.length) throw new Error('Invalid direct-S3 ledger: ' + errors.join('; '));

let assets = [...byPath.values()];
if (process.argv.includes('--local')) {
  console.log('Valid direct-S3 receipt records: ' + assets.length);
  process.exit(0);
}
if (process.argv.includes('--changed-only')) {
  const base = process.env.MEDIA_RECEIPT_BASE_SHA || '';
  if (!/^[0-9a-f]{40}$/.test(base) || /^0+$/.test(base))
    throw new Error('Incremental S3 verification requires a valid MEDIA_RECEIPT_BASE_SHA');
  let previous;
  try {
    previous = JSON.parse(execFileSync('git', ['show', base + ':' + source], {
      encoding: 'utf8', maxBuffer: 30 * 1024 * 1024,
    }));
  } catch (error) {
    throw new Error('Cannot read previous direct-S3 ledger at ' + base + ': ' + (error.message || error));
  }
  assets = newlyAddedDirectAssetReceipts(ledger, previous);
  console.log('Incremental direct-S3 receipts: ' + assets.length + ' new; ' +
    (byPath.size - assets.length) + ' unchanged receipts require no S3 requests.');
}
if (!assets.length) {
  console.log('No S3 objects need remote verification.');
  process.exit(0);
}

const { errors: failed, retried, recovered } = await verifyDirectS3Assets(assets, {
  onRetry: ({ entry, error }) => console.warn('Sequential retry of transient cloud failure: ' + entry.key + ': ' + error.message),
});
const errorsRemote = failed.map(({ entry, error }) => entry.key + ': ' + (error.message || error));
if (errorsRemote.length) {
  throw new Error('Unverified cloud objects (' + errorsRemote.length +
    '): ' + errorsRemote.slice(0, 15).join('; '));
}
console.log('All ' + assets.length + ' selected direct-S3 receipts verified through public HTTPS HEAD and SHA-256 fallback. ' +
  'Sequential transient retries: ' + retried + ', recovered: ' + recovered + '.');
