/** Audit every active country/place/tour/excursion relation and its reachable HTML links. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import { isActiveEntity } from '../src/lib/archive.mjs';
import {
  countryPath, destinationCountryPath, destinationPath,
  excursionCountryPath, excursionDestinationPath, excursionGeography, excursionPath, tourExcursionPath,
  optionalTourDestinationPath, tourCountryPath, tourDestinationPath, tourPath, themePath,
} from '../src/lib/routes.ts';
import { excursionDestinationIds } from '../src/lib/destination-links.mjs';
import { excursionIdsForTour } from '../src/lib/excursion-popularity.ts';
import { buildInterestHub, interestsForCountry, interestTourCatalogPath, interestDestinationCatalogPath, interestExcursionCatalogPath, relatedInterestCatalogPath, themeIds } from '../src/lib/interest-model.mjs';
import { tourHasMainCountry, tourHasMainDestination, tourHasOptionalDestination } from '../src/lib/tour-relations.ts';

const dataOnly = process.argv.includes('--data-only');
const output = resolve('dist');
const read = (path) => readFileSync(path, 'utf8');
const collection = (name) => readdirSync(`src/content/${name}`).filter((file) => file.endsWith('.md'))
  .map((file) => yaml.load(read(`src/content/${name}/${file}`).split(/^---\s*$/m)[1]))
  .filter((data) => data?.id && data.locale === 'ru' && isActiveEntity(data));
const countries = collection('countries');
const destinations = collection('destinations');
const tours = collection('tours');
const excursions = collection('excursions');
const themes = collection('themes');
const excursionIdsByTour = new Map(tours.map((tour) => [tour.id, excursionIdsForTour({ data: tour })]));
const compactCountryById = new Map(JSON.parse(read('data/source-index/catalogs/countries.json')).entries.map((data) => [data.id, data]));
const excursionById = new Map(excursions.map((data) => [data.id, data]));
const compactExcursionById = new Map(JSON.parse(read('data/source-index/catalogs/excursions.json')).entries.map((data) => [data.id, data]));
const countryById = new Map(countries.map((data) => [data.id, data]));
const destinationById = new Map(destinations.map((data) => [data.id, data]));
const plannedById = new Map(JSON.parse(read('src/data/catalog/destinations.json')).map((data) => [data.id, data]));
const compactById = new Map(JSON.parse(read('data/source-index/catalogs/tours.json')).entries.map((data) => [data.id, data]));
const indexById = new Map(JSON.parse(read('data/source-index/index.json')).entries.map((data) => [data.id, data]));
const futureIds = new Set();
const counts = { countries: countries.length, destinations: destinations.length, tours: tours.length,
  themes: themes.length, themeTour: 0, themePlace: 0, themeExcursion: 0, themeRelated: 0, themedObjects: 0, dormantPlaceTheme: 0, countryTheme: 0, countryThemeOutsidePreview: 0, optionalOnlyThemeCountry: 0,
  excursions: excursions.length, countryExcursion: 0, placeExcursion: 0, relatedPlaceExcursion: 0, reservedPlaceExcursion: 0, tourExcursion: 0,
  countryPlace: 0, countryTour: 0, excludedAdditionalCountryTour: 0, placeTour: 0, optionalPlaceTour: 0, reservedPlaceTour: 0 };
const fileFor = (path) => resolve(output, `.${path}`, 'index.html');
const linksCache = new Map();
const links = (path) => {
  if (!linksCache.has(path)) {
    assert.ok(existsSync(fileFor(path)), `Published page is missing: ${path}`);
    const main = read(fileFor(path)).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
    assert.ok(main, `Published page has no main content: ${path}`);
    const anchors = new Set([...main.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)]
      .map((match) => new URL(match[1].replaceAll('&amp;', '&'), 'https://adatours.ru').pathname));
    linksCache.set(path, anchors);
  }
  return linksCache.get(path);
};
const catalogueCache = new Map();
const catalogueLinks = (path) => {
  if (!catalogueCache.has(path)) {
    const result = new Set(links(path));
    let previous = path;
    for (let page = 2; existsSync(fileFor(`${path}page/${page}/`)); page++) {
      const next = `${path}page/${page}/`;
      assert.ok(links(previous).has(next), `Catalogue pagination is unreachable: ${previous} → ${next}`);
      links(next).forEach((href) => result.add(href));
      previous = next;
    }
    catalogueCache.set(path, result);
  }
  return catalogueCache.get(path);
};
const direct = (from, to) => {
  if (!dataOnly) assert.ok(links(from).has(to), `Missing direct link: ${from} → ${to}`);
};
const reverse = (from, to, catalogue) => {
  if (dataOnly || links(from).has(to)) return;
  assert.ok(links(from).has(catalogue), `Missing reverse link or catalogue: ${from} → ${to}`);
  assert.ok(catalogueLinks(catalogue).has(to), `Missing catalogue relation: ${catalogue} → ${to}`);
};

// Compare complete relation catalogues, so missing and foreign/archive items both fail.
const exactCatalogue = (path, expectedIds) => {
  if (dataOnly) return;
  if (!expectedIds.length) {
    assert.ok(!existsSync(fileFor(path)), `Empty relation catalogue is published: ${path}`);
    return;
  }
  catalogueLinks(path);
  const found = [];
  for (let page = 1; ; page++) {
    const current = page === 1 ? path : `${path}page/${page}/`;
    if (!existsSync(fileFor(current))) break;
    found.push(...[...read(fileFor(current)).matchAll(/\bdata-catalog-item=["']([^"']+)["']/g)].map((match) => match[1]));
  }
  assert.equal(new Set(found).size, found.length, `Repeated relation catalogue items: ${path}`);
  assert.deepEqual([...found].sort(), [...expectedIds].sort(), `Catalogue differs from active relations: ${path}`);
};
for (const country of countries) {
  const entry = JSON.parse(read(`data/source-index/entries/${country.id}.json`));
  for (const [label, record] of [['entry', entry], ['compact catalog', compactCountryById.get(country.id)], ['index', indexById.get(country.id)]]) {
    assert.ok(record, `${country.id}: missing ${label}`);
    assert.equal(record.slug, country.slug, `${country.id}: slug differs in ${label}`);
    assert.equal(record.url, countryPath(country), `${country.id}: country URL differs in ${label}`);
    assert.deepEqual(record.countryIds, [country.id], `${country.id}: identity differs in ${label}`);
    assert.ok(!record.themes?.length && !record.relatedThemes?.length, `${country.id}: manual interests in ${label}`);
  }
  assert.ok(!country.themes?.length && !country.relatedThemes?.length, `${country.id}: manual country interests`);
  exactCatalogue(destinationCountryPath(country), destinations.filter((place) => place.countryId === country.id).map((place) => place.id));
  exactCatalogue(tourCountryPath(country), tours.filter((tour) => tourHasMainCountry(tour, country.id)).map((tour) => tour.id));
  exactCatalogue(excursionCountryPath(country), excursions.filter((excursion) => excursionGeography(excursion).country.id === country.id).map((excursion) => excursion.id));
}
for (const place of destinations) {
  exactCatalogue(tourDestinationPath(place), tours.filter((tour) => tourHasMainDestination(tour, place.id)).map((tour) => tour.id));
  exactCatalogue(optionalTourDestinationPath(place), tours.filter((tour) => tourHasOptionalDestination(tour, place.id)).map((tour) => tour.id));
  const country = countryById.get(place.countryId);
  assert.ok(country, `${place.id}: unpublished country ${place.countryId}`);
  assert.equal(plannedById.get(place.id)?.countryId, place.countryId, `${place.id}: catalog country differs`);
  direct(destinationPath(place), countryPath(country));
  reverse(countryPath(country), destinationPath(place), destinationCountryPath(country));
  counts.countryPlace++;
}
for (const tour of tours) {
  const entry = JSON.parse(read(`data/source-index/entries/${tour.id}.json`));
  for (const [label, record] of [['entry', entry], ['compact catalog', compactById.get(tour.id)], ['index', indexById.get(tour.id)]]) {
    assert.ok(record, `${tour.id}: missing ${label}`);
    assert.equal(record.slug, tour.slug, `${tour.id}: slug differs in ${label}`);
    assert.equal(record.url, tourPath(tour), `${tour.id}: canonical URL differs in ${label}`);
    for (const field of ['primaryThemes', 'themes']) assert.deepEqual(record[field], tour[field], `${tour.id}: ${field} differs in ${label}`);
    for (const [field, sourceField] of [['countries', 'countryIds'], ['destinations', 'destinationIds'], ['routeCountries', 'routeCountryIds'], ['routeDestinations', 'routeDestinationIds']]) {
      assert.deepEqual(record[sourceField], tour[field], `${tour.id}: ${field} differs in ${label}`);
    }
  }
  assert.equal(new Set(tour.countries).size, tour.countries.length, `${tour.id}: duplicate countries`);
  assert.equal(new Set(tour.destinations).size, tour.destinations.length, `${tour.id}: duplicate places`);
  for (const id of tour.routeCountries ?? []) assert.ok(tour.countries.includes(id), `${tour.id}: main country absent from full geography`);
  for (const id of tour.routeDestinations ?? []) assert.ok(tour.destinations.includes(id), `${tour.id}: main place absent from full geography`);
  for (const id of tour.countries) {
    const country = countryById.get(id);
    assert.ok(country, `${tour.id}: unpublished country ${id}`);
    const main = tourHasMainCountry(tour, id);
    if (main) {
      direct(tourPath(tour), countryPath(country));
      reverse(countryPath(country), tourPath(tour), tourCountryPath(country));
      counts.countryTour++;
    } else {
      counts.excludedAdditionalCountryTour++;
      if (!dataOnly) {
        assert.ok(!links(tourPath(tour)).has(countryPath(country)), `Additional-country link leaked onto tour page: ${tour.id} → ${country.id}`);
        assert.ok(!links(countryPath(country)).has(tourPath(tour)), `Additional-country tour leaked onto country page: ${country.id} → ${tour.id}`);
        if (existsSync(fileFor(tourCountryPath(country)))) {
          assert.ok(!catalogueLinks(tourCountryPath(country)).has(tourPath(tour)), `Additional-country tour leaked into country catalogue: ${country.id} → ${tour.id}`);
        }
      }
    }
  }
  for (const id of tour.destinations) {
    const planned = plannedById.get(id);
    assert.ok(planned, `${tour.id}: unknown place ${id}`);
    assert.ok(tour.countries.includes(planned.countryId), `${tour.id}: missing country of ${id}`);
    const place = destinationById.get(id);
    if (!place) {
      futureIds.add(id);
      counts.reservedPlaceTour++;
      if (!dataOnly) assert.ok(!links(tourPath(tour)).has(destinationPath(planned)), `Tour links to an unpublished place: ${tour.id} → ${id}`);
      continue;
    }
    const main = tourHasMainDestination(tour, id);
    direct(tourPath(tour), destinationPath(place));
    reverse(destinationPath(place), tourPath(tour), main ? tourDestinationPath(place) : optionalTourDestinationPath(place));
    counts.placeTour++;
    if (!main) counts.optionalPlaceTour++;
  }
}
for (const excursion of excursions) {
  exactCatalogue(tourExcursionPath(excursion), tours.filter((tour) => excursionIdsByTour.get(tour.id).has(excursion.id)).map((tour) => tour.id));
  const entry = JSON.parse(read(`data/source-index/entries/${excursion.id}.json`));
  for (const [label, record] of [['entry', entry], ['compact catalog', compactExcursionById.get(excursion.id)], ['index', indexById.get(excursion.id)]]) {
    assert.ok(record, `${excursion.id}: missing ${label}`);
    assert.deepEqual(record.countryIds, [excursion.country], `${excursion.id}: country differs in ${label}`);
    assert.deepEqual(record.destinationIds, excursion.destination ? [excursion.destination] : [], `${excursion.id}: primary place differs in ${label}`);
    assert.deepEqual(record.relatedDestinationIds ?? [], excursion.relatedDestinations ?? [], `${excursion.id}: related places differ in ${label}`);
  }
  assert.equal(new Set(excursion.relatedDestinations ?? []).size, (excursion.relatedDestinations ?? []).length, `${excursion.id}: duplicate related places`);
  assert.ok(!(excursion.relatedDestinations ?? []).includes(excursion.destination), `${excursion.id}: primary place repeated as related`);
  const country = countryById.get(excursionGeography(excursion).country.id);
  assert.ok(country, `${excursion.id}: unpublished geographic country`);
  direct(excursionPath(excursion), countryPath(country));
  reverse(countryPath(country), excursionPath(excursion), excursionCountryPath(country));
  counts.countryExcursion++;
  for (const id of excursionDestinationIds(excursion)) {
    const planned = plannedById.get(id);
    assert.ok(planned, `${excursion.id}: unknown place ${id}`);
    const place = destinationById.get(id);
    if (!place) {
      futureIds.add(id);
      counts.reservedPlaceExcursion++;
      if (!dataOnly) assert.ok(!links(excursionPath(excursion)).has(destinationPath(planned)), `Excursion links to an unpublished place: ${excursion.id} → ${id}`);
      continue;
    }
    direct(excursionPath(excursion), destinationPath(place));
    reverse(destinationPath(place), excursionPath(excursion), excursionDestinationPath(place));
    counts.placeExcursion++;
    if (id !== excursion.destination) counts.relatedPlaceExcursion++;
  }
}
for (const tour of tours) {
  for (const id of excursionIdsByTour.get(tour.id)) {
    const excursion = excursionById.get(id);
    assert.ok(excursion, `${tour.id}: reference to an unpublished excursion ${id}`);
    direct(tourPath(tour), excursionPath(excursion));
    reverse(excursionPath(excursion), tourPath(tour), tourExcursionPath(excursion));
    counts.tourExcursion++;
  }
}
const interestCollections = { countries, tours, destinations, excursions, themes };
const interestHubById = new Map(themes.map((theme) => [theme.id, buildInterestHub(theme.id, interestCollections)]));
for (const theme of themes) {
  const hub = interestHubById.get(theme.id);
  const root = interestTourCatalogPath(theme);
  if (hub.allTours.length) {
    direct(themePath(theme), root);
    exactCatalogue(root, hub.allTours.map((tour) => tour.id));
    direct(root, themePath(theme));
  }
  for (const tour of hub.allTours) {
    direct(tourPath(tour), themePath(theme));
    reverse(themePath(theme), tourPath(tour), root);
    counts.themeTour++;
  }
  const experienceCatalogs = [
    { kind: 'destination', path: interestDestinationCatalogPath(theme), rows: hub.allExperiences.filter((row) => row.kind === 'destination'), count: 'themePlace' },
    { kind: 'excursion', path: interestExcursionCatalogPath(theme), rows: hub.allExperiences.filter((row) => row.kind === 'excursion'), count: 'themeExcursion' },
  ];
  for (const catalog of experienceCatalogs) {
    exactCatalogue(catalog.path, catalog.rows.map((row) => row.id));
    if (catalog.rows.length) { direct(themePath(theme), catalog.path); direct(catalog.path, themePath(theme)); }
    for (const row of catalog.rows) {
      const entity = row.entry;
      const path = row.kind === 'destination' ? destinationPath(entity) : excursionPath(entity);
      assert.ok(themeIds(entity).includes(theme.id), `${entity.id}: inherited interest ${theme.id}`);
      if (row.kind === 'excursion') assert.equal(row.countryId, excursionGeography(entity).country.id, `${entity.id}: wrong thematic geographic country`);
      direct(path, themePath(theme));
      reverse(themePath(theme), path, catalog.path);
      counts[catalog.count]++;
    }
  }
  const relatedCatalog = relatedInterestCatalogPath(theme);
  exactCatalogue(relatedCatalog, hub.allRelatedThemes.map((row) => row.entry.id));
  if (hub.allRelatedThemes.length) { direct(themePath(theme), relatedCatalog); direct(relatedCatalog, themePath(theme)); }
  for (const row of hub.allRelatedThemes) {
    const other = row.entry;
    const reverseHub = interestHubById.get(other.id);
    const reverseRow = reverseHub.allRelatedThemes.find((candidate) => candidate.entry.id === theme.id);
    assert.equal(reverseRow?.tourCount, row.tourCount, `${theme.id}: asymmetric shared tours with ${other.id}`);
    reverse(themePath(theme), themePath(other), relatedCatalog);
    reverse(themePath(other), themePath(theme), relatedInterestCatalogPath(other));
    counts.themeRelated++;
  }
  for (const row of hub.allCountries) {
    const country = row.entry;
    const catalog = interestTourCatalogPath(theme, country);
    assert.ok(interestsForCountry(country.id, tours, themes).some((interest) => interest.id === theme.id), `${country.id}: asymmetric interest projection ${theme.id}`);
    direct(countryPath(country), themePath(theme));
    // The seven country banners remain a preview; the full catalogue exposes all countries.
    direct(root, catalog);
    exactCatalogue(catalog, row.tours.map((tour) => tour.id));
    if (!dataOnly) {
      for (let page = 1; ; page++) {
        const current = page === 1 ? catalog : `${catalog}page/${page}/`;
        if (!existsSync(fileFor(current))) break;
        direct(current, countryPath(country));
        direct(current, themePath(theme));
        direct(current, root);
      }
    }
    counts.countryTheme++;
    if (!hub.countries.some((preview) => preview.entry.id === country.id)) counts.countryThemeOutsidePreview++;
    if (!row.mainCount) counts.optionalOnlyThemeCountry++;
  }
}
for (const [entities, pathFor] of [[tours, tourPath], [destinations, destinationPath], [excursions, excursionPath]]) {
  for (const entity of entities) {
    for (const id of themeIds(entity)) {
      const theme = themes.find((row) => row.id === id);
      assert.ok(theme, `${entity.id}: unpublished interest ${id}`);
      direct(pathFor(entity), themePath(theme));
      if (entities === destinations && !interestHubById.get(id).allExperiences.some((row) => row.id === entity.id)) counts.dormantPlaceTheme++;
    }
    if (themeIds(entity).length) counts.themedObjects++;
  }
}
console.log(JSON.stringify({ mode: dataOnly ? 'data' : 'data-and-html', ...counts,
  reservedDestinationIds: [...futureIds].sort(), errors: 0 }, null, 2));
