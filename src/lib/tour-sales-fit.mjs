/** Shared commercial order. Moving the previous TS implementation here changes no weights. */
const dataOf = (value) => value?.data ?? value ?? {};
export const salesFitScore = (tour) => {
  const d = dataOf(tour);
  if (typeof d.durationDays !== 'number') return Number.NEGATIVE_INFINITY;
  return 2 * new Set(d.routeCountries ?? d.countries ?? []).size - Math.abs(d.durationDays - 13);
};
export const compareToursBySalesFit = (a, b) => {
  const aScore = salesFitScore(a), bScore = salesFitScore(b);
  if (aScore !== bScore) return bScore - aScore;
  return (dataOf(a).title ?? '').localeCompare(dataOf(b).title ?? '', 'ru');
};
