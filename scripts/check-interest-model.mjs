import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { isActiveEntity } from '../src/lib/archive.mjs';
import { INTERESTS, INTEREST_LIMITS, buildInterestHub, validateInterestContent, interestTourCatalogPath, interestDestinationCatalogPath, interestExcursionCatalogPath, relatedInterestCatalogPath } from '../src/lib/interest-model.mjs';
import { paginateCatalog } from '../src/lib/catalog-pagination.ts';
import { compactCatalogById } from './lib/compact-catalog-map.mjs';
const collections = {};
for (const collection of ['tours', 'excursions', 'destinations', 'countries', 'themes']) {
  collections[collection] = readdirSync(`src/content/${collection}`).filter((file) => file.endsWith('.md')).map((file) => {
    const raw = readFileSync(`src/content/${collection}/${file}`, 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(match, `frontmatter: ${collection}/${file}`);
    return { data: yaml.load(match[1]), body: raw.slice(match[0].length) };
  });
}
assert.deepEqual(validateInterestContent(collections), [], 'actual content conforms to the closed dictionary');
const htmlAt = (path) => readFileSync(join('dist', path, 'index.html'), 'utf8');
const ids = (html, attr) => [...html.matchAll(new RegExp(`${attr}="([^"]+)"`, 'g'))].map((match) => match[1]);
const section = (html, name) => html.match(new RegExp(`<section\\b[^>]*data-interest-section="${name}"[^>]*>([\\s\\S]*?)<\\/section>`))?.[1] ?? '';
const base = process.env.SITE_BASE === '/' ? '' : `/${(process.env.SITE_BASE ?? '').replace(/^\/+|\/+$/g, '')}`.replace(/^\/$/, '');
let catalogs = 0, pages = 0, annotations = 0;
const checkCatalog = (theme, entries, country, root = interestTourCatalogPath(theme, country)) => {
  if (!entries.length) { assert.ok(!existsSync(join('dist', root, 'index.html')), `no empty catalogue ${root}`); return; }
  const all = [];
  for (const page of paginateCatalog(entries, root)) {
    const html = htmlAt(page.pagination.canonical);
    assert.ok(html.includes(`href="${base}/interests/${theme.slug}/"`), `return to interest: ${page.pagination.canonical}`);
    const found = ids(html, 'data-catalog-item');
    assert.deepEqual(found, page.entries.map((entry) => entry.data.id), `thematic order: ${page.pagination.canonical}`);
    all.push(...found); pages++;
  }
  assert.deepEqual(all, entries.map((entry) => entry.data.id));
  catalogs++;
};
for (const interest of INTERESTS) {
  const hub = buildInterestHub(interest.id, collections);
  const root = `/interests/${interest.slug}/`, html = htmlAt(root);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `one H1: ${root}`);
  assert.ok(html.includes(`data-interest-hub="${interest.id}"`), root);
  assert.ok(html.includes(`data-interest-total-tours="${hub.allTours.length}"`), root);
  const expectations = { stories: hub.stories.map((row) => row.id), tours: hub.tours.map((row) => row.data.id),
    countries: hub.countries.map((row) => row.entry.data.id), experiences: hub.experiences.map((row) => row.id), related: hub.relatedThemes.map((row) => row.entry.data.id) };
  for (const [name, expected] of Object.entries(expectations)) {
    const found = ids(section(html, name), 'data-interest-item');
    assert.deepEqual(found, expected, `${root}: ${name} exactly matches active projection`);
    assert.ok(found.length <= INTEREST_LIMITS[name], `${root}: ${name} limit`);
  }
  assert.equal(new Set([...expectations.stories, ...expectations.experiences]).size, expectations.stories.length + expectations.experiences.length, `${root}: no repeated experience`);
  const coverTourIds = hub.countries.map((row) => row.coverTour?.data.id).filter(Boolean);
  assert.equal(new Set(coverTourIds).size, coverTourIds.length, `${root}: country geography never repeats a tour cover`);
  for (const row of hub.countries) if (row.coverTour) assert.ok(row.tours.some((tour) => tour.data.id === row.coverTour.data.id), `${root}: cover belongs to country thematic catalogue`);
  if (hub.allTours.length) assert.ok(html.includes(`href="${base}${interestTourCatalogPath(interest)}"`), `complete tour catalogue link: ${root}`);
  for (const row of hub.countries) assert.ok(section(html, 'countries').includes(`href="${base}${interestTourCatalogPath(interest, row.entry.data)}"`), `country links preserve interest: ${root}`);
  assert.ok(html.includes('data-interest-section="cta"'), `CTA: ${root}`);
  checkCatalog(interest, hub.allTours);
  checkCatalog(interest, hub.allExperiences.filter((row) => row.kind === 'destination').map((row) => row.entry), undefined, interestDestinationCatalogPath(interest));
  checkCatalog(interest, hub.allExperiences.filter((row) => row.kind === 'excursion').map((row) => row.entry), undefined, interestExcursionCatalogPath(interest));
  checkCatalog(interest, hub.allRelatedThemes.map((row) => row.entry), undefined, relatedInterestCatalogPath(interest));
  for (const row of hub.allCountries) checkCatalog(interest, row.tours, row.entry.data);
}
// Validate exact source pointers and compact catalog copies, not the historical annotation audit.
for (const collection of ['tours', 'excursions', 'destinations']) {
  const rawCatalog = JSON.parse(readFileSync(`data/source-index/catalogs/${collection}.json`, 'utf8'));
  const compact = compactCatalogById(rawCatalog);
  for (const entry of collections[collection].filter((entry) => entry.data.locale === 'ru' && isActiveEntity(entry))) {
    const d = entry.data;
    const source = JSON.parse(readFileSync(`data/source-index/entries/${d.id}.json`, 'utf8'));
    for (const field of collection === 'tours' ? ['primaryThemes', 'themes'] : ['themes']) {
      assert.deepEqual(source[field], d[field], `source entry ${d.id}: ${field}`);
      assert.deepEqual(compact.get(d.id)?.[field], d[field], `compact catalogue ${d.id}: ${field}`);
    }
    annotations++;
  }
}
console.log(`Interest model checks passed: ${INTERESTS.length} hubs, ${catalogs} complete thematic catalogues, ${pages} catalogue pages, ${annotations} synchronized entity annotations.`);
