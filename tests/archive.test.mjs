import assert from 'node:assert/strict';
import test from 'node:test';
import { archiveEntries, archiveById, isActiveEntity, isArchivedEntity, isArchivedPath, activeReplacementId } from '../src/lib/archive.mjs';
import { buildPhotoQueue } from '../scripts/photo-queue.mjs';
import { buildCountryTourCounts } from '../src/lib/country-popularity.ts';
import { buildDestinationTourCounts } from '../src/lib/destination-popularity.ts';
import { excursionIdsForTour } from '../src/lib/excursion-popularity.ts';
const archivedTour = archiveEntries.find((a) => a.type === 'tour');
const archivedExcursion = archiveEntries.find((a) => a.type === 'excursion');
test('registry overrides stale published status; all aliases are excluded', () => {
  for (const a of archiveEntries) {
    assert.ok(isArchivedEntity({ id: a.id, status: 'published' }));
    assert.ok(!isActiveEntity({ data: { id: a.id, status: 'published' } }));
    for (const url of [a.url, ...(a.legacyUrls ?? [])]) assert.ok(isArchivedPath(`/adatours.ru${url}`, '/adatours.ru'));
    if (a.duplicateOf) assert.ok(!archiveById.has(activeReplacementId(a.id)));
  }
});
test('archived tours cannot contribute counts even in unfiltered input', () => {
  const active = { data: { id: 'test_active', status: 'published', countries: ['country_brazil'], destinations: ['destination_brazil_rio'], routeCountryIds: ['country_brazil'] } };
  const old = { data: { ...active.data, id: archivedTour.id } };
  assert.equal(buildCountryTourCounts([active, old]).get('country_brazil'), 1);
  assert.equal(buildDestinationTourCounts([active, old]).get('destination_brazil_rio'), 1);
  assert.equal(excursionIdsForTour({ data: { ...old.data, itinerary: [{ excursionRef: archivedExcursion.duplicateOf }] } }).size, 0);
});
test('photo queue excludes archive before limit, including forced stale statuses and references', () => {
  const entries = [
    { id: archivedTour.id, type: 'tour', contentPath: 'old.md', countryIds: ['country_antarctica'] },
    { id: 'active', type: 'tour', contentPath: 'active.md', countryIds: ['country_antarctica'] },
    { id: archivedExcursion.id, type: 'excursion', contentPath: 'old-ex.md' },
    { id: archivedExcursion.duplicateOf, type: 'excursion', contentPath: 'new-ex.md' },
  ];
  const contents = new Map(entries.map((e) => [e.id, { id: e.id, status: 'published', hero: { src: `https://test.invalid/${e.id}.jpg` } }]));
  contents.get('active').itinerary = [{ excursionRef: archivedExcursion.id }];
  const all = buildPhotoQueue({ entries, contents, country: 'country_antarctica', type: 'tour', all: true });
  assert.deepEqual(all.selectedEntityIds, ['active']);
  assert.ok(all.photos.some((p) => p.slots.some((s) => s.entityId === archivedExcursion.duplicateOf)));
  assert.ok(all.photos.every((p) => p.slots.every((s) => !archiveById.has(s.entityId))));
  assert.equal(buildPhotoQueue({ entries, contents, entityIds: [archivedTour.id] }).photos.length, 0);
  assert.equal(buildPhotoQueue({ entries, contents, type: 'tour', limit: 1 }).photos[0].slots[0].entityId, 'active');
});
test('ready assets are reused, not generated twice; source-only entries are not photo jobs', () => {
  const entry = { id: 'active', type: 'tour', contentPath: 'a.md' }, contents = new Map([['active', { status: 'published', hero: { src: 'old.jpg' }, gallery: [{ src: 'old.jpg' }] }]]);
  const result = buildPhotoQueue({ entries: [entry, { id: 'source_only', type: 'tour' }], contents, enhancements: [{ source: 'old.jpg', enhanced: '/media/already.webp' }] });
  assert.equal(result.photos.length, 0); assert.equal(result.reuse.length, 1); assert.equal(result.reuse[0].slots.length, 2);
  assert.deepEqual(result.selectedEntityIds, ['active']);
});
