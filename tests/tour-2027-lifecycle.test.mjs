import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkLifecycle } from '../scripts/check-tour-2027-lifecycle.mjs';
import {
  LIFECYCLE_VERSION, PREDEPLOY_STAGES, FINAL_STAGES, createLifecycle,
  recordStage, stageErrors, verifyLifecycle, validateDailyState,
} from '../scripts/tour-2027-lifecycle.mjs';

const copy = value => JSON.parse(JSON.stringify(value));
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const time = minute => '2026-10-26T18:' + String(minute).padStart(2, '0') + ':00Z';
const tour = 'tour_fixture', place = 'destination_fixture';
const url = '/brazil/tour/fixture/', placeUrl = '/brazil/place/fixture/';
const image = '/media/tours/fixture/hero.webp', crop = '/media/tours/fixture/hero-mobile.webp';
const usage = tour + ':hero';
const registry = 'src/data/interest-registry.json', taxonomy = 'src/lib/destination-taxonomy.mjs';
const geoPath = id => 'data/geo-knowledge/entities/' + id + '.json';
const lifecyclePath = 'data/audits/tour-lifecycle/fixture.json';

function fixture() {
  const entityPaths = { [tour]: 'src/content/tours/fixture.md', [place]: 'src/content/destinations/fixture.md' };
  const articlePaths = { [url]: 'data/seo-geo/articles/brazil/tour/fixture/index.md', [placeUrl]: 'data/seo-geo/articles/brazil/place/fixture/index.md' };
  const paths = [...Object.values(entityPaths), registry, taxonomy,
    'src/data/media/photo-enhancements.json', 'src/data/media/direct-s3-uploads.json',
    ...Object.values(articlePaths), 'data/catalogues/multi-country.json', geoPath(tour), geoPath(place)];
  const fileContent = path => 'fixture content: ' + path;
  const files = paths.map(path => ({ path, sha256: hash(fileContent(path)),
    ...(path.startsWith('data/geo-knowledge/entities/') ? { phase: 'postdeploy' } : {}) }));
  const fileHashes = Object.fromEntries(files.map(row => [row.path, row.sha256]));
  const sheetTargets = {
    pages: { spreadsheetId: 'main_book', sheetName: 'Страницы', key: tour },
    photos: { spreadsheetId: 'main_book', sheetName: 'Фото', key: tour + ':hero' },
    seo: { spreadsheetId: 'main_book', sheetName: 'SEO-GEO тексты', key: url },
    geo: { spreadsheetId: 'main_book', sheetName: 'GEO результаты', key: tour },
  };
  const scope = {
    fingerprint: hash('scope-v1'), files, entityPaths, articlePaths,
    unresolvedEntityIds: [], cataloguePaths: { 'multi-country': 'data/catalogues/multi-country.json' },
    interestIds: ['theme_nature', 'theme_wildlife'], taxonomyTypes: ['city', 'national_park'],
    assetHashes: { [image]: hash('hero'), [crop]: hash('crop') }, heroSources: { [usage]: image },
    geoSourceFingerprints: { [tour]: hash('tour geo current'), [place]: hash('place geo current') },
    sheetTargets,
    targets: {
      word_verified: ['drive_word'], relations_ready: [tour, place], interests_verified: [tour, place],
      destinations_classified: [place], media_ready: [image], mobile_heroes_ready: [usage],
      seo_facts_ready: [url, placeUrl], seo_voice_ready: [url, placeUrl], catalogues_ready: ['multi-country'],
      actions_deployed: ['production'], geo_ready: [tour, place], sheets_synced: Object.keys(sheetTargets),
    },
  };
  const source = { driveFileId: 'drive_word', textSha256: hash('word text'),
    embeddedMediaSha256: hash('word media'), fingerprint: hash('source v1') };
  const lifecycle = createLifecycle({ programKey: 'P_TEST', tourId: tour, source, scope, now: time(0) });
  const evidence = stage => ({
    word_verified: [{ kind: 'word_comparison', driveFileId: source.driveFileId, textSha256: source.textSha256,
      embeddedMediaSha256: source.embeddedMediaSha256, fullTextCompared: true, tablesCompared: true,
      embeddedMediaCompared: true, mediaComparison: 'changed' }],
    relations_ready: [tour, place].map(entityId => ({ kind: 'relations', entityId, filePath: entityPaths[entityId],
      entitySha256: fileHashes[entityPaths[entityId]], mdEntryCatalogEqual: true, fullProgramReviewed: true,
      excursionReuseReviewed: true, missingEntityIds: [] })),
    interests_verified: [tour, place].map(entityId => ({ kind: 'interests', entityId,
      registrySha256: fileHashes[registry], themeIds: ['theme_nature', 'theme_wildlife'],
      ...(entityId === tour ? { primaryThemeIds: ['theme_wildlife'] } : {}), rationale: 'Program includes confirmed wildlife observation.' })),
    destinations_classified: [{ kind: 'destination', entityId: place, destinationType: 'national_park',
      navigationRole: 'sight', taxonomySha256: fileHashes[taxonomy], projectionsEqual: true }],
    media_ready: [{ kind: 'image', source: image, method: 'gpt-image', enhancementRecord: 'registered-source-and-result',
      sha256: scope.assetHashes[image], storage: 'direct-s3', receiptVerified: true }],
    mobile_heroes_ready: [{ kind: 'mobile_hero', usageKey: usage, source: image,
      sourceSha256: scope.assetHashes[image], sourceViewed: true, previewsViewed: true,
      focusReason: 'Faces preserved through tested cover profiles.', variants: [{ src: crop, sha256: scope.assetHashes[crop], receiptVerified: true }] }],
    seo_facts_ready: [url, placeUrl].map(value => ({ kind: 'seo_facts', url: value, filePath: articlePaths[value],
      articleSha256: fileHashes[articlePaths[value]], sourceCompared: true, linksChecked: true, decision: 'updated' })),
    seo_voice_ready: [url, placeUrl].map(value => ({ kind: 'seo_voice', url: value, filePath: articlePaths[value],
      articleSha256: fileHashes[articlePaths[value]], directAdaVoice: true })),
    catalogues_ready: [{ kind: 'catalogue', id: 'multi-country', filePath: 'data/catalogues/multi-country.json',
      sha256: fileHashes['data/catalogues/multi-country.json'], fingerprint: hash('catalogue-v1'),
      generatedFromCurrentContent: true, seoRegistryPresent: true, externalIdentityInventoryPresent: true }],
    actions_deployed: [{ kind: 'pages_deploy', target: 'production', conclusion: 'success', commit: 'a'.repeat(40),
      exactFilesVerified: true, runUrl: 'https://github.com/alexyakovlev79/adatours.ru/actions/runs/123',
      fileHashes: Object.fromEntries(files.filter(row => row.phase !== 'postdeploy').map(row => [row.path, row.sha256])) }],
    geo_ready: [tour, place].map(entityId => ({ kind: 'geo_passport', entityId,
      sourceFingerprint: scope.geoSourceFingerprints[entityId], resultHash: hash(entityId + ' result'),
      filePath: geoPath(entityId), passportSha256: fileHashes[geoPath(entityId)], publication: 'published_current',
      stale: false, releaseCommit: 'b'.repeat(40), exactFilesVerified: true,
      runUrl: 'https://github.com/alexyakovlev79/adatours.ru/actions/runs/124' })),
    sheets_synced: Object.entries(sheetTargets).map(([target, identity]) => ({ kind: 'sheet_readback', target,
      ...identity, range: identity.sheetName + '!A2:Z2', valuesSha256: hash(target + ' values'),
      writtenValuesSha256: hash(target + ' values'), readBack: true, managerFieldsPreserved: true })),
  })[stage];
  const receipt = stage => ({ submissionId: 'submission-' + stage, status: 'verified',
    checkedAt: time(FINAL_STAGES.indexOf(stage) + 1), sourceFingerprint: source.fingerprint,
    scopeFingerprint: scope.fingerprint, targets: copy(scope.targets[stage]),
    note: 'Addressed comparison and readback complete for this revision.', evidence: evidence(stage) });
  const populate = (stages = FINAL_STAGES) => { for (const stage of stages) recordStage(lifecycle, stage, receipt(stage)); return lifecycle; };
  return { lifecycle, scope, source, receipt, populate, fileHashes, fileContent };
}
function stateFor(lifecycle, queue = 'completedQueue') {
  const entry = { programKey: lifecycle.programKey, driveFileId: lifecycle.source.driveFileId, tourId: lifecycle.tourId,
    readableTextSha256: lifecycle.source.textSha256, sourceFingerprint: lifecycle.source.fingerprint,
    lifecyclePath, stage: queue === 'completedQueue' ? 'done' : 'actions_deployed',
    ...(queue === 'completedQueue' ? { completedAt: time(20) } : {}) };
  return { lifecyclePolicy: { version: LIFECYCLE_VERSION, enforcedFrom: time(0), historicalCompletions: [] },
    openQueue: queue === 'openQueue' ? [entry] : [], completedQueue: queue === 'completedQueue' ? [entry] : [] };
}
function errorsInclude(result, expected) { assert.equal(result.ok, false); assert.match(result.errors.join('\n'), expected); }

test('a full matched version requires all 12 stages and current scoped files', () => {
  const f = fixture(); f.populate();
  assert.equal(f.lifecycle.status, 'complete');
  assert.deepEqual(verifyLifecycle(f.lifecycle, { currentFiles: f.fileHashes }), { ok: true, phase: 'final', errors: [], verifiedStages: 12 });
});

test('nine predeploy stages permit first content release before GEO creation; final stays incomplete', () => {
  const f = fixture(); f.populate(PREDEPLOY_STAGES);
  const live = { ...f.fileHashes }; delete live[geoPath(tour)]; delete live[geoPath(place)];
  assert.equal(PREDEPLOY_STAGES.length, 9);
  assert.equal(verifyLifecycle(f.lifecycle, { phase: 'predeploy', currentFiles: live }).ok, true);
  assert.throws(() => recordStage(f.lifecycle, 'geo_ready', f.receipt('geo_ready')), /actions_deployed/);
  recordStage(f.lifecycle, 'actions_deployed', f.receipt('actions_deployed'));
  errorsInclude(verifyLifecycle(f.lifecycle), /geo_ready/);
  assert.throws(() => recordStage(f.lifecycle, 'sheets_synced', f.receipt('sheets_synced')), /geo_ready/);
});

test('new GEO passport hash can be bound after content release without predicting it in the predeploy scope', () => {
  const f = fixture(); f.lifecycle.scope.files = f.lifecycle.scope.files.filter(row => row.phase !== 'postdeploy');
  assert.doesNotThrow(() => createLifecycle({ programKey: 'P_TEST', tourId: tour, source: f.source, scope: f.lifecycle.scope, now: time(0) }));
  f.populate([...PREDEPLOY_STAGES, 'actions_deployed']);
  const geo = f.receipt('geo_ready'); geo.evidence[0].passportSha256 = hash('created only after creationCommit');
  recordStage(f.lifecycle, 'geo_ready', geo); recordStage(f.lifecycle, 'sheets_synced', f.receipt('sheets_synced'));
  const current = { ...f.fileHashes, [geoPath(tour)]: geo.evidence[0].passportSha256 };
  assert.equal(verifyLifecycle(f.lifecycle, { currentFiles: current }).ok, true);
  delete current[geoPath(tour)];
  errorsInclude(verifyLifecycle(f.lifecycle, { currentFiles: current }), /Published GEO file changed/);
});

test('required unfilled reservations permit partial content work but never final completion', () => {
  const f = fixture(); f.lifecycle.scope.unresolvedEntityIds = ['destination_missing_1', 'destination_missing_2'];
  f.populate();
  assert.equal(verifyLifecycle(f.lifecycle, { phase: 'predeploy' }).ok, true);
  errorsInclude(verifyLifecycle(f.lifecycle), /Unresolved required entities/);
  assert.equal(f.lifecycle.status, 'in_progress');
  const state = stateFor(f.lifecycle); errorsInclude(validateDailyState(state, { readLifecycle: () => f.lifecycle }), /Unresolved required entities/);
});

for (const stage of ['media_ready', 'mobile_heroes_ready', 'seo_voice_ready', 'geo_ready', 'sheets_synced']) {
  test('cannot complete with missing ' + stage, () => {
    const f = fixture(); f.populate(); delete f.lifecycle.stages[stage];
    errorsInclude(verifyLifecycle(f.lifecycle), new RegExp(stage));
  });
}

test('source text, embedded media, source revision and scope drift each invalidate evidence', () => {
  for (const mutate of [l => l.source.textSha256 = hash('new text'), l => l.source.embeddedMediaSha256 = hash('new image'),
    l => l.source.fingerprint = hash('new source'), l => l.scope.fingerprint = hash('new scope')]) {
    const f = fixture(); f.populate(); mutate(f.lifecycle); assert.equal(verifyLifecycle(f.lifecycle).ok, false);
  }
});

test('changing a scoped output cannot reuse old stage proofs even with unchanged scope label', () => {
  const f = fixture(); f.populate();
  f.lifecycle.scope.files.find(row => row.path === f.scope.entityPaths[tour]).sha256 = hash('new MD');
  errorsInclude(verifyLifecycle(f.lifecycle), /relations_ready|actions_deployed/);
});

test('runtime comparison rejects changed or missing files, including final GEO payload', () => {
  const f = fixture(); f.populate();
  errorsInclude(verifyLifecycle(f.lifecycle, { currentFiles: { ...f.fileHashes, [geoPath(tour)]: hash('drift') } }), /Scoped file changed/);
  const missing = { ...f.fileHashes }; delete missing[f.scope.articlePaths[url]];
  errorsInclude(verifyLifecycle(f.lifecycle, { currentFiles: missing }), /Scoped file changed/);
});

test('changed article after fact QA cannot be passed as voice-only work', () => {
  const f = fixture(); f.populate(PREDEPLOY_STAGES.filter(stage => stage !== 'seo_voice_ready'));
  const receipt = f.receipt('seo_voice_ready'); receipt.evidence[0].articleSha256 = hash('new prose');
  assert.throws(() => recordStage(f.lifecycle, 'seo_voice_ready', receipt), /fact-checked final article/);
  const mismatch = copy(f.lifecycle); mismatch.scope.targets.seo_voice_ready = [];
  errorsInclude(verifyLifecycle(mismatch), /SEO fact and voice target sets differ/);
});

test('identical submission is a no-op; reuse with changed content or another stage is rejected', () => {
  const f = fixture(); f.populate(); const before = JSON.stringify(f.lifecycle);
  recordStage(f.lifecycle, 'word_verified', f.receipt('word_verified'));
  assert.equal(JSON.stringify(f.lifecycle), before);
  const changed = f.receipt('word_verified'); changed.note = 'Different proof';
  assert.throws(() => recordStage(f.lifecycle, 'word_verified', changed), /Submission ID reused/);
  const other = f.receipt('interests_verified'); other.submissionId = f.receipt('word_verified').submissionId;
  assert.throws(() => recordStage(f.lifecycle, 'interests_verified', other), /belongs to another stage/);
});

test('new fact evidence invalidates voice/deploy/GEO/Sheets while preserving unrelated media', () => {
  const f = fixture(); f.populate(); const media = copy(f.lifecycle.stages.media_ready);
  const next = f.receipt('seo_facts_ready'); next.submissionId = 'fact-recheck'; next.checkedAt = time(21);
  recordStage(f.lifecycle, 'seo_facts_ready', next);
  for (const stage of ['seo_voice_ready', 'actions_deployed', 'geo_ready', 'sheets_synced']) assert.equal(f.lifecycle.stages[stage], undefined);
  assert.deepEqual(f.lifecycle.stages.media_ready, media);
  assert.equal(f.lifecycle.status, 'in_progress');
});

test('persisted downstream evidence cannot predate its prerequisite', () => {
  const f = fixture(); f.populate(); f.lifecycle.stages.actions_deployed.checkedAt = time(1);
  errorsInclude(verifyLifecycle(f.lifecycle), /receipt predates/);
});

test('malformed lifecycle/evidence/targets fail closed without TypeError', () => {
  for (const value of [null, [], {}, { version: LIFECYCLE_VERSION }]) assert.doesNotThrow(() => assert.equal(verifyLifecycle(value).ok, false));
  for (const mutate of [l => l.scope.targets.media_ready = null, l => l.scope.files = {},
    l => l.stages.media_ready.evidence = {}, l => l.stages.media_ready.evidence = [null]]) {
    const f = fixture(); f.populate(); mutate(f.lifecycle);
    assert.doesNotThrow(() => assert.equal(verifyLifecycle(f.lifecycle).ok, false));
  }
  const f = fixture(); f.populate(); const extra = copy(f.lifecycle.stages.sheets_synced.evidence[0]); extra.target = 'unknown';
  f.lifecycle.stages.sheets_synced.evidence.push(extra);
  assert.doesNotThrow(() => errorsInclude(verifyLifecycle(f.lifecycle), /unexpected sheet_readback/));
});

test('invented GPT provenance, legacy fallback and mismatched asset bytes are rejected', () => {
  for (const patch of [{ method: 'deterministic-restoration' }, { storage: 'legacy_git' }, { sha256: hash('other') }, { receiptVerified: false }]) {
    const f = fixture(); f.populate(); Object.assign(f.lifecycle.stages.media_ready.evidence[0], patch);
    errorsInclude(verifyLifecycle(f.lifecycle), /no valid image/);
  }
});

test('mobile proof is bound to final source bytes, known crop and actual review flags', () => {
  for (const mutate of [r => r.sourceSha256 = hash('previous hero'), r => r.previewsViewed = false,
    r => r.variants[0].src = '/media/unregistered.webp', r => r.variants[0].receiptVerified = false]) {
    const f = fixture(); f.populate(); mutate(f.lifecycle.stages.mobile_heroes_ready.evidence[0]);
    errorsInclude(verifyLifecycle(f.lifecycle), /no valid mobile_hero/);
  }
});

test('current taxonomy/interest snapshots forbid old registries and unsupported categories', () => {
  for (const [stage, patch] of [['interests_verified', { registrySha256: hash('14 interests') }],
    ['interests_verified', { themeIds: ['theme_not_in_registry'] }],
    ['destinations_classified', { destinationType: 'unsupported_type' }],
    ['destinations_classified', { navigationRole: 'auto' }]]) {
    const f = fixture(); f.populate(); Object.assign(f.lifecycle.stages[stage].evidence[0], patch);
    assert.equal(verifyLifecycle(f.lifecycle).ok, false);
  }
});

test('GEO needs current source, exact passport and a real release receipt, not READY', () => {
  for (const patch of [{ sourceFingerprint: hash('stale route') }, { publication: 'included_in_content_release' },
    { publication: 'READY' }, { releaseCommit: 'pending' }, { passportSha256: hash('old passport') }]) {
    const f = fixture(); f.populate(); Object.assign(f.lifecycle.stages.geo_ready.evidence[0], patch);
    errorsInclude(verifyLifecycle(f.lifecycle), /no valid geo_passport/);
  }
});

test('Sheets completion needs all target identities and identical write/readback values', () => {
  for (const mutate of [r => r.evidence.pop(), r => r.evidence[0].spreadsheetId = 'wrong_book',
    r => r.evidence[0].valuesSha256 = hash('different readback'), r => r.evidence[0].managerFieldsPreserved = false]) {
    const f = fixture(); f.populate(); mutate(f.lifecycle.stages.sheets_synced);
    assert.equal(verifyLifecycle(f.lifecycle).ok, false);
  }
});

test('truly empty optional scope needs explicit explanation and cannot hide the Tour GEO', () => {
  const f = fixture(); f.lifecycle.scope.targets.media_ready = [];
  const receipt = f.receipt('media_ready'); receipt.targets = []; receipt.evidence = [{ kind: 'empty_scope', reason: 'No affected image slots', scopeFingerprint: f.scope.fingerprint }];
  assert.deepEqual(stageErrors(f.lifecycle, 'media_ready', receipt), []);
  receipt.evidence = [{ kind: 'empty_scope', reason: '', scopeFingerprint: f.scope.fingerprint }];
  assert.match(stageErrors(f.lifecycle, 'media_ready', receipt).join('\n'), /explicit scoped explanation/);
  f.lifecycle.scope.targets.geo_ready = [];
  errorsInclude(verifyLifecycle(f.lifecycle), /Tour relations\/interests\/GEO/);
});

test('new completion cannot bypass policy by omitting time or backdating without explicit history', () => {
  for (const completedAt of [undefined, 'not-a-date', '2026-10-01T00:00:00Z']) {
    const f = fixture(); f.populate(); const state = stateFor(f.lifecycle); delete state.completedQueue[0].lifecyclePath;
    state.completedQueue[0].completedAt = completedAt;
    errorsInclude(validateDailyState(state), /no v2 receipt|real completedAt/);
  }
});

test('exact approved old completions remain unchanged, but changing their identity fails', () => {
  const f = fixture(); const state = stateFor(f.lifecycle); const entry = state.completedQueue[0];
  delete entry.lifecyclePath; entry.completedAt = '2026-10-16T08:45:18.639748+00:00'; entry.stage = 'sheets_synced';
  state.lifecyclePolicy.historicalCompletions = [{ programKey: entry.programKey, driveFileId: entry.driveFileId, tourId: entry.tourId, completedAt: entry.completedAt }];
  const before = JSON.stringify(state); assert.equal(validateDailyState(state).ok, true); assert.equal(JSON.stringify(state), before);
  entry.tourId = 'changed_tour'; errorsInclude(validateDailyState(state), /exact historical approval/);
});

test('duplicating a grandfathered completion or an unresolved open Drive item is rejected', () => {
  const f = fixture(); const state = stateFor(f.lifecycle); const entry = state.completedQueue[0];
  delete entry.lifecyclePath; entry.completedAt = '2026-10-16T08:45:18Z';
  state.lifecyclePolicy.historicalCompletions = [{ programKey: entry.programKey, driveFileId: entry.driveFileId, tourId: entry.tourId, completedAt: entry.completedAt }];
  state.completedQueue.push(copy(entry)); errorsInclude(validateDailyState(state), /Duplicate completion identity/);
  state.completedQueue = []; state.openQueue = [{ driveFileId: 'review_file', status: 'REVIEW' }, { driveFileId: 'review_file', status: 'REVIEW' }];
  errorsInclude(validateDailyState(state), /Duplicate Drive file/);
});

test('completed version preserves immutable history after later content changes', () => {
  const f = fixture(); f.populate(); const state = stateFor(f.lifecycle);
  assert.equal(validateDailyState(state, { readLifecycle: () => f.lifecycle, currentFilesFor: () => { throw Error('Must not read current files for historic completed release'); } }).ok, true);
  const pending = stateFor(f.lifecycle, 'openQueue');
  errorsInclude(validateDailyState(pending, { readLifecycle: () => f.lifecycle, currentFilesFor: () => ({}) }), /Scoped file changed/);
});

test('pending actions_deployed can await GEO, but cannot invent deploy success', () => {
  const f = fixture(); f.populate([...PREDEPLOY_STAGES, 'actions_deployed']); const state = stateFor(f.lifecycle, 'openQueue');
  assert.equal(validateDailyState(state, { readLifecycle: () => f.lifecycle, currentFilesFor: () => f.fileHashes }).ok, true);
  delete f.lifecycle.stages.actions_deployed;
  errorsInclude(validateDailyState(state, { readLifecycle: () => f.lifecycle }), /actions_deployed: not verified/);
});

test('queue rejects duplicate lifecycle or same program/source revision under a new path', () => {
  const f = fixture(); f.populate(); const state = stateFor(f.lifecycle); state.completedQueue.push(copy(state.completedQueue[0]));
  errorsInclude(validateDailyState(state, { readLifecycle: () => f.lifecycle }), /occurs twice/);
  state.completedQueue[1].lifecyclePath = 'data/audits/tour-lifecycle/another.json';
  errorsInclude(validateDailyState(state, { readLifecycle: () => f.lifecycle }), /Duplicate source revision/);
});

test('queue verifies program identity, text revision and final completion time', () => {
  for (const patch of [{ programKey: 'wrong' }, { readableTextSha256: hash('wrong word') }, { completedAt: time(1) }]) {
    const f = fixture(); f.populate(); const state = stateFor(f.lifecycle); Object.assign(state.completedQueue[0], patch);
    assert.equal(validateDailyState(state, { readLifecycle: () => f.lifecycle }).ok, false);
  }
  const f = fixture(); const state = stateFor(f.lifecycle);
  assert.doesNotThrow(() => assert.equal(validateDailyState(state, { readLifecycle: () => null }).ok, false));
});

test('Code Mode evaluation works without structuredClone or Node imports', () => {
  const source = readFileSync(new URL('../scripts/tour-2027-lifecycle.mjs', import.meta.url), 'utf8');
  const portable = new Function('structuredClone', source.replace(/^export /gm, '') + ';return {createLifecycle,verifyLifecycle};')(undefined);
  const f = fixture(); const made = portable.createLifecycle({ programKey: 'P_TEST', tourId: tour, source: f.source, scope: f.scope, now: time(0) });
  assert.equal(made.programKey, 'P_TEST'); assert.equal(portable.verifyLifecycle(made).ok, false);
});

test('CLI wrapper reads bytes and returns structured failure for malformed JSON', () => {
  const root = mkdtempSync(join(tmpdir(), 'ada-lifecycle-'));
  try {
    const f = fixture(); f.populate();
    // New passport hashes are learned after creationCommit, outside the first-release scope.
    f.lifecycle.scope.files = f.lifecycle.scope.files.filter(row => row.phase !== 'postdeploy');
    for (const row of f.scope.files) { const path = join(root, row.path); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, f.fileContent(row.path)); }
    const receipt = join(root, 'receipt.json'); writeFileSync(receipt, JSON.stringify(f.lifecycle));
    assert.equal(checkLifecycle({ receiptPath: 'receipt.json', rootDir: root }).ok, true);
    writeFileSync(join(root, f.scope.entityPaths[tour]), 'changed');
    errorsInclude(checkLifecycle({ receiptPath: 'receipt.json', rootDir: root }), /Scoped file changed/);
    writeFileSync(receipt, '{broken');
    errorsInclude(checkLifecycle({ receiptPath: 'receipt.json', rootDir: root }), /Cannot validate lifecycle input/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
