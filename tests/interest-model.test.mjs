import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInterestHub, themeRelevance, compareToursForInterest, interestsForCountry, validateInterestContent, INTERESTS, countLabel, countryMembership, excursionIdsForInterestTour } from '../src/lib/interest-model.mjs';
import { salesFitScore, countryDestinationShare, compareToursForCountry, compareToursBySalesFit } from '../src/lib/tour-sales-fit.mjs';
import destinationCatalog from '../src/data/catalog/destinations.json' with { type: 'json' };
const A = 'theme_adventure', C = 'theme_culture';
const entity = (id, extra = {}) => ({ data: { id, locale: 'ru', status: 'published', title: id, name: id, slug: id.replaceAll('_', '-'), themes: [], ...extra } });
const tour = (id, extra = {}) => entity(id, { primaryThemes: [A], countries: ['one'], destinations: [], durationDays: 13, itinerary: [], ...extra });
const countries = [entity('one'), entity('two')];
const themes = INTERESTS.map((d) => entity(d.id, d));
const brazilPlaces = destinationCatalog.filter((place) => place.countryId === 'country_brazil').slice(0, 7).map((place) => place.id);
const foreignPlaces = destinationCatalog.filter((place) => place.countryId !== 'country_brazil').slice(0, 3).map((place) => place.id);
test('country formula matches 15 days, four countries, and seven of ten places: 3.6', () => {
  const t = tour('four-countries', { durationDays: 15, countries: ['country_brazil', 'two', 'three', 'four'],
    destinations: [...brazilPlaces, ...foreignPlaces] });
  assert.equal(countryDestinationShare(t, 'country_brazil'), .7);
  assert.ok(Math.abs(salesFitScore(t, 'country_brazil') - 3.6) < 1e-12);
  assert.equal(salesFitScore(t), 6);
  assert.equal(salesFitScore(tour('short', { ...t.data, durationDays: 11 }), 'country_brazil'), salesFitScore(t, 'country_brazil'));
});
test('route share deduplicates visits, excludes optional places, and counts unpublished catalogued places', () => {
  const t = tour('route', { destinations: [...brazilPlaces, ...foreignPlaces],
    routeDestinations: [brazilPlaces[0], brazilPlaces[0], foreignPlaces[0]] });
  assert.equal(countryDestinationShare(t, 'country_brazil'), .5);
  assert.equal(countryDestinationShare(tour('empty', { routeDestinations: [], destinations: brazilPlaces }), 'country_brazil'), 0);
  assert.equal(countryDestinationShare(tour('unknown', { destinations: ['unknown'] }), 'country_brazil'), 0);
  assert.equal(salesFitScore(tour('unknown-days', { durationDays: undefined }), 'country_brazil'), -Infinity);
});
test('country order rewards route presence, preserves global order and thematic relevance', () => {
  const dilute = tour('dilute', { title: 'А', countries: ['country_brazil', 'two'], destinations: [brazilPlaces[0], ...foreignPlaces] });
  const concentrated = tour('concentrated', { title: 'Я', countries: ['country_brazil', 'two'], destinations: [...brazilPlaces, foreignPlaces[0]] });
  assert.deepEqual([concentrated, dilute].sort(compareToursBySalesFit).map((t) => t.data.id), ['dilute', 'concentrated']);
  assert.deepEqual([dilute, concentrated].sort(compareToursForCountry('country_brazil')).map((t) => t.data.id), ['concentrated', 'dilute']);
  assert.deepEqual([dilute, concentrated].sort(compareToursForInterest(A, 'country_brazil')).map((t) => t.data.id), ['concentrated', 'dilute']);
  const secondary = tour('secondary', { ...concentrated.data, id: 'secondary', primaryThemes: [C], themes: [A] });
  assert.deepEqual([secondary, dilute].sort(compareToursForInterest(A, 'country_brazil')).map((t) => t.data.id), ['dilute', 'secondary']);
  const hub = buildInterestHub(A, { tours: [dilute, concentrated], countries: [entity('country_brazil')], themes });
  assert.deepEqual(hub.allCountries[0].tours.map((t) => t.data.id), ['concentrated', 'dilute']);
  assert.deepEqual(hub.allTours.map((t) => t.data.id), ['dilute', 'concentrated']);
});
test('closed dictionary retains the nine stable URLs and includes the restored coffee interest among fifteen themes', () => { assert.equal(INTERESTS.length, 15); assert.equal(INTERESTS.find((r) => r.id === 'theme_motorcycle').slug, 'motorcycle-tours'); });
test('primary relevance beats a stronger commercial score', () => {
  const primary = tour('primary', { durationDays: 30 }), secondary = tour('secondary', { primaryThemes: [C], themes: [A], countries: ['one', 'two'], durationDays: 13 });
  assert.equal(themeRelevance(primary, A), 2); assert.equal(themeRelevance(secondary, A), 1);
  assert.deepEqual([secondary, primary].sort(compareToursForInterest(A)).map((t) => t.data.id), ['primary', 'secondary']);
});
test('commercial formula is unchanged and uses main, unique countries', () => {
  assert.equal(salesFitScore(tour('t', { countries: ['one', 'two'], routeCountries: ['one'], durationDays: 12 })), 1);
  assert.equal(salesFitScore(tour('t', { countries: ['one','one'], durationDays: 13 })), 2);
  assert.equal(salesFitScore(tour('t', { durationDays: undefined })), -Infinity);
});
test('country scores use all tours, optional visits have lower weight and duplicate tours count once', () => {
  const tours = Array.from({ length: 15 }, (_, i) => tour(`t${i}`, { countries: ['one', 'two'], routeCountries: ['one'] }));
  const hub = buildInterestHub(A, { countries, tours: [...tours, tours[0]], themes });
  assert.equal(hub.tours.length, 10); assert.equal(hub.allTours.length, 15);
  assert.equal(hub.countries[0].tourCount, 15); assert.equal(hub.countries[0].score, 30);
  assert.equal(hub.countries[1].score, 7.5); assert.equal(hub.countries[1].optionalCount, 15);
  assert.equal(countryMembership(tours[0], 'two'), .25);
});
test('geography uses country-only covers and country heroes instead of shared multi-country leaders', () => {
  const geography = [entity('brazil'), entity('argentina', { hero: { src: '/argentina.webp' } }), entity('peru', { hero: { src: '/peru.webp' } })];
  const t1 = tour('t1', { countries: ['brazil', 'argentina', 'peru'], routeCountries: ['brazil', 'argentina', 'peru'], hero: { src: '/t1.webp' } });
  const t2 = tour('t2', { countries: ['brazil', 'argentina'], routeCountries: ['brazil', 'argentina'], hero: { src: '/t2.webp' } });
  const t3 = tour('t3', { countries: ['brazil'], routeCountries: ['brazil'], hero: { src: '/t3.webp' } });
  const hub = buildInterestHub(A, { countries: geography, tours: [t1, t2, t3], themes });
  assert.deepEqual(hub.countries.map((row) => row.entry.data.id), ['brazil', 'argentina', 'peru']);
  assert.deepEqual(hub.allCountries.map((row) => row.topTour.data.id), ['t1', 't1', 't1']);
  assert.deepEqual(hub.countries.map((row) => row.coverTour?.data.id), ['t3', undefined, undefined]);
  assert.equal(new Set(hub.countries.map((row) => row.coverTour?.data.id).filter(Boolean)).size, 1);
  assert.equal(hub.countries[1].entry.data.hero.src, '/argentina.webp');
  assert.equal(hub.countries[2].entry.data.hero.src, '/peru.webp');
});
test('Rio multi-country hero never becomes Bolivia cover, without determining image geography', () => {
  const countries = [entity('brazil'), entity('bolivia', { hero: { src: '/bolivia.webp' } })];
  const shared = tour('five-countries', { countries: ['brazil', 'bolivia'], hero: { src: '/rio.webp' } });
  const single = tour('bolivia-only', { countries: ['bolivia'], durationDays: 30, hero: { src: '/single.webp' } });
  const hub = buildInterestHub(A, { countries, tours: [shared, single], themes });
  const row = hub.countries.find(row => row.entry.data.id === 'bolivia');
  assert.equal(row.topTour.data.id, shared.data.id);
  assert.equal(row.coverTour.data.id, single.data.id);
  assert.equal(row.tourCount, 2);
  assert.deepEqual(hub.allTours.map(row => row.data.id), [shared.data.id, single.data.id]);
  const withoutSingle = buildInterestHub(A, { countries, tours: [shared], themes });
  const fallback = withoutSingle.countries.find(row => row.entry.data.id === 'bolivia');
  assert.equal(fallback.coverTour, undefined);
  assert.equal(fallback.entry.data.hero.src, '/bolivia.webp');
});
test('optional foreign visits disqualify a cover and missing tour photos use country fallback', () => {
  const countries = [entity('one', { hero: { src: '/one.webp' } })];
  const optional = tour('optional', { countries: ['one', 'two'], routeCountries: ['one'], hero: { src: '/optional.webp' } });
  const noHero = tour('no-hero');
  const hub = buildInterestHub(A, { countries, themes, tours: [optional, noHero] });
  assert.equal(hub.countries[0].coverTour, undefined);
  assert.equal(hub.countries[0].tourCount, 2);
  const duplicateId = tour('single', { countries: ['one', 'one'], hero: { src: '/single.webp' } });
  assert.equal(buildInterestHub(A, { countries, themes, tours: [duplicateId] }).countries[0].coverTour.data.id, 'single');
});
test('no excursion/destination inheritance and no archived/draft contribution', () => {
  const tours = [tour('a', { destinations: ['city'], itinerary: [{ excursionRef: 'sightseeing' }] }), tour('arch', { status: 'archived' }), tour('draft', { status: 'draft' })];
  const hub = buildInterestHub(A, { countries, tours, themes,
    destinations: [entity('city', { countryId: 'one', themes: [C] })], excursions: [entity('sightseeing', { country: 'one', themes: [C] })] });
  assert.equal(hub.allTours.length, 1); assert.equal(hub.allExperiences.length, 0); assert.equal(hub.countries[0].tourCount, 1);
});
test('explicit standalone excursion stays eligible and nested references are deduplicated', () => {
  const t = tour('t', { itinerary: [{ excursionRef: 'e', contentBlocks: [{ type: 'excursion', excursionRef: 'e' }] }] });
  const hub = buildInterestHub(A, { countries, themes, tours: [t], excursions: [entity('e', { country: 'one', themes: [A] }), entity('standalone', { country: 'one', themes: [A] })] });
  assert.equal(excursionIdsForInterestTour(t).size, 1); assert.equal(hub.allExperiences.find((e) => e.id === 'e').tourCount, 1);
  assert.equal(hub.allExperiences.find((e) => e.id === 'standalone').tourCount, 0);
});
test('archived countries, places and excursions never leak into the graph', () => {
  const hub = buildInterestHub(A, { countries: [entity('one', { status: 'archived' })], tours: [tour('t')], themes,
    destinations: [entity('p', { countryId: 'one', themes: [A] })], excursions: [entity('e', { country: 'one', themes: [A] })] });
  assert.equal(hub.allCountries.length, 0); assert.equal(hub.allExperiences.length, 0);
});
test('excursion geography follows the primary place even before its page exists', () => {
  const excursion = entity('cross-border', { country: 'country_argentina', destination: 'destination_uruguay_montevideo', themes: [C], hero: { src: '/test.webp' } });
  const origin = entity('country_argentina'), visited = entity('country_uruguay');
  const hub = buildInterestHub(C, { countries: [entity('country_argentina', { status: 'archived' }), visited], themes, excursions: [excursion] });
  assert.equal(hub.allExperiences[0].countryId, 'country_uruguay');
  assert.equal(hub.stories[0].countryId, 'country_uruguay');
  const excluded = buildInterestHub(C, { countries: [origin, entity('country_uruguay', { status: 'archived' })], themes, excursions: [excursion] });
  assert.equal(excluded.allExperiences.length, 0);
});
test('top stories and lower experiences do not repeat; related interests come only from common tours', () => {
  const excursions = Array.from({ length: 18 }, (_, i) => entity(`e${i}`, { country: i % 2 ? 'one' : 'two', themes: [A], hero: { src: '/test.webp' } }));
  const hub = buildInterestHub(A, { countries, themes, excursions, tours: [tour('t', { themes: [C] })] });
  assert.equal(hub.stories.length, 5); assert.equal(hub.experiences.length, 10);
  assert.equal(new Set([...hub.stories,...hub.experiences].map((r) => r.id)).size, 15);
  assert.equal(new Set(hub.stories.map((r) => r.countryId)).size, 2);
  assert.deepEqual(hub.relatedThemes.map((r) => r.entry.data.id), [C]);
});
test('empty interests produce empty sections, not unrelated filler', () => {
  const hub = buildInterestHub('theme_spa', { countries, themes, tours: [tour('a')] });
  for (const key of ['tours','stories','countries','experiences','relatedThemes']) assert.deepEqual(hub[key], []);
});
test('country interest projection responds to adding and archiving a tour', () => {
  assert.deepEqual(interestsForCountry('one', [tour('a')], themes).map((r) => r.id), [A]);
  assert.equal(interestsForCountry('one', [tour('a', { status: 'archived' })], themes).length, 0);
});
test('validator rejects missing primary, old vocabulary, overlap and country curation', () => {
  const errors = validateInterestContent({ themes, tours: [tour('bad', { primaryThemes: [], themes: ['nature'] }), tour('overlap', { themes: [A] })], countries: [entity('one', { relatedThemes: [A] })] });
  assert.equal(errors.length, 4); assert.deepEqual(validateInterestContent({ themes, tours: [tour('good')], destinations: [entity('intentional-empty')] }), []);
});
test('Russian counters have correct forms', () => { assert.equal(countLabel(1), '1 тур'); assert.equal(countLabel(2), '2 тура'); assert.equal(countLabel(11), '11 туров'); assert.equal(countLabel(21), '21 тур'); });

