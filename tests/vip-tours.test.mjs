import test from 'node:test';
import assert from 'node:assert/strict';
import { hasVipInTitle, selectVipTours, vipTourPriceLabel } from '../src/lib/vip-tours.mjs';

const tour = (id, title, priceFrom, durationDays = 10) => ({
  data: { id, title, priceFrom, currency: 'USD', durationDays, countries: ['country_brazil'] },
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
