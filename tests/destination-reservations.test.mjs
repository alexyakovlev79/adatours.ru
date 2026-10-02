import test from 'node:test';
import assert from 'node:assert/strict';
import { destinationSlug, normalizeDestinationName, reserveDestinations, syncReservationStatuses, validateDestinationReservations } from '../src/lib/destination-reservations.mjs';
import { excursionHasDestination } from '../src/lib/destination-links.mjs';
import { excursionPath } from '../src/lib/routes.ts';

const countries = [{ id: 'country_argentina', slug: 'argentina' }, { id: 'country_brazil', slug: 'braziliya' }, { id: 'country_chile', slug: 'chili' }];
const discovery = { entityType: 'tour', entityId: 'tour_fixture', sourceUrl: 'https://brasiltours.ru/fixture', evidence: 'День 2: поездка в указанное место.' };
const request = (name, extra = {}) => ({ countryId: 'country_argentina', name, discoveredIn: discovery, ...extra });
const empty = () => ({ catalog: [], reservations: { version: 1, entries: [] }, countries, publishedDestinationIds: [] });
const continueWith = (result, extra = {}) => ({ catalog: result.catalog, reservations: result.reservations, countries, publishedDestinationIds: [], ...extra });

test('repeat request keeps ID/slug/URL and does not duplicate evidence or mutate inputs', () => {
  const state = empty();
  const first = reserveDestinations(state, request('Эль-Чалтен', { aliases: ['El Chaltén'] }));
  assert.equal(first.ok, true);
  assert.equal(first.results[0].outcome, 'reserved');
  assert.equal(first.catalog[0].id, 'destination_argentina_el_chalten');
  assert.equal(first.catalog[0].url, '/argentina/place/el-chalten/');
  const repeated = reserveDestinations(continueWith(first), request(' EL—CHALTEN ', { discoveredIn: { ...discovery, evidence: 'День 2:   поездка в указанное место.' } }));
  assert.equal(repeated.results[0].outcome, 'existing');
  assert.equal(repeated.changed, false);
  assert.equal(repeated.reservations.entries[0].discoveredIn.length, 1);
  assert.deepEqual(state, empty());
  assert.equal(first.catalog[0].sourceUrl, null);
  assert.equal(first.catalog[0].destinationType, undefined);
  assert.equal(first.reservations.entries[0].name, undefined);
});

test('same Iguacu name in two countries keeps two independent identities', () => {
  const state = empty();
  const result = reserveDestinations(state, [request('Игуасу', { countryId: 'country_brazil' }), request('Игуасу')]);
  assert.equal(result.ok, true);
  assert.equal(result.catalog.length, 2);
  assert.notEqual(result.catalog[0].id, result.catalog[1].id);
  const again = reserveDestinations(continueWith(result), request('Игуасу', { countryId: 'country_brazil' }));
  assert.equal(again.results[0].destination.countryId, 'country_brazil');
  assert.equal(again.changed, false);
});

test('aliases that bridge two known places reject the whole batch before any mutation', () => {
  const known = reserveDestinations(empty(), [request('Тигре'), request('Сан-Исидро')]);
  const state = continueWith(known);
  const before = structuredClone(state);
  const result = reserveDestinations(state, [request('Кафаяте'), request('Тигре', { aliases: ['Сан-Исидро'] })]);
  assert.equal(result.ok, false);
  assert.equal(result.results[0].outcome, 'ambiguous');
  assert.equal(result.results[0].requestIndex, 1);
  assert.equal(result.results[0].candidates.length, 2);
  assert.deepEqual(result.catalog, before.catalog);
  assert.deepEqual(result.reservations, before.reservations);
  assert.deepEqual(state, before);
});

test('explicit existing ID cannot cross countries or steal an alias', () => {
  const known = reserveDestinations(empty(), [request('Тигре'), request('Сан-Исидро')]);
  const id = known.catalog[0].id;
  assert.equal(reserveDestinations(continueWith(known), request('Tigre', { destinationId: id, countryId: 'country_brazil' })).ok, false);
  const conflict = reserveDestinations(continueWith(known), request('Сан-Исидро', { destinationId: id }));
  assert.equal(conflict.results[0].outcome, 'ambiguous');
  const alias = reserveDestinations(continueWith(known), request('Tigre', { destinationId: id }));
  assert.equal(alias.ok, true);
  assert.equal(alias.catalog.length, 2);
  assert.deepEqual(alias.catalog[0].aliases, ['Tigre']);
});

test('an unqualified name does not silently duplicate a qualified place', () => {
  const known = reserveDestinations(empty(), request('Остров Магдалена (Магелланов пролив)', { countryId: 'country_chile' }));
  const result = reserveDestinations(continueWith(known), request('Магдалена', { countryId: 'country_chile' }));
  assert.equal(result.results[0].outcome, 'ambiguous');
  assert.equal(result.catalog.length, 1);
});

test('a parenthetical geographic qualifier does not confuse a place with its parent city', () => {
  const known = reserveDestinations(empty(), request('Буэнос-Айрес'));
  const result = reserveDestinations(continueWith(known), request('Сан-Исидро (Буэнос-Айрес)'));
  assert.equal(result.ok, true);
  assert.equal(result.catalog.length, 2);
  const bare = reserveDestinations(continueWith(result), request('Сан-Исидро'));
  assert.equal(bare.results[0].outcome, 'ambiguous');
  const anotherHomonym = reserveDestinations(continueWith(result), request('Сан-Исидро (другая провинция)'));
  assert.equal(anotherHomonym.results[0].outcome, 'ambiguous');
});

test('a direct user request reserves a place without a fabricated tour or excursion ID', () => {
  const input = request('Тигре', { discoveredIn: { entityType: 'user_request', evidence: 'Пользователь предоставил материалы места Тигре в Аргентине.' } });
  const first = reserveDestinations(empty(), input);
  assert.equal(first.ok, true);
  assert.equal(first.reservations.entries[0].discoveredIn[0].entityId, undefined);
  assert.equal(reserveDestinations(continueWith(first), input).changed, false);
  assert.equal(reserveDestinations(empty(), request('Тигре', { discoveredIn: { entityType: 'user_request' } })).ok, false);
});

test('transliteration collision cannot create a numeric-suffix duplicate', () => {
  const known = reserveDestinations(empty(), request('Сезд'));
  const result = reserveDestinations(continueWith(known), request('Съезд'));
  assert.equal(destinationSlug('Съезд'), 'sezd');
  assert.equal(result.results[0].outcome, 'ambiguous');
  assert.equal(result.catalog.length, 1);
});

test('unknown country, empty names and unsafe raw media URLs do not write state', () => {
  for (const input of [request('Тигре', { countryId: 'country_unknown' }), request('---'), request('Тигре', { aliases: ['---'] }), request('Тигре', { discoveredIn: { ...discovery, sourceUrl: 'https://brasiltours.ru/image/cache/photo.jpg' } })]) {
    const result = reserveDestinations(empty(), input);
    assert.equal(result.ok, false);
    assert.deepEqual(result.catalog, []);
  }
});

test('ordinary aliases preserve a prepared canonical record without opening a new preparation task', () => {
  const state = empty();
  state.catalog.push({ id: 'destination_argentina_el_chalten', name: 'Эль-Чалтен', slug: 'el-chalten', countryId: 'country_argentina', countrySlug: 'argentina', url: '/argentina/place/el-chalten/', sourceUrl: 'https://brasiltours.ru/existing', aliases: ['El Chaltén'] });
  const result = reserveDestinations(state, request('El Chalten'));
  assert.equal(result.results[0].outcome, 'existing');
  assert.equal(result.changed, false);
  assert.equal(result.reservations.entries.length, 0);
});

test('build guard rejects country-scoped alias conflicts, duplicated evidence and a second identity copy', () => {
  const known = reserveDestinations(empty(), [request('Тигре'), request('Сан-Исидро')]);
  const catalog = structuredClone(known.catalog);
  const queue = structuredClone(known.reservations);
  catalog[0].aliases = ['Tígre'];
  catalog[1].aliases = ['Tigre'];
  queue.entries[0].name = 'Second identity copy';
  queue.entries[0].discoveredIn.push({ ...discovery });
  const errors = validateDestinationReservations(catalog, queue, { countries });
  assert.ok(errors.some((error) => error.includes('already belongs')));
  assert.ok(errors.some((error) => error.includes('duplicate discovery')));
  assert.ok(errors.some((error) => error.includes('belongs only')));
});

test('publication changes queue status by the same ID; no placeholder is a prerequisite', () => {
  const known = reserveDestinations(empty(), request('Тигре'));
  const id = known.catalog[0].id;
  assert.equal(known.reservations.entries[0].status, 'needs_content');
  assert.ok(validateDestinationReservations(known.catalog, known.reservations, { countries, publishedDestinationIds: [id] }).some((error) => error.includes('same commit')));
  const queue = syncReservationStatuses(known.reservations, [id]);
  assert.equal(queue.entries[0].status, 'added');
  assert.equal(queue.entries[0].id, id);
  assert.deepEqual(validateDestinationReservations(known.catalog, queue, { countries, publishedDestinationIds: [id] }), []);
  assert.equal(syncReservationStatuses(queue, []).entries[0].status, 'needs_content');
  assert.ok(validateDestinationReservations(known.catalog, { version: 1, entries: [] }, { countries, publishedDestinationIds: [] }).some((error) => error.includes('needs a reservation')));
});

test('provided original material can reference a saved local image without permitting traversal', () => {
  const known = reserveDestinations(empty(), request('Тигре'));
  const queue = structuredClone(known.reservations);
  queue.entries[0].materials = { repositoryPath: 'data/source-index/materials/tigre.md', imageUrls: ['/media/destinations/tigre/original.jpg'] };
  assert.deepEqual(validateDestinationReservations(known.catalog, queue, { countries }), []);
  queue.entries[0].materials.imageUrls = ['/media/%2e%2e/private.jpg'];
  assert.ok(validateDestinationReservations(known.catalog, queue, { countries }).some((error) => error.includes('imageUrls')));
});

test('normalization recognizes punctuation and accents without inventing transliteration aliases', () => {
  assert.equal(normalizeDestinationName('  EL—CHALTÉN '), 'el chalten');
  assert.equal(normalizeDestinationName('ТЁРРА'), 'терра');
  assert.notEqual(normalizeDestinationName('Тигре'), normalizeDestinationName('Tigre'));
});

test('adding a secondary future place activates the reverse match without moving the excursion URL', () => {
  const excursion = { slug: 'fixture-excursion', country: 'country_argentina', destination: 'destination_argentina_buenos_aires' };
  const linked = { ...excursion, relatedDestinations: ['destination_argentina_tigre'] };
  assert.equal(excursionPath(linked), excursionPath(excursion));
  assert.equal(excursionHasDestination(excursion, 'destination_argentina_tigre'), false);
  assert.equal(excursionHasDestination(linked, 'destination_argentina_tigre'), true);
  assert.equal(excursionHasDestination(linked, excursion.destination), true);
});
