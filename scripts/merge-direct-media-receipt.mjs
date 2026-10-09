import fs from 'node:fs';
import { mergeDirectAssetReceipts } from './lib/direct-media-ledger.mjs';

const receiptPath = process.argv[2];
if (!receiptPath) throw new Error('Usage: node scripts/merge-direct-media-receipt.mjs /path/to/receipt.json');
const ledgerPath = 'src/data/media/direct-s3-uploads.json';
const current = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
const merged = mergeDirectAssetReceipts(current, receipt);
fs.writeFileSync(ledgerPath, JSON.stringify(merged, null, 2) + '\n');
console.log('Direct S3 ledger now contains ' + merged.assets.length + ' verified objects.');
