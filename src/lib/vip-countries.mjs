import { isActiveEntity } from './archive.mjs';
import { selectVipTours } from './vip-tours.mjs';
import { compareToursBySalesFit } from './tour-sales-fit.mjs';

const dataOf = (entry) => entry?.data ?? entry;
const directions = {
  country_brazil: 'в Бразилию', country_argentina: 'в Аргентину',
  country_peru: 'в Перу', country_antarctica: 'в Антарктиду',
  country_belize: 'в Белиз', country_bolivia: 'в Боливию',
  country_chile: 'в Чили', country_colombia: 'в Колумбию',
  country_costa_rica: 'в Коста-Рику', country_cuba: 'на Кубу',
  country_dominican_republic: 'в Доминикану', country_ecuador: 'в Эквадор',
  country_el_salvador: 'в Эль-Сальвадор', country_french_guiana: 'во Французскую Гвиану',
  country_guatemala: 'в Гватемалу', country_guyana: 'в Гайану',
  country_honduras: 'в Гондурас', country_mexico: 'в Мексику',
  country_nicaragua: 'в Никарагуа', country_panama: 'в Панаму',
  country_paraguay: 'в Парагвай', country_suriname: 'в Суринам',
  country_uruguay: 'в Уругвай', country_venezuela: 'в Венесуэлу',
};

export function vipCountryTitle(country) {
  const data = dataOf(country);
  const direction = directions[data.id];
  if (!direction) throw new Error(`Missing VIP country direction: ${data.id}`);
  return `VIP-туры ${direction}`;
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
    return [{ entry, tours: entries.sort(compareToursBySalesFit), count: entries.length,
      href: vipCountryPath(entry), label: vipCountryTitle(entry) }];
  }).sort((a, b) => b.count - a.count || dataOf(a.entry).name.localeCompare(dataOf(b.entry).name, 'ru'));
}
