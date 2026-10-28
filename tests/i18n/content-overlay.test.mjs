import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSourceSnapshot, sourceFingerprints, sourceBlockEvidence,
  fingerprint, textFingerprint, assessOverlay, assembleLocalizedContent,
  reconcileOverlay, applyTranslationPatch, translationBlockHash,
  translationApprovalHash,
  TranslationNotReadyError, TranslationConflictError,
} from '../../src/lib/i18n/content-overlay.mjs';

// Synthetic fixtures test the contract, not actual Anna/Word approval.
const clone = (value) => structuredClone(value);
const approval = (block) => ({ reviewerId: 'fixture-reviewer', reviewedAt: '2026-10-28T12:00:00Z',
  checks: { meaning: true, voice: true, facts: true }, approvedContentHash: translationApprovalHash(block) });
const reapprove = (block) => { block.approval = approval(block); return block; };
const source = () => createSourceSnapshot({
  schemaVersion: 1, entityId: 'tour_fixture_peru', entityType: 'tour', locale: 'ru',
  shared: {
    facts: { id: 'tour_fixture_peru', priceFrom: 1000, currency: 'USD',
      countries: ['country_peru'], route: ['lima', 'cusco'],
      stops: { arrival: { destinationId: 'destination_lima' } } },
    media: { hero: { src: '/media/fixture-1.webp', subjectId: 'destination_lima' } },
  },
  blocks: [
    { blockId: 'tour:title', field: 'title', text: 'Перу', dependsOn: [] },
    { blockId: 'arrival:paragraph', field: 'itinerary.text', text: 'Мы встретим вас в Лиме.',
      dependsOn: ['/facts/stops/arrival/destinationId'] },
    { blockId: 'price:note', field: 'priceNote', text: 'От 1000 долларов.',
      dependsOn: ['/facts/priceFrom', '/facts/currency'] },
    { blockId: 'hero:alt', field: 'media.alt', text: 'Площадь Лимы.',
      dependsOn: ['/media/hero/subjectId'] },
  ],
});
const TARGETS = { 'tour:title': 'Peru', 'arrival:paragraph': 'We will meet you in Lima.',
  'price:note': 'From USD 1,000.', 'hero:alt': 'A square in Lima.' };
const wordSources = () => ({ 'fixture-word-2027': {
  revision: 'fixture-revision-1', documentHash: fingerprint({ fixture: 'program-2027' }),
  blocks: { 'paragraph:arrival': TARGETS['arrival:paragraph'] },
} });
const overlay = (input = source()) => ({
  schemaVersion: 1, entityId: input.entityId, entityType: input.entityType,
  locale: input.locale === 'ru' ? 'en' : 'ru', sourceLocale: input.locale,
  blocks: input.blocks.map((block) => reapprove({
    blockId: block.blockId, field: block.field, text: TARGETS[block.blockId], state: 'approved',
    ...sourceBlockEvidence(input, block.blockId),
    provenance: block.blockId === 'arrival:paragraph' ? {
      kind: 'word_exact', fileId: 'fixture-word-2027', revision: 'fixture-revision-1',
      documentHash: wordSources()['fixture-word-2027'].documentHash,
      locator: 'paragraph:arrival', textHash: textFingerprint(TARGETS[block.blockId]),
    } : { kind: 'editorial', editorId: 'fixture-editor', reason: 'Synthetic test text' },
  })),
});
const context = () => ({ wordSources: wordSources() });

test('assembles only target text while reusing authoritative shared facts and media', () => {
  const original = source();
  const translation = overlay(original);
  const result = assembleLocalizedContent(original, translation, context());
  assert.equal(result.locale, 'en');
  assert.deepEqual(result.shared, original.shared);
  assert.equal(result.blocks[1].text, TARGETS['arrival:paragraph']);
  assert.equal(JSON.stringify(result).includes('Мы встретим'), false);
  assert.equal(assessOverlay(original, translation, context()).approvedCount, 4);
  result.shared.facts.priceFrom = 1;
  assert.equal(original.shared.facts.priceFrom, 1000, 'No mutable reference to canonical data');
});

test('rejects attempts to change price, ID, route or media through the overlay', () => {
  const original = source();
  for (const key of ['priceFrom', 'id', 'route', 'hero', 'shared', 'media']) {
    const injected = { ...overlay(original), [key]: 'injected' };
    assert.equal(assessOverlay(original, injected, context()).status, 'invalid', key);
  }
  for (const field of ['priceFrom', 'id', 'route', 'media.src', 'hero.src']) {
    const injected = overlay(original);
    injected.blocks[0].field = field;
    assert.equal(assessOverlay(original, injected, context()).status, 'invalid', field);
  }
  const nested = overlay(original);
  nested.blocks[0].priceFrom = 0;
  assert.equal(assessOverlay(original, nested, context()).status, 'invalid');
});

test('stable block IDs survive reordering; the result follows current source order', () => {
  const original = source();
  const reordered = clone(original);
  reordered.blocks.reverse();
  assert.equal(sourceFingerprints(original).text, sourceFingerprints(reordered).text);
  const result = assembleLocalizedContent(reordered, overlay(original), context());
  assert.deepEqual(result.blocks.map((block) => block.blockId), reordered.blocks.map((block) => block.blockId));
  assert.equal(result.blocks.find((block) => block.blockId === 'arrival:paragraph').text, TARGETS['arrival:paragraph']);
});

test('forbids mutable array-index dependency pointers', () => {
  const original = source();
  original.blocks[1].dependsOn = ['/facts/route/0'];
  assert.throws(() => createSourceSnapshot(original), /unsafe shared dependency/);
});

test('image enhancement changes media fingerprint without invalidating paragraph or same-subject alt', () => {
  const previous = source();
  const current = clone(previous);
  current.shared.media.hero.src = '/media/fixture-enhanced.webp';
  const result = reconcileOverlay(previous, current, overlay(previous), context());
  assert.deepEqual(result.changed, { text: false, facts: false, media: true });
  assert.equal(result.assessment.status, 'ready');
  assert.equal(assembleLocalizedContent(current, result.overlay, context()).shared.media.hero.src,
    '/media/fixture-enhanced.webp');
});

test('a different photo subject invalidates only its dependent caption', () => {
  const original = source();
  const current = clone(original);
  current.shared.media.hero.subjectId = 'destination_cusco';
  const result = assessOverlay(current, overlay(original), context());
  assert.equal(result.status, 'stale');
  assert.deepEqual(result.issues.map((item) => item.blockId), ['hero:alt']);
});

test('new shared price is automatic, embedded price prose becomes stale with a precise dependency', () => {
  const previous = source();
  const current = clone(previous);
  current.shared.facts.priceFrom = 1200;
  const translation = overlay(previous);
  const result = reconcileOverlay(previous, current, translation, context());
  assert.deepEqual(result.changed, { text: false, facts: true, media: false });
  assert.equal(result.assessment.status, 'stale');
  assert.deepEqual(result.assessment.issues.map((item) => item.blockId), ['price:note']);
  assert.deepEqual(result.overlay, translation, 'No stale English is silently rewritten');
  assert.throws(() => assembleLocalizedContent(current, translation, context()), TranslationNotReadyError);
});

test('an unrelated shared fact update does not invalidate approved text', () => {
  const original = source();
  const current = clone(original);
  current.shared.facts.priority = 9;
  const result = assembleLocalizedContent(current, overlay(original), context());
  assert.equal(result.shared.facts.priority, 9);
});

test('source text edit preserves independently edited target and marks only that block stale', () => {
  const previous = source();
  const current = clone(previous);
  current.blocks[0].text = 'Знакомство с Перу';
  const translation = overlay(previous);
  translation.blocks[0].text = 'Discover Peru with Ada Tours';
  reapprove(translation.blocks[0]);
  const result = reconcileOverlay(previous, current, translation, context());
  assert.equal(result.assessment.status, 'stale');
  assert.deepEqual(result.assessment.issues.map((item) => item.blockId), ['tour:title']);
  assert.equal(result.overlay.blocks[0].text, 'Discover Peru with Ada Tours');
});

test('Word revision change and changed source text are stale, not a new approved translation', () => {
  const original = source();
  for (const change of ['revision', 'text']) {
    const ctx = context();
    if (change === 'revision') ctx.wordSources['fixture-word-2027'].revision = 'fixture-revision-2';
    else ctx.wordSources['fixture-word-2027'].blocks['paragraph:arrival'] = 'Your driver will meet you in Lima.';
    const result = assessOverlay(original, overlay(original), ctx);
    assert.equal(result.status, 'stale', change);
    assert.equal(result.issues[0].code, 'word_source_changed');
  }
});

test('word_exact refuses to rewrite even punctuation or whitespace', () => {
  const original = source();
  const translation = overlay(original);
  translation.blocks[1].text += ' ';
  reapprove(translation.blocks[1]);
  const result = assessOverlay(original, translation, context());
  assert.equal(result.status, 'invalid');
  assert.ok(result.issues.some((item) => item.code === 'word_text_modified'));
});

test('missing captured Word evidence blocks assembly instead of trusting a URL or hash alone', () => {
  const original = source();
  assert.equal(assessOverlay(original, overlay(original)).status, 'blocked');
  assert.throws(() => assembleLocalizedContent(original, overlay(original)), TranslationNotReadyError);
});

test('draft, review, missing QA and fabricated published state cannot be assembled', () => {
  const original = source();
  for (const state of ['draft', 'review', 'published']) {
    const translation = overlay(original);
    translation.blocks[0].state = state;
    assert.equal(assessOverlay(original, translation, context()).status, state === 'published' ? 'invalid' : 'review');
    assert.throws(() => assembleLocalizedContent(original, translation, context()), TranslationNotReadyError);
  }
  const noQa = overlay(original);
  delete noQa.blocks[0].approval;
  assert.equal(assessOverlay(original, noQa, context()).status, 'invalid');
});

test('missing overlay or one untranslated block never falls back to Russian', () => {
  const original = source();
  assert.equal(assessOverlay(original, null).status, 'missing');
  assert.throws(() => assembleLocalizedContent(original, null), TranslationNotReadyError);
  const incomplete = overlay(original);
  incomplete.blocks.pop();
  const result = assessOverlay(original, incomplete, context());
  assert.equal(result.status, 'incomplete');
  assert.equal(result.issues[0].code, 'block_missing');
  assert.throws(() => assembleLocalizedContent(original, incomplete, context()), TranslationNotReadyError);
});

test('identity mismatch and retired blocks cannot accidentally localise another entity/day', () => {
  const original = source();
  const wrongEntity = overlay(original);
  wrongEntity.entityId = 'tour_other';
  assert.equal(assessOverlay(original, wrongEntity, context()).status, 'invalid');
  const removed = clone(original);
  removed.blocks = removed.blocks.filter((block) => block.blockId !== 'arrival:paragraph');
  const result = assessOverlay(removed, overlay(original), context());
  assert.equal(result.status, 'stale');
  assert.equal(result.issues[0].code, 'retired_block');
});

test('independent target edit causes CAS conflict; fresh patch succeeds without touching other blocks', () => {
  const original = source();
  const translation = overlay(original);
  const readHash = translationBlockHash(translation.blocks[0]);
  const incoming = reapprove({ ...clone(translation.blocks[0]), text: 'Peru highlights' });
  const edited = clone(translation);
  edited.blocks[0].text = 'Peru with Ada Tours';
  reapprove(edited.blocks[0]);
  assert.throws(() => applyTranslationPatch(original, edited,
    [{ block: incoming, expectedBlockHash: readHash }], context()), TranslationConflictError);
  assert.equal(edited.blocks[0].text, 'Peru with Ada Tours');
  const updated = applyTranslationPatch(original, edited, [{
    block: incoming, expectedBlockHash: translationBlockHash(edited.blocks[0]),
  }], context());
  assert.equal(updated.blocks[0].text, 'Peru highlights');
  assert.deepEqual(updated.blocks.slice(1), edited.blocks.slice(1));
});

test('patch with stale source evidence cannot overwrite the target even with correct target CAS', () => {
  const previous = source();
  const current = clone(previous);
  current.blocks[0].text = 'Новый тур в Перу';
  const translation = overlay(previous);
  const incoming = reapprove({ ...clone(translation.blocks[0]), text: 'Updated Peru tour' });
  assert.throws(() => applyTranslationPatch(current, translation, [{
    block: incoming, expectedBlockHash: translationBlockHash(translation.blocks[0]),
  }], context()), TranslationNotReadyError);
  assert.equal(translation.blocks[0].text, 'Peru');
});

test('translation patches cannot replace approved Word with newly relabelled AI or editorial prose', () => {
  const original = source();
  const translation = overlay(original);
  for (const provenance of [
    { kind: 'ai_translation', model: 'fixture-model', runId: 'fixture-run' },
    { kind: 'editorial', editorId: 'fixture-editor', reason: 'Reworded automatically' },
  ]) {
    const incoming = reapprove({ ...clone(translation.blocks[1]), text: 'Rewritten arrival description.', provenance });
    assert.throws(() => applyTranslationPatch(original, translation, [{
      block: incoming, expectedBlockHash: translationBlockHash(translation.blocks[1]),
    }], context()), /Word authority cannot be downgraded/);
  }
  assert.equal(translation.blocks[1].text, TARGETS['arrival:paragraph']);
});

test('an approved replacement Word revision can update its block with fresh evidence and target CAS', () => {
  const original = source();
  const translation = overlay(original);
  const ctx = context();
  const exactText = 'Your driver will meet you in Lima.';
  const record = ctx.wordSources['fixture-word-2027'];
  record.revision = 'fixture-revision-2';
  record.documentHash = fingerprint({ fixture: 'updated-2027-program' });
  record.blocks['paragraph:arrival'] = exactText;
  const incoming = reapprove({ ...clone(translation.blocks[1]), text: exactText,
    provenance: { ...clone(translation.blocks[1].provenance), revision: record.revision,
      documentHash: record.documentHash, textHash: textFingerprint(exactText) } });
  const updated = applyTranslationPatch(original, translation, [{ block: incoming,
    expectedBlockHash: translationBlockHash(translation.blocks[1]) }], ctx);
  assert.equal(assessOverlay(original, updated, ctx).status, 'ready');
  assert.equal(updated.blocks[1].text, exactText);
});

test('reverse EN-to-RU editing follows the same conflict and source rules', () => {
  const en = source();
  en.locale = 'en';
  en.blocks = [{ blockId: 'tour:title', field: 'title', text: 'Peru', dependsOn: [] }];
  const ru = { schemaVersion: 1, entityId: en.entityId, entityType: 'tour', locale: 'ru', sourceLocale: 'en',
    blocks: [reapprove({ blockId: 'tour:title', field: 'title', text: 'Путешествие по Перу', state: 'approved',
      ...sourceBlockEvidence(en, 'tour:title'),
      provenance: { kind: 'editorial', editorId: 'fixture-editor', reason: 'Reverse edit fixture' } })] };
  assert.equal(assembleLocalizedContent(en, ru).blocks[0].text, 'Путешествие по Перу');
  const revised = clone(en);
  revised.blocks[0].text = 'Peru highlights';
  const result = reconcileOverlay(en, revised, ru);
  assert.equal(result.assessment.status, 'stale');
  assert.equal(result.overlay.blocks[0].text, 'Путешествие по Перу');
});

test('editing a target or evidence cannot reuse an earlier approval record', () => {
  const original = source();
  const translation = overlay(original);
  const edited = clone(translation);
  edited.blocks[0].text = 'Different travel promise';
  const result = assessOverlay(original, edited, context());
  assert.equal(result.status, 'invalid');
  assert.match(result.issues[0].detail, /Approval is not bound/);
  assert.throws(() => applyTranslationPatch(original, translation, [{
    block: edited.blocks[0], expectedBlockHash: translationBlockHash(translation.blocks[0]),
  }], context()), TranslationNotReadyError);
  const changedEvidence = clone(translation);
  changedEvidence.blocks[0].provenance.reason = 'A different editorial decision';
  assert.equal(assessOverlay(original, changedEvidence, context()).status, 'invalid');
});

test('unsafe nested values, duplicate identities and arbitrary field paths fail closed', () => {
  const original = source();
  const prototype = JSON.parse('{"schemaVersion":1,"entityId":"x","entityType":"tour","locale":"ru","shared":{"facts":{"__proto__":{"priceFrom":0}},"media":{}},"blocks":[]}');
  assert.throws(() => createSourceSnapshot(prototype), /Forbidden JSON key/);
  original.blocks.push(clone(original.blocks[0]));
  assert.throws(() => createSourceSnapshot(original), /Duplicate blockId/);
  assert.throws(() => fingerprint({ value: undefined }), /finite JSON/);
  const wrongPath = source();
  wrongPath.blocks[0].field = 'itinerary.0.text';
  assert.throws(() => createSourceSnapshot(wrongPath), /not localisable/);
});
