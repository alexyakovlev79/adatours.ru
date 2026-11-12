import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('linked place recommendations hand off to unlinked editorial photo stories', () => {
  const layout = readFileSync(new URL('../src/layouts/DestinationLayout.astro', import.meta.url), 'utf8');
  const story = readFileSync(new URL('../src/components/editorial/StoryPair.astro', import.meta.url), 'utf8');
  assert.ok(layout.includes('const hasCommercialBands = relatedTours.length > 0 || optionalTours.length > 0 || relatedExcursions.length > 0'));
  assert.ok(layout.includes('const hasStoryTransition = hasCommercialBands && d.featureBands.length > 0'));
  assert.ok(layout.includes('{hasStoryTransition && ('));
  assert.ok(layout.includes('href="#destination-stories"'));
  assert.ok(layout.includes("id={index === 0 ? 'destination-stories' : undefined}"));
  assert.ok(story.includes('id={id}'));
  assert.ok(layout.includes("const storyTransitionLabel = isEnglish ? 'Explore the place' : 'Ближе к месту'"));
  assert.ok(!story.includes('href={'));
});
