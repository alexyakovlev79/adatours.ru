import { isActiveEntity, archiveById, archiveEntries, activeReplacementId } from './archive.mjs';
import { validateInterestContent } from './interest-model.mjs';
import { getCollection } from 'astro:content';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import destinationRecords from '../data/catalog/destinations.json';
import destinationReservations from '../data/catalog/destination-reservations.json';
import { validateDestinationReservations } from './destination-reservations.mjs';
import { validateSourceTextPointer, validateProvidedMedia, isNonemptyUtf8 } from './provided-materials.mjs';
import { validateGeneratedSourceMaterials } from './generated-source-materials.mjs';
import { canonicalPath, countryPath, destinationPath, tourPath, excursionPath, themePath } from './routes';

export interface CatalogDestination {
  id: string;
  name: string;
  slug: string;
  countryId: string;
  countrySlug: string;
  url: string;
  sourceUrl: string | null;
  aliases?: string[];
}

// The catalog reserves IDs and URLs before their Destination pages are created.
export const destinationCatalog = destinationRecords as CatalogDestination[];
export const destinationCatalogById = new Map(destinationCatalog.map((item) => [item.id, item]));

const isPublished = (data: { status: string }) => isActiveEntity(data);
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
  const errors: string[] = validateInterestContent({ countries, destinations, tours, excursions, themes });
  const rows = [...countries, ...destinations, ...tours, ...excursions, ...themes, ...cases, ...people, ...articles];
  const publishedRouteById = new Map<string, string>();
  for (const { data } of countries.filter(({ data }) => isPublished(data))) publishedRouteById.set(data.id, countryPath(data));
  for (const { data } of destinations.filter(({ data }) => isPublished(data))) publishedRouteById.set(data.id, destinationPath(data));
  for (const { data } of tours.filter(({ data }) => isPublished(data))) publishedRouteById.set(data.id, tourPath(data));
  for (const { data } of excursions.filter(({ data }) => isPublished(data))) publishedRouteById.set(data.id, excursionPath(data));
  const publishedPaths = [...publishedRouteById.values(), ...themes.filter(({ data }) => isPublished(data)).map(({ data }) => themePath(data))];
  if (new Set(publishedPaths).size !== publishedPaths.length) errors.push('Повторяющийся канонический URL опубликованных объектов.');
  const countryById = new Map(countries.filter(({ data }) => isPublished(data)).map((entry) => [key(entry.data.locale, entry.data.id), entry]));
  const excursionById = new Map(excursions.filter(({ data }) => isPublished(data)).map((entry) => [key(entry.data.locale, entry.data.id), entry]));
  const contentById = new Map(rows.map((entry) => [entry.data.id, entry]));
  for (const entry of [...tours, ...excursions]) {
    if (entry.data.status === 'archived' && !archiveById.has(entry.data.id)) errors.push(`${entry.data.id}: добавь запись в data/catalog-archive.json и синхронизируй архив.`);
  }
  for (const archived of archiveEntries) {
    const page = contentById.get(archived.id);
    if (archived.hadPage && !page) errors.push(`${archived.id}: архивная страница должна оставаться доступной.`);
    if (page && page.data.status !== 'archived') errors.push(`${archived.id}: запись архива требует status: archived в MD.`);
    if (page && (archived.type === 'tour' ? tourPath(page.data) : excursionPath(page.data)) !== archived.url) errors.push(`${archived.id}: обнови URL архива одновременно с каноническим маршрутом.`);
    if (archived.duplicateOf && (!activeReplacementId(archived.id) || archiveById.has(archived.duplicateOf))) errors.push(`${archived.id}: у дубля нет активной замены.`);
  }
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
    const expectedUrl = `/${item.countrySlug}/place/${item.slug}/`;
    const catalogPath = new URL(item.url || '/', 'https://adatours.ru').pathname.replace(/^\/adatours\.ru(?=\/)/, '');
    if (catalogPath !== expectedUrl) errors.push(`${label}: URL должен соответствовать ${expectedUrl}.`);
    if (catalogIds.has(item.id)) errors.push(`${label}: повторяющийся id в каталоге.`);
    if (catalogUrls.has(expectedUrl)) errors.push(`${label}: повторяющийся URL в каталоге.`);
    catalogIds.add(item.id);
    catalogUrls.add(expectedUrl);
    const country = countryById.get(key('ru', item.countryId));
    if (country && country.data.slug !== item.countrySlug) errors.push(`${label}: countrySlug не совпадает со страницей страны.`);
  }

  errors.push(...validateDestinationReservations(destinationCatalog, destinationReservations, {
    countries: countries.filter(({ data }) => isPublished(data)).map(({ data }) => ({ id: data.id, slug: data.slug })),
    publishedDestinationIds: destinations.filter(({ data }) => isPublished(data)).map(({ data }) => data.id),
  }));

  for (const { data: d } of destinations.filter(({ data }) => isPublished(data))) {
    const planned = destinationCatalogById.get(d.id);
    if (!countryById.has(key(d.locale, d.countryId))) errors.push(`${d.id}: страна ${d.countryId} ещё не опубликована.`);
    if (!planned) errors.push(`${d.id}: место отсутствует в src/data/catalog/destinations.json.`);
    else if (planned.countryId !== d.countryId || planned.slug !== d.slug) errors.push(`${d.id}: countryId/slug не совпадает с закреплённым каталогом.`);
    if (destinationReservations.entries.some((item) => item.id === d.id)) {
      if (!d.summary.trim() || !d.hero?.src?.trim()) errors.push(`${d.id}: заполненный резерв требует описания и фотографии в самой странице места.`);
      if (planned && d.name !== planned.name) errors.push(`${d.id}: название заполненного места должно совпадать с резервом.`);
    }
  }

  for (const { data: d } of excursions.filter(({ data }) => isPublished(data))) {
    if (!countryById.has(key(d.locale, d.country))) errors.push(`${d.id}: страна ${d.country} ещё не опубликована.`);
    if (d.destination && !destinationCatalogById.has(d.destination)) errors.push(`${d.id}: неизвестный ID места ${d.destination}; выбери ID из каталога.`);
    if (new Set(d.relatedDestinations).size !== d.relatedDestinations.length || (d.destination && d.relatedDestinations.includes(d.destination))) errors.push(`${d.id}: дополнительные места не должны повторяться или дублировать основное место.`);
    for (const id of d.relatedDestinations) {
      if (!destinationCatalogById.has(id)) errors.push(`${d.id}: неизвестный ID дополнительного места ${id}.`);
    }
  }

  for (const { data: d } of tours.filter(({ data }) => isPublished(data))) {
    if (new Set(d.countries).size !== d.countries.length || new Set(d.destinations).size !== d.destinations.length) errors.push(`${d.id}: повторяющиеся ID в countries/destinations.`);
    if (d.routeCountries && (new Set(d.routeCountries).size !== d.routeCountries.length || d.routeCountries.some((id) => !d.countries.includes(id)))) errors.push(`${d.id}: routeCountries должны быть уникальным подмножеством countries.`);
    if (d.routeDestinations && (new Set(d.routeDestinations).size !== d.routeDestinations.length || d.routeDestinations.some((id) => !d.destinations.includes(id)))) errors.push(`${d.id}: routeDestinations должны быть уникальным подмножеством destinations.`);
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
        const activeId = activeReplacementId(id);
        if (activeId && !excursionById.has(key(d.locale, activeId)) && !excursions.some((item) => item.data.id === activeId && item.data.status === 'archived')) errors.push(`${d.id}: экскурсия ${id} должна быть создана и опубликована вместе с туром.`);
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
  const sourceIds = new Set<string>();
  const publishedReservations = new Set(destinationReservations.entries.filter((item) => publishedRouteById.has(item.id)).map((item) => item.id));
  const providedTextFiles = new Map<string, Promise<boolean>>();
  const validProvidedTextFile = (path: string) => {
    if (!providedTextFiles.has(path)) {
      providedTextFiles.set(path, readFile(path).then(isNonemptyUtf8, () => false));
    }
    return providedTextFiles.get(path)!;
  };
  for (let offset = 0; offset < sourceEntryFiles.length; offset += 64) {
    await Promise.all(sourceEntryFiles.slice(offset, offset + 64).filter((name) => name.endsWith('.json')).map(async (name) => {
      const source = await readFile(join(sourceEntryRoot, name), 'utf8');
      if (cachePath.test(source)) errors.push(`source-index/${name}: URL /image/cache/ запрещён в подготовленных источниках.`);
      const entry = JSON.parse(source);
      sourceIds.add(entry.id);
      const expectedUrl = canonicalPath(entry);
      if (entry.url !== expectedUrl) errors.push(`source-index/${name}: ожидается канонический URL ${expectedUrl}.`);
      const publishedUrl = publishedRouteById.get(entry.id);
      if (publishedUrl && entry.url !== publishedUrl) errors.push(`source-index/${name}: URL не совпадает с опубликованной сущностью ${publishedUrl}.`);
      const extraDestinations = entry.relatedDestinationIds ?? [];
      if (!Array.isArray(extraDestinations) || new Set(extraDestinations).size !== extraDestinations.length || extraDestinations.some((id: string) => !destinationCatalogById.has(id) || entry.destinationIds.includes(id))) errors.push(`source-index/${name}: дополнительные места должны быть уникальными ID из каталога и не дублировать основное.`);
      const routeCountryIds = entry.routeCountryIds ?? [];
      if (!Array.isArray(routeCountryIds) || new Set(routeCountryIds).size !== routeCountryIds.length || routeCountryIds.some((id: string) => !entry.countryIds.includes(id))) errors.push(`source-index/${name}: routeCountryIds должны быть уникальным подмножеством countryIds.`);
      const routeDestinationIds = entry.routeDestinationIds ?? [];
      if (!Array.isArray(routeDestinationIds) || new Set(routeDestinationIds).size !== routeDestinationIds.length || routeDestinationIds.some((id: string) => !entry.destinationIds.includes(id))) errors.push(`source-index/${name}: routeDestinationIds должны быть уникальным подмножеством destinationIds.`);
      const publishedExcursion = excursionById.get(key('ru', entry.id));
      if (publishedExcursion && JSON.stringify(extraDestinations) !== JSON.stringify(publishedExcursion.data.relatedDestinations)) errors.push(`source-index/${name}: дополнительные места не совпадают с опубликованной экскурсией.`);
      const completingReservation = publishedReservations.has(entry.id);
      const generatedMaterials = entry.text?.selected?.kind === 'editorial_generated'
        || entry.media?.status === 'generated'
        || entry.media?.provenance?.kind === 'gpt_image';
      if (generatedMaterials) {
        // Tour-day photo repair has its own strict provenance rules. Do not
        // mislabel editorial text and GPT Image assets as user-provided files.
        errors.push(...validateGeneratedSourceMaterials(entry, { repoRoot: process.cwd() })
          .map((error) => `source-index/${name}: ${error}`));
      } else {
        if (completingReservation && entry.text?.selected?.kind !== 'provided_materials') errors.push(`source-index/${name}: заполненному резерву нужен text.selected.kind: provided_materials.`);
        for (const field of ['selected', 'original']) {
          const pointer = entry.text?.[field];
          if (!completingReservation && pointer?.kind !== 'provided_materials' && pointer?.repositoryPath === undefined) continue;
          const pointerErrors = validateSourceTextPointer(pointer, entry.id);
          errors.push(...pointerErrors.map((error) => `source-index/${name} text.${field}: ${error}`));
          if (!pointerErrors.length && pointer.repositoryPath && !await validProvidedTextFile(pointer.repositoryPath)) errors.push(`source-index/${name}: предоставленный текст ${pointer.repositoryPath} отсутствует, пуст или не является UTF-8.`);
        }
        if (completingReservation || entry.media?.status === 'provided_originals') {
          const mediaErrors = validateProvidedMedia(entry.media);
          errors.push(...mediaErrors.map((error) => `source-index/${name}: ${error}`));
          for (const image of mediaErrors.length ? [] : entry.media.images) {
            if (image.url.startsWith('/media/')) {
              const relative = decodeURIComponent(new URL(image.url, 'https://adatours.ru').pathname);
              const path = resolve(publicRoot, `.${relative}`);
              if (!path.startsWith(`${publicRoot}${sep}`) || !await stat(path).then((file) => file.isFile() && file.size > 0, () => false)) errors.push(`source-index/${name}: предоставленная фотография ${image.url} отсутствует или пуста.`);
            }
          }
        }
      }
    }));
  }
  for (const reservation of destinationReservations.entries) {
    if (publishedRouteById.has(reservation.id) && !sourceIds.has(reservation.id)) errors.push(`${reservation.id}: заполненному месту нужна запись предоставленных источников.`);
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
