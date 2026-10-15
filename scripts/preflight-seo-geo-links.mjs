import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import yaml from 'js-yaml';
import { buildSeoGeoCanonicalPaths } from '../src/lib/seo-geo-route-inventory.mjs';
import { parseSeoGeoArticle, validateSeoGeoHtml, seoGeoArticleFile } from '../src/lib/seo-geo.mjs';
import { isArchivedPath } from '../src/lib/archive.mjs';

const args = process.argv.slice(2);
const arg = (flag, fallback) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : fallback; };
const source = resolve(arg('--source-root', process.cwd()));
const staging = resolve(arg('--staging-root', source));
const base = arg('--base', '');
const head = arg('--head', 'HEAD');
const explicit = args.flatMap((v, i) => v === '--article' ? [args[i + 1]] : []);
if (!base && !explicit.length) throw new Error('Supply --article <path> or --base <commit>');
const articlePattern = /^data\/seo-geo\/articles\/(?:[a-z0-9_-]+\/)+index\.md$/;
const phasePattern = /^data\/seo-geo\/registry\/0[1-7]-[a-z-]+\.json$/;
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const frontmatter = (raw, path) => {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new Error(`Frontmatter missing: ${path}`);
  return yaml.load(m[1]);
};
const files = (root) => !existsSync(root) ? [] : readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
  const path = join(root, entry.name);
  return entry.isDirectory() ? files(path) : [path];
});
const newlyPrepared = [];
function changedArticles() {
  if (!base) return explicit;
  const changedFiles = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', base, head,
    '--', 'data/seo-geo/articles/', 'data/seo-geo/registry/'], { cwd: staging, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const changed = new Set(changedFiles.filter((path) => articlePattern.test(path)));
  for (const path of changedFiles.filter((path) => phasePattern.test(path))) {
    const current = json(join(staging, path));
    let old;
    try { old = JSON.parse(execFileSync('git', ['show', `${base}:${path}`], { cwd: staging, encoding: 'utf8' })); }
    catch { old = { entries: [] }; }
    const before = new Map(old.entries.map((row) => [row.url, row.work]));
    for (const row of current.entries) {
      if (row.work === 'prepared' && before.get(row.url) !== 'prepared') {
        const articlePath = row.articlePath ?? seoGeoArticleFile(row.url);
        if (articlePattern.test(articlePath)) { changed.add(articlePath); newlyPrepared.push({ row, articlePath }); }
      }
    }
  }
  return [...changed, ...explicit];
}

async function verifyPreparedProof({ row, articlePath }) {
  const sha = row.preflightCommit, blob = row.preflightArticleBlobSha;
  if (!/^[0-9a-f]{40}$/.test(sha ?? '') || !/^[0-9a-f]{40}$/.test(blob ?? '')) {
    throw new Error('New prepared row needs preflightCommit and preflightArticleBlobSha');
  }
  const actual = execFileSync('git', ['hash-object', articlePath], { cwd: staging, encoding: 'utf8' }).trim();
  if (actual !== blob) throw new Error('Article changed after the successful preflight');
  const repo = process.env.GITHUB_REPOSITORY, token = process.env.GH_TOKEN;
  if (!repo || !token) throw new Error('GitHub authentication unavailable to verify preflight');
  const request = async (path) => {
    const response = await fetch('https://api.github.com/repos/' + repo + path, {
      headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token,
        'X-GitHub-Api-Version': '2022-11-28' },
    });
    if (!response.ok) throw new Error('GitHub verification returned HTTP ' + response.status);
    return response.json();
  };
  const checked = await request('/contents/' + articlePath + '?ref=' + sha);
  if (checked.sha !== blob) throw new Error('Claimed preflight commit contains different article bytes');
  const status = await request('/commits/' + sha + '/status');
  if (!status.statuses?.some((entry) => entry.context === 'ada/seo-link-preflight' && entry.state === 'success')) {
    throw new Error('No successful ada/seo-link-preflight for the claimed content commit');
  }
}

const collection = (name) => files(join(source, 'src', 'content', name)).filter((file) => /\.mdx?$/.test(file))
  .map((file) => ({ data: frontmatter(readFileSync(file, 'utf8'), file) }));
const staticPaths = files(join(source, 'src', 'pages')).filter((file) => /\.astro$/.test(file))
  .map((file) => relative(join(source, 'src', 'pages'), file).split(sep).join('/'))
  .filter((path) => !path.includes('[') && !/(?:^|\/)404\.astro$/.test(path))
  .map((path) => ('/' + path.replace(/(?:^|\/)index\.astro$/, '').replace(/\.astro$/, '') + '/').replace(/\/{2,}/g, '/'));
const canonical = buildSeoGeoCanonicalPaths({
  countries: collection('countries'), destinations: collection('destinations'), tours: collection('tours'),
  excursions: collection('excursions'), themes: collection('themes'),
  destinationCatalog: json(join(source, 'src/data/catalog/destinations.json')), staticPaths,
});
const candidates = [...new Set(changedArticles())];
if (!candidates.length) {
  console.log(`SEO/GEO link preflight: no changed articles, ${canonical.size} active paths indexed`);
  process.exit(0);
}
const processor = await createMarkdownProcessor();
const errors = [];
for (const transition of newlyPrepared) {
  try { await verifyPreparedProof(transition); }
  catch (error) { errors.push(transition.articlePath + ': ' + error.message); }
}
let count = 0;
for (const path of candidates) {
  try {
    if (!articlePattern.test(path)) throw new Error('Noncanonical article path');
    const full = resolve(staging, path);
    if (!full.startsWith(staging + sep)) throw new Error('Article outside staging');
    const content = readFileSync(full, 'utf8');
    if (frontmatter(content, path).status !== 'approved') continue;
    const article = parseSeoGeoArticle(content, path);
    if (seoGeoArticleFile(article.targetPath) !== path) throw new Error('Path does not match targetPath');
    if (!canonical.has(article.targetPath)) throw new Error(`Unavailable/noncanonical target: ${article.targetPath}`);
    const text = article.markdown
      .replace(/\{\{#if\s+[^}]+\}\}/g, '').replace(/\{\{\/if\}\}/g, '')
      .replace(/\{\{catalog\.tourTable:[^}]+\}\}/g, '').replace(/\{\{[^}]+\}\}/g, '0');
    const { code } = await processor.render(text);
    validateSeoGeoHtml(code, {
      targetPath: article.targetPath,
      isCanonicalLink: (href) => canonical.has(href) && href !== article.targetPath && !isArchivedPath(href),
    });
    count++;
    console.log(`OK ${article.targetPath}`);
  } catch (e) { errors.push(`${path}: ${e.message}`); }
}
errors.forEach((error) => console.error('SEO/GEO preflight: ' + error));
console.log(`SEO/GEO link preflight: ${count} articles checked; ${errors.length} errors; no Astro build`);
if (errors.length) process.exitCode = 1;
