/**
 * Add the configured "русский гид" SEO keyword only to RU pages actually connected
 * to selected geographic entities. No article or content frontmatter is modified.
 */
import settings from '../data/seo/russian-guide-targets.json' with { type: 'json' };
import destinationCatalogue from '../data/catalog/destinations.json' with { type: 'json' };

const cache = new WeakMap();

function normalPath(path) {
  const value = String(path || '/').split(/[?#]/, 1)[0];
  return ('/' + value.replace(/^\/+/, '')).replace(/\/?$/, '/');
}

function lookups(records) {
  if (cache.has(records)) return cache.get(records);
  const byPath = new Map(records.map((row) => [normalPath(row.path), row]));
  const countriesBySlug = new Map(records.filter((row) => row.kind === 'country')
    .map((row) => [row.data.slug, row.data.id]));
  const destinationsBySlug = new Map(destinationCatalogue.map((place) =>
    [place.countryId + ':' + place.slug, place.id]));
  const resolved = { byPath, countriesBySlug, destinationsBySlug };
  cache.set(records, resolved);
  return resolved;
}

function ids(data, keys) {
  const found = [];
  for (const key of keys) {
    const value = data?.[key];
    if (Array.isArray(value)) found.push(...value);
    else if (typeof value === 'string') found.push(value);
  }
  return found;
}

function entityMatches(row, countries, destinations) {
  if (!row || row.archived || ['archived', 'draft'].includes(row.data?.status)) return false;
  const data = row.data || {};
  if (row.kind === 'country') return countries.has(data.id);
  if (row.kind === 'destination') return countries.has(data.countryId) || destinations.has(data.id);
  return ids(data, ['country', 'countryId', 'countries', 'countryIds', 'routeCountries'])
    .some((id) => countries.has(id)) ||
    ids(data, ['destination', 'destinationId', 'destinationIds', 'destinations',
      'routeDestinations', 'relatedDestinations']).some((id) => destinations.has(id));
}

function catalogueMatches(path, lookup, countries, destinations) {
  const parts = path.split('/').filter(Boolean);
  const countryId = lookup.countriesBySlug.get(parts[0]);
  if (countryId) {
    if (countries.has(countryId)) return true;
    const placeSlug = parts[1] === 'place' ? parts[2]
      : !['tour', 'excursion'].includes(parts[1]) ? parts[1] : null;
    return !!placeSlug && destinations.has(lookup.destinationsBySlug.get(countryId + ':' + placeSlug));
  }
  if (parts[0] === 'vip' && parts[1])
    return countries.has(lookup.countriesBySlug.get(parts[1]));
  if (parts[0] === 'interests' && parts[2] === 'tours' && parts[3])
    return countries.has(lookup.countriesBySlug.get(parts[3]));
  // Only named, non-empty multi-country combinations, not the general multi-country hub.
  if (parts[0] === 'multi-country' && parts[1]?.includes('_'))
    return parts[1].split('_').some((slug) => countries.has(lookup.countriesBySlug.get(slug)));
  return false;
}

export function isRussianGuidePage({ path, lang = 'ru', records = [], config = settings }) {
  if (lang !== 'ru' || config.enabled !== true) return false;
  const countries = new Set(config.countryIds || []);
  const destinations = new Set((config.destinationGroups || [])
    .flatMap((group) => group.destinationIds || []));
  const lookup = lookups(records);
  const canonical = normalPath(path);
  const row = lookup.byPath.get(canonical);
  if (row?.archived || ['archived', 'draft'].includes(row?.data?.status)) return false;
  return entityMatches(row, countries, destinations) ||
    catalogueMatches(canonical, lookup, countries, destinations);
}

export function russianGuideSeoMetadata({ path, title, description, lang = 'ru', records = [], config = settings }) {
  if (!isRussianGuidePage({ path, lang, records, config })) return { title, description };
  const brand = config.brandSuffix || ' | Ada Tours';
  const suffix = config.titleSuffix || ', русский гид';
  let stem = String(title || '').trim().replace(/\s*\|\s*Ada Tours\s*$/iu, '').trim();
  // Some current formulae end in bare "Ada Tours"; normalize to one terminal brand.
  stem = stem.replace(/\s+Ada Tours$/iu, '').trim();
  if (!stem.toLocaleLowerCase('ru').endsWith(suffix.toLocaleLowerCase('ru'))) stem += suffix;
  const cleanDescription = String(description || '').trim();
  const prefix = String(config.descriptionPrefix || '').trim();
  const nextDescription = !prefix || /русский гид/iu.test(cleanDescription)
    ? cleanDescription : prefix + (cleanDescription ? ' ' + cleanDescription : '');
  return { title: stem + brand, description: nextDescription };
}
