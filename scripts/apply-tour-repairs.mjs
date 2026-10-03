import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { brotliDecompressSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { reserveDestinations } from '../src/lib/destination-reservations.mjs';

// Narrow, reviewed content import. Do not change photos, archive policy, or unrelated files.
const manifestPath = process.argv[2];
if (manifestPath !== 'data/tour-repairs/2026-10-03.json') throw new Error('Unexpected repair manifest');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.applied) throw new Error('This repair batch is already applied');
const response = await fetch(manifest.downloadUrl, { signal: AbortSignal.timeout(60000) });
if (!response.ok) throw new Error(`Prepared bundle download failed: ${response.status}`);
const compressed = Buffer.from(await response.arrayBuffer());
if (createHash('sha256').update(compressed).digest('hex') !== manifest.sha256) throw new Error('Prepared bundle checksum mismatch');
const bundle = JSON.parse(brotliDecompressSync(compressed));
if (bundle.version !== 1 || bundle.records.length !== 8) throw new Error('Unexpected bundle contract');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const archived = new Set(read('data/catalog-archive.json').entries.map(x => x.id));
for (const record of [...bundle.records, ...bundle.newExcursions]) {
  if (archived.has(record.id)) throw new Error(`Will not reactivate archived entity: ${record.id}`);
}
const allowedPath = p => /^(src\/content\/(tours|excursions)\/[a-z0-9-]+\.md|data\/source-index\/entries\/[a-z0-9_]+\.json|docs\/reports\/anna-tour-repairs-2026-10-03\.md)$/.test(p);
const prepared = new Map();
// Validate all new files and patch baselines before changing any source file.
for (const [p, text] of Object.entries(bundle.files)) {
  if (!allowedPath(p) || typeof text !== 'string') throw new Error(`Unexpected file: ${p}`);
  if (fs.existsSync(p) && fs.readFileSync(p, 'utf8') !== text) throw new Error(`Concurrent file already exists: ${p}`);
  if (p.startsWith('src/content/')) {
    const data = yaml.load(text.split('---')[1]);
    if (data.status !== 'published' || !data.id || !data.title) throw new Error(`Invalid page: ${p}`);
  } else if (p.endsWith('.json')) JSON.parse(text);
  prepared.set(p, text);
}
for (const patch of bundle.patches) {
  if (!patch.path.startsWith('data/source-index/entries/') || !allowedPath(patch.path)) throw new Error('Unexpected patch path');
  const current = read(patch.path);
  if (current.id !== patch.id || current.status === 'archived') throw new Error(`Identity/archive conflict: ${patch.id}`);
  for (const [field, change] of Object.entries(patch.fields)) {
    if (field === 'media' || field === 'status') throw new Error('Media/archive mutations are not allowed');
    const actual = current[field] ?? null;
    if (!same(actual, change.before) && !same(actual, change.after)) throw new Error(`Concurrent edit: ${patch.id}.${field}`);
    current[field] = change.after;
  }
  prepared.set(patch.path, JSON.stringify(current, null, 2) + '\n');
}
const catalogPath = 'src/data/catalog/destinations.json';
const queuePath = 'src/data/catalog/destination-reservations.json';
const catalog = read(catalogPath);
// Explicitly distinguish the town Cotacachi from the named Cotacachi-Cayapas reserve.
for (const destination of bundle.preResolvedDestinations) {
  const current = catalog.find(x => x.id === destination.id || x.url === destination.url);
  if (current && (current.id !== destination.id || current.name !== destination.name)) throw new Error('Destination identity changed');
  if (!current) catalog.push(destination);
}
const publishedDestinationIds = fs.readdirSync('src/content/destinations').filter(x => x.endsWith('.md')).map(filename => yaml.load(fs.readFileSync(`src/content/destinations/${filename}`, 'utf8').split('---')[1])).filter(x => x.status === 'published' || x.status === 'approved').map(x => x.id);
const reservation = reserveDestinations({ catalog, reservations: read(queuePath), countries: read('data/source-index/catalogs/countries.json').entries, publishedDestinationIds }, bundle.reservationRequests);
if (!reservation.ok) throw new Error(JSON.stringify(reservation.results));
prepared.set(catalogPath, JSON.stringify(reservation.catalog, null, 2) + '\n');
prepared.set(queuePath, JSON.stringify(reservation.reservations, null, 2) + '\n');
const mappingPath = 'docs/TOUR_EXCURSION_MAPPING_REGISTRY.md';
const mapping = fs.readFileSync(mappingPath, 'utf8');
if (mapping.includes('## Сверка очереди Анны — 2026-10-03')) throw new Error('Mapping batch already recorded');
prepared.set(mappingPath, mapping.trimEnd() + bundle.appendMapping + '\n');
for (const [p, text] of prepared) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}
execFileSync(process.execPath, ['scripts/sync-source-catalogs.mjs'], { stdio: 'inherit' });
for (const p of ['data/source-index/index.json', ...['countries', 'destinations', 'tours', 'excursions'].map(x => `data/source-index/catalogs/${x}.json`)]) prepared.set(p, fs.readFileSync(p, 'utf8'));
// Retain only the immutable checksum in the final manifest, not the expiring transfer URL.
fs.writeFileSync(manifestPath, JSON.stringify({ version: 1, applied: true, sha256: manifest.sha256, records: bundle.records, newExcursions: bundle.newExcursions, reservationResults: reservation.results }, null, 2) + '\n');
prepared.set(manifestPath, fs.readFileSync(manifestPath, 'utf8'));
fs.writeFileSync('/tmp/verified-tour-paths.txt', [...prepared.keys()].join('\n') + '\n');
console.log(JSON.stringify({ tours: bundle.records.length, excursions: bundle.newExcursions.length, destinationsReserved: reservation.results.length, changedPaths: prepared.size }, null, 2));
