import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveEntries } from '../src/lib/archive.mjs';
import { buildSeoGeoCanonicalPaths } from '../src/lib/seo-geo-route-inventory.mjs';
import { reconcileRuntimeRegistries, projectRuntimeRegistryRows } from '../src/lib/runtime-seo-registry.mjs';
import { verifyRuntimeSeoCoverage, runtimeCanonicalPath } from '../scripts/check-runtime-seo-coverage.mjs';

const entry = (data) => ({ data: { locale: 'ru', status: 'approved', ...data } });
const copy = (value) => JSON.parse(JSON.stringify(value));
function fixture() {
  const content = {
    countries: [entry({ id: 'country_brazil', slug: 'brazil', name: 'Бразилия' })],
    themes: [entry({ id: 'theme_wildlife', slug: 'wildlife', name: 'Животные и сафари' })],
    tours: [entry({ id: 'tour_coverage_fixture', title: 'Fixture tour', slug: 'coverage-fixture', countries: ['country_brazil'], primaryThemes: [], themes: [], destinations: [], itinerary: [] })],
    destinations: [entry({ id: 'destination_coverage_fixture', name: 'Fixture place', slug: 'coverage-place', countryId: 'country_brazil', themes: [] })],
    excursions: [entry({ id: 'excursion_coverage_fixture', title: 'Fixture excursion', slug: 'coverage-excursion', country: 'country_brazil', themes: [] })],
  };
  const phases = [
    { phase: 1, entries: [{ phase: 1, kind: 'country', id: 'country_brazil', url: '/brazil/' }] },
    { phase: 2, entries: [{ phase: 2, kind: 'interest', id: 'theme_wildlife', url: '/interests/wildlife/' }] },
    { phase: 5, entries: [{ phase: 5, kind: 'tour', id: 'tour_coverage_fixture', url: '/brazil/tour/coverage-fixture/' }] },
    { phase: 6, entries: [{ phase: 6, kind: 'destination', id: 'destination_coverage_fixture', url: '/brazil/place/coverage-place/' }] },
    { phase: 7, entries: [{ phase: 7, kind: 'excursion', id: 'excursion_coverage_fixture', url: '/brazil/excursion/coverage-excursion/' }] },
  ];
  for (const phase of phases) for (const row of phase.entries) {
    row.work = 'queued'; row.availability = 'active_runtime_entity';
  }
  const destinationCatalog = [
    { id: 'destination_coverage_fixture', name: 'Fixture place', slug: 'coverage-place', countryId: 'country_brazil', countrySlug: 'brazil' },
    { id: 'destination_brazil_rio', name: 'Рио-де-Жанейро', slug: 'rio-de-janeiro', countryId: 'country_brazil', countrySlug: 'brazil' },
  ];
  const existing = new Set(phases.flatMap((p) => p.entries).map((row) => row.url));
  for (const url of buildSeoGeoCanonicalPaths({ ...content, destinationCatalog })) if (!existing.has(url)) {
    phases[2].entries.push({ phase: 5, kind: 'fixture_catalogue', url, work: 'queued', availability: 'active_runtime_catalogue' });
  }
  return { content, phases, destinationCatalog };
}

test('all five active entity kinds are registered; queued coverage does not pretend their articles are complete', () => {
  const input = fixture(), before = JSON.stringify(input);
  const result = verifyRuntimeSeoCoverage(input);
  assert.equal(result.ok, true); assert.equal(result.activeEntities, 5); assert.equal(result.covered, 5);
  assert.deepEqual(result.byType, { country: 1, theme: 1, tour: 1, destination: 1, excursion: 1 });
  assert.equal(JSON.stringify(input), before, 'gate is read-only');
});

test('a newly added tour, excursion, country, place or interest cannot disappear outside the SEO queue', () => {
  for (const phase of [1, 2, 5, 6, 7]) {
    const input = fixture(); input.phases.find((p) => p.phase === phase).entries = [];
    const result = verifyRuntimeSeoCoverage(input);
    assert.equal(result.ok, false, `missing phase ${phase} entity`);
    assert.ok(result.errors.some((message) => /exactly one SEO row.*found 0/.test(message)));
  }
});

test('duplicate canonical URL and duplicate identity under a legacy URL fail instead of double-registering', () => {
  const duplicateUrl = fixture(), row = duplicateUrl.phases[2].entries[0];
  duplicateUrl.phases[4].entries.push({ ...row, id: 'other-id' });
  assert.match(verifyRuntimeSeoCoverage(duplicateUrl).errors.join('\n'), /found 2/);
  const duplicateId = fixture();
  duplicateId.phases[2].entries.push({ ...duplicateId.phases[2].entries[0], url: '/brazil/tour/old-slug/' });
  assert.match(verifyRuntimeSeoCoverage(duplicateId).errors.join('\n'), /identity must resolve only/);
});

test('matching URL with another ID and matching ID with an obsolete canonical cannot satisfy coverage', () => {
  const wrongId = fixture(); wrongId.phases[2].entries[0].id = 'another-tour';
  assert.match(verifyRuntimeSeoCoverage(wrongId).errors.join('\n'), /SEO stable ID must be tour_coverage_fixture/);
  const oldUrl = fixture(); oldUrl.phases[2].entries[0].url = '/multi-country/tour/coverage-fixture/';
  assert.match(verifyRuntimeSeoCoverage(oldUrl).errors.join('\n'), /exactly one SEO row.*found 0/);
});

test('entity kind and both phase declarations must agree, so a derived catalogue cannot impersonate a tour', () => {
  for (const change of [
    (x) => { x.phases[2].entries[0].kind = 'excursion_tours'; },
    (x) => { x.phases[2].entries[0].phase = 7; },
    (x) => { x.phases[2].phase = 7; },
  ]) {
    const input = fixture(); change(input);
    assert.equal(verifyRuntimeSeoCoverage(input).ok, false);
  }
});

test('official archive registry, explicit archives, drafts and other locales are excluded', () => {
  const input = fixture();
  const archivedTour = archiveEntries.find((row) => row.id.startsWith('tour_'));
  assert.ok(archivedTour, 'production archive fixture is present');
  for (const overrides of [{ status: 'draft' }, { status: 'archived' }, { locale: 'en' }, { id: archivedTour.id }]) {
    input.content.tours.push(entry({ id: 'ignored-tour', slug: 'ignored-tour', countries: ['country_brazil'], ...overrides }));
  }
  const result = verifyRuntimeSeoCoverage(input);
  assert.equal(result.ok, true); assert.equal(result.activeEntities, 5);
});

test('tour routeCountries determines canonical geography; optional countries do not force multi-country', () => {
  const input = fixture();
  input.content.tours[0].data.countries = ['country_brazil', 'country_argentina'];
  input.content.tours[0].data.routeCountries = ['country_brazil'];
  assert.equal(verifyRuntimeSeoCoverage(input).ok, true);
  input.content.tours[0].data.routeCountries = ['country_brazil', 'country_argentina'];
  assert.equal(verifyRuntimeSeoCoverage(input).ok, false);
  input.phases[2].entries[0].url = '/multi-country/tour/coverage-fixture/';
  assert.equal(verifyRuntimeSeoCoverage(input).ok, true);
});

test('excursion parent destination supplies the canonical geography using the official route helper', () => {
  const input = fixture();
  input.content.excursions[0].data.destination = 'destination_brazil_rio';
  input.content.excursions[0].data.country = 'country_chile';
  assert.equal(runtimeCanonicalPath('excursion', input.content.excursions[0].data), '/brazil/rio-de-janeiro/coverage-excursion/');
  assert.equal(verifyRuntimeSeoCoverage(input).ok, false);
  input.phases[4].entries[0].url = '/brazil/rio-de-janeiro/coverage-excursion/';
  input.phases[4].entries.push({ phase: 7, kind: 'destination_excursions', url: '/brazil/rio-de-janeiro/',
    work: 'queued', availability: 'active_runtime_catalogue' });
  assert.equal(verifyRuntimeSeoCoverage(input).ok, true);
});

test('an active entity cannot be hidden behind unavailable/archived work; explicit paused research remains registered', () => {
  for (const work of ['archived', 'temporarily_unavailable', 'waiting_for_page', 'not_in_active_theme_registry', undefined]) {
    const input = fixture(); input.phases[2].entries[0].work = work;
    assert.equal(verifyRuntimeSeoCoverage(input).ok, false, String(work));
  }
  for (const availability of ['temporarily_unavailable', 'missing', 'needs_content', undefined]) {
    const input = fixture(); input.phases[2].entries[0].availability = availability;
    assert.equal(verifyRuntimeSeoCoverage(input).ok, false, String(availability));
  }
  const paused = fixture(); paused.phases[2].entries[0].work = 'paused';
  assert.equal(verifyRuntimeSeoCoverage(paused).ok, true);
});

test('historical and waiting-for-page rows without an active MD can survive without fabricated published status', () => {
  const input = fixture();
  input.phases[3].entries.push({ phase: 6, kind: 'destination', id: 'destination_reserved_only',
    url: '/brazil/place/reserved-only/', work: 'waiting_for_page', availability: 'needs_content' });
  input.phases[2].entries.push({ phase: 5, kind: 'tour', id: 'tour_historical_only',
    url: '/brazil/tour/historical-only/', work: 'archived', availability: 'archived', publishedAt: '2026-09-20' });
  input.phases[2].entries.push({ phase: 5, kind: 'tour', id: 'tour_coverage_fixture',
    url: '/brazil/tour/previous-canonical/', work: 'temporarily_unavailable', availability: 'temporarily_unavailable',
    note: 'Replaced by /brazil/tour/coverage-fixture/; preserve original publication history.' });
  const before = copy(input);
  assert.equal(verifyRuntimeSeoCoverage(input).ok, true);
  assert.deepEqual(input, before);
});

test('malformed inputs and duplicate active runtime identities fail closed with actionable errors', () => {
  for (const input of [undefined, null, 'bad', {}, { content: {}, phases: [] }, { content: fixture().content, phases: [null] }]) {
    const result = verifyRuntimeSeoCoverage(input); assert.equal(result.ok, false); assert.ok(result.errors.length);
  }
  const malformed = fixture(); malformed.content.tours.push(null);
  assert.equal(verifyRuntimeSeoCoverage(malformed).ok, false);
  for (const field of ['locale', 'status', 'slug']) {
    const missingField = fixture(); delete missingField.content.tours[0].data[field];
    assert.equal(verifyRuntimeSeoCoverage(missingField).ok, false, field);
  }
  const duplicated = fixture(); duplicated.content.tours.push(copy(duplicated.content.tours[0]));
  assert.match(verifyRuntimeSeoCoverage(duplicated).errors.join('\n'), /Duplicate active runtime ID/);
  const invalidRoute = fixture(); invalidRoute.content.tours[0].data.countries = ['country_missing'];
  assert.match(verifyRuntimeSeoCoverage(invalidRoute).errors.join('\n'), /cannot derive canonical URL/);
});

test('a newly nonempty destination-tour catalogue must be registered; page 2 cannot substitute for page 1', () => {
  const input = fixture(); input.content.tours[0].data.destinations = ['destination_coverage_fixture'];
  const url = '/brazil/place/coverage-place/tour/';
  assert.ok(verifyRuntimeSeoCoverage(input).errors.some((error) => error.includes(url)));
  input.phases[2].entries.push({ phase: 5, kind: 'destination_tours', url: url + 'page/2/',
    work: 'queued', availability: 'active_runtime_catalogue' });
  assert.equal(verifyRuntimeSeoCoverage(input).ok, false);
  input.phases[2].entries.at(-1).url = url;
  assert.equal(verifyRuntimeSeoCoverage(input).ok, true);
});

test('new excursion references create a writing target, and a removed intersection preserves unavailable history', () => {
  const input = fixture();
  input.content.tours[0].data.itinerary = [{ excursionRef: 'excursion_coverage_fixture' }];
  const url = '/brazil/excursion/coverage-excursion/tour/';
  assert.ok(verifyRuntimeSeoCoverage(input).errors.some((error) => error.includes(url)));
  const row = { phase: 5, kind: 'excursion_tours', url, work: 'queued', availability: 'active_runtime_catalogue' };
  input.phases[2].entries.push(row);
  assert.equal(verifyRuntimeSeoCoverage(input).ok, true);
  row.work = row.availability = 'temporarily_unavailable';
  assert.equal(verifyRuntimeSeoCoverage(input).ok, false, 'active catalogue cannot be hidden as unavailable');
  input.content.tours[0].data.itinerary = [];
  assert.equal(verifyRuntimeSeoCoverage(input).ok, true, 'disappeared catalogue keeps its historical row');
});

test('new theme membership is projected by the official inventory and cannot bypass queue coverage', () => {
  const input = fixture(); input.content.tours[0].data.primaryThemes = ['theme_wildlife'];
  const result = verifyRuntimeSeoCoverage(input);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('/interests/wildlife/tours/')));
});

test('a source-only reservation can have a real related-excursion catalogue without a fabricated Destination MD', () => {
  const input = fixture();
  input.destinationCatalog.push({ id: 'destination_reserved', name: 'Reserved place', slug: 'reserved-place', countryId: 'country_brazil', countrySlug: 'brazil' });
  input.content.excursions[0].data.relatedDestinations = ['destination_reserved'];
  assert.equal(verifyRuntimeSeoCoverage(input).ok, false);
  input.phases[4].entries.push({ phase: 7, kind: 'destination_excursions', url: '/brazil/reserved-place/',
    work: 'queued', availability: 'active_runtime_catalogue' });
  const result = verifyRuntimeSeoCoverage(input);
  assert.equal(result.ok, true); assert.equal(result.byType.destination, 1, 'reservation is not an active entity MD');
});

const registrationFixture = () => {
  const { content, destinationCatalog } = fixture();
  return { content, destinationCatalog, phases: [1, 2, 3, 4, 5, 6, 7].map((phase) => ({ phase, entries: [] })) };
};
const findRow = (phases, url) => phases.flatMap((phase) => phase.entries).find((row) => row.url === url);

test('the reusable projection registers a fresh graph without articles, and a second build is idempotent', () => {
  const input = registrationFixture(), before = copy(input);
  const phases = reconcileRuntimeRegistries(input.phases, input.content, input.destinationCatalog);
  const row = findRow(phases, '/brazil/tour/coverage-fixture/');
  assert.equal(row.work, 'queued'); assert.equal(row.id, 'tour_coverage_fixture');
  assert.ok(!Object.hasOwn(row, 'articlePath')); assert.ok(!Object.hasOwn(row, 'publishedAt'));
  assert.equal(verifyRuntimeSeoCoverage({ ...input, phases }).ok, true);
  assert.deepEqual(reconcileRuntimeRegistries(phases, input.content, input.destinationCatalog), phases);
  assert.deepEqual(input, before);
});

test('main and staging reconcile independently and retain their own published/prepared articles, notes and ownership', () => {
  const input = registrationFixture(), url = '/brazil/tour/coverage-fixture/';
  const seed = projectRuntimeRegistryRows(input.content, input.destinationCatalog).find((row) => row.url === url);
  const published = { ...seed, work: 'published', articlePath: 'main-only.md', publishedAt: '2026-10-12',
    publishedCommit: 'main-commit', note: 'manager history' };
  const prepared = { ...seed, work: 'prepared', articlePath: 'staging-only.md', preparedAt: '2026-10-26',
    provenancePath: 'staging-evidence.json', note: 'specialist draft', owner: 'other-writer', lease: { expiresAt: '2026-10-27' } };
  const main = copy(input.phases), staging = copy(input.phases);
  main.find((p) => p.phase === 5).entries.push(published);
  staging.find((p) => p.phase === 5).entries.push(prepared);
  const mainAfter = reconcileRuntimeRegistries(main, input.content, input.destinationCatalog);
  const stagingAfter = reconcileRuntimeRegistries(staging, input.content, input.destinationCatalog);
  assert.deepEqual(findRow(mainAfter, url), published);
  assert.deepEqual(findRow(stagingAfter, url), prepared);
  assert.deepEqual(staging.find((p) => p.phase === 5).entries, [prepared]);
});

test('disappearing related catalogues keep rewritten history and recover that same status when the relation returns', () => {
  const input = registrationFixture();
  input.content.tours[0].data.destinations = ['destination_coverage_fixture'];
  const url = '/brazil/place/coverage-place/tour/';
  let phases = reconcileRuntimeRegistries(input.phases, input.content, input.destinationCatalog);
  Object.assign(findRow(phases, url), { work: 'rewritten', articlePath: 'historical.md',
    publishedAt: '2026-10-12', rewrittenAt: '2026-10-18', note: 'Never erase this history', owner: 'specialist' });
  input.content.tours[0].data.destinations = [];
  phases = reconcileRuntimeRegistries(phases, input.content, input.destinationCatalog);
  assert.equal(findRow(phases, url).work, 'temporarily_unavailable');
  assert.equal(findRow(phases, url).workBeforeUnavailable, 'rewritten');
  assert.equal(findRow(phases, url).tours, 0);
  assert.equal(findRow(phases, url).articlePath, 'historical.md');
  input.content.tours[0].data.destinations = ['destination_coverage_fixture'];
  phases = reconcileRuntimeRegistries(phases, input.content, input.destinationCatalog);
  const restored = findRow(phases, url);
  assert.equal(restored.work, 'rewritten'); assert.equal(restored.tours, 1);
  assert.equal(restored.publishedAt, '2026-10-12'); assert.equal(restored.owner, 'specialist');
  assert.equal(restored.note, 'Never erase this history'); assert.ok(!Object.hasOwn(restored, 'workBeforeUnavailable'));
});

test('projection never fabricates a Destination entity for a reservation, but registers its nonempty excursion catalogue', () => {
  const input = registrationFixture();
  input.destinationCatalog.push({ id: 'destination_reserved', name: 'Reserved place', slug: 'reserved-place', countryId: 'country_brazil', countrySlug: 'brazil' });
  input.content.excursions[0].data.relatedDestinations = ['destination_reserved'];
  const phases = reconcileRuntimeRegistries(input.phases, input.content, input.destinationCatalog);
  assert.equal(findRow(phases, '/brazil/place/reserved-place/'), undefined);
  const row = findRow(phases, '/brazil/reserved-place/');
  assert.equal(row.work, 'queued'); assert.equal(row.kind, 'destination_excursions');
  assert.equal(row.id, 'destination_excursions:destination_reserved');
});

test('projection fails on ambiguous identities and duplicate canonical URLs without overwriting either record', () => {
  const input = registrationFixture();
  const phases = reconcileRuntimeRegistries(input.phases, input.content, input.destinationCatalog);
  const wrong = copy(phases); findRow(wrong, '/brazil/tour/coverage-fixture/').id = 'other-tour';
  assert.throws(() => reconcileRuntimeRegistries(wrong, input.content, input.destinationCatalog), /identity conflict/);
  const duplicate = copy(phases);
  duplicate[0].entries.push(copy(findRow(duplicate, '/brazil/tour/coverage-fixture/')));
  assert.throws(() => reconcileRuntimeRegistries(duplicate, input.content, input.destinationCatalog), /conflict|Duplicate/);
  assert.equal(findRow(wrong, '/brazil/tour/coverage-fixture/').id, 'other-tour');
});

test('registration preserves an existing derived stable ID, waiting reserve and unrelated special-page history', () => {
  const input = registrationFixture();
  input.content.tours[0].data.destinations = ['destination_coverage_fixture'];
  const url = '/brazil/place/coverage-place/tour/';
  let phases = reconcileRuntimeRegistries(input.phases, input.content, input.destinationCatalog);
  findRow(phases, url).id = 'legacy-derived-id';
  const reserve = { phase: 6, kind: 'destination', id: 'destination_future', url: '/brazil/place/future/',
    work: 'waiting_for_page', availability: 'needs_content', note: 'No MD; do not publish' };
  const unrelated = { phase: 5, kind: 'mice_special', id: 'external-work', url: '/mice/special/',
    work: 'prepared', articlePath: 'other-writer.md', owner: 'other-writer' };
  phases.find((p) => p.phase === 6).entries.push(reserve);
  phases.find((p) => p.phase === 5).entries.push(unrelated);
  phases = reconcileRuntimeRegistries(phases, input.content, input.destinationCatalog);
  assert.equal(findRow(phases, url).id, 'legacy-derived-id');
  assert.deepEqual(findRow(phases, reserve.url), reserve);
  assert.deepEqual(findRow(phases, unrelated.url), unrelated);
});
