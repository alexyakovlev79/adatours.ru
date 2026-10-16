import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectSeoGeoReleaseCandidate, partitionSeoGeoReleaseCandidates } from '../src/lib/seo-geo-release-gate.mjs';
const url = '/multi-country/brazil_paraguay_uruguay/interests/beach-holidays/';
const good = [
  '---', 'targetPath: ' + url, 'kind: multi_country_interest', 'status: approved',
  'lead: "Путешествие по нескольким странам"', 'buttonLabel: "Подробнее о турах"',
  '---', '## Пляжный отдых', '', 'Основной текст статьи.', '',
  '## Частые вопросы', '', '### Где отдыхать?', '', 'На океанском побережье.',
].join('\n');
const row = (source = good, suffix = '') => {
  const target = suffix ? url.replace('beach-holidays/', 'beach-holidays-' + suffix + '/') : url;
  return { url: target, path: 'data/seo-geo/articles' + target + 'index.md',
    content: source.replaceAll(url, target) };
};
test('fast source-only gate accepts canonical approved MD', () => {
  assert.equal(inspectSeoGeoReleaseCandidate(row()).ok, true);
});
test('fast gate catches the absent first H2 that broke the 48-article release', () => {
  const result = inspectSeoGeoReleaseCandidate(row(good.replace('## Пляжный отдых', 'Текст сразу')));
  assert.equal(result.ok, false);
  assert.match(result.reason, /start with H2/);
});
test('wrong path, draft, target, FAQ structure get held', () => {
  assert.match(inspectSeoGeoReleaseCandidate({ ...row(), path: 'data/seo-geo/articles/foo/index.md' }).reason, /differs/);
  assert.match(inspectSeoGeoReleaseCandidate(row(good.replace('status: approved', 'status: draft'))).reason, /approved/);
  assert.match(inspectSeoGeoReleaseCandidate(row(good.replace('targetPath:', 'wrongPath:'))).reason, /targetPath/);
  assert.match(inspectSeoGeoReleaseCandidate(row(good.replace('### Где отдыхать?', '#### Где отдыхать?'))).reason, /H3/);
});
test('two faulty articles are isolated; other 46 remain in a batch of 48', () => {
  const rows = Array.from({ length: 48 }, (_, i) =>
    row(i === 3 || i === 41 ? good.replace('## Пляжный отдых', 'Текст сразу') : good, String(i + 1)));
  const { accepted, held } = partitionSeoGeoReleaseCandidates(rows);
  assert.equal(accepted.length, 46);
  assert.equal(held.length, 2);
});
test('a repeated URL never removes the first valid article', () => {
  const { accepted, held } = partitionSeoGeoReleaseCandidates([row(), row()]);
  assert.equal(accepted.length, 1);
  assert.match(held[0].reason, /Duplicate URL/);
});
test('a batch of 1000 already loaded short articles validates within one second', () => {
  const rows = Array.from({ length: 1000 }, (_, i) => row(good, String(i + 1)));
  const start = performance.now();
  assert.equal(partitionSeoGeoReleaseCandidates(rows).accepted.length, 1000);
  assert.ok(performance.now() - start < 1000);
});
