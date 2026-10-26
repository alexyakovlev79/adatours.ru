#!/usr/bin/env node
/**
 * Metadata-only planner for reviewed SEO included in a normal content release.
 * This module does no network I/O, publication, claim mutation, or file writes.
 * The caller must fetch the real deploy result and immutable release files, then
 * apply returned writes to a fresh branch with compare-and-swap. A supplied
 * receipt is evidence to validate, not independent proof of physical execution.
 */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {PHASE_FILES, articlePath, parseArticle} from '../src/lib/seo-geo-voice-rewrite.mjs';

const PREFIX = 'data/seo-geo/registry/';
const CLAIMS = ['data/seo-geo/claims.json', 'data/seo-geo/voice-rewrite/claims.json'];
const REPO = 'alexyakovlev79/adatours.ru';
const clone = value => JSON.parse(JSON.stringify(value));
const json = value => JSON.stringify(value, null, 2) + '\n';
const assert = (condition, message) => { if (!condition) throw Error('Tour SEO finalization: ' + message); };
const iso = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));

export function seoFileHashes(text) {
  assert(typeof text === 'string', 'file bytes missing');
  const bytes = Buffer.from(text, 'utf8');
  return {
    sha256: createHash('sha256').update(bytes).digest('hex'),
    blobSha: createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex'),
  };
}

export function publicationDateMoscow(timestamp) {
  assert(iso(timestamp), 'invalid publication timestamp');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function readJson(files, path) {
  assert(typeof files?.[path] === 'string', 'missing fresh file ' + path);
  return JSON.parse(files[path]);
}
function verifyRelease(release) {
  assert(release?.repository === REPO && release.workflowPath === '.github/workflows/deploy.yml', 'wrong deploy repository/workflow');
  assert(release.status === 'completed' && release.conclusion === 'success', 'successful completed Pages run required');
  assert(/^[a-f0-9]{40}$/.test(release.headSha || '') && /^\d+$/.test(String(release.runId || '')), 'exact deploy SHA/run required');
  assert(release.runUrl === `https://github.com/${REPO}/actions/runs/${release.runId}`, 'run URL mismatch');
  assert(iso(release.completedAt) && iso(release.observedAt) && Date.parse(release.completedAt) <= Date.parse(release.observedAt), 'invalid deployment timestamps');
}
function beforeRelease(time, release) {
  assert(iso(time) && Date.parse(time) <= Date.parse(release.completedAt), 'review must precede deployment');
}
function branchState(files) {
  const documents = new Map(), rows = new Map();
  for (const name of PHASE_FILES) {
    const path = PREFIX + name, phase = readJson(files, path);
    assert(Array.isArray(phase.entries), 'invalid phase ' + path);
    documents.set(path, phase);
    for (const row of phase.entries) {
      assert(!rows.has(row.url), 'duplicate canonical registry URL ' + row.url);
      rows.set(row.url, row);
    }
  }
  const claims = CLAIMS.map(path => {
    const doc = readJson(files, path);
    assert(doc.claims && typeof doc.claims === 'object' && !Array.isArray(doc.claims), 'invalid claims file ' + path);
    return doc.claims;
  });
  return {documents, rows, claims};
}
function blocked(row, claims) {
  if (!row) return 'canonical registry row missing';
  if (claims.some(doc => doc[row.url] || doc.__bootstrap__)) return 'existing specialist claim; preserve it';
  if (['archived', 'temporarily_unavailable', 'missing'].includes(row.work) ||
      ['archived', 'temporarily_unavailable', 'missing'].includes(row.availability)) return 'URL is unavailable';
  return null;
}
function fileWrites(files, documents) {
  return [...documents].flatMap(([path, value]) => {
    if (JSON.stringify(JSON.parse(files[path])) === JSON.stringify(value)) return [];
    const content = json(value);
    return content === files[path] ? [] : [{path, baseBlobSha: seoFileHashes(files[path]).blobSha, content}];
  });
}
function checkHash(actual, expected, label) {
  assert(actual.sha256 === expected.articleSha256 && actual.blobSha === expected.articleBlobSha, label + ' article hash mismatch');
}
function verifyReview(item, provenance, qa, actual, release, deployedFiles, isNew) {
  checkHash(actual, item, 'manifest');
  assert(qa?.targetPath && qa.articlePath === item.articlePath && qa.sha256 === actual.sha256 && qa.blobSha === actual.blobSha, 'independent QA hash mismatch');
  for (const key of ['manifestSha256', 'manifestBlobSha', 'canonicalFile', 'canonicalRegistry', 'allLinksCanonical', 'productionTemplatesResolved', 'renderedHtmlValid']) {
    assert(qa.checks?.[key] === true, 'independent QA missing ' + key);
  }
  let sourcePath, sourceHash, evidence;
  if (isNew) {
    const facts = provenance.lifecycleReview?.facts, voice = provenance.lifecycleReview?.voice;
    checkHash(actual, facts || {}, 'facts'); checkHash(actual, voice || {}, 'voice');
    assert(facts.sourceCompared && facts.linksChecked && facts.factsPreservedByVoiceGate, 'incomplete fact review');
    assert(voice.directAdaVoice && voice.allParagraphsAndLeadReviewed && voice.structureAndFactTokensPreserved, 'incomplete voice review');
    assert(/^[a-f0-9]{64}$/.test(facts.factDraftSha256 || '') && /^[a-f0-9]{40}$/.test(facts.factDraftBlobSha || '') &&
      voice.sourceArticleSha256 === facts.factDraftSha256 && voice.sourceArticleBlobSha === facts.factDraftBlobSha, 'facts/voice draft lineage mismatch');
    beforeRelease(facts.checkedAt, release); beforeRelease(voice.checkedAt, release);
    assert(Date.parse(facts.checkedAt) <= Date.parse(voice.checkedAt), 'voice precedes fact review');
    assert(qa.checks.currentFactHash === true && qa.checks.currentVoiceHash === true, 'current full review missing');
    sourcePath = provenance.primaryWord?.snapshotPath; sourceHash = provenance.primaryWord?.snapshotSha256;
    evidence = {scope: 'full_facts_and_voice', factsCheckedAt: facts.checkedAt, voiceCheckedAt: voice.checkedAt,
      factScope: facts.scope, sourceBlobSha: voice.sourceArticleBlobSha, changedLines: voice.changedLines};
  } else {
    const revision = provenance.sourceRevisions?.at(-1);
    checkHash(actual, revision || {}, 'latest source revision');
    assert(revision.sourceCompared === true && revision.scope && revision.voiceReview, 'targeted source/voice review missing');
    beforeRelease(revision.preparedAt, release);
    sourcePath = revision.sourceSnapshotPath; sourceHash = revision.sourceSnapshotSha256;
    evidence = {scope: 'targeted_word_revision', factsCheckedAt: revision.preparedAt, voiceCheckedAt: revision.preparedAt,
      factScope: revision.scope, voiceReview: revision.voiceReview, previousArticleBlobSha: revision.previousArticleBlobSha};
  }
  assert(sourcePath && /^[a-f0-9]{64}$/.test(sourceHash || '') && seoFileHashes(deployedFiles[sourcePath]).sha256 === sourceHash, 'deployed Word snapshot mismatch');
  return {...evidence, sourceSnapshotPath: sourcePath, sourceSnapshotSha256: sourceHash};
}

/** files = fresh main files; deployedFiles = bytes fetched at release.headSha. */
export function planTourSeoFinalization({files, deployedFiles, reviewPath, release}) {
  verifyRelease(release);
  const publicationDate = publicationDateMoscow(release.completedAt);
  const review = readJson(deployedFiles, reviewPath);
  assert(files[reviewPath] === deployedFiles[reviewPath], 'review manifest changed after deployment');
  assert(review.independentQa?.allChecksPass === true, 'independent QA incomplete');
  beforeRelease(review.reviewedAt, release); beforeRelease(review.independentQa.checkedAt, release);
  assert(Array.isArray(review.newArticles) && Array.isArray(review.correctedArticles), 'explicit new/corrected manifest required');
  const items = [...review.newArticles.map(row => ({...row, isNew: true})), ...review.correctedArticles.map(row => ({...row, isNew: false}))];
  assert(items.length > 0 && new Set(items.map(item => item.articlePath)).size === items.length, 'empty or duplicate manifest targets');
  const state = branchState(files), confirmed = [], held = [];
  for (const item of items) {
    const qa = review.independentQa.results?.find(result => result.articlePath === item.articlePath);
    const url = item.targetPath || qa?.targetPath;
    try {
      assert(url && item.articlePath === articlePath(url) && item.provenancePath === 'data/seo-geo/provenance' + url + 'index.json', 'canonical article/provenance path mismatch');
      const row = state.rows.get(url), reason = blocked(row, state.claims);
      assert(!reason, reason);
      if (row.currentArticleReview) {
        assert(iso(row.currentArticleReview.deployedAt), 'invalid current publication timestamp');
        assert(Date.parse(row.currentArticleReview.deployedAt) <= Date.parse(release.completedAt), 'newer publication already recorded');
      }
      assert(row.articlePath === item.articlePath && row.provenancePath === item.provenancePath, 'registry artifact paths changed');
      const actual = seoFileHashes(deployedFiles[item.articlePath]);
      const {front} = parseArticle(deployedFiles[item.articlePath]);
      assert(/^status:\s*approved\s*$/m.test(front) && front.split('\n').some(line =>
        line.trim().replace(/["']/g, '') === 'targetPath: ' + url), 'deployed article is not approved at canonical URL');
      checkHash(seoFileHashes(files[item.articlePath]), item, 'current branch');
      const deployedProvenance = readJson(deployedFiles, item.provenancePath);
      const provenance = readJson(files, item.provenancePath);
      const evidence = verifyReview(item, deployedProvenance, qa, actual, release, deployedFiles, item.isNew);
      // A newer branch review must not be overwritten merely because article bytes agree.
      const currentEvidence = verifyReview(item, provenance, qa, actual, release, deployedFiles, item.isNew);
      assert(JSON.stringify(evidence) === JSON.stringify(currentEvidence), 'current provenance review drift');
      const current = {...evidence, articleSha256: actual.sha256, articleBlobSha: actual.blobSha,
        deployedCommit: release.headSha, deployRun: release.runUrl, deployedAt: release.completedAt};
      if (item.isNew) {
        assert(['draft', 'prepared', 'published', 'rewritten'].includes(row.work), 'new article is not prepared');
        row.publishedAt ||= publicationDate;
        row.publishedCommit ||= release.headSha;
        row.deployRun ||= release.runId;
        Object.assign(row, {work: 'rewritten', availability: 'published_current', rewrittenAt: publicationDate,
          rewrittenCommit: release.headSha, rewriteDeployRun: release.runUrl, rewriteSourceBlobSha: evidence.sourceBlobSha,
          rewriteResultBlobSha: actual.blobSha, rewriteChanges: evidence.changedLines});
        provenance.publicationStatus = 'published';
        provenance.publication = {publishedAt: row.publishedAt, commit: release.headSha, deployRun: release.runUrl, completedAt: release.completedAt};
        provenance.lifecycleReview.voice.status = 'complete_published';
      } else {
        assert(['published', 'rewritten'].includes(row.work) && row.publishedAt, 'existing first publication missing');
        // Keep historical rewrite* fields exact; current evidence is explicit and separate.
        Object.assign(provenance.sourceRevisions.at(-1), {status: 'published', publication: {
          completedAt: release.completedAt, commit: release.headSha, deployRun: release.runUrl,
          articleBlobSha: actual.blobSha, articleSha256: actual.sha256}});
      }
      row.currentArticleReview = current;
      state.documents.set(item.provenancePath, provenance);
      confirmed.push({url, articlePath: item.articlePath, provenancePath: item.provenancePath,
        isNew: item.isNew, publishedAt: row.publishedAt, currentArticleReview: current,
        publicationFields: Object.fromEntries(['work', 'availability', 'publishedAt', 'publishedCommit', 'deployRun',
          'rewrittenAt', 'rewrittenCommit', 'rewriteDeployRun', 'rewriteSourceBlobSha', 'rewriteResultBlobSha', 'rewriteChanges',
          'currentArticleReview'].filter(key => row[key] !== undefined).map(key => [key, clone(row[key])]))});
    } catch (error) { held.push({url, reason: error.message}); }
  }
  return {schemaVersion: 1, release: clone(release), confirmed, held, writes: fileWrites(files, state.documents)};
}

/**
 * Mirror known-main publication into freshly fetched SEO staging registry only.
 * Never copy articles/provenance/claims, nor replace another prepared revision.
 */
export function planTourSeoPublicationMirror({files, publication}) {
  verifyRelease(publication.release);
  const state = branchState(files), confirmed = [], held = [];
  for (const item of publication.confirmed) {
    const row = state.rows.get(item.url), reason = blocked(row, state.claims);
    const stagedBytes = files[item.articlePath];
    const sameArticle = typeof stagedBytes === 'string' && seoFileHashes(stagedBytes).blobSha === item.currentArticleReview.articleBlobSha;
    const newerPublication = row?.currentArticleReview && Date.parse(row.currentArticleReview.deployedAt) > Date.parse(publication.release.completedAt);
    if (reason || newerPublication || (['draft', 'prepared', 'in_progress', 'review'].includes(row?.work) &&
        !(sameArticle && row.localReviewStatus === 'facts_and_voice_complete' && row.localArticleBlobSha === item.currentArticleReview.articleBlobSha))) {
      held.push({url: item.url, reason: reason || (newerPublication ? 'newer publication already recorded' : 'different prepared staging revision; preserve it')}); continue;
    }
    // The mirror concerns published main. Older staging bytes are left untouched.
    const firstPublication = Object.fromEntries(['publishedAt', 'publishedCommit', 'deployRun'].filter(key => row[key]).map(key => [key, row[key]]));
    Object.assign(row, clone(item.publicationFields), firstPublication,
      {articlePath: item.articlePath, provenancePath: item.provenancePath});
    confirmed.push(item.url);
  }
  return {confirmed, held, writes: fileWrites(files, state.documents)};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert(process.argv.length === 3, 'usage: node scripts/finalize-tour-seo-review.mjs <fresh-input.json>');
  process.stdout.write(json(planTourSeoFinalization(JSON.parse(readFileSync(process.argv[2], 'utf8')))));
}
