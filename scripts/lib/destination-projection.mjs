import { isDeepStrictEqual } from 'node:util';
import { isDestinationType, isNavigationRole } from '../../src/lib/destination-taxonomy.mjs';

/** Compare today's canonical records. Nested source snapshots are historical evidence. */
export function validateDestinationProjection(place, { catalog, entry, compact, canonicalUrl }) {
  const errors = [];
  const id = place?.id ?? '(missing destination ID)';
  if (!isDestinationType(place?.destinationType)) errors.push(`${id}: invalid destinationType in content`);
  if (!isNavigationRole(place?.navigationRole)) errors.push(`${id}: invalid navigationRole in content`);
  for (const [label, record] of [['catalog', catalog], ['entry', entry], ['compact catalog', compact]]) {
    if (!record) {
      errors.push(`${id}: missing ${label}`);
      continue;
    }
    const expected = {
      id, slug: place.slug, url: canonicalUrl,
      destinationType: place.destinationType, navigationRole: place.navigationRole,
      ...(label === 'catalog'
        ? { countryId: place.countryId }
        : { type: 'destination', countryIds: [place.countryId], themes: place.themes ?? [] }),
    };
    for (const [field, value] of Object.entries(expected)) {
      if (!isDeepStrictEqual(record[field], value)) errors.push(`${id}: ${field} differs in ${label}`);
    }
  }
  if (entry && compact && entry.contentPath !== compact.contentPath) errors.push(`${id}: contentPath differs in compact catalog`);
  return errors;
}
