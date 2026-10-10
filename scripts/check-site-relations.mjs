/** Audit every active country/place/tour relation and its reachable HTML links. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import { isActiveEntity } from '../src/lib/archive.mjs';
import {
  countryPath, destinationCountryPath, destinationPath,
  optionalTourDestinationPath, tourCountryPath, tourDestinationPath, tourPath,
} from '../src/lib/routes.ts';
import { tourHasMainCountry, tourHasMainDestination } from '../src/lib/tour-relations.ts';

const dataOnly = process.argv.includes('--data-only');
const output = resolve('dist');
const read = (path) => readFileSync(path, 'utf8');
const collection = (name) => readdirSync(`src/content/${name}`).filter((file) => file.endsWith('.md'))
  .map((file) => yaml.load(read(`src/content/${name}/${file}`).split(/^---\s*$/m)[1]))
  .filter((data) => data?.id && data.locale === 'ru' && isActiveEntity(data));
const countries = collection('countries');
const destinations = collection('destinations');
const tours = collection('tours');
const countryById = new Map(countries.map((data) => [data.id, data]));
const destinationById = new Map(destinations.map((data) => [data.id, data]));
const plannedById = new Map(JSON.parse(read('src/data/catalog/destinations.json')).map((data) => [data.id, data]));
const compactById = new Map(JSON.parse(read('data/source-index/catalogs/tours.json')).entries.map((data) => [data.id, data]));
const indexById = new Map(JSON.parse(read('data/source-index/index.json')).entries.map((data) => [data.id, data]));
const futureIds = new Set();
const counts = { countries: countries.length, destinations: destinations.length, tours: tours.length,
  countryPlace: 0, countryTour: 0, excludedAdditionalCountryTour: 0, placeTour: 0, optionalPlaceTour: 0, reservedPlaceTour: 0 };
const fileFor = (path) => resolve(output, `.${path}`, 'index.html');
const linksCache = new Map();
const links = (path) => {
  if (!linksCache.has(path)) {
    assert.ok(existsSync(fileFor(path)), `Published page is missing: ${path}`);
    const anchors = new Set([...read(fileFor(path)).matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)]
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

for (const place of destinations) {
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
console.log(JSON.stringify({ mode: dataOnly ? 'data' : 'data-and-html', ...counts,
  reservedDestinationIds: [...futureIds].sort(), errors: 0 }, null, 2));
