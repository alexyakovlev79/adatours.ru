#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDailyState, verifyLifecycle } from './tour-2027-lifecycle.mjs';

/** Read-only wrapper, also callable in-process where child processes are unavailable. */
export function checkLifecycle({ receiptPath, phase = 'final', rootDir = '.' } = {}) {
  const json = path => JSON.parse(readFileSync(resolve(rootDir, path), 'utf8'));
  const hashes = receipt => {
    const geoPaths = (Array.isArray(receipt.stages.geo_ready?.evidence) ? receipt.stages.geo_ready.evidence : [])
      .filter(row => row?.kind === 'geo_passport' && /^[a-zA-Z0-9_-]+$/.test(row.entityId || '')
        && row.filePath === 'data/geo-knowledge/entities/' + row.entityId + '.json').map(row => row.filePath);
    return Object.fromEntries([...new Set([...receipt.scope.files.map(row => row.path), ...geoPaths])].map(path => {
      try { return [path, createHash('sha256').update(readFileSync(resolve(rootDir, path))).digest('hex')]; }
      catch { return [path, null]; }
    }));
  };
  try {
    if (!receiptPath) return validateDailyState(json('data/audits/tour-2027-daily-state.json'), { readLifecycle: json, currentFilesFor: hashes });
    const receipt = json(receiptPath);
    const result = verifyLifecycle(receipt, { phase });
    // Validate structure before using file paths from a persisted receipt.
    return result.ok ? verifyLifecycle(receipt, { phase, currentFiles: hashes(receipt) }) : result;
  } catch (error) {
    return { ok: false, errors: ['Cannot validate lifecycle input: ' + error.message] };
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const receiptPath = process.argv.find(arg => arg.startsWith('--receipt='))?.slice(10);
  const result = checkLifecycle({ receiptPath, phase: process.argv.includes('--predeploy') ? 'predeploy' : 'final' });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
