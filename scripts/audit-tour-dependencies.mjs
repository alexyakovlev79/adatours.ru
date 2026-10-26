#!/usr/bin/env node
/** Read-only, offline evidence for a scoped Word import. Never repairs, generates or publishes. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { isActiveEntity, activeReplacementId } from '../src/lib/archive.mjs';
import { canonicalPath, tourExcursionPath, excursionDestinationPath } from '../src/lib/routes.ts';
import { excursionDestinationIds } from '../src/lib/destination-links.mjs';
import { paginateCatalog } from '../src/lib/catalog-pagination.ts';
import { isDestinationType, isNavigationRole } from '../src/lib/destination-taxonomy.mjs';
import { createMobileHeroSelector } from '../src/lib/mobile-hero-registry.mjs';
import { buildMultiCountryCatalog } from '../src/lib/multi-country-catalog.mjs';
import { validateDestinationProjection } from './lib/destination-projection.mjs';
import { compactCatalogById } from './lib/compact-catalog-map.mjs';
import { validateDirectAssetLedger } from './lib/direct-media-ledger.mjs';
import { digest } from './schema-geo-core.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const LEGACY_CUTOFF = 'b09b6ba01316e888e871eac399d98eb9915d2bf7';
const unique = (rows = []) => [...new Set(rows)];
const sorted = (rows = []) => unique(rows).sort();
const sha256 = text => createHash('sha256').update(text).digest('hex');
const blobSha = (text) => {
  const bytes = Buffer.from(text);
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};
const issue = (code, entityId, detail) => ({ code, entityId, detail });
const refsOf = (tour) => unique((tour.itinerary ?? []).flatMap((day) => [day.excursionRef,
  ...(day.contentBlocks ?? []).filter((block) => block.type === 'excursion').map((block) => block.excursionRef)])
  .filter(Boolean).map((id) => activeReplacementId(id)).filter(Boolean));

/** Standalone canonical cards immediately after a numbered day belong to that programme block. */
export function programmeExcursionCoverage(tour) {
  const days = [], unassignedRefs = [];
  let current;
  for (const item of tour.itinerary ?? []) {
    if (Number.isInteger(item.day) && item.day > 0) {
      current = { day: item.day, title: item.title ?? '', excursionIds: [],
        textualCandidate: /экскурси|обзорн|посещени/iu.test([item.title, item.text,
          ...(item.subsections ?? []).map((row) => row.text)].filter(Boolean).join(' ')) };
      days.push(current);
    }
    const refs = refsOf({ itinerary: [item] });
    if (current) current.excursionIds = unique([...current.excursionIds, ...refs]);
    else unassignedRefs.push(...refs);
  }
  return { days, unassignedRefs: unique(unassignedRefs) };
}

/** Derive affected catalogue usages from the same membership and pagination models as Astro. */
export function catalogHeroUsagesForTour({ tourId, excursions = [], allExcursions = excursions,
  destinationCatalog = [], allTours = [], multiCountryRows = [],
  affectedCatalogPaths = [], countries = [], catalogOverrides = {}, combinationCovers = {} }) {
  const usages = [], imageFree = [], catalogs = [], warnings = [], data = row => row?.data ?? row;
  const emit = (entityId, pagePath, source, profile, basis) => {
    if (!source) {
      warnings.push({ code: 'CATALOG_HERO_SOURCE_UNRESOLVED', entityId, pagePath, basis,
        note: 'No exact hero can be proved from the current model; inspect rendered HTML before completing this usage' });
      return;
    }
    usages.push({ entityId, pagePath, source: logicalSource(source), profile, kind: 'catalog', basis });
  };
  const activeTours = allTours.map(data).filter(row => row?.locale === 'ru' && isActiveEntity(row));
  for (const excursion of excursions.map(data).filter(Boolean)) {
    if (!isActiveEntity(excursion)) continue;
    const related = activeTours.filter(tour => refsOf(tour).includes(excursion.id));
    if (!related.some(tour => tour.id === tourId)) continue;
    const rootPath = tourExcursionPath(excursion);
    catalogs.push({ entityId: 'excursion_tours:' + excursion.id, url: rootPath, kind: 'excursion_tours',
      excursionId: excursion.id, memberIds: related.map(tour => tour.id) });
    for (const { pagination } of paginateCatalog(related, rootPath)) {
      const pagePath = pagination.canonical;
      emit('excursion_tours:' + excursion.id, pagePath,
        catalogOverrides[pagePath]?.src ?? '/media/catalog/tury/hero-enhanced-20260930.webp', 'compact',
        'src/pages/[...path].astro excursion reverse relation + EntityCatalogLayout canonical override');
    }
  }
  const places = new Map(destinationCatalog.map(data).map(row => [row.id, row]));
  const affectedPlaces = unique(excursions.map(data).filter(row => row && isActiveEntity(row)).flatMap(excursionDestinationIds));
  const activeExcursions = allExcursions.map(data).filter(row => row?.locale === 'ru' && isActiveEntity(row));
  for (const id of affectedPlaces) {
    const place = places.get(id);
    if (!place) continue; // Missing destination identity is reported by the relation gate.
    const related = activeExcursions.filter(excursion => excursionDestinationIds(excursion).includes(id));
    if (!related.length) continue;
    const rootPath = excursionDestinationPath(place), entityId = 'destination_excursions:' + id;
    catalogs.push({ entityId, url: rootPath, kind: 'destination_excursions', destinationId: id,
      memberIds: related.map(excursion => excursion.id) });
    for (const { pagination } of paginateCatalog(related, rootPath)) {
      const pagePath = pagination.canonical, source = catalogOverrides[pagePath]?.src;
      const basis = 'src/pages/[...path].astro destination excursion catalogue: no default photograph; EntityCatalogLayout exact canonical override only';
      if (source) emit(entityId, pagePath, source, 'compact', basis);
      else imageFree.push({ entityId, pagePath, kind: 'catalog', profile: 'compact', status: 'not_applicable_no_image', basis });
    }
  }
  const affected = new Set(affectedCatalogPaths);
  const fallbackBrazil = countries.map(data).find(row => row.id === 'country_brazil')?.hero?.src;
  for (const row of multiCountryRows.filter(row => affected.has(row.path))) {
    const tours = row.tours.map(data), pages = paginateCatalog(tours, row.path);
    catalogs.push({ entityId: row.id, url: row.path, kind: row.kind ?? 'multi_country_catalog', memberIds: tours.map(tour => tour.id) });
    for (const { entries, pagination } of pages) {
      const pagePath = pagination.canonical;
      if (row.path !== '/multi-country/') {
        emit(row.id, pagePath, combinationCovers[row.key]?.src ?? row.theme?.hero?.src ?? tours[0]?.hero?.src,
          'compact', 'src/pages/multi-country/[...selection].astro: combination override, Theme, first ranked Tour');
      } else if (pagination.currentPage === 1) {
        emit(row.id, pagePath, tours[pagination.to]?.hero?.src ?? fallbackBrazil, 'standard',
          'src/pages/multi-country/index.astro: first off-page Tour or Brazil fallback');
      } else {
        const pageImages = new Set(entries.map(tour => tour.hero?.src).filter(Boolean));
        const cover = [...tours.slice(pagination.to), ...tours.slice(0, pagination.offset)]
          .find(tour => tour.hero?.src && !pageImages.has(tour.hero.src));
        // Astro itself requires an off-page photograph before applying layout overrides.
        if (!cover) {
          warnings.push({ code: 'CATALOG_HERO_SOURCE_UNRESOLVED', entityId: row.id, pagePath,
            note: 'Multi-country pagination has no off-page photograph; the current Astro route would reject this page' });
          continue;
        }
        emit(row.id, pagePath, catalogOverrides[pagePath]?.src ?? cover.hero.src, 'compact',
          'src/pages/multi-country/page/[page].astro: off-page Tour + EntityCatalogLayout canonical override');
      }
    }
  }
  return { usages, imageFree, catalogs, warnings };
}

/** New derived URLs need both editorial stages in this Word job; old queued URLs retain their own queue. */
export function auditScopedCatalogSeo(catalogs, baseline, seoByUrl, articleForRow) {
  const blockers = [], rows = [];
  if (!baseline?.available) blockers.push(issue('CATALOG_BASELINE_UNAVAILABLE', null,
    { ref: baseline?.ref ?? null, reason: baseline?.error ?? 'No verified pre-import catalogue snapshot' }));
  for (const catalog of catalogs) {
    const row = seoByUrl.get(catalog.url), raw = articleForRow(row);
    const isNew = baseline?.available ? !baseline.paths.has(catalog.url) : null;
    if (!row) blockers.push(issue('CATALOG_SEO_REGISTRATION_MISSING', catalog.entityId, catalog.url));
    if (isNew && !raw) blockers.push(issue('SEO_NEW_CATALOG_ARTICLE_MISSING', catalog.entityId, catalog.url));
    else if (isNew && row?.work !== 'rewritten') blockers.push(issue('SEO_NEW_CATALOG_SECOND_STAGE_PENDING', catalog.entityId,
      { url: catalog.url, work: row?.work ?? 'unregistered' }));
    rows.push({ ...catalog, newInWordJob: isNew, seoWork: row?.work ?? 'unregistered',
      articlePath: row?.articlePath ?? null, articleBlobSha: raw ? blobSha(raw) : null,
      editorialScope: isNew === null ? 'unknown_baseline_unavailable' : isNew ? 'required_in_current_word_job' : 'existing_catalogue_queue' });
  }
  return { rows, blockers };
}

function baselineCatalogs(root, ref, excursionIds) {
  try {
    if (!/^(?:HEAD|[a-f0-9]{40})$/.test(ref)) throw new Error('Expected HEAD or a full pre-import commit SHA');
    const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 24 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' } });
    const commit = git(['rev-parse', '--verify', ref + '^{commit}']).trim();
    const read = file => JSON.parse(git(['show', commit + ':' + file]));
    const oldExcursions = read('data/source-index/catalogs/excursions.json').entries;
    const oldDestinations = new Map(read('src/data/catalog/destinations.json').map(row => [row.id, row]));
    const paths = new Set(read('data/catalogues/multi-country.json').catalogs.map(row => row.path));
    for (const excursion of oldExcursions.filter(isActiveEntity)) {
      for (const id of [...(excursion.destinationIds ?? []), ...(excursion.relatedDestinationIds ?? [])]) {
        const place = oldDestinations.get(id);
        if (place?.countrySlug && place.slug) paths.add('/' + place.countrySlug + '/' + place.slug + '/');
      }
    }
    let matches = '';
    if (excursionIds.length) {
      try { matches = git(['grep', '-l', '-F', ...excursionIds.flatMap(id => ['-e', id]), commit, '--', 'src/content/tours']); }
      catch (error) { if (error.status !== 1) throw error; }
    }
    const previouslyLinked = new Set();
    for (const match of matches.trim().split('\n').filter(Boolean)) {
      const raw = git(['show', match]);
      const front = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      if (!front) throw new Error('Baseline Tour frontmatter missing: ' + match);
      const tour = yaml.load(front[1]);
      if (tour.locale === 'ru' && isActiveEntity(tour)) for (const id of refsOf(tour)) previouslyLinked.add(id);
    }
    for (const excursion of oldExcursions.filter(isActiveEntity)) if (previouslyLinked.has(excursion.id)) paths.add(excursion.url + 'tour/');
    return { available: true, ref, commit, paths };
  } catch (error) {
    return { available: false, ref, paths: new Set(), error: String(error.message).slice(0, 600) };
  }
}

/** Only a reviewed, byte-bound Word variant can omit a canonical excursion place. */
export function verifyExcursionVariantReviews({ tour, tourSourceBlobSha, excursions, receipt, sourceSnapshotSha256 }) {
  const approvedExclusions = new Map(), evidence = [], blockers = [];
  if (!receipt) return { approvedExclusions, evidence, blockers };
  const fail = (id, reason) => blockers.push(issue('EXCURSION_VARIANT_REVIEW_INVALID', id, reason));
  if (receipt.tourId !== tour.id || receipt.tourMdBlobSha !== tourSourceBlobSha
    || !/^[a-f0-9]{64}$/.test(receipt.sourceSnapshotSha256 ?? '')
    || receipt.sourceSnapshotSha256 !== sourceSnapshotSha256 || !Array.isArray(receipt.resolved)) {
    fail(tour.id, 'Review must match the current Tour blob and exact Word snapshot');
    return { approvedExclusions, evidence, blockers };
  }
  const reviewedIds = new Set();
  for (const review of receipt.resolved.filter(row => Array.isArray(row.excludedDestinationIds) && row.excludedDestinationIds.length)) {
    const id = review.excursionId, record = excursions.get(id), excluded = review.excludedDestinationIds;
    const uses = (tour.itinerary ?? []).flatMap(day => [
      ...(day.excursionRef === id ? [{ day: day.day, text: null }] : []),
      ...(day.contentBlocks ?? []).filter(block => block.type === 'excursion' && block.excursionRef === id)
        .map(block => ({ day: day.day, text: block.text })),
    ]);
    const missing = record ? excursionDestinationIds(record.data).filter(placeId => !(tour.destinations ?? []).includes(placeId)) : [];
    const valid = !reviewedIds.has(id) && record && review.status === 'resolved'
      && review.kind === 'existing_with_word_variant' && review.reviewedAgainstWord === true
      && review.excursionMdBlobSha === record.sourceBlobSha && review.source === receipt.sourceSnapshotPath
      && Number.isInteger(review.sourceDay) && review.sourceDay > 0 && Boolean(review.exclusionReason?.trim())
      && uses.length > 0 && uses.every(use => use.day === review.sourceDay && typeof use.text === 'string'
        && use.text.trim() && sha256(use.text) === review.wordOverrideSha256)
      && excluded.length === unique(excluded).length && isDeepStrictEqual(sorted(excluded), sorted(missing));
    reviewedIds.add(id);
    if (!valid) { fail(id, 'Exact canonical Excursion blob, Word override and complete explicit omitted-place set are required'); continue; }
    approvedExclusions.set(id, new Set(excluded));
    evidence.push({ excursionId: id, sourceDay: review.sourceDay, excursionMdBlobSha: review.excursionMdBlobSha,
      wordOverrideSha256: review.wordOverrideSha256, excludedDestinationIds: excluded, reason: review.exclusionReason });
  }
  return { approvedExclusions, evidence, blockers };
}

/** A lost excursion/place edge is an error even when all entities exist separately. */
export function auditTourGraph({ tour, entry, compact, url, destinations, excursions, interests, variantExclusions = new Map() }) {
  const blockers = [];
  const primary = tour.primaryThemes ?? [], secondary = tour.themes ?? [];
  const knownInterests = new Set(interests.map((row) => row.id));
  if (primary.length < 1 || primary.length > 2) blockers.push(issue('PRIMARY_THEMES_INVALID', tour.id, 'Expected 1–2 primary interests'));
  if (unique([...primary, ...secondary]).length !== primary.length + secondary.length) blockers.push(issue('THEMES_OVERLAP', tour.id, [...primary, ...secondary]));
  for (const id of [...primary, ...secondary]) if (!knownInterests.has(id)) blockers.push(issue('UNKNOWN_INTEREST', tour.id, id));
  for (const [label, source] of [['entry', entry], ['compact', compact]]) {
    if (!source) { blockers.push(issue('SOURCE_RECORD_MISSING', tour.id, label)); continue; }
    const fields = { id: tour.id, type: 'tour', slug: tour.slug, url,
      primaryThemes: primary, themes: secondary, countryIds: tour.countries, destinationIds: tour.destinations,
      routeCountryIds: tour.routeCountries, routeDestinationIds: tour.routeDestinations };
    for (const [field, expected] of Object.entries(fields)) if (!isDeepStrictEqual(source[field], expected)) {
      blockers.push(issue('TOUR_SOURCE_DRIFT', tour.id, `${label}.${field}`));
    }
  }
  for (const field of ['countries', 'destinations', 'routeCountries', 'routeDestinations']) {
    if (unique(tour[field]).length !== (tour[field] ?? []).length) blockers.push(issue('DUPLICATE_RELATION', tour.id, field));
  }
  for (const [field, parent] of [['routeCountries', 'countries'], ['routeDestinations', 'destinations']]) {
    for (const id of tour[field] ?? []) if (!(tour[parent] ?? []).includes(id)) blockers.push(issue('MAIN_ROUTE_NOT_IN_FULL_GEOGRAPHY', tour.id, `${field}:${id}`));
  }
  for (const id of tour.destinations ?? []) {
    const place = destinations.get(id);
    if (!place) { blockers.push(issue('DESTINATION_MISSING', tour.id, id)); continue; }
    if (!(tour.countries ?? []).includes(place.countryId)) blockers.push(issue('PLACE_COUNTRY_NOT_IN_TOUR', tour.id, id));
    if (!isDestinationType(place.destinationType) || !isNavigationRole(place.navigationRole)) blockers.push(issue('DESTINATION_TAXONOMY_INVALID', id, { destinationType: place.destinationType, navigationRole: place.navigationRole }));
  }
  const excursionIds = refsOf(tour);
  for (const id of excursionIds) {
    const excursion = excursions.get(id);
    if (!excursion || !isActiveEntity(excursion)) { blockers.push(issue('EXCURSION_MISSING', tour.id, id)); continue; }
    for (const placeId of unique([excursion.destination, ...(excursion.relatedDestinations ?? [])].filter(Boolean))) {
      if (!(tour.destinations ?? []).includes(placeId) && !variantExclusions.get(id)?.has(placeId)) blockers.push(issue('EXCURSION_PLACE_NOT_IN_TOUR', tour.id, { excursionId: id, destinationId: placeId }));
    }
    if (!(tour.countries ?? []).includes(excursion.country)) blockers.push(issue('EXCURSION_COUNTRY_NOT_IN_TOUR', tour.id, id));
  }
  return { excursionIds, blockers };
}

function logicalSource(value) {
  if (typeof value !== 'string') return value;
  try {
    const parsed = new URL(value, 'https://adatours.ru');
    if (['adatours.ru', 'www.adatours.ru', 'img.adatours.ru'].includes(parsed.hostname) && parsed.pathname.startsWith('/media/')) return parsed.pathname;
  } catch {}
  return value;
}

/** A historical conversion may sit between the original and its completed GPT edit. */
export function resolveGptImageEvidence(source, enhancements) {
  const current = logicalSource(source);
  const completed = enhancements.filter((row) => row.method === 'gpt-image' && logicalSource(row.enhanced) === current).at(-1);
  if (completed) return { status: 'confirmed', record: completed, chain: [] };
  const outgoing = new Map();
  for (const row of enhancements) {
    if (!row.source || !row.enhanced) continue;
    const key = logicalSource(row.source);
    outgoing.set(key, [...(outgoing.get(key) ?? []), row]);
  }
  const queue = [{ source: current, chain: [] }], visited = new Set([current]);
  for (let index = 0; index < queue.length; index++) {
    const step = queue[index];
    for (const row of [...(outgoing.get(step.source) ?? [])].reverse()) {
      const next = logicalSource(row.enhanced);
      if (visited.has(next)) continue;
      const chain = [...step.chain, { source: logicalSource(row.source), enhanced: next, method: row.method ?? null }];
      if (row.method === 'gpt-image') return { status: 'reuse_available', record: row, chain };
      visited.add(next);
      queue.push({ source: next, chain });
    }
  }
  return { status: 'enhancement_required', chain: [] };
}

function collectMedia(records) {
  const media = new Map();
  const add = (record, slot, value) => {
    const source = logicalSource(value);
    if (!source || typeof source !== 'string') return;
    const row = media.get(source) ?? { source, slots: [] };
    row.slots.push({ entityId: record.data.id, slot });
    media.set(source, row);
  };
  const walk = (record, value, slot) => {
    if (Array.isArray(value)) return value.forEach((item, i) => walk(record, item, `${slot}[${i}]`));
    if (typeof value === 'string') { if (['hero', 'image'].includes(slot.split('.').at(-1))) add(record, slot, value); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      // A referenced day renders the canonical excursion hero instead of local images.
      if (value.excursionRef && ['src', 'image', 'images'].includes(key)) continue;
      if (['src', 'image'].includes(key) && typeof child === 'string') add(record, `${slot}.${key}`, child);
      else walk(record, child, slot ? `${slot}.${key}` : key);
    }
  };
  for (const record of records) {
    for (const key of ['hero', 'gallery', 'featureBands', 'highlights', 'itinerary']) walk(record, record.data[key], key);
    let index = 0;
    for (const match of record.body.matchAll(/!\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)) add(record, `body.image[${index++}]`, match[1]);
  }
  return [...media.values()];
}

/** Git metadata only, with lazy network fetching explicitly disabled. */
function gitTree(root, ref) {
  try {
    const raw = execFileSync('git', ['ls-tree', '-r', '-z', ref, '--', 'public/media'], {
      cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    return new Map(raw.split('\0').filter(Boolean).map((line) => {
      const [meta, filename] = line.split('\t');
      return [filename.slice('public'.length), meta.split(' ')[2]];
    }));
  } catch { return null; }
}

function articleLinks(raw) {
  const links = new Set();
  for (const match of raw.matchAll(/(?:\]\(|\bhref=["'])([^\s)"'>]+)|\bhttps:\/\/adatours\.ru\/[^\s)"'<>]+/g)) {
    try {
      const target = new URL(match[1] ?? match[0], 'https://adatours.ru');
      if (['adatours.ru', 'www.adatours.ru'].includes(target.hostname)) links.add(target.pathname);
    } catch {}
  }
  return links;
}

export function auditTourDependencies({ tourId, repoRoot = ROOT, changedEntityIds = [], baselineRef = 'HEAD', excursionReview } = {}) {
  if (!/^tour_[a-z0-9_]+$/.test(tourId ?? '')) throw new Error('A canonical --tour-id is required');
  const root = path.resolve(repoRoot), blockers = [], warnings = [];
  const local = (relative) => {
    const full = path.resolve(root, relative);
    if (!full.startsWith(root + path.sep)) throw new Error(`Path outside repository: ${relative}`);
    return full;
  };
  const json = (relative, fallback) => {
    const filename = local(relative);
    if (!fs.existsSync(filename) && fallback !== undefined) return fallback;
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
  };
  const compactMaps = Object.fromEntries(['tours', 'excursions', 'destinations', 'countries'].map((kind) =>
    [kind, compactCatalogById(json(`data/source-index/catalogs/${kind}.json`))]));
  const compactById = new Map(Object.values(compactMaps).flatMap((map) => [...map]));
  const cache = new Map();
  const loadEntity = (id) => {
    if (cache.has(id)) return cache.get(id);
    const compact = compactById.get(id), entry = json(`data/source-index/entries/${id}.json`, null);
    const contentPath = entry?.contentPath ?? compact?.contentPath;
    if (!contentPath || !fs.existsSync(local(contentPath))) { cache.set(id, null); return null; }
    const raw = fs.readFileSync(local(contentPath), 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) throw new Error(`Invalid frontmatter: ${contentPath}`);
    const data = yaml.load(match[1]);
    const record = { data, entry, compact, contentPath, raw, body: raw.slice(match[0].length), sourceBlobSha: blobSha(raw) };
    if (data.id !== id) blockers.push(issue('CONTENT_ID_MISMATCH', id, data.id));
    cache.set(id, record);
    return record;
  };
  const tourRecord = loadEntity(tourId);
  if (!tourRecord || !isActiveEntity(tourRecord.data)) throw new Error(`Tour is absent or inactive: ${tourId}`);
  const tour = tourRecord.data, tourUrl = canonicalPath({ ...tourRecord.entry, ...tourRecord.compact });
  const scope = new Set([tourId, ...changedEntityIds]);
  const interests = json('src/data/interest-registry.json');
  const destinationCatalog = new Map(json('src/data/catalog/destinations.json').map((row) => [row.id, row]));
  const excursionIds = refsOf(tour);
  const excursions = new Map(excursionIds.map((id) => [id, loadEntity(id)?.data]));
  const variantReceipt = excursionReview ? json(excursionReview) : null;
  const variantReviews = verifyExcursionVariantReviews({ tour, tourSourceBlobSha: tourRecord.sourceBlobSha,
    excursions: new Map(excursionIds.map(id => [id, loadEntity(id)])), receipt: variantReceipt,
    sourceSnapshotSha256: variantReceipt?.sourceSnapshotPath && fs.existsSync(local(variantReceipt.sourceSnapshotPath))
      ? sha256(fs.readFileSync(local(variantReceipt.sourceSnapshotPath), 'utf8')) : null });
  blockers.push(...variantReviews.blockers);
  const graph = auditTourGraph({ tour, entry: tourRecord.entry, compact: tourRecord.compact, url: tourUrl,
    destinations: destinationCatalog, excursions, interests, variantExclusions: variantReviews.approvedExclusions });
  blockers.push(...graph.blockers);
  const destinationIds = unique([...(tour.destinations ?? []), ...[...excursions.values()].filter(Boolean)
    .flatMap((row) => [row.destination, ...(row.relatedDestinations ?? [])]).filter(Boolean)]);
  const dependencyIds = unique([tourId, ...excursionIds, ...destinationIds, ...changedEntityIds]);
  const records = dependencyIds.map(loadEntity).filter(Boolean);
  for (const id of scope) if (!loadEntity(id)) blockers.push(issue('CHANGED_ENTITY_MISSING', id, 'Changed scope must contain a current content record'));
  for (const record of records) {
    const { data, entry, compact } = record;
    if (compact?.type === 'destination') {
      const errors = validateDestinationProjection(data, { catalog: destinationCatalog.get(data.id), entry, compact,
        canonicalUrl: canonicalPath(compact) });
      for (const error of errors) blockers.push(issue('DESTINATION_PROJECTION_DRIFT', data.id, error));
    }
    if (compact?.type === 'excursion') {
      const expected = { id: data.id, slug: data.slug, url: canonicalPath(compact), countryIds: [data.country],
        destinationIds: data.destination ? [data.destination] : [], relatedDestinationIds: data.relatedDestinations ?? [], themes: data.themes ?? [] };
      for (const [name, source] of [['entry', entry], ['compact', compact]]) {
        for (const [field, value] of Object.entries(expected)) {
          if (!isDeepStrictEqual(source?.[field] ?? (['relatedDestinationIds', 'themes'].includes(field) ? [] : undefined), value)) blockers.push(issue('EXCURSION_SOURCE_DRIFT', data.id, `${name}.${field}`));
        }
      }
    }
  }
  for (const id of destinationIds) if (!loadEntity(id)) blockers.push(issue('DESTINATION_CONTENT_MISSING', id, 'Only a reservation exists'));

  const ledger = validateDirectAssetLedger(json('src/data/media/direct-s3-uploads.json'));
  if (ledger.errors.length) blockers.push(issue('MEDIA_LEDGER_INVALID', tourId, ledger.errors));
  const frozen = gitTree(root, LEGACY_CUTOFF), current = gitTree(root, 'HEAD');
  const delivery = (source, expected = {}) => {
    const receipt = ledger.byPath.get(source);
    if (receipt) return { status: (!expected.sha256 || expected.sha256 === receipt.sha256) && (!expected.bytes || expected.bytes === receipt.bytes) ? 'direct_s3_receipt' : 'receipt_mismatch',
      sha256: receipt.sha256, bytes: receipt.bytes, key: receipt.key };
    if (frozen?.has(source) && current?.get(source) === frozen.get(source)) return { status: 'legacy_frozen_git', blobSha: frozen.get(source), cutoff: LEGACY_CUTOFF };
    return { status: frozen === null ? 'legacy_tree_unavailable' : 'receipt_missing' };
  };
  const enhancements = json('src/data/media/photo-enhancements.json').enhancements ?? [];
  const imageOwners = records.filter((row) => row.data.id === tourId || excursionIds.includes(row.data.id) || scope.has(row.data.id));
  const media = collectMedia(imageOwners).map((row) => {
    const evidence = resolveGptImageEvidence(row.source, enhancements);
    const done = evidence.status === 'confirmed' ? evidence.record : null;
    const reuse = evidence.status === 'reuse_available' ? evidence.record : null;
    const transfer = delivery(row.source);
    const gptImage = done ? { status: 'confirmed', source: done.source, method: done.method, enhancedAt: done.enhancedAt ?? null }
      : reuse ? { status: 'reuse_available', enhanced: reuse.enhanced, method: reuse.method, chain: evidence.chain, delivery: delivery(logicalSource(reuse.enhanced)) }
      : { status: 'enhancement_required' };
    if (!done) blockers.push(issue(reuse ? 'PHOTO_REUSE_NOT_APPLIED' : 'GPT_IMAGE_EVIDENCE_MISSING', row.slots[0].entityId, row.source));
    if (!['direct_s3_receipt', 'legacy_frozen_git'].includes(transfer.status)) blockers.push(issue('MEDIA_DELIVERY_UNVERIFIED', row.slots[0].entityId, { source: row.source, status: transfer.status }));
    return { ...row, gptImage, delivery: transfer };
  });
  const mobileRegistry = json('src/data/media/mobile-hero-registry.json');
  const mobileSelect = createMobileHeroSelector(mobileRegistry);
  const checkMobileHero = ({ source, pagePath, profile, ...context }) => {
    const selected = mobileSelect({ pagePath, source, profile, manualObjectPosition: null });
    const base = { ...context, pagePath, source, profile }, id = base.entityId;
    if (!selected) { blockers.push(issue('MOBILE_HERO_MISSING', id, base)); return { ...base, status: 'missing' }; }
    const sourceDelivery = delivery(source, { sha256: selected.sourceSha256 });
    const visualQA = selected.visualQA?.sourceViewed === true && selected.visualQA?.previewsViewed === true && Boolean(selected.focusReason?.trim());
    if (!visualQA) blockers.push(issue('MOBILE_VISUAL_QA_MISSING', id, pagePath));
    if (!/^[0-9a-f]{64}$/.test(selected.sourceSha256 ?? '') || !['direct_s3_receipt', 'legacy_frozen_git'].includes(sourceDelivery.status)) blockers.push(issue('MOBILE_SOURCE_UNVERIFIED', id, sourceDelivery));
    const variants = selected.variants.map((variant) => {
      const proof = delivery('/' + variant.key, variant);
      if (proof.status !== 'direct_s3_receipt' || !/^[0-9a-f]{64}$/.test(variant.sha256 ?? '') || !(variant.width > 0 && variant.height > 0)) blockers.push(issue('MOBILE_VARIANT_RECEIPT_INVALID', id, variant.key));
      return { key: variant.key, width: variant.width, height: variant.height, ...proof };
    });
    return { ...base, status: 'registered', sourceSha256: selected.sourceSha256, sourceProof: sourceDelivery, visualQA,
      focusReason: selected.focusReason, variants, borrowedCover: mobileSelect.borrowed({ source })?.src ?? null };
  };
  const mobileHeroes = imageOwners.filter((row) => row.data.hero?.src).map(record => checkMobileHero({
    entityId: record.data.id, source: logicalSource(record.data.hero.src), pagePath: canonicalPath(record.compact ?? record.entry),
    profile: 'content-sized', kind: 'entity' })); // All three entity layouts use this profile.

  const registryIndex = json('data/seo-geo/registry/index.json');
  const seoRows = registryIndex.phases.flatMap((phase) => json(phase.path).entries);
  const seoByUrl = new Map(seoRows.map((row) => [row.url, row]));
  const article = (row) => row?.articlePath && fs.existsSync(local(row.articlePath)) ? fs.readFileSync(local(row.articlePath), 'utf8') : null;
  const scopeRecords = records.filter((row) => scope.has(row.data.id));
  const scopeUrls = new Set(scopeRecords.map((row) => canonicalPath(row.compact ?? row.entry)));
  const ownArticles = scopeRecords.map((record) => {
    const url = canonicalPath(record.compact ?? record.entry), row = seoByUrl.get(url), raw = article(row);
    if (!row || !raw) blockers.push(issue('SEO_OWN_ARTICLE_MISSING', record.data.id, url));
    else if (row.work !== 'rewritten') blockers.push(issue('SEO_OWN_SECOND_STAGE_PENDING', record.data.id, { url, work: row.work }));
    return { entityId: record.data.id, url, work: row?.work ?? 'unregistered', articlePath: row?.articlePath ?? null,
      articleBlobSha: raw ? blobSha(raw) : null, publishedCommit: row?.publishedCommit ?? null,
      rewrittenCommit: row?.rewrittenCommit ?? null, rewriteReceiptMatchesCurrent: raw && row?.rewriteResultBlobSha ? blobSha(raw) === row.rewriteResultBlobSha : null,
      contentReview: 'Required against the current Word facts; publication status alone does not prove semantic accuracy' };
  });
  const referringArticles = [];
  for (const row of seoRows) {
    if (scopeUrls.has(row.url)) continue;
    const raw = article(row);
    if (!raw) continue;
    const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
    const targets = [...articleLinks(body)].filter((url) => scopeUrls.has(url));
    if (targets.length) referringArticles.push({ url: row.url, articlePath: row.articlePath, work: row.work,
      articleBlobSha: blobSha(raw), directTargets: targets, needsFactReview: true });
  }

  const allTours = [...compactMaps.tours.keys()].map(loadEntity).filter(Boolean).map((row) => row.data);
  const allExcursions = [...compactMaps.excursions.keys()].map(loadEntity).filter(Boolean).map(row => row.data);
  const countries = [...compactMaps.countries.keys()].map(loadEntity).filter(Boolean).map((row) => row.data);
  const themes = fs.readdirSync(local('src/content/themes')).filter((name) => name.endsWith('.md')).map((name) => {
    const raw = fs.readFileSync(local('src/content/themes/' + name), 'utf8');
    return yaml.load(raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1]);
  });
  const currentCatalogs = buildMultiCountryCatalog(allTours, countries, themes);
  const expectedByPath = new Map(currentCatalogs.map((row) => [row.path, row]));
  const savedCatalogs = json('data/catalogues/multi-country.json');
  const savedByPath = new Map(savedCatalogs.catalogs.map((row) => [row.path, row]));
  const membershipPaths = sorted([...currentCatalogs.filter((row) => row.tours.some((item) => item.id === tourId)).map((row) => row.path),
    ...savedCatalogs.catalogs.filter((row) => row.tourIds.includes(tourId)).map((row) => row.path)]);
  const catalogHeroPlan = catalogHeroUsagesForTour({ tourId, excursions: [...excursions.values()], allTours, allExcursions,
    destinationCatalog: [...destinationCatalog.values()],
    multiCountryRows: currentCatalogs, affectedCatalogPaths: membershipPaths, countries,
    catalogOverrides: json('src/data/media/catalog-hero-overrides.json').covers,
    combinationCovers: json('src/data/media/multi-country-heroes.json').covers });
  warnings.push(...catalogHeroPlan.warnings);
  const catalogMobileHeroes = catalogHeroPlan.usages.map(checkMobileHero);
  const baseline = baselineCatalogs(root, baselineRef, excursionIds);
  const scopedCatalogSeo = auditScopedCatalogSeo(catalogHeroPlan.catalogs, baseline, seoByUrl, article);
  blockers.push(...scopedCatalogSeo.blockers);
  const catalogMembership = membershipPaths.map((url) => {
    const expected = expectedByPath.get(url), saved = savedByPath.get(url), row = seoByUrl.get(url);
    const tourIds = sorted(expected?.tours.map((item) => item.id));
    const places = sorted(expected?.tours.flatMap((item) => item.destinations ?? []));
    const refs = sorted(expected?.tours.flatMap(refsOf));
    const matches = Boolean(saved) && isDeepStrictEqual(sorted(saved.tourIds), tourIds)
      && isDeepStrictEqual(sorted(saved.destinationIds), places) && isDeepStrictEqual(sorted(saved.excursionIds), refs);
    if (!matches) blockers.push(issue('DERIVED_CATALOG_STALE', tourId, url));
    if (expected && !row) blockers.push(issue('CATALOG_SEO_REGISTRATION_MISSING', tourId, url));
    return { url, expectedCount: expected?.count ?? 0, recordedCount: saved?.count ?? 0, dependenciesMatch: matches,
      containsTour: tourIds.includes(tourId), seoWork: row?.work ?? 'unregistered', articleExists: Boolean(article(row)) };
  });

  const geoPassports = records.map((record) => {
    const id = record.data.id, passportPath = `data/geo-knowledge/entities/${id}.json`, passport = json(passportPath, null);
    const source = record.entry ?? record.compact;
    const fingerprint = digest({ stableId: id, kind: source.type, url: source.url, sourceBlobSha: record.sourceBlobSha,
      countryIds: source.countryIds ?? [], destinationIds: source.destinationIds ?? [] });
    const sameIdentity = passport?.stableId === id && passport?.canonicalPath === source.url;
    const matches = sameIdentity && passport.sourceFingerprint === fingerprint;
    if (scope.has(id) && !passport) blockers.push(issue('GEO_PASSPORT_MISSING', id, passportPath));
    else if (scope.has(id) && !matches) blockers.push(issue('GEO_PASSPORT_REVALIDATION_REQUIRED', id, passportPath));
    return { entityId: id, inChangedScope: scope.has(id), passportPath: passport ? passportPath : null,
      status: passport?.status ?? 'missing', sameIdentity, sourceFingerprint: fingerprint,
      recordedFingerprint: passport?.sourceFingerprint ?? null, currentSourceMatches: matches,
      publication: 'Main-file presence only; confirm the matching production deploy and staging finalization separately' };
  });
  const excursionDayCoverage = programmeExcursionCoverage(tour);
  const unlinkedExcursionCandidates = excursionDayCoverage.days.filter((day) => !day.excursionIds.length && day.textualCandidate)
    .map((day) => ({ day: day.day, title: day.title }));
  if (unlinkedExcursionCandidates.length) warnings.push({ code: 'EXCURSION_MATCH_REVIEW', detail: unlinkedExcursionCandidates,
    note: 'Textual candidates require semantic matching; no identity or mandatory visit is inferred by regex' });
  if (!frozen) warnings.push({ code: 'LEGACY_TREE_UNAVAILABLE', detail: LEGACY_CUTOFF });
  return { schemaVersion: 1, mode: 'read_only_offline', tourId, canonicalUrl: tourUrl,
    scope: { changedEntityIds: [...scope], destinationIds, tourDestinationIds: tour.destinations, excursionIds, interestCount: interests.length,
      themes: [...(tour.primaryThemes ?? []), ...(tour.themes ?? [])], sourceBlobSha: tourRecord.sourceBlobSha,
      excursionDayCoverage, reviewedExcursionVariants: variantReviews.evidence, excursionReviewPath: excursionReview ?? null,
      catalogueBaseline: { ref: baseline.ref, commit: baseline.commit ?? null, available: baseline.available } },
    summary: { blockers: blockers.length, mediaSources: media.length, confirmedGptImages: media.filter((row) => row.gptImage.status === 'confirmed').length,
      reusableGptImages: media.filter((row) => row.gptImage.status === 'reuse_available').length,
      mobileHeroes: mobileHeroes.length, ownArticles: ownArticles.length, referringArticles: referringArticles.length,
      catalogMobileHeroes: catalogMobileHeroes.length, catalogImageFree: catalogHeroPlan.imageFree.length,
      newCatalogues: scopedCatalogSeo.rows.filter(row => row.newInWordJob).length,
      catalogMemberships: catalogMembership.length, legacyCutoffTreeAvailable: Boolean(frozen) },
    blockers, warnings, media, mobileHeroes, catalogMobileHeroes, catalogImageFree: catalogHeroPlan.imageFree,
    catalogHeroModelEvidence: ['src/pages/[...path].astro', 'src/layouts/EntityCatalogLayout.astro',
      'src/pages/multi-country/[...selection].astro', 'src/pages/multi-country/index.astro',
      'src/pages/multi-country/page/[page].astro', 'src/lib/catalog-pagination.ts'].map(file => ({
        path: file, sourceBlobSha: blobSha(fs.readFileSync(local(file), 'utf8')) })),
    seo: { ownArticles, referringArticles, dependentCatalogues: scopedCatalogSeo.rows,
      catalogPolicy: 'New dependent canonical catalogues require both SEO stages in this Word job; existing queued articles retain their queue. Pass the frozen pre-import --baseline-ref after publication.' },
    catalogMembership, geoPassports,
    externalChecks: ['Word semantic completeness', 'GPT Image/visual QA receipt truth', 'source bytes for legacy SHA-256',
      'production deploy and rendered catalogue hero usages', 'schema-geo/staging leases and receipts', 'Google Sheets readback', 'email delivery'] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {}, args = process.argv.slice(2);
  let check = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--check') { check = true; continue; }
    if (!['--tour-id', '--repo-root', '--changed-entity', '--baseline-ref', '--excursion-review'].includes(arg) || !args[i + 1]) throw new Error(`Unknown/incomplete option: ${arg}`);
    const value = args[++i];
    if (arg === '--changed-entity') (options.changedEntityIds ??= []).push(value);
    else options[arg === '--tour-id' ? 'tourId' : arg === '--baseline-ref' ? 'baselineRef' : arg === '--excursion-review' ? 'excursionReview' : 'repoRoot'] = value;
  }
  const result = auditTourDependencies(options);
  console.log(JSON.stringify(result, null, 2));
  if (check && result.blockers.length) process.exitCode = 2;
}
