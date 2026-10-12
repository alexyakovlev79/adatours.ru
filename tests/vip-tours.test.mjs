import test from 'node:test';
import assert from 'node:assert/strict';
import { hasVipInTitle, selectVipTours, vipTourPriceLabel } from '../src/lib/vip-tours.mjs';
import { isActiveEntity } from '../src/lib/archive.mjs';
import { buildVipCountryIndex, vipCountryTitle } from '../src/lib/vip-countries.mjs';
import { SEO_CASES } from '../src/lib/seo-grammar.mjs';
import { buildVipFilterIndex, vipFilterOptions } from '../src/lib/vip-filters.mjs';
import { paginateCatalog } from '../src/lib/catalog-pagination.ts';

const filterCountries = [
  { id: 'country_brazil', slug: 'brazil', name: 'Бразилия', locale: 'ru' },
  { id: 'country_chile', slug: 'chile', name: 'Чили', locale: 'ru' },
  { id: 'country_peru', slug: 'peru', name: 'Перу', locale: 'ru' },
];
const filterThemes = [
  { id: 'theme_wildlife', slug: 'wildlife', name: 'Природа и животные', locale: 'ru' },
  { id: 'theme_culture', slug: 'culture-and-history', name: 'Культура и история', locale: 'ru' },
  { id: 'theme_spa', slug: 'spa', name: 'SPA и wellness', locale: 'ru' },
];
const filterTour = (id, countries, primaryThemes, themes = [], extras = {}) => ({ data: {
  id, title: `VIP ${id}`, durationDays: 13, locale: 'ru', countries, primaryThemes, themes, ...extras,
} });

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

