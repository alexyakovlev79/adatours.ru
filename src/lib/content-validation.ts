import { getCollection } from 'astro:content';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import destinationRecords from '../data/catalog/destinations.json';

export interface CatalogDestination {
  id: string;
  name: string;
  slug: string;
  countryId: string;
  countrySlug: string;
  url: string;
  sourceUrl: string | null;
}

// The catalog reserves IDs and URLs before their Destination pages are created.
export const destinationCatalog = destinationRecords as CatalogDestination[];
export const destinationCatalogById = new Map(destinationCatalog.map((item) => [item.id, item]));

const isPublished = (data: { status: string }) => !['draft', 'archived'].includes(data.status);
const key = (locale: string, id: string) => `${locale}:${id}`;
const cachePath = /\/image\/cache\//i;
let buildValidation: Promise<void> | undefined;

/** One offline guard per build. Astro has already parsed YAML and checked its schema. */
export function validateSiteContent(): Promise<void> {
  if (import.meta.env.DEV) return validateContent();
  return buildValidation ??= validateContent();
}

async function validateContent(): Promise<void> {
  const [countries, destinations, tours, excursions, themes, cases, people, articles] = await Promise.all([
    getCollection('countries'), getCollection('destinations'), getCollection('tours'),
    getCollection('excursions'), getCollection('themes'), getCollection('cases'),
    getCollection('people'), getCollection('articles'),
  ]);
  const errors: string[] = [];
  const rows = [...countries, ...destinations, ...tours, ...excursions, ...themes, ...cases, ...people, ...articles];
  const countryById = new Map(countries.filter(({ data }) => isPublished(data)).map((entry) => [key(entry.data.locale, entry.data.id), entry]));
  const excursionById = new Map(excursions.filter(({ data }) => isPublished(data)).map((entry) => [key(entry.data.locale, entry.data.id), entry]));
  const seenIds = new Set<string>();
  const seenRoutes = new Set<string>();
  const localMedia = new Set<string>();
  const publicRoot = resolve('public');

  const inspectMedia = (value: unknown, field = '') => {
    if (typeof value === 'string' && ['src', 'image'].includes(field) && value.startsWith('/media/')) {
      const path = new URL(value, 'https://adatours.ru').pathname;
      localMedia.add(resolve(publicRoot, `.${decodeURIComponent(path)}`));
    } else if (Array.isArray(value)) {
      value.forEach((item) => inspectMedia(item, field));
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([name, item]) => inspectMedia(item, name));
    }
  };

  for (const entry of rows) {
    const d = entry.data;
    const label = `${entry.collection}/${entry.id} (${d.id})`;
    const id = key(d.locale, d.id);
    if (seenIds.has(id)) errors.push(`${label}: повторяющийся id.`);
    seenIds.add(id);
    if (!isPublished(d)) continue;

    const countryPart = entry.collection === 'destinations' ? entry.data.countryId : '';
    const route = `${entry.collection}:${d.locale}:${countryPart}:${d.slug}`;
    if (seenRoutes.has(route)) errors.push(`${label}: повторяющийся URL страницы.`);
    seenRoutes.add(route);
    if (cachePath.test(JSON.stringify(d)) || cachePath.test(entry.body ?? '')) {
      errors.push(`${label}: URL /image/cache/ запрещён; используй закреплённый raw URL или локальное улучшенное фото.`);
    }
    inspectMedia(d);
  }

  const catalogIds = new Set<string>();
  const catalogUrls = new Set<string>();
  for (const item of destinationCatalog) {
    const label = `catalog/destinations.json (${item.id})`;
    for (const field of ['id', 'name', 'slug', 'countryId', 'countrySlug', 'url'] as const) {
      if (typeof item[field] !== 'string' || !item[field].trim()) errors.push(`${label}: не заполнено ${field}.`);
    }
    const expectedUrl = `/napravleniya/${item.countrySlug}/${item.slug}/`;
    const catalogPath = new URL(item.url || '/', 'https://adatours.ru').pathname.replace(/^\/adatours\.ru(?=\/)/, '');
    if (catalogPath !== expectedUrl) errors.push(`${label}: URL должен соответствовать ${expectedUrl}.`);
    if (catalogIds.has(item.id)) errors.push(`${label}: повторяющийся id в каталоге.`);
    if (catalogUrls.has(expectedUrl)) errors.push(`${label}: повторяющийся URL в каталоге.`);
    catalogIds.add(item.id);
    catalogUrls.add(expectedUrl);
    const country = countryById.get(key('ru', item.countryId));
    if (country && country.data.slug !== item.countrySlug) errors.push(`${label}: countrySlug не совпадает со страницей страны.`);
  }

  for (const { data: d } of destinations.filter(({ data }) => isPublished(data))) {
    const planned = destinationCatalogById.get(d.id);
    if (!countryById.has(key(d.locale, d.countryId))) errors.push(`${d.id}: страна ${d.countryId} ещё не опубликована.`);
    if (!planned) errors.push(`${d.id}: место отсутствует в src/data/catalog/destinations.json.`);
    else if (planned.countryId !== d.countryId || planned.slug !== d.slug) errors.push(`${d.id}: countryId/slug не совпадает с закреплённым каталогом.`);
  }

  for (const { data: d } of excursions.filter(({ data }) => isPublished(data))) {
    if (!countryById.has(key(d.locale, d.country))) errors.push(`${d.id}: страна ${d.country} ещё не опубликована.`);
    if (d.destination && !destinationCatalogById.has(d.destination)) errors.push(`${d.id}: неизвестный ID места ${d.destination}; выбери ID из каталога.`);
  }

  for (const { data: d } of tours.filter(({ data }) => isPublished(data))) {
    if (new Set(d.countries).size !== d.countries.length || new Set(d.destinations).size !== d.destinations.length) errors.push(`${d.id}: повторяющиеся ID в countries/destinations.`);
    for (const id of d.countries) {
      if (!countryById.has(key(d.locale, id))) errors.push(`${d.id}: страна ${id} ещё не опубликована.`);
    }
    for (const id of d.destinations) {
      const planned = destinationCatalogById.get(id);
      if (!planned) errors.push(`${d.id}: неизвестный ID места ${id}; будущие места разрешены только по каталогу.`);
      else if (!d.countries.includes(planned.countryId)) errors.push(`${d.id}: страна места ${id} отсутствует в countries.`);
    }
    for (const day of d.itinerary) {
      const refs = [day.excursionRef, ...day.contentBlocks.filter((block) => block.type === 'excursion').map((block) => block.excursionRef)];
      for (const id of refs.filter(Boolean) as string[]) {
        if (!excursionById.has(key(d.locale, id))) errors.push(`${d.id}: экскурсия ${id} должна быть создана и опубликована вместе с туром.`);
      }
    }
  }

  await Promise.all([...localMedia].map(async (path) => {
    if (!path.startsWith(`${publicRoot}${sep}`)) {
      errors.push(`Недопустимый локальный путь изображения: ${path}.`);
      return;
    }
    const exists = await stat(path).then((item) => item.isFile(), () => false);
    if (!exists) errors.push(`Отсутствует локальное изображение ${path.slice(publicRoot.length)}.`);
  }));

  // Source preparation is separate from page creation. Enforce the raw-source
  // policy on its small local JSON records without querying any external URL.
  const sourceEntryRoot = 'data/source-index/entries';
  const sourceEntryFiles = await readdir(sourceEntryRoot);
  for (let offset = 0; offset < sourceEntryFiles.length; offset += 64) {
    await Promise.all(sourceEntryFiles.slice(offset, offset + 64).filter((name) => name.endsWith('.json')).map(async (name) => {
      const source = await readFile(join(sourceEntryRoot, name), 'utf8');
      if (cachePath.test(source)) errors.push(`source-index/${name}: URL /image/cache/ запрещён в подготовленных источниках.`);
    }));
  }
  const photoRegistry = await readFile('src/data/media/photo-enhancements.json', 'utf8');
  if (cachePath.test(photoRegistry)) errors.push('photo-enhancements.json: используйте канонические raw-идентификаторы исходных фотографий.');

  // Check active template literals too. Historical local paths are not resolved
  // or downloaded from the photo registry.
  const inspectCode = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    await Promise.all(entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return inspectCode(path);
      if (!['.astro', '.ts', '.js', '.mjs', '.css'].includes(extname(path))) return;
      const source = await readFile(path, 'utf8');
      const match = source.match(/(?:https?:\/\/[^\s"'<>/]+)?\/image\/cache\//i);
      if (match) errors.push(`${path}:${source.slice(0, match.index).split('\n').length}: активный URL /image/cache/ запрещён.`);
    }));
  };
  await Promise.all(['src/pages', 'src/components', 'src/layouts', 'src/styles'].map(inspectCode));

  if (errors.length) throw new Error(`Ошибки контента (${errors.length}):\n${errors.sort().join('\n')}`);
}
