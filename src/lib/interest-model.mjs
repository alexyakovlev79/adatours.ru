import registry from '../data/interest-registry.json' with { type: 'json' };
import { isActiveEntity, activeReplacementId } from './archive.mjs';
import { compareToursBySalesFit } from './tour-sales-fit.mjs';

export const INTERESTS = Object.freeze(registry);
export const INTEREST_IDS = new Set(registry.map((row) => row.id));
export const INTEREST_LIMITS = Object.freeze({ stories: 5, tours: 10, countries: 7, experiences: 10, related: 4 });
export const OPTIONAL_COUNTRY_WEIGHT = 0.25;
export const THEMATIC_EXCURSION_WEIGHT = 0.5;
const dataOf = (value) => value?.data ?? value ?? {};
const unique = (values = []) => [...new Set(values)];
const active = (value) => dataOf(value).locale === 'ru' && isActiveEntity(value);
const activeUnique = (rows = []) => [...new Map(rows.filter(active).map((row) => [dataOf(row).id, row])).values()];
const nameOf = (entry) => dataOf(entry).name ?? dataOf(entry).title ?? '';
const byName = (a, b) => nameOf(a.entry ?? a).localeCompare(nameOf(b.entry ?? b), 'ru');
export const themeIds = (entity) => unique([...(dataOf(entity).primaryThemes ?? []), ...(dataOf(entity).themes ?? [])]);
export const themeNames = (ids = []) => unique(ids).map((id) => registry.find((row) => row.id === id)?.name ?? id);
export const themeRelevance = (entity, id) => (dataOf(entity).primaryThemes ?? []).includes(id) ? 2 : (dataOf(entity).themes ?? []).includes(id) ? 1 : 0;
export const compareToursForInterest = (id) => (a, b) => themeRelevance(b, id) - themeRelevance(a, id) || compareToursBySalesFit(a, b);
export const countryMembership = (tour, id) => {
  const d = dataOf(tour);
  if ((d.routeCountries ?? d.countries ?? []).includes(id)) return 1;
  return (d.countries ?? []).includes(id) ? OPTIONAL_COUNTRY_WEIGHT : 0;
};
const destinationMembership = (tour, id) => {
  const d = dataOf(tour);
  if ((d.routeDestinations ?? d.destinations ?? []).includes(id)) return 1;
  return (d.destinations ?? []).includes(id) ? OPTIONAL_COUNTRY_WEIGHT : 0;
};
export const interestTourCatalogPath = (theme, country) => `/interests/${dataOf(theme).slug}/tours/${country ? `${dataOf(country).slug}/` : ''}`;
export const pluralIndex = (count) => {
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('A count must be a non-negative safe integer.');
  const last = count % 10, lastTwo = count % 100;
  return lastTwo >= 11 && lastTwo <= 14 ? 2 : last === 1 ? 0 : last >= 2 && last <= 4 ? 1 : 2;
};
export const countLabel = (count, forms = ['тур', 'тура', 'туров']) => `${count} ${forms[pluralIndex(count)]}`;

/** Complete interest index: primary and secondary matches count once, without editorial limits. */
export function buildInterestIndex(themes, tours) {
  const activeTours = activeUnique(tours);
  return activeUnique(themes).filter((entry) => INTEREST_IDS.has(dataOf(entry).id)).map((entry) => ({
    entry, tourCount: activeTours.filter((tour) => themeRelevance(tour, dataOf(entry).id) > 0).length,
  })).sort((a, b) => b.tourCount - a.tourCount || byName(a, b) || dataOf(a.entry).id.localeCompare(dataOf(b.entry).id));
}
export const excursionIdsForInterestTour = (tour) => {
  const ids = new Set();
  if (!active(tour)) return ids;
  for (const day of dataOf(tour).itinerary ?? []) {
    for (const ref of [day.excursionRef, ...(day.contentBlocks ?? []).filter((block) => block.type === 'excursion').map((block) => block.excursionRef)]) {
      if (ref) { const id = activeReplacementId(ref); if (id) ids.add(id); }
    }
  }
  return ids;
};
const excursionPlaces = (excursion) => unique([dataOf(excursion).destination, ...(dataOf(excursion).relatedDestinations ?? [])].filter(Boolean));

/** Country interests are a projection of active tours, never a country-maintained list. */
export function interestsForCountry(countryId, tours, themes = registry) {
  return themes.map((theme) => {
    const id = dataOf(theme).id;
    const matches = activeUnique(tours).filter((tour) => countryMembership(tour, countryId) && themeRelevance(tour, id));
    return { entry: theme, id, tourCount: matches.length, score: matches.reduce((sum, tour) => sum + countryMembership(tour, countryId) * themeRelevance(tour, id), 0) };
  }).filter((row) => row.tourCount).sort((a, b) => b.score - a.score || b.tourCount - a.tourCount || byName(a, b));
}

/** Pure, deterministic graph projection. No matching titles, body text, old aliases, or curated lists. */
export function buildInterestHub(id, { tours = [], countries = [], destinations = [], excursions = [], themes = [] } = {}) {
  if (!INTEREST_IDS.has(id)) throw new Error(`Unknown interest: ${id}`);
  const allTours = activeUnique(tours);
  const matchedTours = allTours.filter((tour) => themeRelevance(tour, id)).sort(compareToursForInterest(id));
  const activeCountries = activeUnique(countries);
  const countryIds = new Set(activeCountries.map((entry) => dataOf(entry).id));
  const activePlaces = activeUnique(destinations).filter((entry) => countryIds.has(dataOf(entry).countryId));
  const placeIds = new Set(activePlaces.map((entry) => dataOf(entry).id));
  const activeExcursions = activeUnique(excursions).filter((entry) => countryIds.has(dataOf(entry).country));
  const allTourRefs = new Map(allTours.map((tour) => [dataOf(tour).id, excursionIdsForInterestTour(tour)]));
  const ownExcursions = activeExcursions.filter((entry) => (dataOf(entry).themes ?? []).includes(id));
  const excursionRows = ownExcursions.map((entry) => {
    const entityId = dataOf(entry).id;
    const relatedTours = matchedTours.filter((tour) => allTourRefs.get(dataOf(tour).id)?.has(entityId));
    return { kind: 'excursion', entry, id: entityId, countryId: dataOf(entry).country, tourCount: relatedTours.length,
      score: relatedTours.length, popularity: allTours.filter((tour) => allTourRefs.get(dataOf(tour).id)?.has(entityId)).length };
  });
  const destinationRows = activePlaces.filter((entry) => (dataOf(entry).themes ?? []).includes(id)).map((entry) => {
    const entityId = dataOf(entry).id;
    const relatedTours = matchedTours.filter((tour) => destinationMembership(tour, entityId));
    const linkedExcursions = ownExcursions.filter((excursion) => excursionPlaces(excursion).includes(entityId));
    const score = relatedTours.reduce((sum, tour) => sum + destinationMembership(tour, entityId) * themeRelevance(tour, id), 0)
      + THEMATIC_EXCURSION_WEIGHT * linkedExcursions.length;
    return { kind: 'destination', entry, id: entityId, countryId: dataOf(entry).countryId, tourCount: relatedTours.length,
      excursionCount: linkedExcursions.length, score, popularity: allTours.filter((tour) => destinationMembership(tour, entityId)).length };
  }).filter((row) => row.tourCount || row.excursionCount);
  const experiences = [...destinationRows, ...excursionRows].sort((a, b) => b.score - a.score || b.popularity - a.popularity || byName(a, b) || a.id.localeCompare(b.id));
  // First spread the five visual stories across eligible countries. A second pass fills spare slots.
  // Eligibility and scores are unchanged; the lower block never repeats a story entity.
  const stories = [], used = new Set(), represented = new Set();
  for (const row of experiences) {
    if (!dataOf(row.entry).hero?.src || represented.has(row.countryId)) continue;
    stories.push(row); used.add(row.id); represented.add(row.countryId);
    if (stories.length === INTEREST_LIMITS.stories) break;
  }
  for (const row of experiences) {
    if (stories.length === INTEREST_LIMITS.stories) break;
    if (!used.has(row.id) && dataOf(row.entry).hero?.src) { stories.push(row); used.add(row.id); }
  }
  const rankedCountries = activeCountries.map((entry) => {
    const countryId = dataOf(entry).id;
    const countryTours = matchedTours.filter((tour) => countryMembership(tour, countryId));
    const mainCount = countryTours.filter((tour) => countryMembership(tour, countryId) === 1).length;
    return { entry, tourCount: countryTours.length, mainCount, optionalCount: countryTours.length - mainCount, tours: countryTours, topTour: countryTours[0],
      score: countryTours.reduce((sum, tour) => sum + themeRelevance(tour, id) * countryMembership(tour, countryId), 0),
      places: destinationRows.filter((row) => row.countryId === countryId).sort((a, b) => b.score - a.score || byName(a, b)).slice(0, 2).map((row) => nameOf(row.entry)) };
  }).filter((row) => row.tourCount).sort((a, b) => b.score - a.score || b.tourCount - a.tourCount || byName(a, b));

  // Allocate visible country covers from the weakest displayed country upward so one
  // multi-country tour can be the background of only one country in the geography block.
  const countryPreview = rankedCountries.slice(0, INTEREST_LIMITS.countries);
  const usedCountryCoverTours = new Set();
  const coverTourByCountry = new Map();
  for (let index = countryPreview.length - 1; index >= 0; index -= 1) {
    const row = countryPreview[index];
    const coverTour = row.tours.find((tour) => {
      const tourId = dataOf(tour).id;
      return tourId && dataOf(tour).hero?.src && !usedCountryCoverTours.has(tourId);
    });
    if (!coverTour) continue;
    usedCountryCoverTours.add(dataOf(coverTour).id);
    coverTourByCountry.set(dataOf(row.entry).id, coverTour);
  }
  const previewCountries = countryPreview.map((row) => ({ ...row, coverTour: coverTourByCountry.get(dataOf(row.entry).id) }));

  const relatedThemes = activeUnique(themes).filter((entry) => dataOf(entry).id !== id && INTEREST_IDS.has(dataOf(entry).id)).map((entry) => ({
    entry, tourCount: matchedTours.filter((tour) => themeRelevance(tour, dataOf(entry).id)).length,
  })).filter((row) => row.tourCount).sort((a, b) => b.tourCount - a.tourCount || byName(a, b));
  return { id, allTours: matchedTours, tours: matchedTours.slice(0, INTEREST_LIMITS.tours), stories,
    allCountries: rankedCountries, countries: previewCountries,
    allExperiences: experiences, experiences: experiences.filter((row) => !used.has(row.id)).slice(0, INTEREST_LIMITS.experiences),
    allRelatedThemes: relatedThemes, relatedThemes: relatedThemes.slice(0, INTEREST_LIMITS.related) };
}

/** Active content is a closed vocabulary. Archived source documents are intentionally untouched. */
export function validateInterestContent({ tours = [], destinations = [], excursions = [], countries = [], themes = [] }) {
  const errors = [];
  for (const [collection, rows] of Object.entries({ tours, destinations, excursions })) {
    for (const entry of rows.filter(active)) {
      const d = dataOf(entry), label = `${collection}/${d.id}`;
      const primary = d.primaryThemes ?? [], secondary = d.themes ?? [];
      if (collection === 'tours' && (primary.length < 1 || primary.length > 2)) errors.push(`${label}: primaryThemes must contain 1–2 interests.`);
      if (!Array.isArray(primary) || !Array.isArray(secondary)) { errors.push(`${label}: themes must be arrays.`); continue; }
      if (new Set([...primary, ...secondary]).size !== primary.length + secondary.length) errors.push(`${label}: duplicate/overlapping themes.`);
      for (const id of [...primary, ...secondary]) if (!INTEREST_IDS.has(id)) errors.push(`${label}: unknown interest ${id}.`);
    }
  }
  const activeThemes = themes.filter(active);
  for (const item of registry) {
    const matches = activeThemes.filter((entry) => dataOf(entry).id === item.id);
    if (matches.length !== 1 || dataOf(matches[0]).slug !== item.slug) errors.push(`${item.id}: expected exactly one active theme with slug ${item.slug}.`);
  }
  for (const entry of activeThemes) {
    const d = dataOf(entry);
    if (!INTEREST_IDS.has(d.id)) errors.push(`${d.id}: interest is outside the approved dictionary.`);
    for (const field of ['featuredCountries', 'featuredDestinations', 'featuredTours', 'relatedThemes']) if (d[field]?.length) errors.push(`${d.id}: manual ${field} is forbidden.`);
  }
  for (const entry of countries.filter(active)) if (dataOf(entry).relatedThemes?.length || dataOf(entry).themes?.length) errors.push(`${dataOf(entry).id}: country interests must be derived.`);
  return errors;
}
