/** Pure registration projection. No article/provenance/claim writes or publication claims. */
import { isActiveEntity, isArchivedEntity } from './archive.mjs';
import { canonicalPath, countryPath, countryRoute, destinationCountryPath, excursionCountryPath,
  excursionDestinationPath, excursionGeography, optionalTourDestinationPath, tourCountryPath,
  tourDestinationPath, tourExcursionPath } from './routes.ts';
import { tourHasMainCountry, tourHasMainDestination, tourHasOptionalDestination } from './tour-relations.ts';
import { excursionIdsForTour } from './excursion-popularity.ts';
import { excursionDestinationIds } from './destination-links.mjs';
import { buildVipFilterIndex } from './vip-filters.mjs';

const data = (entry) => entry?.data ?? entry;
const activeRu = (entry) => data(entry)?.locale === 'ru' && isActiveEntity(entry);
const ENTITY_KINDS = new Set(['country', 'interest', 'tour', 'destination', 'excursion']);
const MANAGED = new Map([
  [1, new Set(['country_index', 'country'])],
  [2, new Set(['interest_index', 'interest'])],
  [5, new Set(['tour_index', 'vip_index', 'multi_country', 'country_tours', 'vip_country',
    'destination_tours', 'optional_destination_tours', 'excursion_tours', 'tour'])],
  [6, new Set(['places_index', 'country_places', 'destination'])],
  [7, new Set(['excursions_index', 'country_excursions', 'destination_excursions', 'excursion'])],
]);
const COUNTS = ['tours', 'destinations', 'excursions'];

export function projectRuntimeRegistryRows(content, destinationCatalog) {
  for (const key of ['countries', 'themes', 'tours', 'destinations', 'excursions']) {
    if (!Array.isArray(content?.[key])) throw new Error('Missing runtime collection: ' + key);
  }
  if (!Array.isArray(destinationCatalog)) throw new Error('Missing destination routing catalogue');
  const countries = content.countries.filter(activeRu), themes = content.themes.filter(activeRu);
  const tours = content.tours.filter(activeRu), destinations = content.destinations.filter(activeRu);
  const excursions = content.excursions.filter(activeRu);
  const byDestination = new Map(destinationCatalog.map((row) => [row.id, row]));
  const rows = [], urls = new Set();
  const add = (phase, kind, name, url, extra = {}) => {
    if (urls.has(url)) throw new Error('Duplicate projected runtime canonical URL: ' + url);
    urls.add(url);
    rows.push({ phase, kind, name, url, ...extra,
      availability: ENTITY_KINDS.has(kind) ? 'active_runtime_entity' : 'active_runtime_catalogue' });
  };
  for (const [phase, kind, name, url, id] of [
    [1, 'country_index', 'Страны', '/country/', 'index_countries'],
    [2, 'interest_index', 'Интересы', '/interests/', 'index_themes'],
    [5, 'tour_index', 'Туры', '/tours/', 'index_tours'],
    [5, 'multi_country', 'Путешествия по нескольким странам', '/multi-country/', 'multi_country'],
    [6, 'places_index', 'Места', '/places/', 'index_destinations'],
    [7, 'excursions_index', 'Экскурсии', '/excursions/', 'index_excursions'],
  ]) add(phase, kind, name, url, { id });
  for (const entry of countries) {
    const d = data(entry);
    add(1, 'country', d.name, countryPath(d), { id: d.id, countryId: d.id });
    const mainTours = tours.filter((tour) => tourHasMainCountry(data(tour), d.id));
    if (mainTours.length) add(5, 'country_tours', 'Туры: ' + d.name, tourCountryPath(d),
      { id: 'country_tours:' + d.id, countryId: d.id, tours: mainTours.length });
    const places = destinations.filter((place) => data(place).countryId === d.id);
    if (places.length) add(6, 'country_places', 'Места: ' + d.name, destinationCountryPath(d),
      { id: 'country_places:' + d.id, countryId: d.id, destinations: places.length });
  }
  for (const entry of themes) {
    const d = data(entry);
    add(2, 'interest', d.name, canonicalPath({ type: 'theme', ...d }), { id: d.id, themeId: d.id });
  }
  for (const entry of tours) {
    const d = data(entry), ids = d.routeCountries ?? d.countries;
    add(5, 'tour', d.title, canonicalPath({ type: 'tour', id: d.id, slug: d.slug,
      countryIds: d.countries, routeCountryIds: d.routeCountries }),
    { id: d.id, ...(ids.length === 1 ? { countryId: ids[0] } : { countryIds: [...ids] }) });
  }
  for (const entry of destinations) {
    const d = data(entry);
    add(6, 'destination', d.name, canonicalPath({ type: 'destination', id: d.id, slug: d.slug, countryIds: [d.countryId] }),
      { id: d.id, countryId: d.countryId });
    const mainTours = tours.filter((tour) => tourHasMainDestination(data(tour), d.id));
    if (mainTours.length) add(5, 'destination_tours', 'Туры через ' + d.name, tourDestinationPath(d),
      { id: 'destination_tours:' + d.id, countryId: d.countryId, destinationId: d.id, tours: mainTours.length });
    const optionalTours = tours.filter((tour) => tourHasOptionalDestination(data(tour), d.id));
    if (optionalTours.length) add(5, 'optional_destination_tours', 'Туры с дополнительным посещением: ' + d.name, optionalTourDestinationPath(d),
      { id: 'optional_destination_tours:' + d.id, countryId: d.countryId, destinationId: d.id, tours: optionalTours.length });
  }
  const tourRefs = new Map(tours.map((tour) => [data(tour).id, excursionIdsForTour(tour)]));
  const excursionsByCountry = new Map(), excursionsByDestination = new Map();
  for (const entry of excursions) {
    const d = data(entry), geography = excursionGeography(d);
    add(7, 'excursion', d.title, canonicalPath({ type: 'excursion', id: d.id, slug: d.slug,
      countryIds: [d.country], destinationIds: d.destination ? [d.destination] : [] }),
    { id: d.id, countryId: geography.country.id, ...(d.destination ? { destinationId: d.destination } : {}) });
    const relatedTours = tours.filter((tour) => tourRefs.get(data(tour).id).has(d.id));
    if (relatedTours.length) add(5, 'excursion_tours', 'Туры с экскурсией: ' + d.title, tourExcursionPath(d),
      { id: 'excursion_tours:' + d.id, countryId: geography.country.id, excursionId: d.id, tours: relatedTours.length });
    const countryGroup = excursionsByCountry.get(geography.country.id) ?? new Set();
    countryGroup.add(d.id); excursionsByCountry.set(geography.country.id, countryGroup);
    for (const id of excursionDestinationIds(d)) {
      if (!byDestination.has(id)) throw new Error(`Unknown related destination ${id} in ${d.id}`);
      const group = excursionsByDestination.get(id) ?? new Set();
      group.add(d.id); excursionsByDestination.set(id, group);
    }
  }
  for (const [id, group] of excursionsByCountry) {
    const country = countryRoute(id);
    add(7, 'country_excursions', 'Экскурсии: ' + country.name, excursionCountryPath(country),
      { id: 'country_excursions:' + id, countryId: id, excursions: group.size });
  }
  for (const [id, group] of excursionsByDestination) {
    const place = byDestination.get(id);
    add(7, 'destination_excursions', 'Экскурсии: ' + place.name, excursionDestinationPath(place),
      { id: 'destination_excursions:' + id, countryId: place.countryId, destinationId: id, excursions: group.size });
  }
  for (const row of buildVipFilterIndex(tours, countries, themes).filter((row) => !row.themeId)) {
    add(5, row.countryId ? 'vip_country' : 'vip_index', row.title, row.href,
      { id: row.countryId ? 'vip:' + row.countryId : 'vip', ...(row.countryId ? { countryId: row.countryId } : {}), tours: row.count });
  }
  return rows.sort((a, b) => a.phase - b.phase || a.url.localeCompare(b.url, 'en'));
}

/** Add missing targets into each branch's own queue; never copy another branch's editorial state. */
export function reconcileRuntimeRegistries(phases, content, destinationCatalog) {
  const output = JSON.parse(JSON.stringify(phases));
  const desired = projectRuntimeRegistryRows(content, destinationCatalog);
  const desiredByUrl = new Map(desired.map((row) => [row.url, row]));
  const seen = new Set(), phaseByNumber = new Map(output.map((phase) => [phase.phase, phase]));
  const sourceById = new Map(Object.values(content).filter(Array.isArray).flat().map((entry) => [data(entry)?.id, data(entry)]));
  for (const phase of output) {
    if (!Array.isArray(phase.entries)) throw new Error('Malformed SEO phase ' + phase.phase);
    phase.entries = phase.entries.map((prior) => {
      if (seen.has(prior.url)) throw new Error('Duplicate registry canonical URL: ' + prior.url);
      seen.add(prior.url);
      const row = desiredByUrl.get(prior.url);
      if (row) {
        if (row.phase !== phase.phase || prior.phase !== phase.phase || row.kind !== prior.kind) {
          throw new Error('Canonical registry phase/kind conflict: ' + prior.url);
        }
        if (ENTITY_KINDS.has(row.kind) && prior.id && prior.id !== row.id) {
          throw new Error('Canonical registry identity conflict: ' + prior.url);
        }
        const updated = { ...prior };
        if (ENTITY_KINDS.has(row.kind) && !updated.id) updated.id = row.id;
        for (const key of COUNTS) if (Object.hasOwn(row, key)) updated[key] = row[key];
        if (['temporarily_unavailable', 'waiting_for_page'].includes(prior.work)) {
          updated.availability = row.availability;
          updated.work = prior.workBeforeUnavailable ?? 'queued';
          delete updated.workBeforeUnavailable;
        } else if (['temporarily_unavailable', 'missing', 'needs_content'].includes(prior.availability)) {
          updated.availability = row.availability;
        }
        return updated;
      }
      if (!MANAGED.get(phase.phase)?.has(prior.kind) || prior.work === 'archived') return prior;
      // A reserved object is not a published page and remains in its existing preparation state.
      if (prior.work === 'waiting_for_page' || ['needs_content', 'planned_unverified'].includes(prior.availability)) return prior;
      const entity = sourceById.get(prior.id);
      if (entity && isArchivedEntity(entity)) return { ...prior, work: 'archived' };
      const unavailable = { ...prior, availability: 'temporarily_unavailable' };
      for (const key of COUNTS) if (Object.hasOwn(unavailable, key)) unavailable[key] = 0;
      if (prior.work !== 'temporarily_unavailable') {
        unavailable.workBeforeUnavailable = prior.work;
        unavailable.work = 'temporarily_unavailable';
      }
      return unavailable;
    });
  }
  for (const row of desired) if (!seen.has(row.url)) {
    const phase = phaseByNumber.get(row.phase);
    if (!phase) throw new Error('Missing SEO registry phase ' + row.phase);
    const lastOfKind = phase.entries.findLastIndex((entry) => entry.kind === row.kind);
    phase.entries.splice(lastOfKind < 0 ? phase.entries.length : lastOfKind + 1, 0, { ...row, work: 'queued' });
    seen.add(row.url);
  }
  return output;
}
