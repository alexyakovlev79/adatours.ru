import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMultiCountryCombinations,
  multiCountryCombinationKey,
  multiCountryCombinationPath,
  nextMultiCountryOptions,
  extendMultiCountrySelection,
  previousMultiCountrySelection,
} from '../src/lib/multi-country-combinations.mjs';

const codes = Object.fromEntries(['argentina', 'brazil', 'chile', 'peru', 'uruguay']
  .map((slug) => [slug, { slug, name: slug }]));
const getCountries = (tour) => (tour.routeCountries ?? tour.countries).map((slug) => codes[slug]);

test('static combinations are sorted, unique, nonempty and match only main countries', () => {
  const tours = [
    { id: 'abc', countries: ['peru', 'chile', 'argentina', 'brazil'], routeCountries: ['chile', 'brazil', 'argentina'] },
    { id: 'brazil-peru', countries: ['brazil', 'peru'] },
    { id: 'brazil-only', countries: ['brazil'] },
    { id: 'chile-brazil', countries: ['brazil', 'chile'] },
    { id: 'same-country', countries: ['argentina', 'argentina'] },
  ];
  const rows = buildMultiCountryCombinations(tours, getCountries);
  const byKey = new Map(rows.map((row) => [row.slugs.join('_'), row]));
  assert.deepEqual([...byKey.keys()], [...byKey.keys()].sort((a, b) => a.localeCompare(b, 'en')));
  assert.deepEqual(byKey.get('argentina_brazil').tours.map((tour) => tour.id), ['abc']);
  assert.deepEqual(byKey.get('brazil_chile').tours.map((tour) => tour.id), ['abc', 'chile-brazil']);
  assert.deepEqual(byKey.get('brazil_peru').tours.map((tour) => tour.id), ['brazil-peru']);
  assert.deepEqual(byKey.get('argentina_brazil_chile').tours.map((tour) => tour.id), ['abc']);
  assert.ok(!byKey.has('argentina_peru'));
  assert.ok(!byKey.has('argentina_brazil_chile_peru'));
  assert.equal(multiCountryCombinationPath(['chile', 'argentina', 'brazil']), '/multi-country/argentina_brazil_chile/');
  assert.deepEqual(nextMultiCountryOptions(rows, ['argentina', 'brazil']), ['chile']);
  assert.deepEqual(nextMultiCountryOptions(rows, ['brazil']), ['argentina', 'chile', 'peru']);
});

test('fourth selector appears only where a fourth main country exists, even on larger routes', () => {
  const tours = [{ id: 'five', countries: ['uruguay', 'peru', 'brazil', 'chile', 'argentina'] }];
  const rows = buildMultiCountryCombinations(tours, getCountries);
  assert.equal(rows.filter((row) => row.slugs.length === 4).length, 5);
  assert.deepEqual(nextMultiCountryOptions(rows, ['argentina', 'brazil', 'chile']), ['peru', 'uruguay']);
  assert.deepEqual(nextMultiCountryOptions(rows, ['argentina', 'brazil', 'chile', 'peru']), []);
  assert.throws(() => multiCountryCombinationKey(['argentina']));
  assert.throws(() => multiCountryCombinationKey(['argentina', 'argentina']));
  assert.throws(() => multiCountryCombinationKey(['argentina', 'brazil', 'chile', 'peru', 'uruguay']));
});


test('mobile back returns one level through the visitor choice order', () => {
  const first = ['brazil'];
  const pair = extendMultiCountrySelection(first, ['argentina', 'brazil']);
  const triple = extendMultiCountrySelection(pair, ['argentina', 'brazil', 'chile']);
  const quadruple = extendMultiCountrySelection(triple, ['argentina', 'brazil', 'chile', 'peru']);
  assert.deepEqual(pair, ['brazil', 'argentina']);
  assert.deepEqual(triple, ['brazil', 'argentina', 'chile']);
  assert.deepEqual(quadruple, ['brazil', 'argentina', 'chile', 'peru']);
  assert.deepEqual(previousMultiCountrySelection(quadruple), triple);
  assert.deepEqual(previousMultiCountrySelection(triple), pair);
  assert.deepEqual(previousMultiCountrySelection(pair), first);
  assert.deepEqual(previousMultiCountrySelection(first), []);
  assert.throws(() => extendMultiCountrySelection(first, ['brazil', 'brazil']));
  assert.throws(() => extendMultiCountrySelection(pair, ['argentina', 'chile']));
});
