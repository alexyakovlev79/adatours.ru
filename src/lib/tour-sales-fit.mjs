import destinationCatalog from '../data/catalog/destinations.json' with { type: 'json' };

/** Shared commercial order, optionally weighted by the selected country's route share. */
const dataOf = (value) => value?.data ?? value ?? {};
const destinationCountryById = new Map(destinationCatalog.map((place) => [place.id, place.countryId]));
export const countryDestinationShare = (tour, countryId) => {
  const d = dataOf(tour);
  const places = [...new Set(d.routeDestinations ?? d.destinations ?? [])];
  if (!places.length) return 0;
  return places.filter((id) => destinationCountryById.get(id) === countryId).length / places.length;
};
export const salesFitScore = (tour, countryId) => {
  const d = dataOf(tour);
  if (typeof d.durationDays !== 'number') return Number.NEGATIVE_INFINITY;
  const share = countryId ? countryDestinationShare(tour, countryId) : 1;
  return 2 * new Set(d.routeCountries ?? d.countries ?? []).size * share - Math.abs(d.durationDays - 13);
};
const compareSalesFit = (a, b, countryId) => {
  const aScore = salesFitScore(a, countryId), bScore = salesFitScore(b, countryId);
  if (aScore !== bScore) return bScore - aScore;
  return (dataOf(a).title ?? '').localeCompare(dataOf(b).title ?? '', 'ru');
};
export const compareToursBySalesFit = (a, b) => compareSalesFit(a, b);
export const compareToursForCountry = (countryId) => (a, b) => compareSalesFit(a, b, countryId);
