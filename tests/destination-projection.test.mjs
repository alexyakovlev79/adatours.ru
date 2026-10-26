import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDestinationProjection } from '../scripts/lib/destination-projection.mjs';

const place = { id: 'destination_brazil_park', slug: 'park', countryId: 'country_brazil',
  destinationType: 'national_park', navigationRole: 'hub', themes: ['theme_nature', 'theme_wildlife'] };
const make = () => {
  const canonicalUrl = '/brazil/place/park/';
  const common = { id: place.id, slug: place.slug, url: canonicalUrl,
    destinationType: place.destinationType, navigationRole: place.navigationRole };
  const source = { ...common, type: 'destination', countryIds: [place.countryId], themes: [...place.themes],
    contentPath: 'src/content/destinations/park.md' };
  return { canonicalUrl, catalog: { ...common, countryId: place.countryId },
    entry: structuredClone(source), compact: structuredClone(source) };
};

test('the current canonical records agree; role is independent of geographic type', () => {
  assert.deepEqual(validateDestinationProjection(place, make()), []);
  const records = make();
  // A source's historical nested annotation is not the current canonical record.
  records.entry.destinations = [{ id: place.id, destinationType: 'natural_area' }];
  assert.deepEqual(validateDestinationProjection(place, records), []);
  for (const row of [records.catalog, records.entry, records.compact]) row.navigationRole = 'sight';
  assert.deepEqual(validateDestinationProjection({ ...place, navigationRole: 'sight' }, records), []);
});

test('missing or invalid taxonomy fails even when all projections repeat the same mistake', () => {
  for (const [field, value] of [['navigationRole', undefined], ['navigationRole', 'city'], ['destinationType', 'tourism']]) {
    const records = make();
    for (const row of [records.catalog, records.entry, records.compact]) row[field] = value;
    assert.ok(validateDestinationProjection({ ...place, [field]: value }, records)
      .some((error) => error.includes(`invalid ${field} in content`)));
  }
});

test('changing the MD without its source records rejects a valid but stale classification', () => {
  for (const projection of ['catalog', 'entry', 'compact']) {
    const records = make();
    records[projection].navigationRole = 'sight';
    assert.ok(validateDestinationProjection(place, records).some((error) => error.includes('navigationRole differs')));
    records[projection].navigationRole = place.navigationRole;
    records[projection].destinationType = 'natural_area';
    assert.ok(validateDestinationProjection(place, records).some((error) => error.includes('destinationType differs')));
  }
});

test('URL, country, interest and exact source path cannot drift between projections', () => {
  for (const [projection, field, value] of [
    ['catalog', 'url', '/old-place/'], ['entry', 'slug', 'old-slug'],
    ['compact', 'countryIds', ['country_argentina']], ['entry', 'themes', ['theme_wildlife']],
    ['compact', 'contentPath', 'src/content/destinations/other.md'],
  ]) {
    const records = make();
    records[projection][field] = value;
    assert.ok(validateDestinationProjection(place, records).some((error) => error.includes(`${field} differs`)));
  }
});

test('an incomplete newly created destination cannot pass without every canonical record', () => {
  for (const projection of ['catalog', 'entry', 'compact']) {
    const records = make();
    delete records[projection];
    assert.ok(validateDestinationProjection(place, records).some((error) => error.includes('missing')));
  }
});
