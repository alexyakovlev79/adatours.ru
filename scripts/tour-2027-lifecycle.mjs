/** Portable evidence contract for the existing daily Word queue. No network or writes.
 * This validates consistency of recorded evidence, not physical execution or truth of claims.
 * Import in Node, or evaluate after removing `export ` in Work Code Mode.
 */
export const LIFECYCLE_VERSION = '2026-10-26.v2';
export const PREDEPLOY_STAGES = [
  'word_verified', 'relations_ready', 'interests_verified', 'destinations_classified',
  'media_ready', 'mobile_heroes_ready', 'seo_facts_ready', 'seo_voice_ready', 'catalogues_ready',
];
export const FINAL_STAGES = [...PREDEPLOY_STAGES, 'actions_deployed', 'geo_ready', 'sheets_synced'];
const HASH = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && !!value.trim();
const clone = value => JSON.parse(JSON.stringify(value));
const goodTime = value => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && Number.isFinite(Date.parse(value));
const unique = values => Array.isArray(values) && values.every(text) && new Set(values).size === values.length;
const sameSet = (a, b) => unique(a) && unique(b) && a.length === b.length && a.every(x => b.includes(x));
const completed = status => ['verified', 'verified_unchanged'].includes(status);
const safePath = value => text(value) && !value.startsWith('/') && !/[\\:]/.test(value)
  && value.split('/').every(part => part && part !== '.' && part !== '..');
const normalized = value => Array.isArray(value) ? value.map(normalized)
  : record(value) ? Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => [k, normalized(value[k])])) : value;
const canonical = value => JSON.stringify(normalized(value));
const runUrl = value => /^https:\/\/github\.com\/alexyakovlev79\/adatours\.ru\/actions\/runs\/\d+$/.test(value || '');
const registryPath = 'src/data/interest-registry.json';
const taxonomyPath = 'src/lib/destination-taxonomy.mjs';
const enhancementsPath = 'src/data/media/photo-enhancements.json';
const uploadsPath = 'src/data/media/direct-s3-uploads.json';
const dependants = {
  word_verified: ['relations_ready', 'interests_verified', 'destinations_classified', 'media_ready', 'seo_facts_ready', 'catalogues_ready'],
  relations_ready: ['interests_verified', 'destinations_classified', 'seo_facts_ready', 'catalogues_ready'],
  interests_verified: ['seo_facts_ready', 'catalogues_ready'],
  destinations_classified: ['catalogues_ready', 'actions_deployed'],
  media_ready: ['mobile_heroes_ready', 'actions_deployed'],
  mobile_heroes_ready: ['actions_deployed'],
  seo_facts_ready: ['seo_voice_ready', 'actions_deployed'],
  seo_voice_ready: ['actions_deployed'],
  catalogues_ready: ['actions_deployed'],
  actions_deployed: ['geo_ready', 'sheets_synced'],
  geo_ready: ['sheets_synced'], sheets_synced: [],
};
const prerequisites = stage => stage === 'seo_voice_ready' ? ['seo_facts_ready']
  : stage === 'mobile_heroes_ready' ? ['media_ready']
  : stage === 'actions_deployed' ? PREDEPLOY_STAGES
  : stage === 'geo_ready' ? ['actions_deployed']
  : stage === 'sheets_synced' ? ['actions_deployed', 'geo_ready'] : [];
const scopedHashes = lifecycle => Object.fromEntries(lifecycle.scope.files.map(row => [row.path, row.sha256]));
const deploymentHashes = lifecycle => Object.fromEntries(lifecycle.scope.files
  .filter(row => row.phase !== 'postdeploy').map(row => [row.path, row.sha256]));

function shapeErrors(lifecycle) {
  const errors = [], fail = message => errors.push('contract: ' + message);
  if (!record(lifecycle) || lifecycle.version !== LIFECYCLE_VERSION) return ['Missing current lifecycle contract'];
  const { source, scope } = lifecycle;
  if (!text(lifecycle.programKey) || !text(lifecycle.tourId) || !record(source)
    || !text(source.driveFileId) || !HASH.test(source.textSha256 || '')
    || !HASH.test(source.embeddedMediaSha256 || '') || !HASH.test(source.fingerprint || '')
    || !goodTime(lifecycle.createdAt) || !goodTime(lifecycle.updatedAt)
    || !record(lifecycle.stages)) fail('Verified source identity, hashes and timestamps required');
  if (!record(scope) || !HASH.test(scope.fingerprint || '') || !Array.isArray(scope.files)
    || !scope.files.length || !unique(scope.files.map(row => row?.path))
    || scope.files.some(row => !record(row) || !safePath(row.path) || !HASH.test(row.sha256 || '')
      || ![undefined, 'predeploy', 'postdeploy'].includes(row.phase)
      || row.phase === 'postdeploy' && !/^data\/geo-knowledge\/entities\/[a-zA-Z0-9_-]+\.json$/.test(row.path))
    || !record(scope.targets)) return [...errors, 'contract: Exact scoped file hashes and target lists required'];
  for (const stage of FINAL_STAGES) if (!unique(scope.targets[stage])) fail('Missing unique target list: ' + stage);
  if (errors.length) return errors;
  const targets = scope.targets, hashes = scopedHashes(lifecycle);
  if (!unique(scope.unresolvedEntityIds)) fail('Explicit unresolvedEntityIds list required');
  for (const stage of ['relations_ready', 'interests_verified', 'destinations_classified', 'geo_ready'])
    if (targets[stage].some(id => !/^[a-zA-Z0-9_-]+$/.test(id))) fail('Invalid stable entity ID in ' + stage);
  if (!targets.relations_ready.includes(lifecycle.tourId) || !targets.interests_verified.includes(lifecycle.tourId)
    || !targets.geo_ready.includes(lifecycle.tourId) || !sameSet(targets.word_verified, [source.driveFileId])
    || targets.actions_deployed.length !== 1 || !targets.sheets_synced.length)
    fail('Source, Tour relations/interests/GEO, one production deploy and table targets are mandatory');
  if (!sameSet(targets.seo_facts_ready, targets.seo_voice_ready)) fail('SEO fact and voice target sets differ');
  for (const id of targets.relations_ready) {
    if (!targets.interests_verified.includes(id) || !targets.geo_ready.includes(id)) fail('Entity missing interests/GEO coverage: ' + id);
    if (!safePath(scope.entityPaths?.[id]) || !hashes[scope.entityPaths[id]]) fail('Entity path is not scoped: ' + id);
  }
  if (!unique(scope.interestIds) || !scope.interestIds.length || !hashes[registryPath]) fail('Current interest registry snapshot required');
  if (targets.destinations_classified.length && (!unique(scope.taxonomyTypes) || !scope.taxonomyTypes.length || !hashes[taxonomyPath]))
    fail('Current destination taxonomy snapshot required');
  if (!record(scope.assetHashes) || Object.entries(scope.assetHashes).some(([path, hash]) => !text(path) || !HASH.test(hash)))
    fail('Asset hash inventory required');
  for (const asset of targets.media_ready) if (!HASH.test(scope.assetHashes?.[asset] || '')) fail('Unscoped image: ' + asset);
  if (targets.media_ready.length && !hashes[enhancementsPath]) fail('GPT Image registry snapshot required');
  for (const usage of targets.mobile_heroes_ready) if (!text(scope.heroSources?.[usage])
    || !HASH.test(scope.assetHashes?.[scope.heroSources[usage]] || '')) fail('Unscoped hero source: ' + usage);
  for (const url of targets.seo_facts_ready) if (!safePath(scope.articlePaths?.[url]) || !hashes[scope.articlePaths[url]])
    fail('SEO article path is not scoped: ' + url);
  for (const id of targets.catalogues_ready) if (!safePath(scope.cataloguePaths?.[id]) || !hashes[scope.cataloguePaths[id]])
    fail('Catalogue path is not scoped: ' + id);
  for (const id of targets.geo_ready) if (!HASH.test(scope.geoSourceFingerprints?.[id] || ''))
    fail('Current GEO source fingerprint required: ' + id);
  for (const target of targets.sheets_synced) {
    const item = scope.sheetTargets?.[target];
    if (!record(item) || !text(item.spreadsheetId) || !text(item.sheetName) || !text(item.key)) fail('Sheet identity snapshot required: ' + target);
  }
  const submissions = Object.values(lifecycle.stages).map(row => row?.submissionId).filter(text);
  if (!unique(submissions)) fail('Submission ID occurs in multiple stages');
  return errors;
}

export function createLifecycle({ programKey, tourId, source, scope, now }) {
  const lifecycle = { version: LIFECYCLE_VERSION, programKey, tourId, source, scope,
    createdAt: now, updatedAt: now, stages: {}, status: 'in_progress' };
  const errors = shapeErrors(lifecycle);
  if (errors.length) throw Error(errors.join('\n'));
  return clone(lifecycle);
}

/** Every stage is bound to this exact source, target set and immutable dependency snapshot. */
export function stageErrors(lifecycle, stage, receipt) {
  const malformed = shapeErrors(lifecycle);
  if (malformed.length) return malformed;
  const errors = [], fail = message => errors.push(stage + ': ' + message);
  if (!FINAL_STAGES.includes(stage)) return ['Unknown lifecycle stage: ' + stage];
  if (!record(receipt) || !completed(receipt.status)) return [stage + ': not verified'];
  if (!text(receipt.submissionId)) fail('stable submissionId required');
  if (!goodTime(receipt.checkedAt) || Date.parse(receipt.checkedAt) < Date.parse(lifecycle.createdAt)) fail('real checkedAt after creation required');
  if (receipt.sourceFingerprint !== lifecycle.source.fingerprint) fail('source revision changed');
  if (receipt.scopeFingerprint !== lifecycle.scope.fingerprint) fail('dependency snapshot changed');
  if (!sameSet(receipt.targets, lifecycle.scope.targets[stage])) fail('missing or unexpected targets');
  if (!text(receipt.note)) fail('specific verification note required');
  if (!Array.isArray(receipt.evidence) || !receipt.evidence.length || receipt.evidence.some(row => !record(row)))
    return [...errors, stage + ': structured evidence required, status alone is not proof'];
  const ev = receipt.evidence, hashes = scopedHashes(lifecycle), scope = lifecycle.scope;
  const rows = kind => ev.filter(row => row.kind === kind);
  const covers = (kind, key, predicate = () => true) => {
    const candidates = rows(kind);
    if (!unique(candidates.map(row => row[key]))) fail('duplicate or malformed ' + kind + ' identities');
    for (const row of candidates) if (!scope.targets[stage].includes(row[key])) fail('unexpected ' + kind + ' target');
    const found = candidates.filter(row => scope.targets[stage].includes(row[key]) && predicate(row)).map(row => row[key]);
    for (const target of scope.targets[stage]) if (!found.includes(target)) fail('no valid ' + kind + ' for ' + target);
  };
  const fileMatches = (row, path, hashKey = 'sha256') => row.filePath === path && hashes[path] === row[hashKey];
  if (stage === 'word_verified') covers('word_comparison', 'driveFileId', row =>
    row.textSha256 === lifecycle.source.textSha256 && row.embeddedMediaSha256 === lifecycle.source.embeddedMediaSha256
    && row.fullTextCompared === true && row.tablesCompared === true && row.embeddedMediaCompared === true
    && ['unchanged', 'changed', 'initial_baseline'].includes(row.mediaComparison));
  if (stage === 'relations_ready') covers('relations', 'entityId', row =>
    fileMatches(row, scope.entityPaths[row.entityId], 'entitySha256') && row.mdEntryCatalogEqual === true
    && row.fullProgramReviewed === true && row.excursionReuseReviewed === true
    && Array.isArray(row.missingEntityIds) && row.missingEntityIds.length === 0);
  if (stage === 'interests_verified') covers('interests', 'entityId', row =>
    row.registrySha256 === hashes[registryPath] && unique(row.themeIds) && row.themeIds.every(id => scope.interestIds.includes(id))
    && text(row.rationale) && (row.entityId !== lifecycle.tourId || unique(row.primaryThemeIds)
      && row.primaryThemeIds.length >= 1 && row.primaryThemeIds.length <= 2 && row.primaryThemeIds.every(id => row.themeIds.includes(id))));
  if (stage === 'destinations_classified') covers('destination', 'entityId', row =>
    scope.taxonomyTypes.includes(row.destinationType) && ['hub', 'sight'].includes(row.navigationRole)
    && row.taxonomySha256 === hashes[taxonomyPath] && row.projectionsEqual === true);
  if (stage === 'media_ready') covers('image', 'source', row => row.method === 'gpt-image'
    && text(row.enhancementRecord) && row.sha256 === scope.assetHashes[row.source]
    && (row.storage === 'legacy_git' && hashes['public' + row.source] === row.sha256
      || row.storage === 'direct-s3' && row.receiptVerified === true && !!hashes[uploadsPath]));
  if (stage === 'mobile_heroes_ready') covers('mobile_hero', 'usageKey', row =>
    row.source === scope.heroSources[row.usageKey] && row.sourceSha256 === scope.assetHashes[row.source]
    && row.sourceViewed === true && row.previewsViewed === true && text(row.focusReason)
    && Array.isArray(row.variants) && row.variants.length > 0 && unique(row.variants.map(v => v?.src))
    && row.variants.every(v => record(v) && HASH.test(v.sha256 || '') && scope.assetHashes[v.src] === v.sha256 && v.receiptVerified === true));
  if (stage === 'seo_facts_ready') covers('seo_facts', 'url', row =>
    fileMatches(row, scope.articlePaths[row.url], 'articleSha256') && row.sourceCompared === true && row.linksChecked === true
    && ['updated', 'created', 'verified_unchanged'].includes(row.decision));
  if (stage === 'seo_voice_ready') {
    covers('seo_voice', 'url', row => fileMatches(row, scope.articlePaths[row.url], 'articleSha256') && row.directAdaVoice === true);
    const facts = Array.isArray(lifecycle.stages.seo_facts_ready?.evidence) ? lifecycle.stages.seo_facts_ready.evidence : [];
    for (const row of rows('seo_voice')) {
      const prior = facts.find(x => x?.kind === 'seo_facts' && x.url === row.url);
      if (!prior || prior.articleSha256 !== row.articleSha256) fail('voice QA is not for the fact-checked final article: ' + row.url);
    }
  }
  if (stage === 'catalogues_ready') covers('catalogue', 'id', row =>
    HASH.test(row.fingerprint || '') && fileMatches(row, scope.cataloguePaths[row.id])
    && row.generatedFromCurrentContent === true && row.seoRegistryPresent === true && row.externalIdentityInventoryPresent === true);
  if (stage === 'actions_deployed') covers('pages_deploy', 'target', row =>
    row.conclusion === 'success' && GIT_SHA.test(row.commit || '') && row.exactFilesVerified === true && runUrl(row.runUrl)
    && record(row.fileHashes) && canonical(row.fileHashes) === canonical(deploymentHashes(lifecycle)));
  if (stage === 'geo_ready') covers('geo_passport', 'entityId', row =>
    row.sourceFingerprint === scope.geoSourceFingerprints[row.entityId] && HASH.test(row.resultHash || '')
    && row.filePath === 'data/geo-knowledge/entities/' + row.entityId + '.json' && HASH.test(row.passportSha256 || '')
    && (!hashes[row.filePath] || hashes[row.filePath] === row.passportSha256)
    && row.publication === 'published_current' && row.stale === false
    && GIT_SHA.test(row.releaseCommit || '') && runUrl(row.runUrl) && row.exactFilesVerified === true);
  if (stage === 'sheets_synced') covers('sheet_readback', 'target', row => {
    const target = scope.sheetTargets[row.target];
    return row.spreadsheetId === target.spreadsheetId && row.sheetName === target.sheetName && row.key === target.key
      && text(row.range) && HASH.test(row.valuesSha256 || '') && row.valuesSha256 === row.writtenValuesSha256
      && row.readBack === true && row.managerFieldsPreserved === true;
  });
  if (!scope.targets[stage].length && !rows('empty_scope').some(row => text(row.reason) && row.scopeFingerprint === scope.fingerprint))
    fail('empty scope needs an explicit scoped explanation');
  for (const prerequisite of prerequisites(stage)) {
    const prior = lifecycle.stages[prerequisite];
    if (!record(prior) || !completed(prior.status) || !goodTime(prior.checkedAt)) fail('missing prerequisite ' + prerequisite);
    else if (Date.parse(receipt.checkedAt) < Date.parse(prior.checkedAt)) fail('receipt predates ' + prerequisite);
  }
  return errors;
}

export function recordStage(lifecycle, stage, receipt) {
  const errors = stageErrors(lifecycle, stage, receipt);
  if (errors.length) throw Error(errors.join('\n'));
  const previous = lifecycle.stages[stage];
  if (previous?.submissionId === receipt.submissionId) {
    if (canonical(previous) !== canonical(receipt)) throw Error('Submission ID reused with different evidence');
    return lifecycle;
  }
  if (Object.entries(lifecycle.stages).some(([key, row]) => key !== stage && row.submissionId === receipt.submissionId))
    throw Error('Submission ID already belongs to another stage');
  for (const prerequisite of prerequisites(stage)) {
    const priorErrors = stageErrors(lifecycle, prerequisite, lifecycle.stages[prerequisite]);
    if (priorErrors.length) throw Error('Invalid prerequisite:\n' + priorErrors.join('\n'));
  }
  const pending = [...dependants[stage]], removed = new Set();
  while (pending.length) {
    const next = pending.pop();
    if (removed.has(next)) continue;
    removed.add(next); pending.push(...dependants[next]);
  }
  for (const next of removed) delete lifecycle.stages[next];
  lifecycle.stages[stage] = clone(receipt);
  lifecycle.updatedAt = receipt.checkedAt;
  lifecycle.status = verifyLifecycle(lifecycle).ok ? 'complete' : 'in_progress';
  return lifecycle;
}

export function verifyLifecycle(lifecycle, { phase = 'final', currentFiles } = {}) {
  const errors = shapeErrors(lifecycle);
  if (!['predeploy', 'final'].includes(phase)) errors.push('Unknown lifecycle verification phase');
  if (errors.length) return { ok: false, phase, errors, verifiedStages: 0 };
  const stages = phase === 'predeploy' ? PREDEPLOY_STAGES : FINAL_STAGES;
  let verifiedStages = 0;
  for (const stage of stages) {
    const stageProblems = stageErrors(lifecycle, stage, lifecycle.stages[stage]);
    if (!stageProblems.length) verifiedStages++;
    errors.push(...stageProblems);
  }
  if (phase === 'final' && lifecycle.scope.unresolvedEntityIds.length)
    errors.push('Unresolved required entities: ' + lifecycle.scope.unresolvedEntityIds.join(', '));
  if (currentFiles !== undefined) {
    if (!record(currentFiles)) errors.push('Current file hash map is malformed');
    else {
      for (const row of lifecycle.scope.files.filter(row => phase === 'final' || row.phase !== 'postdeploy'))
        if (currentFiles[row.path] !== row.sha256) errors.push('Scoped file changed or disappeared: ' + row.path);
      if (phase === 'final' && Array.isArray(lifecycle.stages.geo_ready?.evidence))
        for (const row of lifecycle.stages.geo_ready.evidence.filter(row => row?.kind === 'geo_passport'))
          if (currentFiles[row.filePath] !== row.passportSha256) errors.push('Published GEO file changed or disappeared: ' + row.filePath);
    }
  }
  return { ok: errors.length === 0, phase, errors, verifiedStages };
}

/** Exact pre-policy completions can be allowlisted; history is never upgraded or rewritten. */
export function validateDailyState(state, { readLifecycle, currentFilesFor } = {}) {
  const errors = [], policy = state?.lifecyclePolicy;
  if (!record(state) || !record(policy) || policy.version !== LIFECYCLE_VERSION || !goodTime(policy.enforcedFrom))
    return { ok: false, errors: ['Missing active daily lifecycle policy'] };
  if (![state.openQueue, state.completedQueue, policy.historicalCompletions || []].every(Array.isArray))
    return { ok: false, errors: ['Daily queues and historical completion allowlist must be arrays'] };
  const cutoff = Date.parse(policy.enforcedFrom), paths = new Set(), identities = new Set(), openDriveIds = new Set(), completionKeys = new Set();
  const historicalKey = row => JSON.stringify([row.programKey, row.driveFileId, row.tourId, row.completedAt]);
  const historical = new Set();
  for (const row of policy.historicalCompletions || []) {
    if (!record(row) || !text(row.programKey) || !text(row.driveFileId) || !text(row.tourId)
      || !goodTime(row.completedAt) || Date.parse(row.completedAt) >= cutoff || historical.has(historicalKey(row)))
      errors.push('Malformed or duplicate historical completion allowlist entry');
    else historical.add(historicalKey(row));
  }
  for (const [queue, entries] of [['openQueue', state.openQueue], ['completedQueue', state.completedQueue]]) {
    for (const entry of entries) {
      if (!record(entry)) { errors.push('Malformed daily queue entry'); continue; }
      const label = entry.programKey || entry.driveFileId || queue;
      const done = queue === 'completedQueue' || ['done', 'complete', 'completed'].includes(String(entry.status || '').toLowerCase())
        || ['done', 'deployed_and_sheets_synced', 'sheets_synced'].includes(entry.stage);
      if (done && !goodTime(entry.completedAt)) errors.push(label + ': completion requires a real completedAt');
      if (queue === 'openQueue' && text(entry.driveFileId)) {
        if (openDriveIds.has(entry.driveFileId)) errors.push('Duplicate Drive file in open queue: ' + entry.driveFileId);
        openDriveIds.add(entry.driveFileId);
      }
      if (done) {
        if (completionKeys.has(historicalKey(entry))) errors.push('Duplicate completion identity: ' + label);
        completionKeys.add(historicalKey(entry));
      }
      const reference = entry.lifecyclePath;
      if (!reference) {
        if (done && !historical.has(historicalKey(entry))) errors.push(label + ': completion has no v2 receipt or exact historical approval');
        continue;
      }
      if (!/^data\/audits\/tour-lifecycle\/[a-zA-Z0-9_-]+\.json$/.test(reference)) { errors.push('Unsafe lifecycle path'); continue; }
      if (paths.has(reference)) { errors.push('Lifecycle occurs twice in daily queue: ' + reference); continue; }
      paths.add(reference);
      let receipt;
      try { receipt = readLifecycle(reference); } catch { errors.push('Missing lifecycle file: ' + reference); continue; }
      const malformed = shapeErrors(receipt);
      if (malformed.length) { errors.push(...malformed.map(error => reference + ': ' + error)); continue; }
      if (receipt.programKey !== entry.programKey || receipt.source.driveFileId !== entry.driveFileId || receipt.tourId !== entry.tourId)
        errors.push('Daily queue identity mismatch: ' + reference);
      if (entry.readableTextSha256 !== receipt.source.textSha256
        || entry.sourceFingerprint !== undefined && entry.sourceFingerprint !== receipt.source.fingerprint)
        errors.push('Daily queue source hash mismatch: ' + reference);
      for (const identity of ['program:' + receipt.programKey + ':' + receipt.tourId + ':' + receipt.source.fingerprint,
        'drive:' + receipt.source.driveFileId + ':' + receipt.source.fingerprint]) {
        if (identities.has(identity)) errors.push('Duplicate source revision in daily queue: ' + identity);
        identities.add(identity);
      }
      if (done && goodTime(entry.completedAt) && Date.parse(entry.completedAt) < Date.parse(receipt.stages.sheets_synced?.checkedAt || receipt.createdAt))
        errors.push(label + ': completedAt predates final evidence');
      if (done || ['content_committed', 'actions_deployed', 'geo_ready', 'sheets_synced'].includes(entry.stage)) {
        // An old completed release may legitimately be superseded. Only open publication
        // or finalization must match today's filesystem; immutable history remains valid.
        let currentFiles;
        try { if (queue === 'openQueue') currentFiles = currentFilesFor?.(receipt); }
        catch { errors.push('Could not read current scoped files: ' + reference); continue; }
        const phase = done ? 'final' : 'predeploy';
        const result = verifyLifecycle(receipt, { phase, currentFiles });
        errors.push(...result.errors.map(error => reference + ': ' + error));
        if (!done && ['actions_deployed', 'geo_ready'].includes(entry.stage))
          errors.push(...stageErrors(receipt, 'actions_deployed', receipt.stages.actions_deployed).map(error => reference + ': ' + error));
        if (!done && entry.stage === 'geo_ready')
          errors.push(...stageErrors(receipt, 'geo_ready', receipt.stages.geo_ready).map(error => reference + ': ' + error));
      }
    }
  }
  return { ok: errors.length === 0, errors, receiptsChecked: paths.size };
}
