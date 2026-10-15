import { buildTourFilterIndex } from './tour-filters.mjs';
import { buildVipFilterIndex } from './vip-filters.mjs';
import { buildInterestHub, interestDestinationCatalogPath, interestExcursionCatalogPath, relatedInterestCatalogPath } from './interest-model.mjs';
import { buildMultiCountryCombinations } from './multi-country-combinations.mjs';
import { isActiveEntity, isArchivedPath } from './archive.mjs';

const data = (entry) => entry?.data ?? entry;
const activeRu = (entry) => data(entry).locale === 'ru' && isActiveEntity(entry);

// Use the same data-only tour/theme/VIP selectors as Astro. Never infer a URL by its spelling.
export function buildSeoGeoCanonicalPaths({ countries = [], destinations = [], tours = [], excursions = [], themes = [], destinationCatalog = [], staticPaths = [] }) {
  const countryRows = countries.filter(activeRu), destinationRows = destinations.filter(activeRu);
  const tourRows = tours.filter(activeRu), excursionRows = excursions.filter(activeRu), themeRows = themes.filter(activeRu);
  const countryById = new Map(countryRows.map((entry) => [data(entry).id, data(entry)]));
  const destinationById = new Map(destinationCatalog.map((entry) => [entry.id, entry]));
  const mainCountries = (tour) => data(tour).routeCountries ?? data(tour).countries ?? [];
  const mainPlaces = (tour) => data(tour).routeDestinations ?? data(tour).destinations ?? [];
  const tourExcursions = (tour) => new Set((data(tour).itinerary ?? []).flatMap((day) =>
    [day.excursionRef, ...(day.contentBlocks ?? []).filter((block) => block.type === 'excursion').map((block) => block.excursionRef)]).filter(Boolean));
  const routes = new Set(['/country/', '/places/', '/tours/', '/excursions/', '/interests/', '/multi-country/', ...staticPaths]);
  const add = (path) => { if (path && !/\/page\/\d+\/$/.test(path) && !isArchivedPath(path)) routes.add(path); };
  const activeCountryIds = new Set(countryRows.map((row) => data(row).id));
  for (const country of countryRows) add(`/${data(country).slug}/`);
  for (const entry of destinationRows) {
    const d = data(entry), country = countryById.get(d.countryId);
    if (!country) continue;
    const path = `/${country.slug}/place/${d.slug}/`;
    add(path);
    if (tourRows.some((tour) => mainPlaces(tour).includes(d.id))) add(`${path}tour/`);
    if (tourRows.some((tour) => (data(tour).destinations ?? []).includes(d.id) && !mainPlaces(tour).includes(d.id))) add(`${path}optional-tours/`);
  }
  for (const entry of tourRows) {
    const d = data(entry), selected = [...new Set(mainCountries(entry))];
    if (!selected.length || selected.some((id) => !activeCountryIds.has(id))) continue;
    add(`/${selected.length === 1 ? countryById.get(selected[0]).slug : 'multi-country'}/tour/${d.slug}/`);
  }
  for (const entry of excursionRows) {
    const d = data(entry), place = destinationById.get(d.destination), country = countryById.get(place?.countryId ?? d.country);
    if (!country) continue;
    const path = `${place ? `/${country.slug}/${place.slug}/` : `/${country.slug}/excursion/`}${d.slug}/`;
    add(path);
    if (tourRows.some((tour) => tourExcursions(tour).has(d.id))) add(`${path}tour/`);
    for (const destinationId of [d.destination, ...(d.relatedDestinations ?? [])].filter(Boolean)) {
      const linked = destinationById.get(destinationId), linkedCountry = countryById.get(linked?.countryId);
      if (linked && linkedCountry) add(`/${linkedCountry.slug}/${linked.slug}/`);
    }
  }
  for (const country of countryRows) {
    const d = data(country), path = `/${d.slug}/`;
    if (destinationRows.some((entry) => data(entry).countryId === d.id)) add(`${path}place/`);
    if (tourRows.some((entry) => mainCountries(entry).includes(d.id))) add(`${path}tour/`);
    if (excursionRows.some((entry) => {
      const dExc = data(entry);
      return (destinationById.get(dExc.destination)?.countryId ?? dExc.country) === d.id;
    })) add(`${path}excursion/`);
  }
  for (const theme of themeRows) add(`/interests/${data(theme).slug}/`);
  for (const row of buildTourFilterIndex(tourRows, countryRows, themeRows)) add(row.href);
  for (const row of buildVipFilterIndex(tourRows, countryRows, themeRows)) add(row.href);
  for (const theme of themeRows) {
    const hub = buildInterestHub(data(theme).id, { countries: countryRows, destinations: destinationRows, tours: tourRows, excursions: excursionRows, themes: themeRows });
    if (hub.allExperiences.some((row) => row.kind === 'destination')) add(interestDestinationCatalogPath(theme));
    if (hub.allExperiences.some((row) => row.kind === 'excursion')) add(interestExcursionCatalogPath(theme));
    if (hub.allRelatedThemes.length) add(relatedInterestCatalogPath(theme));
  }
  for (const row of buildMultiCountryCombinations(tourRows, (tour) =>
    mainCountries(tour).map((id) => countryById.get(id)).filter(Boolean))) add(row.path);
  return routes;
}
