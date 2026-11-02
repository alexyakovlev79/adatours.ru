import { validateMediaKey } from '../media-work-session.mjs';

export function validateDirectAssetLedger(data) {
  const errors = [];
  if (!data || data.version !== 1 || !Array.isArray(data.assets))
    return { errors: ['Media ledger must be { version: 1, assets: [] }'], byPath: new Map() };
  const byPath = new Map();
  for (const [i, entry] of data.assets.entries()) {
    try {
      if (!entry || typeof entry !== 'object') throw new Error('Expected an object');
      if (entry.source !== 'direct-s3') throw new Error('Expected direct-s3 source');
      const type = validateMediaKey(entry.key);
      if (type !== entry.contentType) throw new Error('Unexpected content type');
      if (!/^[0-9a-f]{64}$/.test(entry.sha256 || '')) throw new Error('Missing SHA-256');
      if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 1 || entry.bytes > 50_000_000)
        throw new Error('Invalid file size');
      if (!Number.isFinite(Date.parse(entry.uploadedAt || '')))
        throw new Error('Missing upload timestamp');
      const pathname = '/' + entry.key;
      if (byPath.has(pathname)) throw new Error('Duplicate key');
      byPath.set(pathname, entry);
    } catch (error) {
      errors.push('assets[' + i + ']: ' + (error.message || error));
    }
  }
  return { errors, byPath };
}

export function mergeDirectAssetReceipts(ledger, receipt) {
  const current = validateDirectAssetLedger(ledger);
  if (current.errors.length) throw new Error('Existing ledger is invalid: ' + current.errors.join('; '));
  const incoming = validateDirectAssetLedger({ version: 1, assets: receipt?.assets });
  if (incoming.errors.length) throw new Error('Upload receipt invalid: ' + incoming.errors.join('; '));
  const merged = new Map(current.byPath);
  for (const [pathname, item] of incoming.byPath) {
    const previous = merged.get(pathname);
    if (previous && (previous.sha256 !== item.sha256 || previous.bytes !== item.bytes))
      throw new Error('Different file under existing S3 key: ' + pathname);
    if (!previous) merged.set(pathname, item);
  }
  return {
    version: 1,
    assets: [...merged.values()].sort((a, b) => a.key.localeCompare(b.key, 'en')),
  };
}

/**
 * Deployment-time comparison is local. Previously recorded, immutable S3 keys
 * were already read back and SHA-256 verified when uploaded; only new receipts
 * need an additional remote availability check during deployment.
 */
export function newlyAddedDirectAssetReceipts(current, baseline) {
  const latest = validateDirectAssetLedger(current);
  if (latest.errors.length) throw new Error('Current S3 ledger invalid: ' + latest.errors.join('; '));
  const previous = validateDirectAssetLedger(baseline);
  if (previous.errors.length) throw new Error('Baseline S3 ledger invalid: ' + previous.errors.join('; '));
  for (const [key, oldEntry] of previous.byPath) {
    const newEntry = latest.byPath.get(key);
    if (!newEntry) throw new Error('Existing S3 receipt removed: ' + key);
    for (const field of ['sha256', 'bytes', 'contentType', 'uploadedAt', 'source']) {
      if (newEntry[field] !== oldEntry[field])
        throw new Error('Existing S3 receipt changed: ' + key + ' (' + field + ')');
    }
  }
  return [...latest.byPath].filter(([key]) => !previous.byPath.has(key))
    .map(([, entry]) => entry);
}
