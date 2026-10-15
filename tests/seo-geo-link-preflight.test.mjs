import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSeoGeoCanonicalPaths } from '../src/lib/seo-geo-route-inventory.mjs';
import { validateSeoGeoHtml } from '../src/lib/seo-geo.mjs';
const country = { data: { id: 'country_brazil', name: 'Бразилия', slug: 'brazil', status: 'approved', locale: 'ru' } };
const theme = { data: { id: 'theme_diving', name: 'Дайвинг', slug: 'diving', status: 'approved', locale: 'ru' } };
const place = { data: { id: 'destination_brazil_test', name: 'Место', slug: 'sample-island', countryId: 'country_brazil', status: 'approved', locale: 'ru', themes: [] } };
const tour = { data: { id: 'tour_test', slug: 'sample-trip', title: 'Поездка', locale: 'ru', status: 'approved', countries: ['country_brazil'], routeCountries: ['country_brazil'], destinations: ['destination_brazil_test'], routeDestinations: ['destination_brazil_test'], primaryThemes: ['theme_beach'], themes: [], durationDays: 10, itinerary: [] } };
const input = { countries: [country], themes: [theme], destinations: [place], tours: [tour], excursions: [], destinationCatalog: [{ id: 'destination_brazil_test', slug: 'sample-island', countryId: 'country_brazil' }, { id: 'destination_brazil_reserved', slug: 'not-yet-published', countryId: 'country_brazil' }] };
const check = (url, available) => validateSeoGeoHtml(`<h2>Тест</h2><p><a href="${url}">Переход</a></p>`, { targetPath: '/tours/', isCanonicalLink: (path) => available.has(path) });
test('empty Brazil diving catalogue is rejected before prepared', () => {
  const available = buildSeoGeoCanonicalPaths(input);
  assert.ok(available.has('/interests/diving/'));
  assert.ok(!available.has('/interests/diving/tours/brazil/'));
  assert.throws(() => check('/interests/diving/tours/brazil/', available), /unavailable\/noncanonical/);
});
test('adding diving to an active Brazil tour permits the nonempty catalogue', () => {
  const tagged = { ...tour, data: { ...tour.data, themes: ['theme_diving'] } };
  const available = buildSeoGeoCanonicalPaths({ ...input, tours: [tagged] });
  assert.ok(available.has('/interests/diving/tours/brazil/'));
  assert.equal(check('/interests/diving/tours/brazil/', available), true);
});
test('a future reserved place is not a published page', () => {
  const available = buildSeoGeoCanonicalPaths(input);
  assert.ok(available.has('/brazil/place/sample-island/'));
  assert.ok(!available.has('/brazil/place/not-yet-published/'));
  assert.throws(() => check('/brazil/place/not-yet-published/', available), /unavailable\/noncanonical/);
});
test('archive and pagination excluded', () => {
  const archived = { ...tour, data: { ...tour.data, status: 'archived', themes: ['theme_diving'] } };
  const available = buildSeoGeoCanonicalPaths({ ...input, tours: [archived] });
  assert.ok(!available.has('/brazil/tour/sample-trip/'));
  assert.throws(() => check('/interests/diving/tours/page/2/', available), /SEO\/GEO article cannot target pagination/);
});
