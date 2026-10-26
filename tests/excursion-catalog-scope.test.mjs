import test from 'node:test';
import assert from 'node:assert/strict';
import { excursionPlaceCatalogScope } from '../src/lib/excursion-catalog-scope.mjs';

const entry = data => ({ data: { locale: 'ru', status: 'approved', ...data } });
const reserve = { id: 'destination_reserved_lima', slug: 'reserved-lima', name: 'Новый объект', countryId: 'country_peru' };
const fixture = () => ({ countries: [entry({ id: 'country_peru', slug: 'peru' })], destinations: [],
  destinationCatalog: [reserve], excursions: [
    entry({ id: 'excursion_lima', destination: 'destination_peru_lima', relatedDestinations: [reserve.id] }),
    entry({ id: 'excursion_unrelated', destination: 'destination_peru_cusco', relatedDestinations: [] }),
    entry({ id: 'excursion_draft', destination: reserve.id, status: 'draft' }),
  ] });

test('reserved place catalogue gets its exact excursions without creating a Destination page', () => {
  const input = fixture(), before = JSON.stringify(input);
  const scope = excursionPlaceCatalogScope('/peru/reserved-lima/', input);
  assert.equal(scope.destinationId, reserve.id);
  assert.deepEqual(scope.places, []);
  assert.deepEqual(scope.excursions.map(entry => entry.data.id), ['excursion_lima']);
  assert.equal(scope.excursions.length, 1, 'dynamic counter is one, never the entire site catalogue');
  assert.equal(JSON.stringify(input), before);
});

test('published place keeps its real entity, and unrelated paths/countries do not invent scopes', () => {
  const input = fixture(), live = entry(reserve); input.destinations.push(live);
  assert.deepEqual(excursionPlaceCatalogScope('/peru/reserved-lima/', input).places, [live]);
  assert.equal(excursionPlaceCatalogScope('/peru/reserved-lima/product/', input), null);
  input.countries = [];
  assert.equal(excursionPlaceCatalogScope('/peru/reserved-lima/', input), null);
});
