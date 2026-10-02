import type { CollectionEntry } from 'astro:content';

type TourEntry = CollectionEntry<'tours'>;
type DestinationEntry = CollectionEntry<'destinations'>;

export const buildDestinationTourCounts = (tours: TourEntry[]) => {
  const counts = new Map<string, number>();

  for (const tour of tours) {
    for (const destinationId of new Set(tour.data.destinations)) {
      counts.set(destinationId, (counts.get(destinationId) ?? 0) + 1);
    }
  }

  return counts;
};

export const compareDestinationsByPopularity = (
  counts: ReadonlyMap<string, number>
) => (a: DestinationEntry, b: DestinationEntry) => {
  const countDifference =
    (counts.get(b.data.id) ?? 0) - (counts.get(a.data.id) ?? 0);

  return countDifference || a.data.name.localeCompare(b.data.name, 'ru');
};
