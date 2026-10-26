/** Read-only build gate: active RU entities and canonical page-1 catalogues are registered.
 * Coverage is registration, not proof of article writing, publication or Sheets sync.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isActiveEntity } from '../src/lib/archive.mjs';
import { canonicalPath } from '../src/lib/routes.ts';
import { buildSeoGeoCanonicalPaths } from '../src/lib/seo-geo-route-inventory.mjs';
import { PHASE_FILES, readCatalogContent } from './sync-multi-country-registries.mjs';

const TYPES = {
  countries: { type: 'country', kind: 'country', phase: 1 },
  themes: { type: 'theme', kind: 'interest', phase: 2 },
  tours: { type: 'tour', kind: 'tour', phase: 5 },
  destinations: { type: 'destination', kind: 'destination', phase: 6 },
  excursions: { type: 'excursion', kind: 'excursion', phase: 7 },
};
const WORK = new Set(['queued', 'draft', 'prepared', 'published', 'rewritten', 'paused']);
const UNAVAILABLE = new Set(['archived', 'temporarily_unavailable', 'missing', 'waiting_for_page', 'needs_content']);
const dataOf = (entry) => entry?.data ?? entry;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function runtimeCanonicalPath(type, data) {
  return canonicalPath({ type, id: data.id, slug: data.slug,
    countryIds: type === 'destination' ? [data.countryId]
      : type === 'excursion' ? [data.country] : type === 'tour' ? data.countries : undefined,
    routeCountryIds: type === 'tour' ? data.routeCountries : undefined,
    destinationIds: type === 'excursion' && data.destination ? [data.destination] : undefined });
}

export function verifyRuntimeSeoCoverage(input = {}) {
  const { content, phases, destinationCatalog } = object(input) ? input : {};
  const errors = [], active = [], records = [];
  if (!object(content)) return { ok: false, activeEntities: 0, errors: ['Missing runtime content collections'] };
  for (const [collection, contract] of Object.entries(TYPES)) {
    if (!Array.isArray(content[collection])) { errors.push(`Missing content collection: ${collection}`); continue; }
    for (const item of content[collection]) {
      const data = dataOf(item);
      if (!object(data)) { errors.push(`Malformed runtime entry in ${collection}`); continue; }
      if (typeof data.locale !== 'string' || typeof data.status !== 'string') {
        errors.push(`Runtime entry in ${collection} must declare locale and status`); continue;
      }
      if (data.locale !== 'ru' || !isActiveEntity(data)) continue;
      if (typeof data.id !== 'string' || !data.id.trim()) {
        errors.push(`Active ${contract.type} has no stable ID`); continue;
      }
      if (typeof data.slug !== 'string' || !data.slug) {
        errors.push(`${data.id}: active entity has no canonical slug`); continue;
      }
      try { active.push({ ...contract, id: data.id, url: runtimeCanonicalPath(contract.type, data) }); }
      catch (error) { errors.push(`${data.id}: cannot derive canonical URL: ${error.message}`); }
    }
  }
  if (!Array.isArray(phases)) errors.push('Missing SEO registry phases');
  else for (const phase of phases) {
    if (!object(phase) || !Number.isInteger(phase.phase) || !Array.isArray(phase.entries)) {
      errors.push('Malformed SEO registry phase'); continue;
    }
    for (const row of phase.entries) {
      if (!object(row) || typeof row.url !== 'string' || !row.url.startsWith('/')) {
        errors.push(`Malformed SEO registry row in phase ${phase.phase}`); continue;
      }
      records.push({ row, containerPhase: phase.phase });
    }
  }
  const byUrl = new Map(), byId = new Map(), activeIds = new Set(), activeUrls = new Set();
  for (const record of records) {
    const { row } = record;
    byUrl.set(row.url, [...(byUrl.get(row.url) ?? []), record]);
    if (row.id) byId.set(row.id, [...(byId.get(row.id) ?? []), record]);
  }
  let covered = 0;
  for (const entity of active) {
    if (activeIds.has(entity.id)) errors.push(`Duplicate active runtime ID: ${entity.id}`);
    if (activeUrls.has(entity.url)) errors.push(`Duplicate active runtime canonical URL: ${entity.url}`);
    activeIds.add(entity.id); activeUrls.add(entity.url);
    const matches = byUrl.get(entity.url) ?? [];
    // Canonical changes retain an explicitly unavailable historical row. It is
    // not a second active writing target; an unmarked duplicate still fails.
    const identities = (byId.get(entity.id) ?? []).filter(({ row }) => row.url === entity.url
      || !(['archived', 'temporarily_unavailable'].includes(row.work) && UNAVAILABLE.has(row.availability)));
    if (matches.length !== 1) {
      errors.push(`${entity.id}: expected exactly one SEO row at ${entity.url}; found ${matches.length}`);
      continue;
    }
    const { row, containerPhase } = matches[0];
    const before = errors.length;
    if (row.id !== entity.id) errors.push(`${entity.url}: SEO stable ID must be ${entity.id}; found ${row.id ?? '(missing)'}`);
    if (identities.length !== 1 || identities[0]?.row.url !== entity.url) {
      errors.push(`${entity.id}: identity must resolve only to its canonical SEO row ${entity.url}`);
    }
    if (row.kind !== entity.kind) errors.push(`${entity.id}: SEO kind must be ${entity.kind}; found ${row.kind}`);
    if (row.phase !== entity.phase || containerPhase !== entity.phase) {
      errors.push(`${entity.id}: SEO phase must be ${entity.phase}, including its containing file`);
    }
    if (!WORK.has(row.work)) errors.push(`${entity.id}: active page has invalid/unavailable SEO work ${row.work}`);
    if (typeof row.availability !== 'string' || !row.availability || UNAVAILABLE.has(row.availability)) {
      errors.push(`${entity.id}: active page has missing/unavailable availability ${row.availability}`);
    }
    if (before === errors.length) covered += 1;
  }
  let canonicalPages = 0, cataloguePages = 0, cataloguesCovered = 0;
  if (!Array.isArray(destinationCatalog)) errors.push('Missing canonical destination catalogue');
  else if (Object.keys(TYPES).every((collection) => Array.isArray(content[collection]))) {
    try {
      // This is the same active/archive and selector-based inventory used by
      // profile checks. It excludes pagination, aliases and special B2B pages.
      const paths = buildSeoGeoCanonicalPaths({ ...content, destinationCatalog });
      canonicalPages = paths.size;
      for (const url of paths) {
        if (activeUrls.has(url)) continue;
        cataloguePages += 1;
        const matches = byUrl.get(url) ?? [];
        if (matches.length !== 1) {
          errors.push(`Catalogue ${url}: expected exactly one canonical SEO row; found ${matches.length}`); continue;
        }
        const { row, containerPhase } = matches[0], before = errors.length;
        if (typeof row.kind !== 'string' || !row.kind || row.phase !== containerPhase) {
          errors.push(`Catalogue ${url}: missing kind or inconsistent phase`);
        }
        if (!WORK.has(row.work)) errors.push(`Catalogue ${url}: active page has invalid/unavailable SEO work ${row.work}`);
        if (typeof row.availability !== 'string' || !row.availability || UNAVAILABLE.has(row.availability)) {
          errors.push(`Catalogue ${url}: active page has missing/unavailable availability ${row.availability}`);
        }
        if (before === errors.length) cataloguesCovered += 1;
      }
    } catch (error) { errors.push(`Cannot derive canonical page-1 catalogue inventory: ${error.message}`); }
  }
  return { ok: errors.length === 0, activeEntities: active.length, covered,
    byType: Object.fromEntries(Object.values(TYPES).map(({ type }) => [type, active.filter((row) => row.type === type).length])),
    canonicalPages, cataloguePages, cataloguesCovered, errors };
}

export async function checkRuntimeSeoCoverage({ root = process.cwd() } = {}) {
  try {
    const content = await readCatalogContent(root);
    const phases = PHASE_FILES.map((file) => JSON.parse(readFileSync(join(root, 'data/seo-geo/registry', file), 'utf8')));
    const destinationCatalog = JSON.parse(readFileSync(join(root, 'src/data/catalog/destinations.json'), 'utf8'));
    return verifyRuntimeSeoCoverage({ content, phases, destinationCatalog });
  } catch (error) { return { ok: false, activeEntities: 0, errors: [error.message] }; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await checkRuntimeSeoCoverage();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
