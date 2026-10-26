import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { auditTourGraph, resolveGptImageEvidence, programmeExcursionCoverage, catalogHeroUsagesForTour,
  auditScopedCatalogSeo, verifyExcursionVariantReviews } from '../scripts/audit-tour-dependencies.mjs';

const fixture = () => {
  const tour = { id: 'tour_fixture', slug: 'fixture', locale: 'ru', status: 'approved',
    countries: ['country_peru'], routeCountries: ['country_peru'],
    destinations: ['destination_peru_lima', 'destination_peru_museum'],
    routeDestinations: ['destination_peru_lima'], primaryThemes: ['theme_culture'], themes: [],
    itinerary: [{ day: 1, contentBlocks: [{ type: 'excursion', excursionRef: 'excursion_lima' }] }] };
  const source = { id: tour.id, type: 'tour', slug: tour.slug, url: '/peru/tour/fixture/',
    countryIds: [...tour.countries], routeCountryIds: [...tour.routeCountries],
    destinationIds: [...tour.destinations], routeDestinationIds: [...tour.routeDestinations],
    primaryThemes: [...tour.primaryThemes], themes: [] };
  return { tour, url: source.url, entry: structuredClone(source), compact: structuredClone(source),
    interests: [{ id: 'theme_culture' }, { id: 'theme_nature' }, { id: 'theme_wildlife' }],
    destinations: new Map([
      ['destination_peru_lima', { countryId: 'country_peru', destinationType: 'city', navigationRole: 'hub' }],
      ['destination_peru_museum', { countryId: 'country_peru', destinationType: 'museum', navigationRole: 'sight' }],
    ]), excursions: new Map([['excursion_lima', { id: 'excursion_lima', status: 'approved', locale: 'ru',
      country: 'country_peru', destination: 'destination_peru_lima', relatedDestinations: ['destination_peru_museum'] }]]) };
};

test('nested excursion reference retains full geography without inventing a mandatory route stop', () => {
  const result = auditTourGraph(fixture());
  assert.deepEqual(result.excursionIds, ['excursion_lima']);
  assert.deepEqual(result.blockers, []);
});

test('day coverage keeps standalone excursion cards with their preceding day without losing inline blocks', () => {
  const result = programmeExcursionCoverage({ itinerary: [
    { excursionRef: 'excursion_before_programme' },
    { day: 1, title: 'Обзорная экскурсия' }, { excursionRef: 'excursion_lima' },
    { day: 2, title: 'Второй день', contentBlocks: [{ type: 'excursion', excursionRef: 'excursion_museum' }] },
    { day: 3, title: 'Экскурсия без отдельного модуля' },
  ] });
  assert.deepEqual(result.days.map(row => row.excursionIds), [['excursion_lima'], ['excursion_museum'], []]);
  assert.deepEqual(result.unassignedRefs, ['excursion_before_programme']);
  assert.deepEqual(result.days.filter(row => !row.excursionIds.length && row.textualCandidate).map(row => row.day), [3]);
});

test('a place removed from all Tour mirrors is still detected through the canonical excursion edge', () => {
  const input = fixture();
  input.tour.destinations = ['destination_peru_lima'];
  input.entry.destinationIds = ['destination_peru_lima'];
  input.compact.destinationIds = ['destination_peru_lima'];
  const result = auditTourGraph(input);
  assert.ok(result.blockers.some((row) => row.code === 'EXCURSION_PLACE_NOT_IN_TOUR'
    && row.detail.destinationId === 'destination_peru_museum'));
  assert.ok(!result.blockers.some((row) => row.code === 'TOUR_SOURCE_DRIFT'));
});

test('Word text alone cannot excuse a lost place; a byte-bound explicit reviewed variant can', () => {
  const input = fixture(), text = 'По Word только город; дополнительного музея в маршруте нет.';
  input.tour.destinations = input.entry.destinationIds = input.compact.destinationIds = ['destination_peru_lima'];
  input.tour.itinerary[0].contentBlocks[0].text = text;
  const excursions = new Map([['excursion_lima', { data: input.excursions.get('excursion_lima'), sourceBlobSha: 'b'.repeat(40) }]]);
  const receipt = { tourId: input.tour.id, tourMdBlobSha: 'a'.repeat(40), sourceSnapshotPath: 'data/word.md',
    sourceSnapshotSha256: 'c'.repeat(64), resolved: [{ excursionId: 'excursion_lima', status: 'resolved',
      kind: 'existing_with_word_variant', reviewedAgainstWord: true, source: 'data/word.md', sourceDay: 1,
      excursionMdBlobSha: 'b'.repeat(40), excludedDestinationIds: ['destination_peru_museum'],
      wordOverrideSha256: createHash('sha256').update(text).digest('hex'), exclusionReason: 'Word confirms the city only.' }] };
  const check = value => verifyExcursionVariantReviews({ tour: input.tour, tourSourceBlobSha: 'a'.repeat(40),
    excursions, receipt: value, sourceSnapshotSha256: 'c'.repeat(64) });
  assert.ok(auditTourGraph(input).blockers.some(row => row.code === 'EXCURSION_PLACE_NOT_IN_TOUR'));
  const approved = check(receipt);
  assert.deepEqual(approved.blockers, []);
  assert.deepEqual(auditTourGraph({ ...input, variantExclusions: approved.approvedExclusions }).blockers, []);
  assert.deepEqual(approved.evidence[0].excludedDestinationIds, ['destination_peru_museum']);
  for (const mutate of [
    row => { row.tourMdBlobSha = 'd'.repeat(40); },
    row => { row.tourId = 'tour_another'; },
    row => { row.resolved[0].excursionMdBlobSha = 'e'.repeat(40); },
    row => { row.resolved[0].excludedDestinationIds = ['destination_unreviewed']; },
    row => { row.resolved[0].wordOverrideSha256 = 'f'.repeat(64); },
    row => { row.sourceSnapshotSha256 = 'f'.repeat(64); },
  ]) {
    const stale = structuredClone(receipt); mutate(stale);
    const result = check(stale);
    assert.equal(result.approvedExclusions.size, 0);
    assert.ok(result.blockers.some(row => row.code === 'EXCURSION_VARIANT_REVIEW_INVALID'));
    assert.ok(auditTourGraph({ ...input, variantExclusions: result.approvedExclusions }).blockers
      .some(row => row.code === 'EXCURSION_PLACE_NOT_IN_TOUR'));
  }
});

test('missing excursion and stale source mirrors remain distinct actionable blockers', () => {
  const input = fixture();
  input.excursions.clear();
  input.compact.destinationIds = [];
  const codes = auditTourGraph(input).blockers.map((row) => row.code);
  assert.ok(codes.includes('EXCURSION_MISSING'));
  assert.ok(codes.includes('TOUR_SOURCE_DRIFT'));
});

test('interest validation reads the supplied registry instead of a fixed 14-item list', () => {
  const input = fixture();
  for (const row of [input.tour, input.entry, input.compact]) row.themes = ['theme_wildlife'];
  assert.deepEqual(auditTourGraph(input).blockers, []);
  input.interests = input.interests.filter((row) => row.id !== 'theme_wildlife');
  assert.ok(auditTourGraph(input).blockers.some((row) => row.code === 'UNKNOWN_INTEREST'));
});

test('the existing GPT repair is reused through its historical conversion chain', () => {
  const records = [
    { source: '/media/original.webp', enhanced: '/media/converted.webp', method: 'deterministic-restoration' },
    { source: '/media/converted.webp', enhanced: '/media/repaired.webp', method: 'gpt-image' },
  ];
  const result = resolveGptImageEvidence('/media/original.webp', records);
  assert.equal(result.status, 'reuse_available');
  assert.equal(result.record.enhanced, '/media/repaired.webp');
  assert.equal(result.chain.length, 2);
  assert.equal(resolveGptImageEvidence('/media/repaired.webp', records).status, 'confirmed');
});

test('a conversion or a cycle never becomes proof of GPT Image processing', () => {
  const records = [
    { source: '/media/a.webp', enhanced: '/media/b.webp', method: 'deterministic-restoration' },
    { source: '/media/b.webp', enhanced: '/media/a.webp', method: 'webp-conversion' },
  ];
  assert.equal(resolveGptImageEvidence('/media/a.webp', records).status, 'enhancement_required');
});

test('catalogue hero scope includes a newly generated pagination URL, exact overrides and distinct geometry', () => {
  const tours = Array.from({ length: 31 }, (_, i) => ({ id: 'tour_' + i, locale: 'ru', status: 'approved',
    hero: { src: '/media/tours/hero-' + i + '.webp' }, itinerary: [{ excursionRef: 'excursion_fixture' }] }));
  const excursion = { id: 'excursion_fixture', slug: 'fixture-excursion', locale: 'ru', status: 'approved',
    country: 'country_peru', destination: 'destination_peru_lima' };
  const reversePath = '/peru/lima/fixture-excursion/tour/', comboPath = '/multi-country/argentina_brazil/',
    themePath = '/multi-country/argentina_brazil/interests/culture-and-history/';
  const rows = [{ id: 'multi_country', path: '/multi-country/', key: '', tours },
    { id: 'combo', path: comboPath, key: 'argentina_brazil', tours },
    { id: 'theme_combo', path: themePath, key: 'argentina_brazil', tours,
      theme: { hero: { src: '/media/themes/culture.webp' } } }];
  const result = catalogHeroUsagesForTour({ tourId: 'tour_0', allTours: tours, excursions: [excursion],
    multiCountryRows: rows, affectedCatalogPaths: rows.map(row => row.path),
    catalogOverrides: { [reversePath + 'page/2/']: { src: '/media/catalog/reverse-page-2.webp' },
      '/multi-country/page/2/': { src: '/media/catalog/multi-page-2.webp' },
      [comboPath]: { src: '/media/catalog/not-used-by-combination-layout.webp' } },
    combinationCovers: { argentina_brazil: { src: '/media/catalog/combination.webp' } } });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.usages.length, 8);
  const byPath = new Map(result.usages.map(row => [row.pagePath, row]));
  assert.equal(byPath.get(reversePath).source, '/media/catalog/tury/hero-enhanced-20260930.webp');
  assert.equal(byPath.get(reversePath + 'page/2/').source, '/media/catalog/reverse-page-2.webp');
  assert.equal(byPath.get('/multi-country/').source, tours[30].hero.src);
  assert.equal(byPath.get('/multi-country/').profile, 'standard');
  assert.equal(byPath.get('/multi-country/page/2/').source, '/media/catalog/multi-page-2.webp');
  assert.equal(byPath.get(comboPath).source, '/media/catalog/combination.webp');
  assert.equal(byPath.get(themePath + 'page/2/').source, '/media/catalog/combination.webp');
  assert.ok(result.usages.filter(row => row.pagePath !== '/multi-country/').every(row => row.profile === 'compact'));
});

test('catalogue hero model uses theme/first-tour fallbacks and reports unresolved off-page photos', () => {
  const tours = Array.from({ length: 31 }, (_, i) => ({ id: 'tour_' + i, locale: 'ru', status: 'approved',
    hero: { src: '/media/tours/shared.webp' }, itinerary: [] }));
  const comboPath = '/multi-country/argentina_brazil/', themePath = comboPath + 'interests/culture-and-history/';
  const rows = [{ id: 'multi_country', path: '/multi-country/', key: '', tours },
    { id: 'combo', path: comboPath, key: 'argentina_brazil', tours },
    { id: 'theme_combo', path: themePath, key: 'argentina_brazil', tours,
      theme: { hero: { src: '/media/themes/culture.webp' } } }];
  const result = catalogHeroUsagesForTour({ tourId: 'tour_0', multiCountryRows: rows,
    affectedCatalogPaths: rows.map(row => row.path) });
  assert.equal(result.usages.find(row => row.pagePath === comboPath).source, '/media/tours/shared.webp');
  assert.equal(result.usages.find(row => row.pagePath === themePath).source, '/media/themes/culture.webp');
  assert.equal(result.usages.some(row => row.pagePath === '/multi-country/page/2/'), false);
  assert.equal(result.warnings[0].code, 'CATALOG_HERO_SOURCE_UNRESOLVED');
  assert.equal(result.warnings[0].pagePath, '/multi-country/page/2/');
});

test('reserved destination excursion catalogues exist without place MD and only explicit hero overrides need mobile crops', () => {
  const place = { id: 'destination_reserved_fixture', countryId: 'country_peru', slug: 'reserved-fixture' };
  const excursions = Array.from({ length: 31 }, (_, i) => ({ id: 'excursion_reserve_' + i, slug: 'reserve-' + i,
    locale: 'ru', status: 'approved', country: 'country_peru', relatedDestinations: [place.id] }));
  const path = '/peru/reserved-fixture/';
  const result = catalogHeroUsagesForTour({ tourId: 'tour_fixture', excursions: [excursions[0]], allExcursions: excursions,
    destinationCatalog: [place], catalogOverrides: { [path + 'page/2/']: { src: '/media/verified-reused-cover.webp' } } });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.catalogs.length, 1);
  assert.equal(result.catalogs[0].kind, 'destination_excursions');
  assert.equal(result.catalogs[0].memberIds.length, 31, 'paginate the whole current catalogue, not only the Tour reference');
  assert.deepEqual(result.imageFree.map(row => [row.pagePath, row.status]), [[path, 'not_applicable_no_image']]);
  assert.deepEqual(result.usages.map(row => [row.pagePath, row.source, row.profile]),
    [[path + 'page/2/', '/media/verified-reused-cover.webp', 'compact']]);
});

test('new dependent catalogue requires current SEO while an old queued catalogue remains historical scope', () => {
  const catalogs = [{ entityId: 'new', url: '/peru/new-catalog/', kind: 'destination_excursions' },
    { entityId: 'old', url: '/peru/old-catalog/', kind: 'destination_excursions' }];
  const registry = new Map(catalogs.map(row => [row.url, { work: 'queued' }]));
  const baseline = { available: true, paths: new Set(['/peru/old-catalog/']) };
  const first = auditScopedCatalogSeo(catalogs, baseline, registry, () => null);
  assert.deepEqual(first.blockers.map(row => [row.code, row.entityId]), [['SEO_NEW_CATALOG_ARTICLE_MISSING', 'new']]);
  assert.equal(first.rows[0].editorialScope, 'required_in_current_word_job');
  assert.equal(first.rows[1].editorialScope, 'existing_catalogue_queue');
  registry.get('/peru/new-catalog/').work = 'draft';
  const prepared = auditScopedCatalogSeo(catalogs, baseline, registry, row => row.work === 'draft' ? 'reviewed draft' : null);
  assert.equal(prepared.blockers[0].code, 'SEO_NEW_CATALOG_SECOND_STAGE_PENDING');
});

test('missing Git baseline is explicit and never classifies the whole historical backlog as new', () => {
  const result = auditScopedCatalogSeo([{ entityId: 'catalog', url: '/peru/catalog/' }],
    { available: false, ref: 'f'.repeat(40), error: 'Git object unavailable; no lazy fetch' },
    new Map([['/peru/catalog/', { work: 'queued' }]]), () => null);
  assert.deepEqual(result.blockers.map(row => row.code), ['CATALOG_BASELINE_UNAVAILABLE']);
  assert.equal(result.rows[0].newInWordJob, null);
  assert.equal(result.rows[0].editorialScope, 'unknown_baseline_unavailable');
});
