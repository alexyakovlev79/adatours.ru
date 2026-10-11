import { getCollection } from 'astro:content';
import { isActiveEntity } from './archive.mjs';
import { tourPath } from './routes';
import { selectVipTours } from './vip-tours.mjs';
import { buildVipCountryIndex } from './vip-countries.mjs';

let cataloguePaths: Promise<ReadonlySet<string>> | undefined;

async function loadVipTourPaths(): Promise<ReadonlySet<string>> {
  const tours = await getCollection('tours', ({ data }) => data.locale === 'ru' && isActiveEntity(data));
  return new Set(selectVipTours(tours).entries.map((entry) => tourPath(entry.data)));
}

// Share one selection across the build, using the complete active catalogue.
export function getVipTourPaths(): Promise<ReadonlySet<string>> {
  return cataloguePaths ??= loadVipTourPaths();
}

let countryIndex: ReturnType<typeof loadVipCountryIndex> | undefined;
async function loadVipCountryIndex() {
  const activeRu = ({ data }) => data.locale === 'ru' && isActiveEntity(data);
  const [tours, countries] = await Promise.all([
    getCollection('tours', activeRu), getCollection('countries', activeRu),
  ]);
  return buildVipCountryIndex(tours, countries);
}
export function getVipCountryIndex() {
  return countryIndex ??= loadVipCountryIndex();
}
