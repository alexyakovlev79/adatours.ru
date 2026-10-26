import test from 'node:test';
import assert from 'node:assert/strict';
import {planTourSeoFinalization, planTourSeoPublicationMirror, seoFileHashes} from '../scripts/finalize-tour-seo-review.mjs';
import {PHASE_FILES} from '../src/lib/seo-geo-voice-rewrite.mjs';

const json = value => JSON.stringify(value, null, 2) + '\n';
const clone = value => JSON.parse(JSON.stringify(value));
const phasePath = 'data/seo-geo/registry/05-tours.json';
const reviewPath = 'data/audits/test-seo-review.json';
const url = '/test/tour/new-tour/';
const articlePath = 'data/seo-geo/articles' + url + 'index.md';
const provenancePath = 'data/seo-geo/provenance' + url + 'index.json';
const sourcePath = 'data/source-index/materials/test.md';
const claimsPath = 'data/seo-geo/claims.json';
const rewriteClaimsPath = 'data/seo-geo/voice-rewrite/claims.json';
const release = {repository: 'alexyakovlev79/adatours.ru', workflowPath: '.github/workflows/deploy.yml',
  headSha: 'a'.repeat(40), runId: 1234, runUrl: 'https://github.com/alexyakovlev79/adatours.ru/actions/runs/1234',
  status: 'completed', conclusion: 'success', completedAt: '2026-10-26T17:00:00Z', observedAt: '2026-10-26T17:01:00Z'};

function fixture(existing = false) {
  const article = `---\nstatus: approved\ntargetPath: ${url}\nlead: Our tour.\n---\n\n## Route\n\nOur approved tour.\n`;
  const actual = seoFileHashes(article), source = 'Confirmed Word source';
  const hashes = {articleSha256: actual.sha256, articleBlobSha: actual.blobSha};
  const item = {targetPath: url, articlePath, provenancePath, ...hashes};
  const review = {reviewedAt: '2026-10-26T16:00:00Z', newArticles: existing ? [] : [item], correctedArticles: existing ? [item] : [],
    independentQa: {checkedAt: '2026-10-26T16:00:00Z', allChecksPass: true, results: [{articlePath, targetPath: url,
      sha256: actual.sha256, blobSha: actual.blobSha, checks: Object.fromEntries(['manifestSha256', 'manifestBlobSha',
        'canonicalFile', 'canonicalRegistry', 'allLinksCanonical', 'productionTemplatesResolved', 'renderedHtmlValid',
        'currentFactHash', 'currentVoiceHash'].map(key => [key, true]))}]}};
  const facts = {...hashes, checkedAt: '2026-10-26T15:00:00Z', sourceCompared: true, linksChecked: true,
    factDraftSha256: actual.sha256, factDraftBlobSha: actual.blobSha, factsPreservedByVoiceGate: true, scope: 'Full Word'};
  const voice = {...hashes, checkedAt: '2026-10-26T15:30:00Z', status: 'complete_prepared_pending_publication',
    sourceArticleSha256: actual.sha256, sourceArticleBlobSha: actual.blobSha, directAdaVoice: true,
    allParagraphsAndLeadReviewed: true, structureAndFactTokensPreserved: true, changedLines: 0};
  const provenance = existing ? {sourceRevisions: [{...hashes, sourceCompared: true,
    preparedAt: '2026-10-26T15:00:00Z', sourceSnapshotPath: sourcePath, sourceSnapshotSha256: seoFileHashes(source).sha256,
    previousArticleBlobSha: 'b'.repeat(40), scope: 'Targeted Word corrections only; external research not repeated', voiceReview: 'Changed passage reviewed'}]} :
    {primaryWord: {snapshotPath: sourcePath, snapshotSha256: seoFileHashes(source).sha256}, lifecycleReview: {facts, voice}};
  const row = {url, kind: 'tour', phase: 5, articlePath, provenancePath, work: existing ? 'rewritten' : 'draft',
    ...(existing ? {publishedAt: '2026-10-15', publishedCommit: 'b'.repeat(40), deployRun: 987,
      rewrittenAt: '2026-10-19', rewriteResultBlobSha: 'c'.repeat(40), rewriteDeployRun: 'historic'} : {})};
  const files = Object.fromEntries(PHASE_FILES.map(name => ['data/seo-geo/registry/' + name, json({entries: []})]));
  Object.assign(files, {[phasePath]: json({entries: [row, {url: '/untouched/tour/backlog/', work: 'queued', notes: 'human note'}]}),
    [claimsPath]: json({claims: {}}), [rewriteClaimsPath]: json({claims: {}}), [articlePath]: article,
    [provenancePath]: json(provenance), [sourcePath]: source, [reviewPath]: json(review)});
  return {files, deployedFiles: clone(files), reviewPath, release: clone(release)};
}
function edit(input, path, fn, deployedToo = false) {
  const doc = JSON.parse(input.files[path]); fn(doc); input.files[path] = json(doc);
  if (deployedToo) input.deployedFiles[path] = input.files[path];
}
function apply(input, plan) {
  const result = clone(input); for (const write of plan.writes) result.files[write.path] = write.content; return result;
}
function rowFrom(plan) { return JSON.parse(plan.writes.find(write => write.path === phasePath).content).entries[0]; }

test('new article finalizes actual first publication and current facts/voice, preserving queued neighbours', () => {
  const input = fixture(), before = clone(input), plan = planTourSeoFinalization(input);
  assert.equal(plan.confirmed.length, 1); assert.deepEqual(plan.held, []);
  const row = rowFrom(plan);
  assert.equal(row.work, 'rewritten'); assert.equal(row.publishedAt, '2026-10-26');
  assert.equal(row.rewriteResultBlobSha, seoFileHashes(input.files[articlePath]).blobSha);
  assert.equal(row.currentArticleReview.scope, 'full_facts_and_voice');
  assert.deepEqual(JSON.parse(plan.writes.find(write => write.path === phasePath).content).entries[1],
    JSON.parse(input.files[phasePath]).entries[1]);
  assert.deepEqual(plan.writes.map(write => write.path).sort(), [phasePath, provenancePath].sort());
  assert.deepEqual(input, before);
});

test('targeted revision preserves first publication and legacy rewrite proof separately from current review', () => {
  const input = fixture(true), plan = planTourSeoFinalization(input), row = rowFrom(plan);
  assert.equal(row.publishedAt, '2026-10-15'); assert.equal(row.publishedCommit, 'b'.repeat(40)); assert.equal(row.deployRun, 987);
  assert.equal(row.rewriteResultBlobSha, 'c'.repeat(40)); assert.equal(row.rewriteDeployRun, 'historic');
  assert.equal(row.currentArticleReview.scope, 'targeted_word_revision');
  assert.notEqual(row.currentArticleReview.articleBlobSha, row.rewriteResultBlobSha);
  const provenance = JSON.parse(plan.writes.find(write => write.path === provenancePath).content);
  assert.equal(provenance.sourceRevisions[0].status, 'published');
  assert.match(provenance.sourceRevisions[0].scope, /external research not repeated/);
});

test('first publication and rewrite dates use Moscow calendar at the UTC day boundary', () => {
  const input = fixture();
  input.release.completedAt = '2026-10-26T21:30:00Z';
  input.release.observedAt = '2026-10-26T21:31:00Z';
  const row = rowFrom(planTourSeoFinalization(input));
  assert.equal(row.publishedAt, '2026-10-27');
  assert.equal(row.rewrittenAt, '2026-10-27');
  assert.equal(row.currentArticleReview.deployedAt, '2026-10-26T21:30:00Z');
});

test('failed, nonfinal, wrong-workflow and mismatched-run receipts cannot publish', () => {
  for (const patch of [{conclusion: 'failure'}, {status: 'in_progress'}, {workflowPath: '.github/workflows/other.yml'},
    {runUrl: 'https://github.com/another/repo/actions/runs/1234'}, {headSha: ''}, {completedAt: '2026-10-27T17:00:00Z'}]) {
    const input = fixture(); Object.assign(input.release, patch);
    assert.throws(() => planTourSeoFinalization(input));
  }
});

test('changed or missing deployed article cannot inherit prepared review', () => {
  for (const bytes of [undefined, fixture().files[articlePath] + '\nUnreviewed promise.']) {
    const input = fixture(); input.deployedFiles[articlePath] = bytes;
    const plan = planTourSeoFinalization(input);
    assert.equal(plan.confirmed.length, 0); assert.equal(plan.held.length, 1); assert.equal(plan.writes.length, 0);
  }
});

test('changed current article or latest provenance is held, never overwritten', () => {
  for (const mode of ['article', 'provenance']) {
    const input = fixture();
    if (mode === 'article') input.files[articlePath] += '\nNew branch edit.\n';
    else edit(input, provenancePath, doc => {doc.lifecycleReview.facts.scope = 'A different review';});
    const plan = planTourSeoFinalization(input);
    assert.equal(plan.confirmed.length, 0); assert.equal(plan.writes.length, 0);
  }
});

test('missing voice proof, stale fact hash and broken draft lineage all block the target', () => {
  for (const mutate of [doc => {delete doc.lifecycleReview.voice;},
    doc => {doc.lifecycleReview.facts.articleBlobSha = 'd'.repeat(40);},
    doc => {doc.lifecycleReview.voice.sourceArticleBlobSha = 'e'.repeat(40);},
    doc => {doc.lifecycleReview.voice.checkedAt = '2026-10-26T14:00:00Z';}]) {
    const input = fixture(); edit(input, provenancePath, mutate, true);
    const plan = planTourSeoFinalization(input);
    assert.equal(plan.confirmed.length, 0); assert.equal(plan.writes.length, 0);
  }
});

test('source snapshot, exact QA result, manifest immutability and duplicate targets are enforced', () => {
  const source = fixture(); source.deployedFiles[sourcePath] = 'different Word';
  assert.equal(planTourSeoFinalization(source).held.length, 1);
  const qa = fixture(); edit(qa, reviewPath, doc => {doc.independentQa.results[0].checks.renderedHtmlValid = false;}, true);
  assert.equal(planTourSeoFinalization(qa).held.length, 1);
  const manifest = fixture(); manifest.files[reviewPath] += '\n';
  assert.throws(() => planTourSeoFinalization(manifest), /manifest changed/);
  const duplicate = fixture(); edit(duplicate, reviewPath, doc => {doc.newArticles.push(clone(doc.newArticles[0]));}, true);
  assert.throws(() => planTourSeoFinalization(duplicate), /duplicate/);
});

test('existing specialist claims and unavailable pages remain held without claim mutation', () => {
  for (const kind of ['facts', 'voice', 'bootstrap', 'unavailable']) {
    const input = fixture();
    if (kind === 'unavailable') edit(input, phasePath, doc => {doc.entries[0].availability = 'temporarily_unavailable';});
    else edit(input, kind === 'voice' ? rewriteClaimsPath : claimsPath,
      doc => {doc.claims[kind === 'bootstrap' ? '__bootstrap__' : url] = {owner: 'another writer', expiresAt: '2026-10-27T00:00:00Z'};});
    const before = clone(input), plan = planTourSeoFinalization(input);
    assert.equal(plan.confirmed.length, 0); assert.equal(plan.writes.length, 0); assert.deepEqual(input, before);
  }
});

test('an identical successful receipt is idempotent for new and targeted revisions', () => {
  for (const existing of [false, true]) {
    const input = fixture(existing), first = planTourSeoFinalization(input);
    const second = planTourSeoFinalization(apply(input, first));
    assert.equal(second.confirmed.length, 1); assert.deepEqual(second.held, []); assert.deepEqual(second.writes, []);
  }
});

test('staging mirror preserves claims, articles, provenance and unrelated editorial fields', () => {
  const input = fixture(), publication = planTourSeoFinalization(input), files = clone(input.files);
  const phase = JSON.parse(files[phasePath]); phase.entries[0].work = 'queued'; phase.entries[0].notes = 'manager note';
  files[phasePath] = json(phase); delete files[articlePath]; delete files[provenancePath];
  const before = clone(files), plan = planTourSeoPublicationMirror({files, publication});
  assert.deepEqual(plan.confirmed, [url]); assert.deepEqual(plan.held, []);
  assert.deepEqual(plan.writes.map(write => write.path), [phasePath]);
  assert.equal(JSON.parse(plan.writes[0].content).entries[0].notes, 'manager note'); assert.deepEqual(files, before);
});

test('staging different prepared revision or another writer claim cannot be finalized', () => {
  for (const mode of ['prepared', 'claim']) {
    const input = fixture(), publication = planTourSeoFinalization(input), files = clone(input.files);
    const phase = JSON.parse(files[phasePath]); phase.entries[0].work = 'prepared'; files[phasePath] = json(phase);
    if (mode === 'claim') files[claimsPath] = json({claims: {[url]: {owner: 'another writer'}}});
    // Even byte-identical article is insufficient to steal an unrelated prepared job.
    const plan = planTourSeoPublicationMirror({files, publication});
    assert.equal(plan.confirmed.length, 0); assert.equal(plan.held.length, 1); assert.equal(plan.writes.length, 0);
  }
});

test('staging keeps its real historical first publication while mirroring current review', () => {
  const input = fixture(true), publication = planTourSeoFinalization(input), files = clone(input.files);
  const phase = JSON.parse(files[phasePath]); phase.entries[0].publishedAt = '2026-10-14'; files[phasePath] = json(phase);
  const plan = planTourSeoPublicationMirror({files, publication});
  assert.equal(JSON.parse(plan.writes[0].content).entries[0].publishedAt, '2026-10-14');
  assert.equal(JSON.parse(plan.writes[0].content).entries[0].currentArticleReview.articleBlobSha, seoFileHashes(files[articlePath]).blobSha);
});

test('an old mirror cannot replace a newer recorded staging publication', () => {
  const input = fixture(true), publication = planTourSeoFinalization(input), files = clone(input.files);
  const phase = JSON.parse(files[phasePath]);
  phase.entries[0].currentArticleReview = {deployedAt: '2026-10-27T12:00:00Z', articleBlobSha: 'f'.repeat(40)};
  files[phasePath] = json(phase);
  const plan = planTourSeoPublicationMirror({files, publication});
  assert.equal(plan.confirmed.length, 0); assert.equal(plan.held.length, 1); assert.equal(plan.writes.length, 0);
});

test('old successful receipt cannot downgrade newer main publication even when article bytes are identical', () => {
  for (const existing of [false, true]) {
    const input = fixture(existing);
    edit(input, phasePath, doc => {doc.entries[0].currentArticleReview = {
      deployedAt: '2026-10-27T12:00:00Z', articleBlobSha: seoFileHashes(input.files[articlePath]).blobSha,
    };});
    const before = clone(input), plan = planTourSeoFinalization(input);
    assert.equal(plan.confirmed.length, 0); assert.match(plan.held[0].reason, /newer publication/);
    assert.equal(plan.writes.length, 0); assert.deepEqual(input, before);
  }
});
