import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import yaml from 'js-yaml';
import {
  aliasesForEntity, assertUniqueRoutePaths, canonicalPath, countryBreadcrumbs, countryPath, createEntityAliasRegistry, destinationBreadcrumbs, destinationCountryPath,
  destinationPath, destinationRoute, excursionBreadcrumbs, excursionCountryPath,
  excursionDestinationPath, excursionGeography, excursionPath, expandBreadcrumbTrails,
  isLegacyRedirectPath, legacyDestinationPath, legacyEntityPath, mainTourCountries, normalizePageAliases, pageAliases,
  tourBreadcrumbs, tourCountryPath, tourPath,
} from '../src/lib/routes.ts';
import { mainTourDestinationIds, optionalTourDestinationIds } from '../src/lib/tour-relations.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
function published(collection) {
  return readdirSync(`${root}src/content/${collection}`).filter((file) => file.endsWith('.md')).map((file) => {
    const source = readFileSync(`${root}src/content/${collection}/${file}`, 'utf8');
    return yaml.load(source.split(/^---\s*$/m)[1]);
  }).filter((data) => data.locale === 'ru' && !['draft', 'archived'].includes(data.status));
}
const countries = published('countries');
const destinations = published('destinations');
const tours = published('tours');
const excursions = published('excursions');
const brazil = countries.find((entry) => entry.id === 'country_brazil');
const rio = destinations.find((entry) => entry.id === 'destination_brazil_rio');
const luxury = tours.find((entry) => entry.id === 'tour_luxury_brazil_11d');

test('canonical country-first URLs use English slugs and global English theme paths', () => {
  assert.equal(countryPath(brazil), '/brazil/');
  assert.equal(destinationPath(rio), '/brazil/place/rio-de-janeiro/');
  const adventure = tours.find((entry) => entry.id === 'tour_brazil_adventure_17d');
  assert.equal(tourPath(adventure), '/brazil/tour/grand-brazil-adventure-17-days/');
  assert.equal(tourPath(luxury), '/multi-country/tour/luxury-brazil/');
  assert.equal(canonicalPath({ type: 'theme', slug: 'gastronomy-and-wine' }), '/interests/gastronomy-and-wine/');
  assert.equal(destinationCountryPath(brazil), '/brazil/place/');
  assert.equal(tourCountryPath(brazil), '/brazil/tour/');
  assert.equal(excursionCountryPath(brazil), '/brazil/excursion/');
});

test('tour main route excludes optional geography and keeps parallel country breadcrumbs', () => {
  const trip = tours.find((entry) => entry.id === 'tour_argentina_brazil_pipa_11d');
  assert.deepEqual(trip.countries, ['country_argentina', 'country_brazil', 'country_uruguay']);
  assert.deepEqual(mainTourCountries(trip).map((entry) => entry.id), ['country_argentina', 'country_brazil']);
  assert.deepEqual(mainTourDestinationIds(trip), [
    'destination_argentina_buenos_aires',
    'destination_argentina_el_calafate',
    'destination_brazil_iguacu',
    'destination_brazil_natal',
    'destination_brazil_praia_de_pipa',
    'destination_argentina_puerto_iguasu',
  ]);
  assert.deepEqual(optionalTourDestinationIds(trip), [
    'destination_uruguay_montevideo',
    'destination_argentina_san_isidro_buenos_ajres',
    'destination_argentina_tigre',
  ]);
  assert.equal(tourPath(trip), '/multi-country/tour/argentina-brazil-buenos-aires-el-calafate-iguazu-pipa-11-days/');
  const crumbs = tourBreadcrumbs(trip);
  assert.deepEqual(crumbs[1], { links: [
    { label: 'Аргентина', href: '/argentina/tour/' },
    { label: 'Бразилия', href: '/brazil/tour/' },
  ] });
  const trails = expandBreadcrumbTrails(crumbs);
  assert.equal(trails.length, 2);
  assert.deepEqual(trails.map((trail) => trail.map((item) => item.label)), [
    ['Туры', 'Аргентина'], ['Туры', 'Бразилия'],
  ]);
  assert.throws(() => tourPath({ slug: 'invalid', countries: ['country_brazil'], routeCountries: ['country_argentina'] }), /subset/);
  assert.throws(() => tourPath({ slug: 'invalid', countries: ['country_brazil'], routeCountries: [] }), /no route countries/);
});

test('excursions use the destination geography even when departing from another country', () => {
  const excursion = { slug: 'montevideo-test', title: 'Монтевидео', country: 'country_argentina', destination: 'destination_uruguay_montevideo' };
  assert.equal(excursionGeography(excursion).country.id, 'country_uruguay');
  assert.equal(excursionPath(excursion), '/uruguay/montevideo/montevideo-test/');
  assert.equal(excursionDestinationPath(destinationRoute(excursion.destination)), '/uruguay/montevideo/');
  assert.deepEqual(excursionBreadcrumbs(excursion).map(({ label, href }) => [label, href]), [
    ['Экскурсии', '/excursions/'], ['Уругвай', '/uruguay/excursion/'],
    ['Монтевидео', '/uruguay/montevideo/'],
  ]);
  assert.equal(canonicalPath({ type: 'excursion', slug: excursion.slug, countryIds: ['country_argentina'], destinationIds: [excursion.destination] }), excursionPath(excursion));
});

test('reserved future destinations yield a route without a published page or fallback search', () => {
  const entries = JSON.parse(readFileSync(`${root}data/source-index/catalogs/excursions.json`, 'utf8')).entries;
  const publishedIds = new Set(destinations.map((entry) => entry.id));
  const future = entries.find((entry) => entry.destinationIds?.length && !publishedIds.has(entry.destinationIds[0]));
  assert.ok(future, 'fixture needs an excursion linked to a future destination');
  const destination = destinationRoute(future.destinationIds[0]);
  assert.equal(canonicalPath(future), `/${destination.countrySlug}/${destination.slug}/${future.slug}/`);
  assert.equal(canonicalPath({ type: 'excursion', slug: 'coffee-baron-estates', countryIds: ['country_brazil'], destinationIds: [] }), '/brazil/excursion/coffee-baron-estates/');
});

test('Iguasu destinations stay distinct and each source route has exactly one country', () => {
  const brazilSide = destinationRoute('destination_brazil_iguacu');
  const argentinaSide = destinationRoute('destination_argentina_puerto_iguasu');
  assert.equal(destinationPath(brazilSide), '/brazil/place/foz-do-iguacu/');
  assert.equal(destinationPath(argentinaSide), '/argentina/place/puerto-iguazu/');
  assert.notEqual(brazilSide.countryId, argentinaSide.countryId);
  assert.throws(() => canonicalPath({ type: 'destination', id: brazilSide.id, slug: brazilSide.slug, countryIds: ['country_brazil', 'country_argentina'] }), /exactly one country/);
  assert.throws(() => canonicalPath({ type: 'destination', id: brazilSide.id, slug: brazilSide.slug, countryIds: ['country_argentina'] }), /reserved catalog entry/);
});

test('every published old URL is an excluded alias while the new URLs and catalogues stay indexable', () => {
  const pairs = [
    ...countries.map((entry) => [legacyEntityPath('country', entry.slug), countryPath(entry)]),
    ...destinations.map((entry) => [legacyDestinationPath(entry), destinationPath(entry)]),
    ...tours.map((entry) => [legacyEntityPath('tour', entry.slug), tourPath(entry)]),
    ...excursions.map((entry) => [legacyEntityPath('excursion', entry.slug), excursionPath(entry)]),
  ];
  assert.equal(new Set(pairs.flat()).size, pairs.length * 2, 'detail and alias URLs must not collide');
  for (const [alias, canonical] of pairs) {
    assert.equal(isLegacyRedirectPath(alias), true, alias);
    assert.equal(isLegacyRedirectPath(`/adatours.ru${alias}`, '/adatours.ru'), true, alias);
    assert.equal(isLegacyRedirectPath(canonical), false, canonical);
    assert.equal(isLegacyRedirectPath(`/adatours.ru${canonical}`, '/adatours.ru'), false, canonical);
  }
  for (const path of ['/country/', '/places/', '/tours/', '/excursions/', '/multi-country/', '/multi-country/tour/', '/brazil/place/', '/brazil/tour/', '/brazil/excursion/', '/brazil/rio-de-janeiro/']) {
    assert.equal(isLegacyRedirectPath(path), false, path);
  }
});

test('country and destination breadcrumbs use existing catalog levels', () => {
  assert.deepEqual(countryBreadcrumbs(brazil).map((item) => item.href), ['/country/', '/brazil/']);
  assert.deepEqual(destinationBreadcrumbs(rio).map((item) => item.href), ['/places/', '/brazil/place/']);
});

test('all exact pre-migration spellings remain aliases for the same stable entities', () => {
  const fixtures = [
    ['country', brazil, countryPath(brazil), ['/braziliya/', '/strany/braziliya/']],
    ['destination', rio, destinationPath(rio), ['/braziliya/place/rio-de-zhanejro/', '/napravleniya/braziliya/rio-de-zhanejro/']],
    ['tour', luxury, tourPath(luxury), ['/tury/roskoshnaya-braziliya/', '/multi-country/tour/roskoshnaya-braziliya/']],
  ];
  for (const [type, entry, current, expected] of fixtures) {
    const actual = aliasesForEntity(type, entry, current);
    for (const oldPath of expected) {
      assert.ok(actual.includes(oldPath), `${entry.id} lost ${oldPath}`);
      assert.equal(isLegacyRedirectPath(oldPath), true, `sitemap must exclude ${oldPath}`);
    }
    assert.equal(isLegacyRedirectPath(current), false, `canonical must remain in sitemap: ${current}`);
  }
});

test('reserved destination history is registered even without a source snapshot', () => {
  const catalogue = JSON.parse(readFileSync(`${root}src/data/catalog/destinations.json`, 'utf8'));
  const sourceIds = new Set(JSON.parse(readFileSync(`${root}data/source-index/catalogs/destinations.json`, 'utf8')).entries.map(({ id }) => id));
  const reserved = catalogue.find((entry) => !sourceIds.has(entry.id) && entry.legacyUrls?.length);
  assert.ok(reserved, 'migration fixture needs a reserved destination with URL history');
  const current = destinationPath(reserved);
  const actual = aliasesForEntity('destination', reserved, current);
  for (const oldPath of reserved.legacyUrls.filter((path) => path !== current)) {
    assert.ok(actual.includes(oldPath), `reserved place lost ${oldPath}`);
    assert.equal(isLegacyRedirectPath(oldPath), true, oldPath);
  }
});

test('global catalogue and exact page aliases share redirect and sitemap rules', () => {
  const registered = new Map(pageAliases.map(({ from, to }) => [from, to]));
  for (const [from, to] of [
    ['/strany/', '/country/'], ['/napravleniya/', '/places/'],
    ['/tury/', '/tours/'], ['/ekskursii/', '/excursions/'], ['/po-interesam/', '/interests/'],
  ]) assert.equal(registered.get(from), to, from);
  for (const { from, to } of pageAliases) {
    assert.equal(isLegacyRedirectPath(from), true, from);
    assert.equal(isLegacyRedirectPath(`/adatours.ru${from}`, '/adatours.ru'), true, from);
    assert.equal(isLegacyRedirectPath(to), false, `redirect target must be final: ${to}`);
  }
});

test('route segments reject case, punctuation and path injection', () => {
  for (const slug of ['', 'Brazil', 'rio_de_janeiro', 'rio--de-janeiro', 'Бразилия', 'a/b', 'a?b', 'a#b', '..']) {
    assert.throws(() => countryPath({ slug }), /Invalid route segment/);
  }
  assert.equal(countryPath({ slug: 'el-salvador' }), '/el-salvador/');
});

test('duplicate aliases with one final target deduplicate, while conflicting targets fail', () => {
  assert.deepEqual(normalizePageAliases([
    { from: '/old', to: '/new/' }, { from: '/old/', to: '/new', title: 'duplicate' },
  ]), [{ from: '/old/', to: '/new/' }]);
  assert.throws(() => normalizePageAliases([{ from: '/old/', to: '/new/' }, { from: '/old/', to: '/other/' }]), /Alias target collision/);
  assert.throws(() => normalizePageAliases([{ from: '/same/', to: '/same/' }]), /itself/);
  assert.throws(() => normalizePageAliases([{ from: '/old/', to: '/middle/' }, { from: '/middle/', to: '/new/' }]), /final canonical/);
  for (const from of ['https://example.com/', '//example.com/', '/old/?a=1', '/old/#anchor', '/../old/']) {
    assert.throws(() => normalizePageAliases([{ from, to: '/new/' }]), /Invalid legacy route/);
  }
  const alias = { params: { path: 'old' }, props: { mode: 'redirect', to: '/new/' } };
  assert.deepEqual(assertUniqueRoutePaths([alias, { ...alias }]), [alias]);
  assert.throws(() => assertUniqueRoutePaths([alias, { params: { path: 'old' }, props: { mode: 'redirect', to: '/other/' } }]), /Route collision/);
  assert.throws(() => assertUniqueRoutePaths([alias, { params: { path: 'old' }, props: { mode: 'detail' } }]), /Route collision/);
  assert.throws(() => createEntityAliasRegistry([
    { type: 'tour', id: 'first', slug: 'first', countryIds: ['country_brazil'], legacyUrls: ['/shared-history/'] },
    { type: 'tour', id: 'second', slug: 'second', countryIds: ['country_brazil'], legacyUrls: ['/shared-history/'] },
  ]), /Alias target collision/);
});

test('stored country-first legacy URLs become redirects and stay excluded after geography changes', () => {
  const entry = {
    id: 'tour_alias_fixture', type: 'tour', slug: 'alias-fixture',
    countryIds: ['country_brazil', 'country_argentina'],
    legacyUrls: [
      '/braziliya/tour/alias-fixture/', '/braziliya/tour/alias-fixture/',
      '/tury/alias-fixture/', '/multi-country/tour/alias-fixture/',
    ],
  };
  const registry = createEntityAliasRegistry([entry]);
  const current = canonicalPath(entry);
  const aliases = registry.aliasesForEntity('tour', entry, current);
  assert.deepEqual(aliases, ['/tury/alias-fixture/', '/braziliya/tour/alias-fixture/']);
  for (const alias of aliases) {
    assert.equal(registry.isLegacyRedirectPath(alias), true);
    assert.equal(registry.isLegacyRedirectPath(`/adatours.ru${alias}`, '/adatours.ru'), true);
  }
  assert.equal(registry.isLegacyRedirectPath(current), false);
  assert.equal(registry.isLegacyRedirectPath(`/adatours.ru${current}`, '/adatours.ru'), false);
});

test('source-index CLI shares the exact routing contract used in pages', () => {
  const inputs = [
    { id: 'country_brazil', type: 'country', slug: 'brazil' },
    { id: 'tour_example', type: 'tour', slug: 'example', countryIds: ['country_argentina', 'country_brazil', 'country_uruguay'], routeCountryIds: ['country_argentina', 'country_brazil'] },
    { id: 'excursion_example', type: 'excursion', slug: 'example', countryIds: ['country_argentina'], destinationIds: ['destination_uruguay_montevideo'] },
  ];
  const result = spawnSync(process.execPath, ['scripts/resolve-canonical-paths.mjs'], { cwd: root, input: JSON.stringify(inputs), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), [
    { id: 'country_brazil', url: '/brazil/' },
    { id: 'tour_example', url: '/multi-country/tour/example/' },
    { id: 'excursion_example', url: '/uruguay/montevideo/example/' },
  ]);
});
