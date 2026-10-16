/** Single graph for static multi-country catalogues, filters and registries. */
import { isActiveEntity } from './archive.mjs';
import { INTEREST_IDS, themeIds, compareToursForInterest } from './interest-model.mjs';
import { compareToursBySalesFit } from './tour-sales-fit.mjs';
import { buildMultiCountryCombinations, multiCountryCombinationKey, formatMultiCountryNames } from './multi-country-combinations.mjs';

export const multiCountryData = (entry) => entry?.data ?? entry;
const activeUnique = (entries) => [...new Map(entries.filter((entry) => {
  const d = multiCountryData(entry);
  return d?.id && d.locale === 'ru' && isActiveEntity(entry);
}).map((entry) => [multiCountryData(entry).id, entry])).values()];
const byId = (a, b) => multiCountryData(a).id.localeCompare(multiCountryData(b).id, 'en');

export function multiCountryCatalogPath(slugs = [], themeSlug) {
  const key = slugs.length ? multiCountryCombinationKey(slugs) + '/' : '';
  if (themeSlug !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(themeSlug)) throw new Error('Invalid interest slug');
  return '/multi-country/' + key + (themeSlug ? 'interests/' + themeSlug + '/' : '');
}

/** Only complete, active MAIN routes. Optional cross-border visits never create a combination. */
export function buildMultiCountryCatalog(tours = [], countries = [], themes = []) {
  const countryById = new Map(activeUnique(countries).map((entry) => [multiCountryData(entry).id, multiCountryData(entry)]));
  const mainCountries = (entry) => [...new Set(multiCountryData(entry).routeCountries ?? multiCountryData(entry).countries ?? [])];
  const availableTours = activeUnique(tours).filter((entry) => {
    const ids = mainCountries(entry);
    return ids.length >= 2 && ids.every((id) => countryById.has(id));
  });
  const activeThemes = activeUnique(themes).map(multiCountryData)
    .filter((theme) => INTEREST_IDS.has(theme.id)).sort((a, b) => a.slug.localeCompare(b.slug, 'en'));
  const rows = [];
  for (const theme of [undefined, ...activeThemes]) {
    const selected = availableTours.filter((entry) => !theme || themeIds(entry).includes(theme.id));
    if (!selected.length) continue;
    const compare = theme ? compareToursForInterest(theme.id) : compareToursBySalesFit;
    selected.sort((a, b) => compare(a, b) || byId(a, b));
    const combinations = buildMultiCountryCombinations(selected, (entry) => mainCountries(entry).map((id) => countryById.get(id)));
    for (const combo of [{ slugs: [], countries: [], tours: selected }, ...combinations]) {
      const key = combo.slugs.join('_');
      const path = multiCountryCatalogPath(combo.slugs, theme?.slug);
      rows.push({ ...combo, key, path, theme, themeId: theme?.id,
        countryIds: combo.countries.map((country) => country.id), count: combo.tours.length,
        id: theme ? 'multi_country_interest:' + (key || 'all') + ':' + theme.id
          : key ? 'multi_country_combo:' + key : 'multi_country',
      });
    }
  }
  return rows;
}

/** Compact selector projection. Every interest link resolves to a nonempty static catalogue. */
export function multiCountryPickerOptions(rows, slugs = [], themeId) {
  const key = slugs.length ? multiCountryCombinationKey(slugs) : '';
  const combinations = rows.filter((row) => row.themeId === themeId && row.slugs.length);
  const countries = [...new Map(combinations.flatMap((row) => row.countries)
    .map((country) => [country.slug, { slug: country.slug, name: country.name }])).values()]
    .sort((a, b) => a.slug.localeCompare(b.slug, 'en'));
  const interests = rows.filter((row) => row.themeId && row.key === key).map((row) => ({
    id: row.themeId, label: row.theme.name, slug: row.theme.slug, href: row.path, count: row.count,
    // Needed only for a transient first-country choice on the unfiltered root.
    countries: [...new Set(rows.filter((candidate) => candidate.themeId === row.themeId && candidate.slugs.length)
      .flatMap((candidate) => candidate.slugs))],
  })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ru'));
  return { countries, combinations, interests, allInterestsHref: multiCountryCatalogPath(slugs) };
}

export function multiCountryCatalogName(row) {
  const geography = row.countries.length ? formatMultiCountryNames(row.countries.map((country) => country.name)) : 'Несколько стран';
  return row.theme ? geography + ': ' + row.theme.name : 'Туры: ' + geography;
}

/** Stable queue order: unfiltered combinations first, then their thematic intersections. */
export function compareMultiCountryCatalogs(a, b) {
  return Number(Boolean(a.themeId)) - Number(Boolean(b.themeId))
    || a.slugs.length - b.slugs.length || b.count - a.count
    || a.key.localeCompare(b.key, 'en') || (a.theme?.slug ?? '').localeCompare(b.theme?.slug ?? '', 'en');
}
