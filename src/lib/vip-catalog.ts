import { getCollection } from 'astro:content';
import { isActiveEntity } from './archive.mjs';
import { tourPath } from './routes';
import { selectVipTours } from './vip-tours.mjs';

let cataloguePaths: Promise<ReadonlySet<string>> | undefined;

async function loadVipTourPaths(): Promise<ReadonlySet<string>> {
  const tours = await getCollection('tours', ({ data }) => data.locale === 'ru' && isActiveEntity(data));
  return new Set(selectVipTours(tours).entries.map((entry) => tourPath(entry.data)));
}

// Share one selection across the build, using the complete active catalogue.
export function getVipTourPaths(): Promise<ReadonlySet<string>> {
  return cataloguePaths ??= loadVipTourPaths();
}
