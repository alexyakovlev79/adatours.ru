import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileInterestRegistries } from '../src/lib/interest-registry-projection.mjs';
const nature = { id: 'theme_nature', slug: 'nature', name: 'Природа', locale: 'ru' };
const wildlife = { id: 'theme_wildlife', slug: 'wildlife', name: 'Животные и сафари', locale: 'ru' };
const country = { id: 'country_brazil', slug: 'brazil', name: 'Бразилия', locale: 'ru' };
const tour = { id: 'tour_test', title: 'VIP Игуасу', locale: 'ru', countries: [country.id], primaryThemes: [nature.id], themes: [], durationDays: 5 };
const content = { tours: [tour], countries: [country], themes: [nature, wildlife], destinations: [], excursions: [] };
const phases = () => Array.from({ length: 7 }, (_, i) => ({ phase: i + 1, entries: [] }));
test('new nature URLs start queued; old wildlife history and unrelated claims survive disappearance and return', () => {
  const input = phases();
  const history = { kind: 'country_interest_tours', url: '/interests/wildlife/tours/brazil/', themeId: wildlife.id,
    id: 'immutable-old-id', work: 'rewritten', publishedAt: '2026-10-14', publishedCommit: 'old',
    articlePath: 'keep.md', note: 'manager note', claim: { ownerId: 'another-writer' }, tours: 1 };
  input[2].entries.push(history);
  const result = reconcileInterestRegistries(input, content);
  const old = result[2].entries.find(row => row.url === history.url);
  assert.equal(old.work, 'temporarily_unavailable');
  assert.equal(old.workBeforeUnavailable, 'rewritten');
  for (const key of ['id', 'publishedAt', 'publishedCommit', 'articlePath', 'note', 'claim']) assert.deepEqual(old[key], history[key]);
  const added = result[2].entries.find(row => row.themeId === nature.id);
  assert.equal(added.work, 'queued');
  assert.ok(!Object.hasOwn(added, 'publishedAt'));
  assert.deepEqual(input[2].entries, [history]);
  assert.deepEqual(reconcileInterestRegistries(result, content), result);
  const returned = reconcileInterestRegistries(result, { ...content, tours: [{ ...tour, themes: [wildlife.id] }] });
  const restored = returned[2].entries.find(row => row.url === history.url);
  assert.equal(restored.work, 'rewritten');
  assert.equal(restored.id, 'immutable-old-id');
  assert.equal(restored.publishedAt, '2026-10-14');
  assert.ok(!Object.hasOwn(restored, 'workBeforeUnavailable'));
});
