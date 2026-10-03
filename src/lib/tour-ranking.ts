import type { CollectionEntry } from 'astro:content';
import { mainTourCountryIds } from './tour-relations';

type TourEntry = CollectionEntry<'tours'>;

const TARGET_DURATION_DAYS = 13;

const mainCountryCount = (tour: TourEntry): number =>
  new Set(mainTourCountryIds(tour.data)).size;

const durationDistanceFromTarget = (tour: TourEntry): number =>
  typeof tour.data.durationDays === 'number'
    ? Math.abs(tour.data.durationDays - TARGET_DURATION_DAYS)
    : Number.POSITIVE_INFINITY;

/**
 * Rank automatic tour lists by the commercial rule:
 * more main-route countries first, then duration closest to 13 days.
 * Title is only a deterministic tie-breaker.
 */
export const compareToursBySalesFit = (a: TourEntry, b: TourEntry): number => {
  const countryDifference = mainCountryCount(b) - mainCountryCount(a);
  if (countryDifference !== 0) return countryDifference;

  const aDurationDistance = durationDistanceFromTarget(a);
  const bDurationDistance = durationDistanceFromTarget(b);
  if (aDurationDistance !== bDurationDistance) {
    return aDurationDistance - bDurationDistance;
  }

  return a.data.title.localeCompare(b.data.title, 'ru');
};
