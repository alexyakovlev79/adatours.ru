import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInterestHub, themeRelevance, compareToursForInterest, interestsForCountry, validateInterestContent, INTERESTS, countLabel, countryMembership, excursionIdsForInterestTour } from '../src/lib/interest-model.mjs';
import { salesFitScore } from '../src/lib/tour-sales-fit.mjs';
const A = 'theme_adventure', C = 'theme_culture';
const entity = (id, extra = {}) => ({ data: { id, locale: 'ru', status: 'published', title: id, name: id, slug: id.replaceAll('_', '-'), themes: [], ...extra } });
const tour = (id, extra = {}) => entity(id, { primaryThemes: [A], countries: ['one'], destinations: [], durationDays: 13, itinerary: [], ...extra });
const countries = [entity('one'), entity('two')];
const themes = INTERESTS.map((d) => entity(d.id, d));
test('closed dictionary retains the nine stable URLs and has thirteen themes', () => { assert.equal(INTERESTS.length, 13); assert.equal(INTERESTS.find((r) => r.id === 'theme_motorcycle').slug, 'motorcycle-tours'); });
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
test('geography cover tours are unique and allocated from weaker countries upward', () => {
  const geography = [entity('brazil'), entity('argentina'), entity('peru')];
  const t1 = tour('t1', { countries: ['brazil', 'argentina', 'peru'], routeCountries: ['brazil', 'argentina', 'peru'], hero: { src: '/t1.webp' } });
  const t2 = tour('t2', { countries: ['brazil', 'argentina'], routeCountries: ['brazil', 'argentina'], hero: { src: '/t2.webp' } });
  const t3 = tour('t3', { countries: ['brazil'], routeCountries: ['brazil'], hero: { src: '/t3.webp' } });
  const hub = buildInterestHub(A, { countries: geography, tours: [t1, t2, t3], themes });
  assert.deepEqual(hub.countries.map((row) => row.entry.data.id), ['brazil', 'argentina', 'peru']);
  assert.deepEqual(hub.allCountries.map((row) => row.topTour.data.id), ['t1', 't1', 't1']);
  assert.deepEqual(hub.countries.map((row) => row.coverTour?.data.id), ['t3', 't2', 't1']);
  assert.equal(new Set(hub.countries.map((row) => row.coverTour?.data.id).filter(Boolean)).size, 3);
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
