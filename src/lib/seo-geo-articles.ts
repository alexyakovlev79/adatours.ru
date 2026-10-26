import { getCollection } from 'astro:content';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { isActiveEntity } from './archive.mjs';
import { buildMultiCountryCatalog } from './multi-country-catalog.mjs';
import { buildTourFilterIndex } from './tour-filters.mjs';
import { buildVipFilterIndex } from './vip-filters.mjs';
import { countryMembership, themeIds } from './interest-model.mjs';
import { selectVipTours, vipTourPriceLabel } from './vip-tours.mjs';
import { tourHasMainDestination, tourHasOptionalDestination } from './tour-relations';
import { excursionDestinationIds } from './destination-links.mjs';
import { excursionPlaceCatalogScope } from './excursion-catalog-scope.mjs';
import { excursionIdsForTour } from './excursion-popularity';
import {
  countryPath, destinationPath, tourPath, excursionPath, tourExcursionPath,
  excursionCountryPath, excursionDestinationPath,
} from './routes';
import {
  normalizeSeoGeoPath, parseSeoGeoArticle, interpolateSeoGeoMarkdown, seoGeoCount,
  comparableUsdMinimum, validateSeoGeoHtml, extractSeoGeoHeading,
} from './seo-geo.mjs';

const loaders = import.meta.glob('../../data/seo-geo/articles/**/index.md', {
  query: '?raw', import: 'default',
});
let dataPromise;
let processorPromise;
const cache = new Map();

async function getData() {
  if (!dataPromise) {
    const activeRu = ({ data }) => data.locale === 'ru' && isActiveEntity(data);
    dataPromise = Promise.all([
      getCollection('tours', activeRu), getCollection('countries', activeRu),
      getCollection('themes', activeRu), getCollection('destinations', activeRu),
      getCollection('excursions', activeRu),
    ]).then(([tours, countries, themes, destinations, excursions]) => ({
      tours, countries, themes, destinations, excursions,
      multi: buildMultiCountryCatalog(tours, countries, themes),
      regular: buildTourFilterIndex(tours, countries, themes),
      vip: buildVipFilterIndex(tours, countries, themes),
    }));
  }
  return dataPromise;
}

const value = (entry) => entry.data ?? entry;
const unique = (rows) => [...new Map(rows.map((row) => [value(row).id, row])).values()];
const full = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/[\r\n]/g, ' ');
const isMainCountry = (tour, id) => (tour.routeCountries ?? tour.countries ?? []).includes(id);
const countryOfExcursion = (excursion, destinationById) =>
  destinationById.get(excursion.destination)?.countryId ?? excursion.country;

export function seoGeoScope(path, data) {
  const { tours, countries, themes, destinations, excursions, regular, vip } = data;
  const countryBySlug = new Map(countries.map((c) => [c.data.slug, c.data]));
  const themeBySlug = new Map(themes.map((t) => [t.data.slug, t.data]));
  const destinationById = new Map(destinations.map((d) => [d.data.id, d.data]));
  const countryMatch = path.match(/^\/(?:vip\/)?([a-z0-9-]+)\/(?:$|tour\/|place\/|excursion\/)/);
  const themeMatch = path.match(/^\/interests\/([a-z0-9-]+)\//)
    ?? path.match(/^\/vip\/(?:[a-z0-9-]+\/)?interests\/([a-z0-9-]+)\//);
  const selectedRegular = regular.find((row) => row.href === path);
  const selectedVip = vip.find((row) => row.href === path);
  const selectedMulti = (data.multi ?? buildMultiCountryCatalog(tours, countries, themes)).find((row) => row.path === path);
  const theme = selectedMulti?.theme ?? selectedVip?.theme?.data ?? selectedRegular?.theme?.data
    ?? (themeMatch ? themeBySlug.get(themeMatch[1]) : undefined);
  const country = selectedVip?.country?.data ?? selectedRegular?.country?.data
    ?? countryBySlug.get(path.match(/^\/interests\/[a-z0-9-]+\/tours\/([a-z0-9-]+)\/$/)?.[1]
      ?? (countryMatch?.[1] === 'vip' ? '' : countryMatch?.[1]));

  let scopedTours = selectedMulti?.tours ?? selectedVip?.entries ?? selectedRegular?.entries ?? [];
  let scopedPlaces = destinations;
  let scopedExcursions = excursions;

  // On filtered tour catalogues, these counters describe places and excursions
  // actually linked to the complete selected tour set, not all country objects.
  if (selectedMulti || selectedVip || selectedRegular) {
    const visited = new Set(scopedTours.flatMap((tour) => tour.data.destinations ?? []));
    const referenced = new Set(scopedTours.flatMap((tour) => [...excursionIdsForTour(tour)]));
    scopedPlaces = destinations.filter((place) => visited.has(place.data.id));
    scopedExcursions = excursions.filter((exc) => referenced.has(exc.data.id));
  }

  if (path === '/country/' || path === '/places/' || path === '/excursions/' || path === '/interests/') {
    if (!scopedTours.length) scopedTours = tours;
  }

  if (theme && !selectedMulti && !selectedVip && !selectedRegular) {
    scopedTours = tours.filter((tour) => themeIds(tour.data).includes(theme.id));
    scopedPlaces = destinations.filter((place) => place.data.themes.includes(theme.id));
    scopedExcursions = excursions.filter((exc) => exc.data.themes.includes(theme.id));
  }
  if (country && !selectedMulti && !selectedVip && !selectedRegular) {
    scopedTours = tours.filter((tour) => isMainCountry(tour.data, country.id));
  }
  if (country) {
    scopedPlaces = scopedPlaces.filter((place) => place.data.countryId === country.id);
    scopedExcursions = scopedExcursions.filter((exc) =>
      countryOfExcursion(exc.data, destinationById) === country.id);
  }
  if (theme && country && !selectedMulti && !selectedVip && !selectedRegular) {
    scopedTours = tours.filter((tour) =>
      themeIds(tour.data).includes(theme.id) && countryMembership(tour.data, country.id) > 0);
  }

  const directTour = tours.find((tour) => tourPath(tour.data) === path);
  const directPlace = destinations.find((place) => destinationPath(place.data) === path);
  const directExcursion = excursions.find((exc) => excursionPath(exc.data) === path);
  if (directTour) {
    scopedTours = [directTour];
    scopedPlaces = destinations.filter((place) => directTour.data.destinations.includes(place.data.id));
    const refs = excursionIdsForTour(directTour);
    scopedExcursions = excursions.filter((exc) => refs.has(exc.data.id));
  }
  if (directPlace) {
    scopedPlaces = [directPlace];
    scopedTours = tours.filter((tour) =>
      (tour.data.destinations ?? []).includes(directPlace.data.id));
    scopedExcursions = excursions.filter((exc) =>
      excursionDestinationIds(exc.data).includes(directPlace.data.id));
  }
  if (directExcursion) {
    scopedExcursions = [directExcursion];
    scopedTours = tours.filter((tour) =>
      excursionIdsForTour(tour).has(directExcursion.data.id));
    scopedPlaces = destinations.filter((place) =>
      excursionDestinationIds(directExcursion.data).includes(place.data.id));
  }

  const placeCatalog = destinations.find((place) => {
    const root = destinationPath(place.data);
    return path === root + 'tour/' || path === root + 'optional-tours/';
  });
  if (placeCatalog) {
    const optional = path.endsWith('/optional-tours/');
    scopedPlaces = [placeCatalog];
    scopedTours = tours.filter((tour) =>
      optional ? tourHasOptionalDestination(tour.data, placeCatalog.data.id)
        : tourHasMainDestination(tour.data, placeCatalog.data.id));
  }

  const excursionTour = excursions.find((exc) => tourExcursionPath(exc.data) === path);
  if (excursionTour) {
    scopedExcursions = [excursionTour];
    scopedTours = tours.filter((tour) => excursionIdsForTour(tour).has(excursionTour.data.id));
  }

  if (!directTour && !directPlace && !directExcursion) {
    if (path === '/places/') scopedPlaces = destinations;
    if (path === '/excursions/') scopedExcursions = excursions;
    if (country && path === countryPath(country) + 'place/') scopedPlaces =
      destinations.filter((place) => place.data.countryId === country.id);
    if (country && path === excursionCountryPath(country)) scopedExcursions =
      excursions.filter((exc) => countryOfExcursion(exc.data, destinationById) === country.id);
    const excursionPlace = excursionPlaceCatalogScope(path, { destinations, excursions, countries });
    if (excursionPlace) {
      scopedPlaces = excursionPlace.places;
      scopedExcursions = excursionPlace.excursions;
    }
  }

  return {
    tours: unique(scopedTours), places: unique(scopedPlaces), excursions: unique(scopedExcursions),
    country, theme, directTour, directPlace, directExcursion,
  };
}

function tourTableFromScope(ids, scope) {
  if (!ids.length || ids.length > 12 || new Set(ids).size !== ids.length) {
    throw new Error('SEO/GEO tour table expects 1–12 different tour IDs');
  }
  const byId = new Map(scope.tours.map((tour) => [tour.data.id, tour.data]));
  const lines = [
    '| Маршрут | Длительность | Стоимость по программе |',
    '|---|---|---|',
  ];
  for (const id of ids) {
    const tour = byId.get(id);
    if (!tour) throw new Error('SEO/GEO table tour is not in the current active selection: ' + id);
    const duration = Number.isInteger(tour.durationDays)
      ? seoGeoCount(tour.durationDays, ['день', 'дня', 'дней']) : 'Не указана';
    const price = vipTourPriceLabel(tour) || 'Не указана';
    lines.push('| [' + full(tour.title) + '](' + tourPath(tour) + ') | ' + duration + ' | ' + price + ' |');
  }
  return lines.join('\n');
}

export function seoGeoTemplateContext(scope, title) {
  const min = comparableUsdMinimum(scope.tours);
  const durations = scope.tours.map((t) => t.data.durationDays).filter((x) =>
    typeof x === 'number' && Number.isFinite(x) && x > 0);
  const country = scope.country;
  const theme = scope.theme;
  return {
    page: {
      title,
      countryName: country?.name ?? null,
      themeName: theme?.name ?? null,
    },
    catalog: {
      toursCount: scope.tours.length,
      toursCountPhrase: seoGeoCount(scope.tours.length, ['тур', 'тура', 'туров']),
      placesCount: scope.places.length,
      placesCountPhrase: seoGeoCount(scope.places.length, ['место', 'места', 'мест']),
      excursionsCount: scope.excursions.length,
      excursionsCountPhrase: seoGeoCount(scope.excursions.length, ['экскурсия', 'экскурсии', 'экскурсий']),
      hasTours: scope.tours.length > 0,
      hasPlaces: scope.places.length > 0,
      hasExcursions: scope.excursions.length > 0,
      hasDurationRange: durations.length === scope.tours.length && durations.length > 0,
      minDurationDays: durations.length ? Math.min(...durations) : null,
      maxDurationDays: durations.length ? Math.max(...durations) : null,
      hasComparableUsdPrice: min !== null,
      minUsdPriceLabel: min,
    },
    tourTable: (ids) => tourTableFromScope(ids, scope),
  };
}

export async function loadSeoGeoArticle(path, title) {
  if (!path || path === '/' || /\/page\/[0-9]+\/?$/.test(path)) return null;
  const canonical = normalizeSeoGeoPath(path);
  const filePath = '../../data/seo-geo/articles' + canonical + 'index.md';
  const loader = loaders[filePath];
  if (!loader) return null;
  if (!cache.has(canonical)) {
    cache.set(canonical, (async () => {
      const raw = await loader();
      const article = parseSeoGeoArticle(raw, filePath);
      if (article.targetPath !== canonical) {
        throw new Error('SEO/GEO MD target does not match path: ' + filePath);
      }
      if (article.status !== 'approved') return null;
      const data = await getData();
      const scope = seoGeoScope(canonical, data);
      const context = seoGeoTemplateContext(scope, title);
      const resolvedMarkdown = interpolateSeoGeoMarkdown(article.markdown, context);
      const lead = interpolateSeoGeoMarkdown(article.lead, context);
      const processor = await (processorPromise ??= createMarkdownProcessor());
      const { code } = await processor.render(resolvedMarkdown);
      validateSeoGeoHtml(code, { targetPath: canonical });
      const { headingHtml, bodyHtml } = extractSeoGeoHeading(code);
      return {
        ...article, lead, headingHtml, bodyHtml,
      };
    })());
  }
  return cache.get(canonical);
}
