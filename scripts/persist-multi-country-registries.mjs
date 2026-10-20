/** Commit derived inventory and queue metadata after deploy; no editorial writes. */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { reconcileMultiCountryRegistries } from '../src/lib/multi-country-registry.mjs';
import { PHASE_FILES, compactRegistry, readCatalogContent } from './sync-multi-country-registries.mjs';
import { reconcileInterestRegistries } from '../src/lib/interest-registry-projection.mjs';

const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN;
const sourceSha = process.env.CATALOG_SOURCE_SHA ?? process.env.GITHUB_SHA;
if (!repo || !token || !sourceSha) throw new Error('GitHub repository, runtime token and source SHA are required');
const snapshot = JSON.parse(readFileSync('data/catalogues/multi-country.json', 'utf8'));
const interestContent = await readCatalogContent();
const base = 'https://api.github.com/repos/' + repo;
const request = async (path, method = 'GET', body) => {
  const response = await fetch(base + path, { method, headers: {
    Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json',
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.ok) { const error = new Error(method + ' ' + path + ': HTTP ' + response.status); error.status = response.status; throw error; }
  return response.status === 204 ? {} : response.json();
};
const fileAt = async (path, sha) => {
  const result = await request('/contents/' + path + '?ref=' + sha);
  // Contents >1 MB have an empty body; obtain the exact immutable blob instead.
  const blob = result.encoding === 'base64' && result.content ? result : await request('/git/blobs/' + result.sha);
  const text = Buffer.from(blob.content, 'base64').toString('utf8');
  return { text, json: path.endsWith('.json') ? JSON.parse(text) : null, sha: result.sha };
};
const inputsChanged = async (head) => {
  if (head === sourceSha) return false;
  const result = await request('/compare/' + sourceSha + '...' + head);
  if (!['ahead', 'identical'].includes(result.status) || result.files?.length >= 250) return true;
  return result.files.some((file) => /^(?:src\/content\/(?:tours|countries|themes|destinations|excursions)\/|src\/data\/interest-registry\.json|data\/catalog-archive\.json|src\/lib\/multi-country)/.test(file.filename));
};
for (const branch of ['main', 'seo-geo/staging']) {
  let completed = false;
  for (let attempt = 0; attempt < 3 && !completed; attempt++) {
    const head = (await request('/git/ref/heads/' + branch)).object.sha;
    const liveMain = branch === 'main' ? head : (await request('/git/ref/heads/main')).object.sha;
    if (await inputsChanged(liveMain)) {
      console.log(branch + ': source changed after this deploy; the next successful deployment will synchronize it.');
      completed = true; break;
    }
    const sourceFiles = await Promise.all([...PHASE_FILES, 'index.json'].map((name) => fileAt('data/seo-geo/registry/' + name, head)));
    const interests = reconcileInterestRegistries(sourceFiles.slice(0, -1).map((file) => file.json), interestContent);
    const updated = reconcileMultiCountryRegistries(interests, sourceFiles.at(-1).json, snapshot);
    const changes = [];
    for (let i = 0; i < PHASE_FILES.length; i++) if (JSON.stringify(updated.phases[i]) !== JSON.stringify(sourceFiles[i].json))
      changes.push({ path: 'data/seo-geo/registry/' + PHASE_FILES[i], mode: '100644', type: 'blob', content: compactRegistry(updated.phases[i]) });
    if (JSON.stringify(updated.index) !== JSON.stringify(sourceFiles.at(-1).json)) changes.push({ path: 'data/seo-geo/registry/index.json', mode: '100644', type: 'blob', content: JSON.stringify(updated.index, null, 2) + '\n' });
    if (branch === 'main') for (const path of ['data/catalogues/multi-country.json', 'data/external-identity/multi-country-catalogues.json', 'docs/catalogues/multi-country.md']) {
      const local = readFileSync(path, 'utf8');
      let previous;
      try { previous = await fileAt(path, head); } catch (error) { if (error.status !== 404) throw error; }
      if (previous?.text !== local) changes.push({ path, mode: '100644', type: 'blob', content: local });
    }
    if (!changes.length) { console.log(branch + ': already synchronized'); completed = true; break; }
    const commit = await request('/git/commits/' + head);
    const tree = await request('/git/trees', 'POST', { base_tree: commit.tree.sha, tree: changes });
    const next = await request('/git/commits', 'POST', { message: 'chore: reconcile multi-country interest registries [skip ci]', tree: tree.sha, parents: [head] });
    try {
      // A concurrent writer creates a sibling commit, which cannot fast-forward.
      // Refetch all editorial metadata before retrying; never force the ref.
      await request('/git/refs/heads/' + branch, 'PATCH', { sha: next.sha, force: false });
      console.log(branch + ': synchronized ' + snapshot.fingerprint + ' at ' + next.sha);
      completed = true;
    } catch (error) { if (![409, 422].includes(error.status) || attempt === 2) throw error; }
  }
}
