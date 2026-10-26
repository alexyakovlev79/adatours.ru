import { excursionDestinationPath, routeDestinationById } from './routes.ts';
import { excursionDestinationIds } from './destination-links.mjs';
import { isActiveEntity } from './archive.mjs';

const data = entry => entry?.data ?? entry;
const activeRu = entry => data(entry)?.locale === 'ru' && isActiveEntity(entry);

/** A public excursion catalogue may exist before its place's own MD page. */
export function excursionPlaceCatalogScope(pagePath, { destinations = [], excursions = [], countries = [],
  destinationCatalog = [...routeDestinationById.values()] } = {}) {
  const countryById = new Map(countries.filter(activeRu).map(entry => [data(entry).id, data(entry)]));
  const livePlaces = destinations.filter(activeRu);
  const byId = new Map(destinationCatalog.map(entry => [data(entry).id, data(entry)]));
  for (const entry of livePlaces) byId.set(data(entry).id, data(entry));
  const place = [...byId.values()].find(candidate => {
    const country = countryById.get(candidate.countryId);
    return country && excursionDestinationPath({ ...candidate, countrySlug: country.slug }) === pagePath;
  });
  if (!place) return null;
  return { destinationId: place.id,
    places: livePlaces.filter(entry => data(entry).id === place.id),
    excursions: excursions.filter(activeRu).filter(entry => excursionDestinationIds(data(entry)).includes(place.id)) };
}
