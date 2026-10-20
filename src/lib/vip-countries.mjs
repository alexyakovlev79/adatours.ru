import { isActiveEntity } from './archive.mjs';
import { selectVipTours } from './vip-tours.mjs';
import { compareToursForCountry } from './tour-sales-fit.mjs';
import { seoCountryDirection } from './seo-grammar.mjs';

const dataOf = (entry) => entry?.data ?? entry;
export function vipCountryTitle(country) {
  const data = dataOf(country);
  return `VIP-туры ${seoCountryDirection(data.id)}`;
}

export function vipCountryPath(country) {
  return `/vip/${dataOf(country).slug}/`;
}

/** Intersect the global VIP selection with main route countries; never reselect per country. */
export function buildVipCountryIndex(tours, countries) {
  const activeRu = (entry) => isActiveEntity(entry) && (!dataOf(entry).locale || dataOf(entry).locale === 'ru');
  const selected = selectVipTours(tours.filter(activeRu)).entries;
  const byCountry = new Map();
  for (const entry of selected) {
    const data = dataOf(entry);
    for (const id of new Set(data.routeCountries ?? data.countries ?? [])) {
      if (!byCountry.has(id)) byCountry.set(id, []);
      byCountry.get(id).push(entry);
    }
  }
  return countries.filter(activeRu).flatMap((entry) => {
    const entries = byCountry.get(dataOf(entry).id);
    if (!entries?.length) return [];
    return [{ entry, tours: entries.sort(compareToursForCountry(dataOf(entry).id)), count: entries.length,
      href: vipCountryPath(entry), label: vipCountryTitle(entry) }];
  }).sort((a, b) => b.count - a.count || dataOf(a.entry).name.localeCompare(dataOf(b.entry).name, 'ru'));
}
