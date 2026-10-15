import test from 'node:test';
import assert from 'node:assert/strict';
import { isUnprovedPrepared, collectRecoveryCandidates, applySeoRecovery } from '../scripts/lib/seo-geo-recovery.mjs';

const at = '2026-10-15T10:00:00.000Z';
const path = 'data/seo-geo/articles/colombia/place/chicaque-park/tour/index.md';
const makeRow = () => ({ url: '/colombia/place/chicaque-park/tour/', articlePath: path,
  work: 'prepared', preparedAt: '2026-10-15T09:05:00.000Z' });

test('only new prepared rows with missing proof qualify for automatic sweep', () => {
  assert.equal(isUnprovedPrepared(makeRow()), true);
  assert.equal(isUnprovedPrepared({ ...makeRow(), preparedAt: '2026-10-14T09:00:00.000Z' }), false);
  assert.equal(isUnprovedPrepared({ ...makeRow(), work: 'published' }), false);
  assert.equal(isUnprovedPrepared({ ...makeRow(), preflightCommit: 'a'.repeat(40),
    preflightArticleBlobSha: 'b'.repeat(40) }), false);
});

test('recovers invalid prepared without modifying an existing article or other claims', () => {
  const row = makeRow();
  const phase = { entries: [row, { url: '/other/', work: 'published' }] };
  const unrelated = { ownerId: 'other', expiresAt: '2026-10-15T11:00:00.000Z' };
  const claims = { claims: { '/other/': unrelated } };
  const candidates = collectRecoveryCandidates(phase, { mode: 'scan' });
  const result = applySeoRecovery(phase, claims, candidates, { now: at });
  assert.deepEqual(result.recovered, [row.url]);
  assert.equal(row.work, 'draft');
  assert.equal(row.recoveryEligibleAt, at);
  assert.match(row.preflightFailure.reason, /prepared/);
  assert.deepEqual(claims.claims['/other/'], unrelated);
  assert.equal(phase.entries[1].work, 'published');
});

test('failed transition restores only the original unexpired owner lease', () => {
  const row = makeRow(), phase = { entries: [row] };
  const old = { ownerId: 'author', batchId: 'batch', generation: 2,
    claimedAt: '2026-10-15T09:00:00.000Z', lastHeartbeatAt: '2026-10-15T09:00:00.000Z',
    expiresAt: '2026-10-15T11:00:00.000Z' };
  const claims = { claims: {} };
  const candidates = collectRecoveryCandidates(phase, {
    mode: 'run', observed: { entries: [{ ...row, work: 'draft' }] },
  });
  const result = applySeoRecovery(phase, claims, candidates, {
    now: at, previousClaims: { [row.url]: old },
  });
  assert.equal(result.restoredLeases, 1);
  assert.deepEqual(claims.claims[row.url], old);
  assert.equal(row.recoveryEligibleAt, undefined);
});

test('failed gate does not reset a concurrently repaired row', () => {
  const row = { ...makeRow(), preflightCommit: 'a'.repeat(40) };
  const phase = { entries: [row] }, claims = { claims: {} };
  const result = applySeoRecovery(phase, claims,
    [{ url: row.url, preparedAt: '2026-10-15T09:02:00.000Z', articlePath: path }],
    { now: at });
  assert.deepEqual(result.recovered, []);
  assert.equal(row.work, 'prepared');
  assert.equal(Object.keys(claims.claims).length, 0);
});

test('draft-only failures preserve an active lease and annotate the reason', () => {
  const row = { ...makeRow(), work: 'draft' };
  const lease = { ownerId: 'writer', expiresAt: '2026-10-15T11:00:00.000Z' };
  const phase = { entries: [row] }, claims = { claims: { [row.url]: lease } };
  const result = applySeoRecovery(phase, claims, [{ url: row.url, articlePath: path, draftFailure: true }],
    { now: at, errors: new Map([[path, 'Неверная ссылка']] });
  assert.deepEqual(result.annotatedDrafts, [row.url]);
  assert.equal(row.preflightFailure.reason, 'Неверная ссылка');
  assert.deepEqual(claims.claims[row.url], lease);
});

test('run candidates are restricted to fresh transitions or changed articles', () => {
  const row = makeRow();
  const phase = { entries: [row] };
  const observed = { entries: [{ ...row, work: 'prepared' }] };
  assert.deepEqual(collectRecoveryCandidates(phase, { mode: 'run', observed }), []);
  assert.equal(collectRecoveryCandidates(phase, {
    mode: 'run', observed, changedArticles: new Set([path]),
  }).length, 1);
});
