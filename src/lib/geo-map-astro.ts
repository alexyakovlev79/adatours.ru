import {getCollection} from 'astro:content';
import {isActiveEntity} from './archive.mjs';
import destinationCatalog from '../data/catalog/destinations.json';
import {excursionPath} from './routes';
import {makeGeoIndex, tourVisits, excursionVisits, finalizeGeoMap, destinationNeighborhoodMap} from './geo-route-data.mjs';

// Only passports already published by the GEO master in main are usable here.
// Immutable staging results must never be imported into a public map.
const passportModules = import.meta.glob('../../data/geo-knowledge/entities/*.json', {
  eager: true, import: 'default',
});
const passports = new Map(Object.values(passportModules).map((p: any) => [p.stableId, p]));
let cachedSources: Promise<{index: any; excursions: Map<string, any>}> | undefined;

function loadMapSources() {
  if (!cachedSources) cachedSources = Promise.all([
    getCollection('destinations', ({data}) => data.locale === 'ru' && isActiveEntity(data)),
    getCollection('excursions', ({data}) => data.locale === 'ru' && isActiveEntity(data)),
  ]).then(([destinations, excursions]) => ({
    index: makeGeoIndex({
      catalog: destinationCatalog,
      destinations: new Map(destinations.map(e => [e.data.id, e.data])),
      passports,
    }),
    excursions: new Map(excursions.map(e => [e.data.id, e.data])),
  }));
  return cachedSources;
}

// Shared compact static map index fetched only while the Places search tab is active.
// No GEO catalogue or passports are embedded into every page's HTML.
export async function getSearchGeoPlaces() {
  const {index} = await loadMapSources();
  return [...index.entries.values()].map((point: any) => ({
    url:point.href,coordinates:point.coordinates,
  }));
}

export async function buildPageGeoMap(kind: 'tour' | 'destination' | 'excursion', data: any, relatedDestinationIds: string[] = []) {
  if (data.locale !== 'ru' || !isActiveEntity(data)) return null;
  const {index, excursions} = await loadMapSources();
  if (kind === 'destination') {
    return destinationNeighborhoodMap(data.id, relatedDestinationIds, index);
  }
  const model = finalizeGeoMap(
    kind === 'tour' ? tourVisits(data, index, excursions) : excursionVisits(data, index),
    index,
  );
  // A one-place excursion represents itself rather than its parent destination.
  if (kind === 'excursion' && model?.points.length === 1) {
    Object.assign(model.points[0], {id:data.id, name:data.title, image:data.hero?.src || '',
      description:data.lead || '', href:excursionPath(data)});
  }
  return model;
}
