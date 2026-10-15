#!/usr/bin/env node
// Trusted, fail-closed GitHub Actions recovery; preserves article bytes and foreign leases.
import { SEO_PHASE_FILES, collectRecoveryCandidates, applySeoRecovery } from './lib/seo-geo-recovery.mjs';

const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const mode = process.env.RECOVERY_MODE === 'run' ? 'run' : 'scan';
if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository) || !token) {
  throw new Error('Missing GitHub repository or token');
}
const root = 'https://api.github.com/repos/' + repository;
const headers = {
  Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'adatours-seo-recovery',
};
const api = async (path, method = 'GET', payload) => {
  const response = await fetch(root + path, {
    method, headers, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  if (!response.ok) {
    throw new Error(method + ' ' + path + ' HTTP ' + response.status + ': '
      + (await response.text()).slice(0, 350));
  }
  return response.json();
};
const cache = new Map();
async function file(path, sha) {
  if (!/^data\/seo-geo\/(?:registry\/[a-z0-9-]+\.json|claims\.json|articles\/[a-z0-9_/-]+\/index\.md)$/.test(path)) {
    throw new Error('Not an approved recovery path: ' + path);
  }
  const key = sha + '/' + path;
  if (cache.has(key)) return cache.get(key);
  const result = await api('/contents/' + path + '?ref=' + encodeURIComponent(sha));
  let encoded = result.content;
  if (!encoded && result.sha) encoded = (await api('/git/blobs/' + result.sha)).content;
  if (!encoded) throw new Error('Missing file bytes: ' + path);
  const out = { data: Buffer.from(encoded.replace(/\s/g, ''), 'base64').toString('utf8'), sha: result.sha };
  cache.set(key, out);
  return out;
}
const json = async (path, sha) => JSON.parse((await file(path, sha)).data);
const branchSha = async () => (await api('/git/ref/heads/seo-geo/staging')).object.sha;
const claimsPath = 'data/seo-geo/claims.json';

async function failureContext() {
  if (mode !== 'run') return null;
  const id = process.env.FAILED_RUN_ID;
  if (!/^\d+$/.test(id ?? '')) throw new Error('Invalid run ID');
  const run = await api('/actions/runs/' + id);
  if (run.name !== 'SEO/GEO staging link preflight' || run.head_branch !== 'seo-geo/staging'
    || run.head_repository?.full_name !== repository || run.conclusion !== 'failure') {
    return { ignored: true };
  }
  const commit = await api('/commits/' + run.head_sha + '?per_page=100');
  if (!commit.parents?.[0]?.sha) throw new Error('Failure has no parent commit');
  const errors = new Map();
  try {
    const jobs = await api('/actions/runs/' + id + '/jobs?per_page=100');
    const failedJob = jobs.jobs?.find((job) => job.conclusion === 'failure');
    if (failedJob) {
      const response = await fetch(root + '/actions/jobs/' + failedJob.id + '/logs', { headers });
      if (response.ok) {
        for (const line of (await response.text()).split('\n')) {
          const pos = line.indexOf('SEO/GEO preflight: ');
          if (pos === -1) continue;
          const value = line.slice(pos + 'SEO/GEO preflight: '.length).trim().slice(0, 700);
          const match = value.match(/^(data\/seo-geo\/articles\/[a-z0-9_/-]+\/index\.md): (.+)$/);
          if (match) errors.set(match[1], match[2]);
        }
      }
    }
  } catch (error) { console.warn('No detailed CI log: ' + error.message); }
  return {
    head: run.head_sha, parent: commit.parents[0].sha,
    paths: new Set((commit.files ?? []).map((part) => part.filename)),
    errors, url: run.html_url,
  };
}
async function attempt(failure) {
  const sha = await branchSha();
  const oldClaims = await json(claimsPath, sha), claims = structuredClone(oldClaims);
  let priorClaims = {};
  if (failure) {
    try { priorClaims = (await json(claimsPath, failure.parent)).claims ?? {}; } catch {}
  }
  const paths = failure
    ? SEO_PHASE_FILES.filter((path) => failure.paths.has(path))
    : SEO_PHASE_FILES;
  // Article-only commits also get a diagnostic note on their retained draft.
  if (failure && !paths.length && [...failure.paths].some((p) => p.startsWith('data/seo-geo/articles/'))) {
    paths.push(...SEO_PHASE_FILES);
  }
  const updates = [], recovered = [], notes = [];
  for (const path of paths) {
    const original = await file(path, sha), phase = JSON.parse(original.data);
    let old;
    let failed;
    if (failure && failure.paths.has(path)) {
      old = await json(path, failure.parent);
      failed = await json(path, failure.head);
    }
    const source = failed ?? phase;
    const changedArticles = new Set(failure
      ? [...failure.paths].filter((p) => /^data\/seo-geo\/articles\/(?:[a-z0-9_-]+\/)+index\.md$/.test(p))
      : []);
    const candidates = collectRecoveryCandidates(source, {
      mode: failed ? 'run' : 'scan', observed: old, changedArticles,
    }).filter((candidate) => phase.entries.some((row) =>
      row.url === candidate.url && row.work === 'prepared' && row.preparedAt === candidate.preparedAt));
    if (failure) {
      for (const row of phase.entries) {
        if (row.work === 'draft' && changedArticles.has(row.articlePath)) {
          candidates.push({ url: row.url, articlePath: row.articlePath, draftFailure: true });
        }
      }
    }
    if (!candidates.length) continue;
    const same = new Map();
    for (const candidate of candidates) {
      if (!candidate.articlePath || !/^data\/seo-geo\/articles\/(?:[a-z0-9_-]+\/)+index\.md$/.test(candidate.articlePath)) {
        same.set(candidate.url, false);
      } else if (!failure) same.set(candidate.url, true);
      else {
        try {
          const [before, current] = await Promise.all([
            file(candidate.articlePath, failure.head), file(candidate.articlePath, sha),
          ]);
          same.set(candidate.url, before.sha === current.sha);
        } catch { same.set(candidate.url, false); }
      }
    }
    const copy = structuredClone(phase);
    const result = applySeoRecovery(copy, claims, candidates, {
      now: new Date().toISOString(), previousClaims: priorClaims,
      failedCommit: failure?.head, runUrl: failure?.url, errors: failure?.errors,
      hasSameArticle: (candidate) => same.get(candidate.url) === true,
    });
    if (result.recovered.length || result.annotatedDrafts.length) {
      updates.push({ path, contents: JSON.stringify(copy, null, 2) + '\n' });
      recovered.push(...result.recovered);
      notes.push(...result.annotatedDrafts);
    }
  }
  if (JSON.stringify(claims) !== JSON.stringify(oldClaims)) {
    updates.push({ path: claimsPath, contents: JSON.stringify(claims, null, 2) + '\n' });
  }
  if (!updates.length) return { changed: false, recovered, notes };
  const parent = await api('/git/commits/' + sha);
  const entries = [];
  for (const entry of updates) {
    const blob = await api('/git/blobs', 'POST', {
      content: Buffer.from(entry.contents).toString('base64'), encoding: 'base64',
    });
    entries.push({ path: entry.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const tree = await api('/git/trees', 'POST', { base_tree: parent.tree.sha, tree: entries });
  const commit = await api('/git/commits', 'POST', {
    tree: tree.sha, parents: [sha],
    message: 'fix(seo): automatically requeue failed preflight records [skip ci]',
  });
  try {
    await api('/git/refs/heads/seo-geo/staging', 'PATCH', { sha: commit.sha, force: false });
  } catch (error) {
    if (/HTTP (409|422):/.test(error.message)) return { conflict: true };
    throw error;
  }
  return { changed: true, sha: commit.sha, recovered, notes };
}
const failure = await failureContext();
if (failure?.ignored) {
  console.log('Skip unrelated or successful workflow run');
  process.exit(0);
}
for (let i = 0; i < 3; i++) {
  const output = await attempt(failure);
  if (!output.conflict) {
    console.log(JSON.stringify({ mode, ...output }));
    process.exit(0);
  }
  cache.clear(); // Safe retry on latest branch head; no force pushes.
}
throw new Error('Staging moved during all three safe recovery attempts');
