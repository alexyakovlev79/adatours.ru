/** Offline checkpoint audit. Flags editorial work; never rewrites articles or publication history. */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { createHash } from 'node:crypto';
import { readCatalogContent } from './sync-multi-country-registries.mjs';
import { buildTourFilterIndex } from '../src/lib/tour-filters.mjs';
import { buildVipFilterIndex } from '../src/lib/vip-filters.mjs';
import { buildMultiCountryCatalog } from '../src/lib/multi-country-catalog.mjs';
import { buildInterestHub, INTERESTS, themeIds } from '../src/lib/interest-model.mjs';
import { isActiveEntity } from '../src/lib/archive.mjs';

const json = path => JSON.parse(readFileSync(path, 'utf8'));
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(item =>
  item.isDirectory() ? files(join(dir, item.name)) : [join(dir, item.name)]);
const fields = (type, row) => Object.fromEntries((type === 'tour' ? ['primaryThemes', 'themes'] : ['themes'])
  .map(key => [key, row[key] ?? []]));
const parse = file => yaml.load(readFileSync(file, 'utf8').split(/^---\s*$/m)[1]);
const migrationRoot = 'data/migrations/interest-split-20261020';
const journal = json(`${migrationRoot}/decisions.json`);
const catalog = Object.fromEntries(['tour', 'excursion', 'destination'].map(type =>
  [type, new Map(json(`data/source-index/catalogs/${type}s.json`).entries.map(row => [row.id, row]))]));
const indexById = new Map(json('data/source-index/index.json').entries.map(row => [row.id, row]));
const plannedById = new Map(json('src/data/catalog/destinations.json').map(row => [row.id, row]));
const errors = [], coverage = {}, dispositions = {};
let matches = 0;
for (const [key, item] of Object.entries(journal.items)) {
  const label = `${item.type}:${item.status}`;
  coverage[label] = (coverage[label] ?? 0) + 1;
  if (item.status !== 'done') continue;
  const md = parse(item.contentPath), entry = json(`data/source-index/entries/${item.id}.json`);
  const compact = catalog[item.type].get(item.id), index = indexById.get(item.id), expected = JSON.stringify(fields(item.type, item.after));
  if ([md.id, entry.id, compact?.id, index?.id].some(id => id !== item.id)) errors.push(`${key}: ID mismatch`);
  if ([md, entry, compact, index].some(row => !row || JSON.stringify(fields(item.type, row)) !== expected)) {
    errors.push(`${key}: MD / entry / catalog / index / decision mismatch`);
    continue;
  }
  const planned = item.type === 'destination' ? plannedById.get(item.id) : null;
  if (planned?.themes && JSON.stringify(fields(item.type, planned)) !== expected) errors.push(`${key}: planned catalog themes mismatch`);
  const primary = md.primaryThemes ?? [], secondary = md.themes ?? [];
  if (item.type === 'tour' && (primary.length < 1 || primary.length > 2)) errors.push(`${key}: primary count`);
  if (new Set([...primary, ...secondary]).size !== primary.length + secondary.length) errors.push(`${key}: duplicate themes`);
  if (themeIds(md).some(id => !INTERESTS.some(row => row.id === id))) errors.push(`${key}: unknown theme`);
  if (!isActiveEntity(md)) errors.push(`${key}: inactive MD marked done`);
  const n = themeIds(md).includes('theme_nature'), w = themeIds(md).includes('theme_wildlife');
  const disposition = `${item.type}:${n && w ? 'both' : n ? 'nature_only' : w ? 'wildlife_only' : 'neither'}`;
  dispositions[disposition] = (dispositions[disposition] ?? 0) + 1;
  matches++;
}
const content = await readCatalogContent();
content.destinations = files('src/content/destinations').filter(file => file.endsWith('.md')).map(file => ({ data: parse(file) }));
content.excursions = files('src/content/excursions').filter(file => file.endsWith('.md')).map(file => ({ data: parse(file) }));
const regular = buildTourFilterIndex(content.tours, content.countries, content.themes);
const vip = buildVipFilterIndex(content.tours, content.countries, content.themes);
const multi = buildMultiCountryCatalog(content.tours, content.countries, content.themes);
const paths = new Set([...regular.map(row => row.href), ...vip.map(row => row.href), ...multi.map(row => row.path), '/interests/']);
for (const theme of content.themes) {
  paths.add(`/interests/${theme.data.slug}/`);
  const hub = buildInterestHub(theme.data.id, content);
  if (hub.allExperiences.some(row => row.kind === 'destination')) paths.add(`/interests/${theme.data.slug}/places/`);
  if (hub.allExperiences.some(row => row.kind === 'excursion')) paths.add(`/interests/${theme.data.slug}/excursions/`);
  if (hub.relatedThemes.length) paths.add(`/interests/${theme.data.slug}/related/`);
}
const registryBaselineRef = 'origin/main';
const oldRows = files('data/seo-geo/registry').filter(file => /^\d\d-/.test(file.split('/').at(-1)))
  .flatMap(file => JSON.parse(execFileSync('git', ['show', `${registryBaselineRef}:${file}`],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })).entries);
const byUrl = new Map(oldRows.map(row => [row.url, row]));
const oldWildlifePaths = oldRows.filter(row => /\/interests\/wildlife\//.test(row.url));
const retired = oldWildlifePaths.filter(row => !paths.has(row.url));
const newNature = [...paths].filter(path => path.includes('/interests/nature/') && !byUrl.has(path)).sort();
const affected = [];
const editorial = json(`${migrationRoot}/editorial-decisions.json`).articles;
const approvedReviews = new Map(editorial.filter(row => ['reviewed_for_interest_split', 'new_nature_article_prepared'].includes(row.decision))
  .map(row => [row.articlePath, row.resultBlobSha]));
const blobSha = raw => createHash('sha1').update('blob ' + Buffer.byteLength(raw) + '\0').update(raw).digest('hex');
for (const file of files('data/seo-geo/articles').filter(file => file.endsWith('.md'))) {
  const raw = readFileSync(file, 'utf8'), targetPath = raw.match(/^targetPath:\s*(.+)$/m)?.[1]?.trim();
  const oldNameCount = [...raw.matchAll(/природа и животные/gi)].length;
  const wildlifeTarget = /\/interests\/wildlife\//.test(targetPath ?? '');
  const brokenLinks = [...new Set([...raw.matchAll(/\]\((\/[^)\s]+)\)/g)].map(match => match[1]))]
    .filter(path => /\/interests\/wildlife\//.test(path) && !paths.has(path))
    .map(path => ({ path, natureEquivalent: paths.has(path.replace('/interests/wildlife/', '/interests/nature/'))
      ? path.replace('/interests/wildlife/', '/interests/nature/') : null }));
  if (wildlifeTarget || oldNameCount || brokenLinks.length) affected.push({ targetPath, articlePath: file,
    work: byUrl.get(targetPath)?.work ?? null, liveTarget: wildlifeTarget ? paths.has(targetPath) : null,
    wildlifeTarget, oldNameCount, brokenLinks, editorialStatus: approvedReviews.get(file) === blobSha(raw)
      ? 'reviewed_for_interest_split' : 'pending_individual_semantic_review' });
}
const claimStates = ['seo-geo/staging', 'seo-geo/voice-rewrite-staging'].map(ref => {
  const path = ref.includes('voice-') ? 'data/seo-geo/voice-rewrite/claims.json' : 'data/seo-geo/claims.json';
  try {
    const claims = JSON.parse(execFileSync('git', ['show', `origin/${ref}:${path}`], { encoding: 'utf8' })).claims;
    const live = Object.entries(claims).filter(([, claim]) => Date.parse(claim.expiresAt) > Date.now());
    return { ref, liveClaims: live.length, liveWildlifeClaims: live.filter(([url]) => url.includes('/interests/wildlife/')).map(([url]) => url) };
  } catch (error) { return { ref, error: error.message }; }
});
const hero = content.themes.find(row => row.data.id === 'theme_nature')?.data.hero?.src;
const ledger = json('src/data/media/direct-s3-uploads.json');
const receiptRows = ledger.assets;
const report = { version: 1, checkedAt: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'origin/feature/split-nature-wildlife-20261020'], { encoding: 'utf8' }).trim(),
  sourceNote: 'Confirmed remote checkpoint; candidate preparation files validated from working tree.',
  classification: { coverage, activeTriplesMatched: matches, sourceIndexAlsoValidated: true, dispositions, errors },
  media: { natureHero: hero, registeredReceipt: receiptRows.some(row => '/' + row.key === hero), themeHeroes: content.themes.filter(row => row.data.hero?.src).length },
  catalog: { registryBaselineRef, regular: regular.length, vip: vip.length, multiCountry: multi.length,
    nature: { regular: regular.filter(row => row.themeId === 'theme_nature').length, vip: vip.filter(row => row.themeId === 'theme_nature').length,
      multiCountry: multi.filter(row => row.themeId === 'theme_nature').length }, newNatureUrls: newNature,
    retiredWildlife: retired.map(row => ({ url: row.url, id: row.id, work: row.work, articlePath: row.articlePath ?? null })) },
  seo: { affected: affected.length, wildlifeTargets: affected.filter(row => row.wildlifeTarget).length,
    pendingSemanticReview: affected.filter(row => row.editorialStatus === 'pending_individual_semantic_review').length,
    reviewedCandidates: affected.filter(row => row.editorialStatus === 'reviewed_for_interest_split').length,
    liveWildlifeTargets: affected.filter(row => row.wildlifeTarget && row.liveTarget).length,
    oldNameArticles: affected.filter(row => row.oldNameCount).length,
    articlesWithRetiredLinks: affected.filter(row => row.brokenLinks.length).length, articles: affected },
  claims: claimStates, release: { status: 'pending_editorial_review_and_registry_cutover', productionUnchanged: true } };
if (process.argv.includes('--write')) writeFileSync(`${migrationRoot}/release-audit.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ classification: report.classification, media: report.media,
  catalog: { ...report.catalog, newNatureUrls: newNature.length, retiredWildlife: retired.length },
  seo: { ...report.seo, articles: undefined }, claims: report.claims }, null, 2));
if (errors.length) process.exitCode = 1;
