import { isActiveEntity } from './archive.mjs';
import type { CollectionEntry } from 'astro:content';
import { mainTourCountryIds } from './tour-relations.ts';

type TourEntry = CollectionEntry<'tours'>;
type CountryEntry = CollectionEntry<'countries'>;

export const buildCountryTourCounts = (tours: TourEntry[]) => {
  const counts = new Map<string, number>();

  for (const tour of tours) {
    if (!isActiveEntity(tour)) continue;
    for (const countryId of new Set(mainTourCountryIds(tour.data))) {
      counts.set(countryId, (counts.get(countryId) ?? 0) + 1);
    }
  }

  return counts;
};

export const compareCountriesByPopularity = (
  counts: ReadonlyMap<string, number>
) => (a: CountryEntry, b: CountryEntry) => {
  const countDifference =
    (counts.get(b.data.id) ?? 0) - (counts.get(a.data.id) ?? 0);

  return countDifference || a.data.name.localeCompare(b.data.name, 'ru');
};
