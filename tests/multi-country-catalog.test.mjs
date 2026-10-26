import { CATALOG_PAGE_SIZE } from '../src/lib/catalog-pagination.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMultiCountryCatalog, multiCountryCatalogPath, multiCountryPickerOptions } from '../src/lib/multi-country-catalog.mjs';
import { multiCountrySnapshot, reconcileMultiCountryRegistries } from '../src/lib/multi-country-registry.mjs';
import { buildSeoGeoCanonicalPaths } from '../src/lib/seo-geo-route-inventory.mjs';
import { multiCountrySeoMetadata } from '../src/lib/multi-country-seo.mjs';

const entry = (data) => ({ data: { locale: 'ru', status: 'approved', ...data } });
const countries = [['argentina', 'Аргентина'], ['brazil', 'Бразилия'], ['chile', 'Чили'], ['peru', 'Перу'], ['uruguay', 'Уругвай']]
  .map(([slug, name]) => entry({ id: 'country_' + slug, slug, name }));
const themes = [entry({ id: 'theme_wildlife', slug: 'wildlife', name: 'Природа и животные' }),
  entry({ id: 'theme_culture', slug: 'culture-and-history', name: 'Культура и история' }),
  entry({ id: 'theme_fishing', slug: 'fishing', name: 'Рыболовные туры' })];
const tour = (id, countrySlugs, extra = {}) => entry({ id, slug: id, title: id, durationDays: 13,
  countries: countrySlugs.map((slug) => 'country_' + slug), primaryThemes: ['theme_culture'], themes: [], destinations: [], ...extra });
const tours = [
  tour('secondary', ['argentina', 'brazil', 'chile'], { themes: ['theme_wildlife'], priceFrom: 500, currency: 'USD' }),
  tour('primary', ['brazil', 'argentina'], { primaryThemes: ['theme_wildlife'], durationDays: 20, priceFrom: 1500, currency: 'USD' }),
  tour('culture-only', ['argentina', 'brazil'], { priceFrom: 10, currency: 'USD' }),
  tour('optional', ['argentina', 'peru'], { routeCountries: ['country_argentina'], primaryThemes: ['theme_wildlife'] }),
];
const selectedPath = '/multi-country/argentina_brazil/interests/wildlife/';
const find = (rows, path = selectedPath) => rows.find((row) => row.path === path);

test('main-country intersection includes primary AND secondary interests, ranked by relevance before sales score', () => {
  const rows = buildMultiCountryCatalog(tours, countries, themes);
  assert.deepEqual(find(rows).tours.map((row) => row.data.id), ['primary', 'secondary']);
  assert.equal(find(rows).count, 2);
  assert.ok(!rows.some((row) => row.slugs.includes('peru')));
  assert.ok(!rows.some((row) => row.themeId === 'theme_fishing'));
  assert.ok(rows.some((row) => row.path === '/multi-country/interests/wildlife/'));
  assert.equal(find(rows, '/multi-country/argentina_brazil/').count, 3);
});

test('all 2–4 subsets of a five-country route are generated once; permutations have one canonical', () => {
  const all = buildMultiCountryCatalog([tour('five', ['uruguay', 'chile', 'brazil', 'peru', 'argentina'])], countries, themes);
  const combos = all.filter((row) => row.themeId && row.slugs.length);
  assert.equal(combos.length, 25); // C(5,2)+C(5,3)+C(5,4)
  assert.equal(new Set(combos.map((row) => row.path)).size, 25);
  assert.ok(combos.every((row) => row.slugs.length <= 4));
  assert.equal(multiCountryCatalogPath(['brazil', 'argentina'], 'wildlife'), selectedPath);
  assert.throws(() => multiCountryCatalogPath(['brazil'], 'wildlife'));
  assert.throws(() => multiCountryCatalogPath(['brazil', 'argentina'], '../wildlife'));
});

test('drafts, archives, another locale, duplicate tour IDs and unknown route countries cannot leak into any catalogue', () => {
  const bad = [tour('draft', ['argentina', 'brazil'], { status: 'draft' }),
    tour('archive', ['argentina', 'brazil'], { status: 'archived' }),
    tour('english', ['argentina', 'brazil'], { locale: 'en' }),
    tour('unknown', ['argentina', 'brazil', 'unknown'])];
  const rows = buildMultiCountryCatalog([...tours, tours[0], ...bad], countries, themes);
  assert.equal(find(rows).count, 2);
  const hiddenTheme = structuredClone(themes); hiddenTheme[0].data.status = 'draft';
  assert.ok(!find(buildMultiCountryCatalog(tours, countries, hiddenTheme)));
  const hiddenCountry = structuredClone(countries); hiddenCountry[1].data.status = 'draft';
  assert.ok(!find(buildMultiCountryCatalog(tours, hiddenCountry, themes)));
  assert.deepEqual(buildMultiCountryCatalog([], countries, themes), []);
});

test('all selector interests and country combinations resolve to existing matching static pages', () => {
  const rows = buildMultiCountryCatalog(tours, countries, themes);
  const options = multiCountryPickerOptions(rows, ['argentina', 'brazil'], 'theme_wildlife');
  assert.equal(options.allInterestsHref, '/multi-country/argentina_brazil/');
  assert.ok(options.interests.some((option) => option.id === 'theme_culture'));
  assert.ok(!options.interests.some((option) => option.id === 'theme_fishing'));
  for (const option of options.interests) assert.equal(find(rows, option.href).count, option.count);
  assert.ok(options.combinations.every((row) => row.themeId === 'theme_wildlife'));
  assert.equal(options.countries.some((country) => country.slug === 'peru'), false);
});

test('archiving, restoring, changing countries or interest tags recalculates URLs, counts, rank and exports', () => {
  const input = structuredClone(tours);
  const initial = buildMultiCountryCatalog(input, countries, themes);
  input[0].data.status = 'archived';
  assert.equal(find(buildMultiCountryCatalog(input, countries, themes)).count, 1);
  input[1].data.primaryThemes = ['theme_culture'];
  assert.equal(find(buildMultiCountryCatalog(input, countries, themes)), undefined);
  input[0].data.status = 'approved'; input[0].data.routeCountries = ['country_brazil', 'country_peru'];
  input[0].data.countries.push('country_peru');
  const changed = buildMultiCountryCatalog(input, countries, themes);
  assert.equal(find(changed), undefined);
  assert.equal(find(changed, '/multi-country/brazil_peru/interests/wildlife/').count, 1);
  const a = multiCountrySnapshot(initial), b = multiCountrySnapshot(changed);
  assert.notEqual(a.fingerprint, b.fingerprint);
  assert.ok(b.catalogs.every((row) => row.tourIds.length === row.count && row.totalPages === Math.ceil(row.count / CATALOG_PAGE_SIZE)));
});

test('title and description combine only selected country names, interest, actual count, years and filtered minimum price', () => {
  const row = find(buildMultiCountryCatalog(tours, countries, themes));
  const meta = multiCountrySeoMetadata({ ...row, date: new Date('2026-10-16T00:00:00Z') });
  assert.match(meta.title, /Аргентина и Бразилия, Природа и животные: Каталог 2026-2027: 2 тура/);
  assert.match(meta.title, /500/);
  assert.doesNotMatch(meta.title, /10\s*тур/);
  assert.equal(meta.minUsdPrice, 500);
  assert.match(meta.description, /Природа и животные/);
  const mixed = structuredClone(row); mixed.tours[0].data.currency = 'EUR';
  assert.equal(multiCountrySeoMetadata(mixed).minUsdPrice, null);
});

test('SEO route inventory and public catalogue graph have identical nonempty intersection paths', () => {
  const input = { tours, countries, themes, destinations: [], excursions: [] };
  const paths = buildSeoGeoCanonicalPaths(input);
  const rows = buildMultiCountryCatalog(tours, countries, themes);
  for (const row of rows) assert.ok(paths.has(row.path), row.path);
  assert.ok(!paths.has('/multi-country/argentina_peru/interests/wildlife/'));
});

const initialRegistry = () => ({ phases: [
  { phase: 1, entries: [{ url: '/country/', work: 'published', order: 1 }] },
  { phase: 5, entries: [
    { phase: 5, url: '/tours/', kind: 'tour_index', work: 'published', order: 2 },
    { phase: 5, url: '/multi-country/', kind: 'multi_country', work: 'published', order: 3 },
    { phase: 5, url: '/brazil/tour/', kind: 'country_tours', work: 'draft', owner: 'other-writer', order: 4 },
  ] }, { phase: 6, entries: [{ url: '/places/', work: 'published', order: 5 }] },
], index: { phases: [{ phase: 1 }, { phase: 5 }, { phase: 6 }], totalRows: 5, rules: { preserved: true } } });

test('queue has one row per root, places intersections after ordinary multi-country pages and preserves unrelated editorial fields', () => {
  const base = initialRegistry(); const snapshot = multiCountrySnapshot(buildMultiCountryCatalog(tours, countries, themes));
  const merged = reconcileMultiCountryRegistries(base.phases, base.index, snapshot);
  const entries = merged.phases[1].entries;
  const ordinary = entries.findLastIndex((row) => row.kind === 'multi_country_combination');
  const thematic = entries.findIndex((row) => row.kind === 'multi_country_interest_index');
  assert.ok(thematic > ordinary);
  assert.ok(entries.findLastIndex((row) => row.kind === 'multi_country_interest') < entries.findIndex((row) => row.url === '/brazil/tour/'));
  assert.equal(entries.find((row) => row.url === '/brazil/tour/').owner, 'other-writer');
  assert.equal(new Set(entries.map((row) => row.url)).size, entries.length);
  assert.ok(entries.every((row) => !row.url.includes('/page/')));
  assert.deepEqual(reconcileMultiCountryRegistries(merged.phases, merged.index, snapshot), merged, 'idempotent reconciliation');
  assert.equal(base.phases[1].entries.length, 3, 'input not mutated');
});

test('disappeared catalogues retain approved article history and restore exact editorial state; staging claims are not touched', () => {
  const base = initialRegistry(); const snapshot = multiCountrySnapshot(buildMultiCountryCatalog(tours, countries, themes));
  const saved = reconcileMultiCountryRegistries(base.phases, base.index, snapshot);
  const target = saved.phases[1].entries.find((row) => row.url === selectedPath);
  Object.assign(target, { work: 'prepared', note: 'Manager note', articlePath: 'approved.md', preparedAt: '2026-10-16', owner: 'writer' });
  const unavailable = reconcileMultiCountryRegistries(saved.phases, saved.index, multiCountrySnapshot([]));
  const history = unavailable.phases[1].entries.find((row) => row.url === selectedPath);
  assert.equal(history.work, 'temporarily_unavailable');
  assert.equal(history.workBeforeUnavailable, 'prepared');
  assert.equal(history.articlePath, 'approved.md');
  const restored = reconcileMultiCountryRegistries(unavailable.phases, unavailable.index, snapshot).phases[1].entries.find((row) => row.url === selectedPath);
  assert.equal(restored.work, 'prepared'); assert.equal(restored.note, 'Manager note'); assert.equal(restored.owner, 'writer');
});

test('same source content gives reproducible graph and registry fingerprints independent of file enumeration', () => {
  const date = new Date('2026-10-16T00:00:00Z');
  const one = multiCountrySnapshot(buildMultiCountryCatalog(tours, countries, themes), { date });
  const two = multiCountrySnapshot(buildMultiCountryCatalog([...tours].reverse(), [...countries].reverse(), [...themes].reverse()), { date });
  assert.deepEqual(two, one);
});

test('multi-country uses matching native country and interest selectors without changing ordinary filters', () => {
  const ordinary = readFileSync('src/components/catalog/TourFilters.astro', 'utf8');
  const multi = readFileSync('src/components/catalog/MultiCountrySelector.astro', 'utf8');
  const client = readFileSync('src/scripts/multi-country-selector.ts', 'utf8');
  assert.ok(ordinary.includes('<CatalogFilterMenu'), 'Ordinary catalogue menu stays unchanged');
  assert.ok(!multi.includes('<CatalogFilterMenu'), 'Multi-country interest should not use a separate details popup');
  assert.ok(multi.includes('data-mc-interest-select'), 'Interest is a native dropdown');
  assert.ok(multi.indexOf('data-mc-select=') < multi.indexOf('data-mc-interest-select'));
  assert.ok(multi.indexOf('data-mc-interest-select') < multi.indexOf('data-mc-reset'));
  assert.ok(multi.includes('<option value="" disabled selected={!themeId} data-mc-interest-placeholder>'));
  assert.ok(multi.includes('data-mc-interest-reset'), 'Can reset just interest');
  assert.ok(multi.includes('mc-picker__interest-fallback'), 'Preserve crawlable navigation without JavaScript');
  assert.ok(multi.includes('.mc-picker__field select,\n  .mc-picker__interest select'), 'Share exact same visual select CSS');
  assert.ok(client.includes('interestSelect?.addEventListener(\'change\''), 'Native dropdown navigates');
  assert.ok(client.includes('sessionStorage.setItem(firstCountryState, selected[0])'), 'Keep first country during interest changes');
  assert.ok(client.includes('interestSelect.replaceChildren(interestPlaceholder, interestReset, ...choices)'), 'Re-filter native options');
  assert.ok(!multi.includes('data-tour-vip-toggle'));
});

test('final price-enrichment pass retains the whole thematic intersection on every pagination URL', async () => {
  const { collectSeoPagePrices } = await import('../src/lib/seo-price-meta.mjs');
  const records = [...countries.map((r) => ({ ...r, kind: 'country', path: '/' + r.data.slug + '/' })),
    ...themes.map((r) => ({ ...r, kind: 'theme', path: '/interests/' + r.data.slug + '/' })),
    ...tours.map((r) => ({ ...r, kind: 'tour', path: '/multi-country/tour/' + r.data.slug + '/' }))];
  for (const path of [selectedPath, selectedPath + 'page/2/']) {
    const prices = collectSeoPagePrices({ records, root: 'https://adatours.ru/', path, groups: [] });
    assert.deepEqual(new Set(prices.map((price) => price.id)), new Set(['primary', 'secondary']));
    assert.equal(Math.min(...prices.map((price) => price.amount)), 500);
  }
});
