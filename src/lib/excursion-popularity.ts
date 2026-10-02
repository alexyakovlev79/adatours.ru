import type { CollectionEntry } from 'astro:content';

type TourEntry = CollectionEntry<'tours'>;
type ExcursionEntry = CollectionEntry<'excursions'>;

export const excursionIdsForTour = (tour: TourEntry) => {
  const ids = new Set<string>();

  for (const item of tour.data.itinerary) {
    if (item.excursionRef) ids.add(item.excursionRef);

    for (const block of item.contentBlocks) {
      if (block.type === 'excursion') ids.add(block.excursionRef);
    }
  }

  return ids;
};

export const buildExcursionTourCounts = (tours: TourEntry[]) => {
  const counts = new Map<string, number>();

  for (const tour of tours) {
    for (const excursionId of excursionIdsForTour(tour)) {
      counts.set(excursionId, (counts.get(excursionId) ?? 0) + 1);
    }
  }

  return counts;
};

export const compareExcursionsByPopularity = (
  counts: ReadonlyMap<string, number>
) => (a: ExcursionEntry, b: ExcursionEntry) => {
  const countDifference =
    (counts.get(b.data.id) ?? 0) - (counts.get(a.data.id) ?? 0);

  return countDifference || a.data.title.localeCompare(b.data.title, 'ru');
};
