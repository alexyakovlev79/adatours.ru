#!/usr/bin/env node
/** JSON in, JSON out. Preview by default; --write applies one checked batch. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';
import { reserveDestinations, syncReservationStatuses, validateDestinationReservations } from '../src/lib/destination-reservations.mjs';
import { tourPath, excursionPath } from '../src/lib/routes.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = path.join(repoRoot, 'src/data/catalog/destinations.json');
const queuePath = path.join(repoRoot, 'src/data/catalog/destination-reservations.json');
const countriesPath = path.join(repoRoot, 'data/source-index/catalogs/countries.json');
const args = process.argv.slice(2);
const write = args.includes('--write');
const sync = args.includes('--sync-status');
const exportQueue = args.includes('--export-queue');
const inputIndex = args.indexOf('--input');
const inputPath = inputIndex < 0 ? '-' : args[inputIndex + 1];
const usage = 'node scripts/reserve-destination.mjs --input request.json [--write]\nnode scripts/reserve-destination.mjs --sync-status [--write]\nnode scripts/reserve-destination.mjs --export-queue';
const output = (value) => console.log(JSON.stringify(value, null, 2));

function contentRows(collection) {
  const directory = path.join(repoRoot, 'src/content', collection);
  return fs.readdirSync(directory, { recursive: true }).filter((filename) => /\.mdx?$/.test(filename)).map((filename) => {
    const text = fs.readFileSync(path.join(directory, filename), 'utf8');
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
    if (!frontmatter) throw new Error(`Missing frontmatter: ${collection}/${filename}`);
    return parseYaml(frontmatter);
  });
}

function exportRows(catalog, queue, countries) {
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const countryById = new Map(countries.map((item) => [item.id, item]));
  const deployment = parseYaml(fs.readFileSync(path.join(repoRoot, '.github/workflows/deploy.yml'), 'utf8')).env ?? {};
  const siteOrigin = process.env.SITE_ORIGIN ?? deployment.SITE_ORIGIN;
  const siteBase = String(process.env.SITE_BASE ?? deployment.SITE_BASE ?? '/').replace(/^\/+|\/+$/g, '');
  if (!siteOrigin) throw new Error('SITE_ORIGIN is required for exact public queue links.');
  const publicUrl = (logicalPath) => new URL(`${siteBase ? `/${siteBase}` : ''}${logicalPath}`, siteOrigin).href;
  const occurrences = new Map();
  for (const [collection, entityType] of [['tours', 'tour'], ['excursions', 'excursion']]) {
    for (const item of contentRows(collection)) {
      const logicalPath = entityType === 'tour' ? tourPath(item) : excursionPath(item);
      occurrences.set(item.id, { entityType, entityId: item.id, title: item.title, url: publicUrl(logicalPath), path: logicalPath });
    }
  }
  return queue.entries.map((item) => {
    const place = byId.get(item.id);
    const grouped = new Map();
    for (const discovery of item.discoveredIn) {
      const key = `${discovery.entityType}:${discovery.entityId ?? discovery.sourceUrl ?? discovery.evidence}`;
      const occurrence = discovery.entityType === 'user_request'
        ? { entityType: 'user_request', title: 'Прямая заявка пользователя', ...(discovery.sourceUrl ? { url: discovery.sourceUrl } : {}) }
        : occurrences.get(discovery.entityId);
      if (!occurrence) throw new Error(`Discovery has no local source entity: ${discovery.entityId}`);
      const previous = grouped.get(key);
      if (previous) previous.evidence += ` ${discovery.evidence}`;
      else grouped.set(key, { ...occurrence, sourceUrl: discovery.sourceUrl, evidence: discovery.evidence });
    }
    return { id: item.id, name: place.name, countryId: place.countryId, countryName: countryById.get(place.countryId)?.name ?? place.countryId,
      futureUrl: publicUrl(place.url), futurePath: place.url, status: item.status === 'added' ? 'Добавлено' : 'Нужен контент',
      contentRequirements: 'Описание самого места и минимум 1 фото с подтвержденным источником.',
      materials: item.materials ?? {}, notes: item.notes ?? '',
      occurrences: [...grouped.values()] };
  }).sort((a, b) => a.countryName.localeCompare(b.countryName, 'ru') || a.name.localeCompare(b.name, 'ru'));
}

// Readers see complete JSON files. The lock prevents two CLI writers; checked
// before/after bytes and rollback protect against partial or concurrent edits.
function commitFiles(changes) {
  const staged = changes.map((item) => ({ ...item, temp: `${item.filename}.reserve-${process.pid}.tmp` }));
  const committed = [];
  try {
    for (const item of staged) {
      if (fs.readFileSync(item.filename, 'utf8') !== item.before) throw new Error(`Concurrent edit: ${item.filename}`);
      fs.writeFileSync(item.temp, item.after, { flag: 'wx' });
    }
    for (const item of staged) {
      if (fs.readFileSync(item.filename, 'utf8') !== item.before) throw new Error(`Concurrent edit: ${item.filename}`);
      fs.renameSync(item.temp, item.filename);
      committed.push(item);
    }
  } catch (error) {
    for (const item of committed.reverse()) fs.writeFileSync(item.filename, item.before);
    throw error;
  } finally {
    for (const item of staged) fs.rmSync(item.temp, { force: true });
  }
}

let lock;
const lockPath = path.join(repoRoot, 'src/data/catalog/.destination-reservation.lock');
try {
  if (args.includes('--help')) { console.log(usage); process.exit(0); }
  const recognized = new Set(['--write', '--sync-status', '--export-queue', '--input']);
  for (let i = 0; i < args.length; i++) {
    if (!recognized.has(args[i])) throw new Error(`Unknown argument: ${args[i]}\n${usage}`);
    if (args[i] === '--input') i++;
  }
  if (!inputPath || ((sync || exportQueue) && inputIndex >= 0) || (sync && exportQueue) || (exportQueue && write)) throw new Error(usage);
  if (write) lock = fs.openSync(lockPath, 'wx');
  const catalogText = fs.readFileSync(catalogPath, 'utf8');
  const queueText = fs.readFileSync(queuePath, 'utf8');
  const catalog = JSON.parse(catalogText);
  const reservations = JSON.parse(queueText);
  const countries = JSON.parse(fs.readFileSync(countriesPath, 'utf8')).entries;
  const publishedDestinationIds = contentRows('destinations').filter((item) => !['draft', 'archived'].includes(item.status)).map((item) => item.id);
  if (exportQueue) {
    const currentQueue = syncReservationStatuses(reservations, publishedDestinationIds);
    const errors = validateDestinationReservations(catalog, currentQueue, { countries, publishedDestinationIds });
    if (errors.length) throw new Error(errors.join('\n'));
    output({ version: 1, entries: exportRows(catalog, currentQueue, countries) });
  } else {
    let result;
    if (sync) {
      const updated = syncReservationStatuses(reservations, publishedDestinationIds);
      const errors = validateDestinationReservations(catalog, updated, { countries, publishedDestinationIds });
      result = { ok: !errors.length, changed: JSON.stringify(updated) !== JSON.stringify(reservations), catalog, reservations: updated, results: errors.length ? [{ outcome: 'invalid', errors }] : [] };
    } else {
      const input = JSON.parse(fs.readFileSync(inputPath === '-' ? 0 : path.resolve(inputPath), 'utf8'));
      result = reserveDestinations({ catalog, reservations, countries, publishedDestinationIds }, input);
    }
    if (result.ok && result.changed && write) {
      const changes = [
        { filename: catalogPath, before: catalogText, after: `${JSON.stringify(result.catalog, null, 2)}\n` },
        { filename: queuePath, before: queueText, after: `${JSON.stringify(result.reservations, null, 2)}\n` },
      ].filter((item) => item.before !== item.after);
      commitFiles(changes);
    }
    output({ ok: result.ok, changed: result.changed, written: Boolean(result.ok && result.changed && write), results: result.results });
    if (!result.ok) process.exitCode = 2;
  }
} catch (error) {
  output({ ok: false, changed: false, written: false, error: error.message });
  process.exitCode = 2;
} finally {
  if (lock !== undefined) { fs.closeSync(lock); fs.rmSync(lockPath, { force: true }); }
}
