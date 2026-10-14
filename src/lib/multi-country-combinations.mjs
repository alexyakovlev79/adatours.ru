/**
 * Static multi-country combinations. A match contains every selected MAIN
 * route country; optional visits in tour.countries are never treated as main.
 * Generate subsets of 2–4 countries even for routes visiting 5+ countries.
 */
export const MAX_SELECTED_COUNTRIES = 4;

export function multiCountryCombinationKey(slugs) {
  const values = [...new Set(slugs)];
  if (values.length < 2 || values.length > MAX_SELECTED_COUNTRIES
    || values.some((slug) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) {
    throw new Error('Invalid multi-country combination');
  }
  return values.sort().join('_');
}

export function multiCountryCombinationPath(slugs) {
  return '/multi-country/' + multiCountryCombinationKey(slugs) + '/';
}

export function buildMultiCountryCombinations(tours, countriesForTour) {
  const results = new Map();
  for (const tour of tours) {
    const countries = [...new Map(countriesForTour(tour).map((country) => [country.slug, country])).values()]
      .sort((a, b) => a.slug.localeCompare(b.slug, 'en'));
    if (countries.length < 2) continue;
    const add = (size, start, selected) => {
      if (selected.length === size) {
        const slugs = selected.map((country) => country.slug);
        const key = multiCountryCombinationKey(slugs);
        let row = results.get(key);
        if (!row) {
          row = { slugs, countries: [...selected], path: multiCountryCombinationPath(slugs), tours: [] };
          results.set(key, row);
        }
        row.tours.push(tour);
        return;
      }
      for (let i = start; i <= countries.length - (size - selected.length); i++) {
        add(size, i + 1, [...selected, countries[i]]);
      }
    };
    for (let size = 2; size <= Math.min(countries.length, MAX_SELECTED_COUNTRIES); size++) {
      add(size, 0, []);
    }
  }
  return [...results.values()].sort((a, b) => a.path.localeCompare(b.path, 'en'));
}

export function nextMultiCountryOptions(combinations, selected) {
  if (!selected.length || selected.length >= MAX_SELECTED_COUNTRIES) return [];
  const found = new Set();
  for (const combo of combinations) {
    if (combo.slugs.length !== selected.length + 1
      || !selected.every((slug) => combo.slugs.includes(slug))) continue;
    for (const slug of combo.slugs) if (!selected.includes(slug)) found.add(slug);
  }
  return [...found].sort();
}
