import fs from 'node:fs';
import { validateDirectAssetLedger } from './lib/direct-media-ledger.mjs';
import { verifyDirectS3Assets } from './lib/verify-direct-s3-assets.mjs';

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

const { errors: failed, retried, recovered } = await verifyDirectS3Assets(assets, {
  onRetry: ({ entry, error }) => console.warn('Sequential retry of transient cloud failure: ' + entry.key + ': ' + error.message),
});
const errorsRemote = failed.map(({ entry, error }) => entry.key + ': ' + (error.message || error));
if (errorsRemote.length) {
  throw new Error('Unverified cloud objects (' + errorsRemote.length +
    '): ' + errorsRemote.slice(0, 15).join('; '));
}
console.log('All ' + assets.length + ' direct-S3 receipts verified through public HTTPS HEAD and SHA-256 fallback. ' +
  'Sequential transient retries: ' + retried + ', recovered: ' + recovered + '.');
