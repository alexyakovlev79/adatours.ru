import { getCollection } from 'astro:content';
import { buildMultiCountryCatalog } from './multi-country-catalog.mjs';

let cached: Promise<ReturnType<typeof buildMultiCountryCatalog>>;
/** One graph per Astro build; no browser fetch and no independent lists. */
export function getMultiCountryCatalog() {
  if (!cached) cached = Promise.all([
    getCollection('tours'), getCollection('countries'), getCollection('themes'),
  ]).then(([tours, countries, themes]) => buildMultiCountryCatalog(tours, countries, themes));
  return cached;
}
