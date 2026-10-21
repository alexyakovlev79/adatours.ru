import test from 'node:test';
import assert from 'node:assert/strict';
import { hasVipInTitle, selectVipTours, vipTourPriceLabel } from '../src/lib/vip-tours.mjs';
import { isActiveEntity } from '../src/lib/archive.mjs';
import { buildVipCountryIndex, vipCountryTitle } from '../src/lib/vip-countries.mjs';
import { SEO_CASES } from '../src/lib/seo-grammar.mjs';
import { buildVipFilterIndex, vipFilterOptions } from '../src/lib/vip-filters.mjs';
import { paginateCatalog } from '../src/lib/catalog-pagination.ts';
import { buildTourFilterIndex, tourFilterOptions } from '../src/lib/tour-filters.mjs';
import { buildInterestHub, INTERESTS } from '../src/lib/interest-model.mjs';
import destinationCatalog from '../src/data/catalog/destinations.json' with { type: 'json' };
import { tourFilterTitle, vipFilterTitle, vipFilterDescription } from '../src/lib/vip-copy.mjs';

test('all fifteen interests have VIP copy and grammar; landscapes and animals stay separate', () => {
  for (const theme of INTERESTS) {
    assert.ok(vipFilterTitle(undefined, theme).length > 10);
    assert.ok(vipFilterDescription(undefined, theme, 2).length > 50);
    assert.equal(SEO_CASES.interests[theme.id].name, theme.name);
  }
  const nature = { id: 'theme_nature' }, wildlife = { id: 'theme_wildlife' };
  assert.match(vipFilterTitle(undefined, nature), /любителей природы/);
  assert.match(vipFilterTitle(undefined, wildlife), /наблюдением за животными/);
  assert.notEqual(vipFilterDescription(undefined, nature, 2), vipFilterDescription(undefined, wildlife, 2));
});

test('coffee interest supports ordinary, VIP and country intersections with its own visitor copy', () => {
  const theme = { id: 'theme_coffee', slug: 'coffee-tours', name: 'Кофейные туры', locale: 'ru' };
  const tours = [
    filterTour('coffee', ['country_brazil'], ['theme_coffee']),
    filterTour('coffee-day', ['country_brazil', 'country_peru'], ['theme_culture'], ['theme_coffee'], { routeCountries: ['country_brazil'] }),
    filterTour('other', ['country_chile'], ['theme_culture']),
    filterTour('archive', ['country_brazil'], ['theme_coffee'], [], { status: 'archived' }),
  ];
  const regular = buildTourFilterIndex(tours, filterCountries, [theme]);
  const vip = buildVipFilterIndex(tours, filterCountries, [theme]);
  for (const rows of [regular, vip]) {
    const all = rows.find((row) => row.themeId === theme.id && !row.countryId);
    assert.deepEqual(new Set(all.entries.map((entry) => entry.data.id)), new Set(['coffee', 'coffee-day']));
    const brazil = rows.find((row) => row.themeId === theme.id && row.countryId === 'country_brazil');
    assert.match(brazil.title ?? tourFilterTitle(filterCountries[0], theme), /Кофейные (?:VIP-)?туры в Бразилию/);
    assert.equal(brazil.count, 2);
    assert.ok(!rows.some((row) => row.themeId === theme.id && row.countryId === 'country_chile'));
  }
  assert.ok(regular.some((row) => row.themeId === theme.id && row.countryId === 'country_peru'));
  assert.ok(!vip.some((row) => row.themeId === theme.id && row.countryId === 'country_peru'));
});

const filterCountries = [
  { id: 'country_brazil', slug: 'brazil', name: 'Бразилия', locale: 'ru' },
  { id: 'country_chile', slug: 'chile', name: 'Чили', locale: 'ru' },
  { id: 'country_peru', slug: 'peru', name: 'Перу', locale: 'ru' },
];
const filterThemes = [
  { id: 'theme_wildlife', slug: 'wildlife', name: 'Животные и сафари', locale: 'ru' },
  { id: 'theme_culture', slug: 'culture-and-history', name: 'Культура и история', locale: 'ru' },
  { id: 'theme_spa', slug: 'spa', name: 'SPA и wellness', locale: 'ru' },
];
const filterTour = (id, countries, primaryThemes, themes = [], extras = {}) => ({ data: {
  id, title: `VIP ${id}`, durationDays: 13, locale: 'ru', countries, primaryThemes, themes, ...extras,
} });

test('regular, interest, VIP and VIP-interest country lists share the route-weighted order before pagination', () => {
  const brazil = destinationCatalog.filter((p) => p.countryId === 'country_brazil').slice(0, 7).map((p) => p.id);
  const chile = destinationCatalog.filter((p) => p.countryId === 'country_chile').slice(0, 7).map((p) => p.id);
  const concentrated = filterTour('concentrated', ['country_brazil', 'country_chile'], ['theme_wildlife'], [],
    { title: 'VIP Я', destinations: [...brazil, chile[0]] });
  const dilute = filterTour('dilute', ['country_brazil', 'country_chile'], ['theme_wildlife'], [],
    { title: 'VIP А', destinations: [brazil[0], ...chile] });
  const tours = [dilute, concentrated];
  const regular = buildTourFilterIndex(tours, filterCountries, filterThemes);
  const vip = buildVipFilterIndex(tours, filterCountries, filterThemes);
  for (const rows of [regular, vip]) {
    for (const themeId of [undefined, 'theme_wildlife']) {
      for (const [countryId, expected] of [['country_brazil', ['concentrated', 'dilute']], ['country_chile', ['dilute', 'concentrated']]]) {
        const row = rows.find((r) => r.countryId === countryId && r.themeId === themeId);
        assert.deepEqual(paginateCatalog(row.entries, row.href).flatMap((p) => p.entries).map((t) => t.data.id), expected);
      }
    }
  }
  assert.deepEqual(buildVipCountryIndex(tours, filterCountries).find((r) => r.entry.id === 'country_brazil').tours.map((t) => t.data.id), ['concentrated', 'dilute']);
  assert.deepEqual(regular.find((r) => !r.countryId && !r.themeId).entries.map((t) => t.data.id), ['dilute', 'concentrated']);
});

test('ordinary filter counts and entries match the existing thematic catalogues, including optional countries', () => {
  const tours = [
    filterTour('nature', ['country_brazil', 'country_peru'], ['theme_wildlife'], ['theme_culture'], { routeCountries: ['country_brazil'] }),
    filterTour('culture', ['country_chile'], ['theme_culture']),
    filterTour('draft', ['country_peru'], ['theme_spa'], [], { status: 'draft' }),
    filterTour('archived', ['country_peru'], ['theme_spa'], [], { status: 'archived' }),
    filterTour('foreign', ['country_peru'], ['theme_spa'], [], { locale: 'en' }),
  ];
  const regular = buildTourFilterIndex([...tours, tours[0]], filterCountries, filterThemes);
  for (const theme of filterThemes) {
    const hub = buildInterestHub(theme.id, { tours, countries: filterCountries, themes: filterThemes });
    for (const country of hub.allCountries) {
      const actual = regular.find((row) => row.themeId === theme.id && row.countryId === country.entry.id);
      assert.deepEqual(actual.entries, country.tours);
      assert.equal(actual.count, country.tourCount);
    }
  }
  assert.ok(regular.some((row) => row.href === '/interests/wildlife/tours/peru/'));
  assert.ok(!regular.some((row) => row.href === '/peru/tour/'));
  assert.equal(regular.find((row) => row.href === '/tours/').count, 2);
  assert.ok(regular.every((row) => row.count > 0 && row.themeId !== 'theme_spa'));
});

test('VIP checkbox switches both ways with the same country and interest, never to an empty or fallback route', () => {
  const tours = [
    filterTour('nature', ['country_brazil', 'country_peru'], ['theme_wildlife'], [], { routeCountries: ['country_brazil'] }),
    filterTour('culture', ['country_chile'], ['theme_culture']),
    filterTour('ordinary', ['country_peru'], ['theme_spa'], [], { title: 'Обычный тур' }),
  ];
  const regular = buildTourFilterIndex(tours, filterCountries, filterThemes);
  const vip = buildVipFilterIndex(tours, filterCountries, filterThemes);
  const selected = { countryId: 'country_brazil', themeId: 'theme_wildlife' };
  assert.equal(tourFilterOptions(regular, vip, selected).toggleHref, '/vip/brazil/interests/wildlife/');
  assert.equal(tourFilterOptions(regular, vip, { ...selected, vip: true }).toggleHref, '/interests/wildlife/tours/brazil/');
  assert.equal(tourFilterOptions(regular, vip, { countryId: 'country_brazil' }).toggleHref, '/vip/brazil/');
  assert.equal(tourFilterOptions(regular, vip, { themeId: 'theme_wildlife' }).toggleHref, '/vip/interests/wildlife/');
  assert.equal(tourFilterOptions(regular, vip).toggleHref, '/vip/');
  assert.equal(tourFilterOptions(regular, vip, { countryId: 'country_peru', themeId: 'theme_wildlife' }).toggleHref, undefined);
  assert.equal(tourFilterOptions(regular, vip, { countryId: 'country_peru', themeId: 'theme_spa' }).toggleHref, undefined);
  for (const row of vip) {
    const options = tourFilterOptions(regular, vip, { countryId: row.countryId, themeId: row.themeId, vip: true });
    assert.equal(options.toggleHref, regular.find((item) => item.countryId === row.countryId && item.themeId === row.themeId).href);
    assert.ok([...options.countries, ...options.themes].every((item) => item.href.startsWith('/vip/') && !item.href.includes('#') && !item.href.includes('?')));
  }
});

test('country overview menus keep country selection on country pages and interest selection in matching static catalogues', () => {
  const tours = [
    filterTour('brazil', ['country_brazil'], ['theme_wildlife'], ['theme_culture']),
    filterTour('chile', ['country_chile'], ['theme_wildlife']),
  ];
  const regular = buildTourFilterIndex(tours, filterCountries, filterThemes);
  const vip = buildVipFilterIndex(tours, filterCountries, filterThemes);
  const overview = tourFilterOptions(regular, vip, { countryId: 'country_brazil', countryOverview: true });
  assert.equal(overview.countries.find((row) => row.id === 'country_chile').href, '/chile/');
  assert.equal(overview.themes.find((row) => row.id === 'theme_wildlife').href, '/interests/wildlife/tours/brazil/');
  assert.equal(overview.toggleHref, '/vip/brazil/');
  const both = tourFilterOptions(regular, vip, { countryId: 'country_brazil', themeId: 'theme_wildlife' });
  assert.equal(both.countries.find((row) => row.id === 'country_chile').href, '/interests/wildlife/tours/chile/');
  assert.equal(both.allCountriesHref, '/interests/wildlife/tours/');
  assert.equal(both.allThemesHref, '/brazil/tour/');
});

test('VIP facets intersect main geography with primary and secondary interests without reselecting VIP', () => {
  const brazil = filterTour('brazil', ['country_brazil', 'country_peru'], ['theme_wildlife'], ['theme_culture'], { routeCountries: ['country_brazil'] });
  const chile = filterTour('chile', ['country_chile'], ['theme_culture'], ['theme_wildlife']);
  const regular = filterTour('regular', ['country_peru'], ['theme_spa'], [], { title: 'Обычный тур', priceFrom: undefined });
  const archived = filterTour('archived', ['country_peru'], ['theme_spa'], [], { status: 'archived', priceFrom: 999999 });
  const rows = buildVipFilterIndex([brazil, chile, regular, archived], filterCountries, filterThemes);
  assert.deepEqual(new Set(rows.find((row) => row.href === '/vip/').entries), new Set([brazil, chile]));
  assert.equal(rows.find((row) => row.href === '/vip/interests/wildlife/').count, 2);
  assert.deepEqual(rows.find((row) => row.href === '/vip/brazil/interests/culture-and-history/').entries, [brazil]);
  assert.ok(rows.every((row) => row.count > 0 && !row.countryId?.includes('peru') && row.themeId !== 'theme_spa'));
  assert.equal(new Set(rows.map((row) => row.href)).size, rows.length);
  const existing = buildVipCountryIndex([brazil, chile, regular, archived], filterCountries);
  for (const row of existing) assert.deepEqual(rows.find((item) => item.href === row.href).entries, row.tours);
});

test('VIP menus preserve the other facet when selecting, switching, or clearing a filter', () => {
  const rows = buildVipFilterIndex([
    filterTour('brazil', ['country_brazil'], ['theme_wildlife'], ['theme_culture']),
    filterTour('chile', ['country_chile'], ['theme_wildlife']),
  ], filterCountries, filterThemes);
  const home = vipFilterOptions(rows);
  assert.equal(home.countries.find((row) => row.id === 'country_brazil').href, '/vip/brazil/');
  assert.equal(home.themes.find((row) => row.id === 'theme_wildlife').href, '/vip/interests/wildlife/');
  const countryFirst = vipFilterOptions(rows, 'country_brazil');
  const themeFirst = vipFilterOptions(rows, undefined, 'theme_wildlife');
  assert.equal(countryFirst.themes.find((row) => row.id === 'theme_wildlife').href, '/vip/brazil/interests/wildlife/');
  assert.equal(themeFirst.countries.find((row) => row.id === 'country_brazil').href, '/vip/brazil/interests/wildlife/');
  const both = vipFilterOptions(rows, 'country_brazil', 'theme_wildlife');
  assert.equal(both.allCountriesHref, '/vip/interests/wildlife/');
  assert.equal(both.allThemesHref, '/vip/brazil/');
  assert.equal(both.countries.find((row) => row.id === 'country_chile').href, '/vip/chile/interests/wildlife/');
  assert.equal(both.themes.find((row) => row.id === 'theme_culture').href, '/vip/brazil/interests/culture-and-history/');
  assert.equal(vipFilterOptions(rows, 'country_brazil', 'theme_culture').countries.length, 1);
});

test('VIP facet pagination retains the full static filter path and includes every matching tour', () => {
  const tours = Array.from({ length: 65 }, (_, index) => filterTour(`tour-${index}`, ['country_brazil'], ['theme_wildlife']));
  const rows = buildVipFilterIndex(tours, filterCountries, filterThemes);
  const combined = rows.find((row) => row.href === '/vip/brazil/interests/wildlife/');
  const pages = paginateCatalog(combined.entries, combined.href);
  assert.deepEqual(pages.map((page) => page.pagination.canonical), [
    '/vip/brazil/interests/wildlife/', '/vip/brazil/interests/wildlife/page/2/', '/vip/brazil/interests/wildlife/page/3/',
  ]);
  assert.equal(new Set(pages.flatMap((page) => page.entries.map((entry) => entry.data.id))).size, 65);
});

test('VIP facets exclude unpublished and foreign-language countries, themes, and tours', () => {
  const entry = filterTour('visible', ['country_brazil'], ['theme_wildlife']);
  for (const changes of [{ status: 'draft' }, { status: 'archived' }, { locale: 'en' }]) {
    assert.equal(buildVipFilterIndex([{ data: { ...entry.data, ...changes } }], filterCountries, filterThemes).length, 0);
    const hiddenCountry = filterCountries.map((country) => ({ ...country, ...changes }));
    assert.ok(buildVipFilterIndex([entry], hiddenCountry, filterThemes).every((row) => !row.countryId));
    const hiddenTheme = filterThemes.map((theme) => ({ ...theme, ...changes }));
    assert.ok(buildVipFilterIndex([entry], filterCountries, hiddenTheme).every((row) => !row.themeId));
  }
});

const tour = (id, title, priceFrom, durationDays = 10) => ({
  data: { id, title, priceFrom, currency: 'USD', durationDays, countries: ['country_brazil'] },
});

test('VIP country intersections use the global selection and main countries without duplicates', () => {
  const countries = ['brazil', 'argentina', 'peru'].map((slug) => ({ data: {
    id: `country_${slug}`, slug, name: slug, locale: 'ru', status: 'published',
  } }));
  const vip = tour('global-vip', 'VIP маршрут', 10000);
  vip.data.countries = ['country_brazil', 'country_argentina', 'country_peru'];
  vip.data.routeCountries = ['country_brazil', 'country_argentina', 'country_brazil'];
  const regular = tour('regular-peru', 'Обычный тур', 1000);
  regular.data.countries = ['country_peru'];
  const index = buildVipCountryIndex([vip, regular], countries);
  assert.deepEqual(index.map((row) => row.entry.data.id).sort(), ['country_argentina', 'country_brazil']);
  for (const row of index) {
    assert.equal(row.count, 1);
    assert.equal(row.tours[0], vip);
    assert.equal(row.href, `/vip/${row.entry.data.slug}/`);
  }
});

test('VIP country links appear and disappear with the active selection and country lifecycle', () => {
  const brazil = { data: { id: 'country_brazil', slug: 'brazil', name: 'Бразилия', locale: 'ru' } };
  const vip = tour('lifecycle-vip', 'VIP маршрут', undefined);
  assert.equal(buildVipCountryIndex([vip], [brazil]).length, 1);
  vip.data.status = 'draft';
  assert.equal(buildVipCountryIndex([vip], [brazil]).length, 0);
  vip.data.status = 'archived';
  assert.equal(buildVipCountryIndex([vip], [brazil]).length, 0);
  vip.data.status = 'published';
  vip.data.locale = 'en';
  assert.equal(buildVipCountryIndex([vip], [brazil]).length, 0);
  vip.data.locale = 'ru';
  brazil.data.status = 'draft';
  assert.equal(buildVipCountryIndex([vip], [brazil]).length, 0);
});

test('VIP country labels cover all current countries and use Russian direction forms', () => {
  for (const [id, country] of Object.entries(SEO_CASES.countries)) {
    assert.match(vipCountryTitle({ id, name: country.name }), /^VIP-туры (в |во |на )/);
  }
  assert.equal(vipCountryTitle({ id: 'country_brazil' }), 'VIP-туры в Бразилию');
  assert.equal(vipCountryTitle({ id: 'country_argentina' }), 'VIP-туры в Аргентину');
  assert.equal(vipCountryTitle({ id: 'country_cuba' }), 'VIP-туры на Кубу');
  assert.equal(vipCountryTitle({ id: 'country_french_guiana' }), 'VIP-туры во Французскую Гвиану');
});

test('VIP country lists use commercial ranking and order countries by VIP tour count', () => {
  const brazil = { id: 'country_brazil', slug: 'brazil', name: 'Бразилия' };
  const argentina = { id: 'country_argentina', slug: 'argentina', name: 'Аргентина' };
  const shorter = tour('short', 'VIP короткий', 10000, 3);
  const standard = tour('standard', 'VIP стандартный', 9000, 13);
  standard.data.countries = ['country_brazil', 'country_argentina'];
  const rows = buildVipCountryIndex([shorter, standard], [argentina, brazil]);
  assert.deepEqual(rows.map((row) => row.entry.id), ['country_brazil', 'country_argentina']);
  assert.deepEqual(rows[0].tours.map((row) => row.data.id), ['standard', 'short']);
});

test('VIP in the title is mandatory and the target stays at 25 percent', () => {
  const tours = Array.from({ length: 20 }, (_, index) =>
    tour(`tour_${index}`, index === 0 ? 'VIP тур без цены' : `Тур ${index}`, index === 0 ? undefined : 1000 + index * 100));
  const selected = selectVipTours(tours);
  assert.equal(selected.targetCount, 5);
  assert.equal(selected.entries.length, 5);
  assert.ok(selected.entries.some((entry) => entry.data.id === 'tour_0'));
  assert.equal(selected.namedCount, 1);
  assert.equal(selected.actualShare, 0.25);
});

test('high total price and high price per day can qualify independently', () => {
  const tours = [
    tour('high-total', 'Длинный дорогой маршрут', 12000, 30),
    tour('high-day', 'Короткий дорогой маршрут', 5000, 2),
    tour('mid-1', 'Маршрут 1', 4200, 14), tour('mid-2', 'Маршрут 2', 3900, 14),
    tour('mid-3', 'Маршрут 3', 3600, 14), tour('mid-4', 'Маршрут 4', 3300, 14),
    tour('mid-5', 'Маршрут 5', 3000, 14), tour('mid-6', 'Маршрут 6', 2700, 14),
  ];
  const ids = new Set(selectVipTours(tours).entries.map((entry) => entry.data.id));
  assert.deepEqual(ids, new Set(['high-total', 'high-day']));
});

test('named VIP tours are never removed even when they exceed the nominal quota', () => {
  const tours = [
    tour('vip-1', 'VIP Бразилия', undefined), tour('vip-2', 'VIP Аргентина', undefined), tour('vip-3', 'VIP Перу', undefined),
    tour('regular-1', 'Обычный 1', 9000), tour('regular-2', 'Обычный 2', 8000), tour('regular-3', 'Обычный 3', 7000),
    tour('regular-4', 'Обычный 4', 6000), tour('regular-5', 'Обычный 5', 5000),
  ];
  const result = selectVipTours(tours);
  assert.equal(result.targetCount, 3);
  assert.deepEqual(new Set(result.entries.map((entry) => entry.data.id)), new Set(['vip-1', 'vip-2', 'vip-3']));
});

test('price label uses the stored currency without inventing a conversion', () => {
  assert.equal(hasVipInTitle(tour('a', 'VIP-тур', 1000)), true);
  assert.equal(hasVipInTitle(tour('b', 'Вип-тур', 1000)), false);
  assert.match(vipTourPriceLabel(tour('c', 'Тур', 3653)), /^от \$3[\s\u00a0]?653$/);
  const eur = tour('d', 'Тур', 2400); eur.data.currency = 'EUR';
  assert.match(vipTourPriceLabel(eur), /^от €2[\s\u00a0]?400$/);
});

test('VIP quota recalculates when the active tour catalog grows or shrinks', () => {
  const tours = Array.from({ length: 24 }, (_, index) => {
    const entry = tour(
      `dynamic-${index}`,
      index === 0 ? 'VIP путешествие' : `Обычный тур ${index}`,
      index === 0 ? undefined : 2000 + index * 100,
    );
    entry.data.status = index < 20 ? 'published' : 'draft';
    return entry;
  });
  const selectActive = () => selectVipTours(tours.filter(isActiveEntity));

  const initial = selectActive();
  assert.equal(initial.targetCount, 5);
  assert.equal(initial.entries.length, 5);
  assert.equal(initial.actualShare, 0.25);
  assert.ok(initial.entries.some((entry) => entry.data.id === 'dynamic-0'));

  for (const entry of tours.slice(20)) entry.data.status = 'approved';
  const grown = selectActive();
  assert.equal(grown.targetCount, 6);
  assert.equal(grown.entries.length, 6);
  assert.equal(grown.actualShare, 0.25);

  for (const entry of tours.slice(17)) entry.data.status = 'archived';
  const reduced = selectActive();
  assert.equal(reduced.targetCount, 4);
  assert.equal(reduced.entries.length, 4);
  assert.equal(reduced.actualShare, 4 / 17);
  assert.ok(reduced.entries.some((entry) => entry.data.id === 'dynamic-0'));
});

