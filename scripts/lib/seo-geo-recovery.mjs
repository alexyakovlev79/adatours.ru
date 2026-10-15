// Fail-closed recovery for SEO/GEO staging. Pure functions are tested separately.
// This module never edits a completed article, a published row, or another writer's lease.
export const PREFLIGHT_GATE_SINCE = '2026-10-15T06:44:17.000Z';
export const SEO_PHASE_FILES = [
  '01-countries.json', '02-interests.json', '03-country-interest.json',
  '04-country-interest-vip.json', '05-tours.json', '06-places.json', '07-excursions.json',
].map((name) => 'data/seo-geo/registry/' + name);

const fullSha = (value) => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);

export function isUnprovedPrepared(row) {
  return row?.work === 'prepared'
    && typeof row.preparedAt === 'string'
    && row.preparedAt >= PREFLIGHT_GATE_SINCE
    && (!fullSha(row.preflightCommit) || !fullSha(row.preflightArticleBlobSha));
}

export function collectRecoveryCandidates(phase, { mode, observed = null, changedArticles = new Set() }) {
  const previous = new Map((observed?.entries ?? []).map((row) => [row.url, row]));
  return phase.entries.filter((row) => {
    if (row.work !== 'prepared') return false;
    if (mode === 'scan') return isUnprovedPrepared(row);
    const old = previous.get(row.url);
    // A failed preflight may roll back only an actual newly-prepared transition
    // or an article explicitly changed by the failed commit.
    return (old?.work !== 'prepared' || changedArticles.has(row.articlePath))
      && row.preparedAt >= PREFLIGHT_GATE_SINCE;
  }).map((row) => ({ url: row.url, preparedAt: row.preparedAt, articlePath: row.articlePath }));
}

export function applySeoRecovery(phase, claims, candidates, {
  now, failedCommit = null, runUrl = null, errors = new Map(), previousClaims = {},
  hasSameArticle = () => true,
} = {}) {
  if (!Array.isArray(phase.entries) || !claims || typeof claims.claims !== 'object') {
    throw new Error('Invalid SEO/GEO registry or claims');
  }
  const matches = new Map(candidates.map((candidate) => [candidate.url, candidate]));
  const recovered = [];
  const notes = [];
  let restoredLeases = 0;
  for (const row of phase.entries) {
    const candidate = matches.get(row.url);
    if (!candidate || !hasSameArticle(candidate)) continue;
    // A subsequent author/CI action may have corrected or published this row.
    if (row.preparedAt !== candidate.preparedAt || row.work !== 'prepared') continue;
    const cause = errors.get(row.articlePath) || errors.get(row.url)
      || (failedCommit ? 'Неуспешная SEO/GEO preflight-проверка'
        : 'prepared без подтвержденных preflight SHA');
    row.work = 'draft';
    delete row.preparedAt;
    delete row.preflightCommit;
    delete row.preflightArticleBlobSha;
    row.preflightFailure = {
      at: now, reason: String(cause).slice(0, 700),
      ...(failedCommit ? { commit: failedCommit } : {}),
      ...(runUrl ? { runUrl } : {}),
    };
    const oldLease = previousClaims[row.url];
    if (!claims.claims[row.url] && oldLease && oldLease.expiresAt > now
        && oldLease.ownerId && oldLease.batchId) {
      claims.claims[row.url] = oldLease; // Preserve its original 60-minute expiry.
      restoredLeases++;
      delete row.recoveryEligibleAt;
    } else if (!claims.claims[row.url]) {
      row.recoveryEligibleAt = now;
    }
    recovered.push(row.url);
  }
  for (const row of phase.entries) {
    // For article-only failures, retain the author's active claim and draft.
    // Never clear a successful proof, change a published row or invent a lease.
    if (row.work !== 'draft') continue;
    const c = candidates.find((candidate) => candidate.url === row.url && candidate.draftFailure);
    if (!c || !hasSameArticle(c)) continue;
    row.preflightFailure = {
      at: now, reason: String(errors.get(row.articlePath) || 'SEO/GEO preflight failed').slice(0, 700),
      ...(failedCommit ? { commit: failedCommit } : {}),
      ...(runUrl ? { runUrl } : {}),
    };
    if (!claims.claims[row.url]) row.recoveryEligibleAt = now;
    notes.push(row.url);
  }
  return { recovered, annotatedDrafts: notes, restoredLeases };
}
