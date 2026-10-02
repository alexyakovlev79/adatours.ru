/**
 * Rebuild compact lookup catalogs from prepared source entries, offline.
 * Run only after adding/changing a source entry. Known-page publication does
 * not need this command. This script never changes content, photos or sources.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPath } from '../src/lib/routes.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(repoRoot, 'data', 'source-index');
const collections = { country: 'countries', destination: 'destinations', tour: 'tours', excursion: 'excursions' };
const compactKeys = ['id', 'type', 'name', 'url', 'slug', 'contentPath', 'countryIds', 'destinationIds', 'sourceUrl'];
const files = fs.readdirSync(path.join(sourceRoot, 'entries')).filter(name => name.endsWith('.json')).sort();
const records = files.map(filename => {
  const record = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'entries', filename), 'utf8'));
  if (filename !== `${record.id}.json` || !collections[record.type]) throw new Error(`Invalid source entry: ${filename}`);
  for (const key of compactKeys) {
    if (!(key in record)) throw new Error(`Missing ${key}: ${filename}`);
  }
  return record;
});
records.sort((a, b) => (a.sheet?.row ?? Number.MAX_SAFE_INTEGER) - (b.sheet?.row ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id));
const seenIds = new Set();
const seenUrls = new Set();
for (const record of records) {
  const canonical = canonicalPath(record);
  if (record.url !== canonical) throw new Error(`Non-canonical source URL for ${record.id}: expected ${canonical}. Update the exact entry first.`);
  if (seenIds.has(record.id) || seenUrls.has(record.url)) throw new Error(`Duplicate entity ID or site URL: ${record.id}`);
  seenIds.add(record.id);
  seenUrls.add(record.url);
}

const entries = records.map(record => {
  const compact = Object.fromEntries(compactKeys.map(key => [key, record[key]]));
  compact.entryPath = `data/source-index/entries/${record.id}.json`;
  for (const key of ['aliases', 'routeCountryIds', 'routeDestinationIds', 'relatedDestinationIds', 'legacyUrls']) {
    if (record[key]?.length) compact[key] = record[key];
  }
  return compact;
});
const indexPath = path.join(sourceRoot, 'index.json');
const previous = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const metadata = { ...previous.metadata, entityCount: entries.length };
const counts = { types: {}, media: {}, rawDonorUrls: 0 };
const donorUrls = new Set();
for (const record of records) {
  counts.types[record.type] = (counts.types[record.type] ?? 0) + 1;
  counts.media[record.media.status] = (counts.media[record.media.status] ?? 0) + 1;
  if (record.sourceUrl) {
    const sourceUrl = new URL(record.sourceUrl);
    sourceUrl.protocol = 'https:';
    sourceUrl.hostname = sourceUrl.hostname.replace(/^www\./, '');
    sourceUrl.hash = '';
    sourceUrl.pathname = sourceUrl.pathname.replace(/\/+$/, '') || '/';
    donorUrls.add(sourceUrl.href);
  }
}
counts.rawDonorUrls = donorUrls.size;
metadata.counts = counts;
const write = (filename, value) => {
  const target = path.join(sourceRoot, filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value)}\n`);
};
write('index.json', { metadata, entries });
for (const [type, collection] of Object.entries(collections)) {
  write(`catalogs/${collection}.json`, {
    preparedAt: metadata.preparedAt,
    entries: entries.filter(record => record.type === type),
  });
}
console.log(JSON.stringify({ entries: entries.length, catalogs: 4, networkRequests: 0, counts }, null, 2));
