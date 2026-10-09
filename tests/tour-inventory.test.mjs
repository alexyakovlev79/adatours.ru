import test from 'node:test';
import assert from 'node:assert/strict';
import { computeInventory, identityFromMarkdown } from '../scripts/sync-tour-inventory.mjs';

const program = (id, entityIds = [], candidateEntityIds = []) => ({ id, name: id, files: [{ driveId: id }], entityIds, candidateEntityIds, work: { state: 'not_started' } });
const entry = (id) => ({ id, type: 'tour', name: id });
const ledger = (...programs) => ({ programs });

test('source-only and candidates do not close missing programs', () => {
  const result = computeInventory(ledger(program('known', ['source']), program('new', [], ['active'])), [entry('source'), entry('active')], [], new Map([['active', { status: 'published' }]]));
  assert.equal(result.summary.missing, 2);
  assert.equal(result.summary.knownUnpublished, 1);
  assert.equal(result.programs[1].state, 'new_program');
});

test('archive restoration and publication remove their programs from the queue', () => {
  const input = ledger(program('restore', ['tour']), program('create', ['new']));
  const catalog = [entry('tour'), entry('new')];
  const before = computeInventory(input, catalog, [{ id: 'tour', type: 'tour' }], new Map([['tour', { status: 'archived' }]]));
  assert.equal(before.summary.archiveOnly, 1);
  assert.equal(before.summary.missing, 1);
  const after = computeInventory(input, catalog, [], new Map([['tour', { status: 'published' }], ['new', { status: 'approved' }]]));
  assert.equal(after.summary.archiveOnly + after.summary.missing, 0);
  assert.equal(after.summary.activePages, 2);
  assert.equal(input.programs[0].work.state, 'not_started');
});

test('an archived duplicate with an active replacement is not a restoration task', () => {
  const result = computeInventory(ledger(program('drive', ['old'])), [entry('old'), entry('active')], [{ id: 'old', type: 'tour', duplicateOf: 'active' }], new Map([['active', { status: 'published' }]]));
  assert.equal(result.summary.archiveOnly, 0);
  assert.equal(result.summary.withArchive, 1);
  assert.equal(result.summary.activeWithArchive, 1);
  assert.equal(result.summary.archivePages, 0);
  assert.equal(result.summary.archiveRecords, 1);
});

test('a draft or a done marker without a page does not close missing work', () => {
  const done = program('done', ['absent']);
  done.work.state = 'done';
  const result = computeInventory(ledger(program('draft', ['draft']), done), [entry('draft'), entry('absent')], [], new Map([['draft', { status: 'draft' }]]));
  assert.equal(result.summary.activePages, 0);
  assert.equal(result.summary.missing, 2);
  assert.equal(result.warnings.length, 1);
});

test('duplicate files and IDs fail instead of inflating the inventory', () => {
  const a = program('a');
  const b = program('b');
  b.files = a.files;
  assert.throws(() => computeInventory(ledger(a, b), [], [], new Map()), /Drive file assigned twice/);
  assert.throws(() => computeInventory(ledger(a, a), [], [], new Map()), /Duplicate program/);
});

test('identity reader ignores status-like strings in the Markdown body', () => {
  assert.deepEqual(identityFromMarkdown('---\nid: "tour_a"\nstatus: approved # active\n---\nstatus: archived\n'), { id: 'tour_a', status: 'approved' });
  assert.throws(() => identityFromMarkdown('id: tour_a\nstatus: published'), /Missing frontmatter/);
});
