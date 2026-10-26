import { isActiveEntity } from './archive.mjs';
import { compareDestinationsForNavigation } from './destination-taxonomy.mjs';
import type { CollectionEntry } from 'astro:content';

type TourEntry = CollectionEntry<'tours'>;
type DestinationEntry = CollectionEntry<'destinations'>;

export const buildDestinationTourCounts = (tours: TourEntry[]) => {
  const counts = new Map<string, number>();

  for (const tour of tours) {
    if (!isActiveEntity(tour)) continue;
    for (const destinationId of new Set(tour.data.destinations)) {
      counts.set(destinationId, (counts.get(destinationId) ?? 0) + 1);
    }
  }

  return counts;
};

export const compareDestinationsByPopularity = (
  counts: ReadonlyMap<string, number>
) => (a: DestinationEntry, b: DestinationEntry) => {
  return compareDestinationsForNavigation(a, b, (left, right) => {
    const countDifference = (counts.get(right.data.id) ?? 0) - (counts.get(left.data.id) ?? 0);
    return countDifference || left.data.name.localeCompare(right.data.name, 'ru');
  });
};
