import { isActiveEntity } from './archive.mjs';
import { selectVipTours } from './vip-tours.mjs';
import { vipFilterTitle } from './vip-copy.mjs';
import { compareToursBySalesFit } from './tour-sales-fit.mjs';
import { INTEREST_IDS, themeIds, compareToursForInterest } from './interest-model.mjs';

const dataOf = (entry) => entry?.data ?? entry;
const activeRu = (entry) => isActiveEntity(entry) && (!dataOf(entry).locale || dataOf(entry).locale === 'ru');
const hasCountry = (tour, id) => (dataOf(tour).routeCountries ?? dataOf(tour).countries ?? []).includes(id);

/** Stable, indexable URLs; country-only catalogues keep their existing addresses. */
export function vipFilterPath(country, theme) {
  return `/vip/${country ? `${dataOf(country).slug}/` : ''}${theme ? `interests/${dataOf(theme).slug}/` : ''}`;
}

/** Select VIP once, then intersect it with the two independent catalogue facets. */
export function buildVipFilterIndex(tours, countries, themes) {
  const selected = selectVipTours(tours.filter(activeRu)).entries;
  const activeCountries = countries.filter(activeRu);
  const activeThemes = themes.filter((entry) => activeRu(entry) && INTEREST_IDS.has(dataOf(entry).id));
  const rows = [];
  for (const country of [undefined, ...activeCountries]) {
    const countryTours = country ? selected.filter((tour) => hasCountry(tour, dataOf(country).id)) : selected;
    for (const theme of [undefined, ...activeThemes]) {
      const entries = theme
        ? countryTours.filter((tour) => themeIds(tour).includes(dataOf(theme).id)).sort(compareToursForInterest(dataOf(theme).id))
        : country ? [...countryTours].sort(compareToursBySalesFit) : [...countryTours];
      if (!entries.length) continue;
      const title = vipFilterTitle(country, theme);
      rows.push({ country, theme, countryId: country ? dataOf(country).id : undefined,
        themeId: theme ? dataOf(theme).id : undefined, entries, count: entries.length,
        href: vipFilterPath(country, theme), title });
    }
  }
  return rows;
}

/** Changing or clearing one facet always preserves the other. Empty intersections have no URL. */
export function vipFilterOptions(rows, countryId, themeId) {
  const sort = (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ru');
  return {
    countries: rows.filter((row) => row.countryId && row.themeId === themeId)
      .map((row) => ({ id: row.countryId, label: dataOf(row.country).name, href: row.href, count: row.count })).sort(sort),
    themes: rows.filter((row) => row.themeId && row.countryId === countryId)
      .map((row) => ({ id: row.themeId, label: dataOf(row.theme).name, href: row.href, count: row.count })).sort(sort),
    allCountriesHref: rows.find((row) => !row.countryId && row.themeId === themeId)?.href,
    allThemesHref: rows.find((row) => !row.themeId && row.countryId === countryId)?.href,
  };
}
