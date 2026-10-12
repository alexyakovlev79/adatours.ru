import { getCollection } from 'astro:content';
import { isActiveEntity } from './archive.mjs';
import { buildTourFilterIndex } from './tour-filters.mjs';
import { getVipFilterIndex } from './vip-catalog';

let index: ReturnType<typeof loadTourFilterIndex> | undefined;
async function loadTourFilterIndex() {
  const activeRu = ({ data }) => data.locale === 'ru' && isActiveEntity(data);
  const [tours, countries, themes, vip] = await Promise.all([
    getCollection('tours', activeRu), getCollection('countries', activeRu),
    getCollection('themes', activeRu), getVipFilterIndex(),
  ]);
  return { regular: buildTourFilterIndex(tours, countries, themes), vip };
}
export function getTourFilterIndex() {
  return index ??= loadTourFilterIndex();
}
