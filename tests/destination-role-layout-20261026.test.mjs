import test from 'node:test';
import assert from 'node:assert/strict';
import { destinationSectionOrder, compareDestinationsForNavigation, isNavigationHub, isNavigationSight } from '../src/lib/destination-taxonomy.mjs';

test('hub pages prioritize tours; sight pages prioritize excursions', () => {
  assert.deepEqual(destinationSectionOrder({navigationRole: 'hub'}), ['tours','excursions']);
  assert.deepEqual(destinationSectionOrder({navigationRole: 'sight'}), ['excursions','tours']);
  assert.deepEqual(destinationSectionOrder({data:{navigationRole:'sight'}}), ['excursions','tours']);
  assert.equal(isNavigationHub({navigationRole:'hub'}), true);
  assert.equal(isNavigationSight({navigationRole:'sight'}), true);
});

test('hub precedes sight independently of geographic type or popularity', () => {
  const hub={data:{navigationRole:'hub',destinationType:'natural_area'}};
  const sight={data:{navigationRole:'sight',destinationType:'city'}};
  assert.ok(compareDestinationsForNavigation(hub,sight,()=>-100)<0);
  assert.ok(compareDestinationsForNavigation(sight,hub,()=>100)>0);
  assert.equal(compareDestinationsForNavigation(hub, {...hub},()=>-3), -3);
});
