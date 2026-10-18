import { CATALOG_PAGE_SIZE } from './catalog-pagination.ts';
import { createHash } from 'node:crypto';
import { compareMultiCountryCatalogs, multiCountryCatalogName, multiCountryData } from './multi-country-catalog.mjs';
import { multiCountrySeoMetadata } from './multi-country-seo.mjs';
import { excursionIdsForInterestTour } from './interest-model.mjs';

export const MULTI_COUNTRY_KINDS = new Set(['multi_country_combination', 'multi_country_interest', 'multi_country_interest_index']);
const distinct = (values) => [...new Set(values)].sort();
export function multiCountrySnapshot(rows, { destinations = [], covers = {}, date = new Date() } = {}) {
  const catalogs = [...rows].sort(compareMultiCountryCatalogs).map((row) => ({
    id: row.id, kind: row.themeId ? row.slugs.length ? 'multi_country_interest' : 'multi_country_interest_index'
      : row.slugs.length ? 'multi_country_combination' : 'multi_country',
    path: row.path, key: row.key, slugs: row.slugs, countryIds: row.countryIds,
    countryNames: row.countries.map((country) => country.name), themeId: row.themeId ?? '',
    themeSlug: row.theme?.slug ?? '', themeName: row.theme?.name ?? '', name: multiCountryCatalogName(row),
    count: row.count, totalPages: Math.ceil(row.count / CATALOG_PAGE_SIZE),
    tourIds: row.tours.map((entry) => multiCountryData(entry).id),
    destinationIds: distinct(row.tours.flatMap((entry) => multiCountryData(entry).destinations ?? [])),
    excursionIds: distinct(row.tours.flatMap((entry) => [...excursionIdsForInterestTour(entry)])),
    hero: covers[row.key]?.src ?? row.theme?.hero?.src ?? multiCountryData(row.tours[0])?.hero?.src ?? '',
    ...multiCountrySeoMetadata({ countries: row.countries, tours: row.tours, destinations, theme: row.theme, date }),
  }));
  const fingerprint = createHash('sha256').update(JSON.stringify(catalogs)).digest('hex');
  return { version: 1, source: 'active production Tour/Country/Theme; main route countries only', fingerprint,
    counts: { catalogs: catalogs.length, combinations: catalogs.filter((row) => row.kind === 'multi_country_combination').length,
      intersections: catalogs.filter((row) => row.kind === 'multi_country_interest').length,
      thematicIndexes: catalogs.filter((row) => row.kind === 'multi_country_interest_index').length,
      htmlPages: catalogs.reduce((total, row) => total + row.totalPages, 0) }, catalogs };
}

/** All historical rows survive. Editorial text, claims, notes and publication dates are never replaced. */
export function reconcileMultiCountryRegistries(phases, index, snapshot) {
  const result = structuredClone(phases);
  const phase = result.find((item) => item.phase === 5);
  if (!phase) throw new Error('Missing SEO/GEO phase 5');
  const original = phase.entries;
  if (new Set(original.map((entry) => entry.url)).size !== original.length) throw new Error('Duplicate canonical URL in phase 5');
  const existing = new Map(original.filter((entry) => MULTI_COUNTRY_KINDS.has(entry.kind)).map((entry) => [entry.url, entry]));
  const current = snapshot.catalogs.filter((row) => MULTI_COUNTRY_KINDS.has(row.kind));
  const activePaths = new Set(current.map((row) => row.path));
  const updated = current.map((row) => {
    const prior = existing.get(row.path);
    const entry = { ...(prior ?? { phase: 5, work: 'queued' }), kind: row.kind,
      id: prior?.id ?? row.id, name: row.name, url: row.path, countryIds: row.countryIds,
      availability: 'active_multi_country_catalog', tours: row.count };
    if (row.themeId) { entry.themeId = row.themeId; entry.themeName = row.themeName; }
    if (['temporarily_unavailable', 'waiting_for_page'].includes(entry.work)) {
      entry.work = entry.workBeforeUnavailable ?? 'queued';
      delete entry.workBeforeUnavailable;
    }
    return entry;
  });
  const missing = [...existing.values()].filter((entry) => !activePaths.has(entry.url)).map((entry) => {
    entry.availability = 'temporarily_unavailable';
    entry.tours = 0;
    if (!['temporarily_unavailable', 'archived'].includes(entry.work)) {
      entry.workBeforeUnavailable = entry.work;
      entry.work = 'temporarily_unavailable';
    }
    return entry;
  });
  // Keep the whole original multi-country block together, then the new thematic
  // block. Missing rows stay within their category and retain every historical field.
  const ordinary = [...updated, ...missing].filter((entry) => entry.kind === 'multi_country_combination');
  const thematic = [...updated, ...missing].filter((entry) => entry.kind !== 'multi_country_combination');
  const remaining = original.filter((entry) => !MULTI_COUNTRY_KINDS.has(entry.kind));
  const at = remaining.findIndex((entry) => entry.url === '/multi-country/');
  if (at < 0) throw new Error('Missing /multi-country/ registry anchor');
  phase.entries = [...remaining.slice(0, at + 1), ...ordinary, ...thematic, ...remaining.slice(at + 1)];
  const root = phase.entries[at], rootCatalog = snapshot.catalogs.find((row) => row.path === '/multi-country/');
  if (rootCatalog) root.tours = rootCatalog.count;
  let order = 0;
  for (const item of result) for (const entry of item.entries) entry.order = ++order;
  const metadata = structuredClone(index);
  metadata.totalRows = order;
  for (const item of metadata.phases) {
    const entries = result.find((phase) => phase.phase === item.phase).entries;
    item.rows = entries.length;
    item.orderFirst = entries[0]?.order ?? 0;
    item.orderLast = entries.at(-1)?.order ?? 0;
  }
  metadata.rules.multiCountryInterests = 'After all multi-country combinations; nonempty main-country + primary/secondary-interest intersections; automatically reconciled without replacing editorial history.';
  for (const item of metadata.phases) { delete item.orderFrom; delete item.orderTo; }
  metadata.multiCountryFingerprint = snapshot.fingerprint;
  return { phases: result, index: metadata };
}

export const multiCountryTypeLabel = (kind) => kind === 'multi_country_combination' ? 'Сочетание стран'
  : kind === 'multi_country_interest_index' ? 'Multi-country по интересу' : 'Сочетание стран + интерес';
export function multiCountrySeoSheetRow(entry, catalog) {
  return [entry.order, '5. Туры', multiCountryTypeLabel(entry.kind), entry.name, 'https://adatours.ru' + entry.url,
    entry.id, catalog.countryNames.join(', '), catalog.themeName, 'Каталог доступен',
    ({ published: 'Опубликовано', rewritten: 'Переписано', prepared: 'Ждет публикации', draft: 'Пишется', queued: 'В очереди',
      temporarily_unavailable: 'Временно недоступна' })[entry.work] ?? entry.work,
    entry.articlePath ?? '', entry.publishedAt ?? '', 'Автоматический каталог: ' + catalog.count + ' туров. Полная SEO/GEO-статья учитывается отдельно.'];
}
export const csvText = (rows) => rows.map((row) => row.map((cell) => '"' + String(cell ?? '').replaceAll('"', '""') + '"').join(',')).join('\r\n') + '\r\n';
