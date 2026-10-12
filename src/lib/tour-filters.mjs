import { isActiveEntity } from './archive.mjs';
import { INTEREST_IDS, themeIds, countryMembership, compareToursForInterest } from './interest-model.mjs';
import { compareToursBySalesFit, compareToursForCountry } from './tour-sales-fit.mjs';
import { vipFilterOptions } from './vip-filters.mjs';

const dataOf = (entry) => entry?.data ?? entry;
const activeRu = (entry) => isActiveEntity(entry) && (!dataOf(entry).locale || dataOf(entry).locale === 'ru');
const activeUnique = (entries) => [...new Map(entries.filter(activeRu).map((entry) => [dataOf(entry).id, entry])).values()];

/** Reuse the existing static tour catalogues, including optional geography in thematic catalogues. */
export function tourFilterPath(country, theme) {
  if (theme) return `/interests/${dataOf(theme).slug}/tours/${country ? `${dataOf(country).slug}/` : ''}`;
  return country ? `/${dataOf(country).slug}/tour/` : '/tours/';
}

export function buildTourFilterIndex(tours, countries, themes) {
  const activeTours = activeUnique(tours);
  const activeCountries = activeUnique(countries);
  const activeThemes = activeUnique(themes).filter((entry) => INTEREST_IDS.has(dataOf(entry).id));
  const rows = [];
  for (const theme of [undefined, ...activeThemes]) {
    const thematicTours = theme ? activeTours.filter((tour) => themeIds(tour).includes(dataOf(theme).id)) : activeTours;
    for (const country of [undefined, ...activeCountries]) {
      const entries = country ? thematicTours.filter((tour) => {
        const membership = countryMembership(tour, dataOf(country).id);
        return theme ? membership > 0 : membership === 1;
      }) : [...thematicTours];
      if (!entries.length) continue;
      const countryId = country ? dataOf(country).id : undefined;
      entries.sort(theme ? compareToursForInterest(dataOf(theme).id, countryId)
        : countryId ? compareToursForCountry(countryId) : compareToursBySalesFit);
      rows.push({ country, theme, countryId: country ? dataOf(country).id : undefined,
        themeId: theme ? dataOf(theme).id : undefined, entries, count: entries.length,
        href: tourFilterPath(country, theme) });
    }
  }
  return rows;
}

/** All links are real nonempty routes. VIP toggling preserves both facets or is unavailable. */
export function tourFilterOptions(regularRows, vipRows, { countryId, themeId, vip = false, countryOverview = false } = {}) {
  const rows = vip ? vipRows : regularRows;
  const options = vipFilterOptions(rows, countryId, themeId);
  const opposite = (vip ? regularRows : vipRows).find((row) => row.countryId === countryId && row.themeId === themeId);
  if (countryOverview && !vip) {
    const overviewHref = (href) => {
      const row = regularRows.find((row) => row.href === href);
      return row?.country && !row.theme ? `/${dataOf(row.country).slug}/` : href;
    };
    options.countries = options.countries.map((option) => ({ ...option, href: overviewHref(option.href) }));
    options.allThemesHref = overviewHref(options.allThemesHref);
  }
  return { ...options, vip, toggleHref: opposite?.href };
}
