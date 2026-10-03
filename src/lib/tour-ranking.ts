import type { CollectionEntry } from 'astro:content';
import { mainTourCountryIds } from './tour-relations';

type TourEntry = CollectionEntry<'tours'>;

const TARGET_DURATION_DAYS = 13;
const COUNTRY_WEIGHT_IN_DAYS = 3;

const mainCountryCount = (tour: TourEntry): number =>
  new Set(mainTourCountryIds(tour.data)).size;

const salesFitScore = (tour: TourEntry): number => {
  if (typeof tour.data.durationDays !== 'number') return Number.NEGATIVE_INFINITY;

  return (
    COUNTRY_WEIGHT_IN_DAYS * mainCountryCount(tour) -
    Math.abs(tour.data.durationDays - TARGET_DURATION_DAYS)
  );
};

/**
 * Rank automatic tour lists by one combined commercial score:
 * +1 main-route country is worth the same as 3 fewer days of deviation from 13.
 * Tours without durationDays stay below tours with a calculable score.
 * Title is only a deterministic tie-breaker.
 */
export const compareToursBySalesFit = (a: TourEntry, b: TourEntry): number => {
  const aScore = salesFitScore(a);
  const bScore = salesFitScore(b);

  if (aScore !== bScore) return bScore - aScore;

  return a.data.title.localeCompare(b.data.title, 'ru');
};
