import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { catalogPagePath, CATALOG_PAGE_SIZE } from '../src/lib/catalog-pagination.ts';

const output = 'dist';
const site = process.env.SITE_ORIGIN ?? 'https://adatours.ru';
const rawBase = process.env.SITE_BASE ?? '/';
const base = rawBase === '/' ? '' : `/${rawBase.replace(/^\/+|\/+$/g, '')}`;
const absolute = (path) => new URL(`${base}${path}`, site).href;
const decode = (value) => value.replaceAll('&amp;', '&');
const attr = (tag, name) => decode(tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? '');
const files = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith('.html')) files.push(path);
  }
}
walk(output);
const sitemap = readdirSync(output).filter((name) => /^sitemap.*\.xml$/.test(name))
  .map((name) => readFileSync(join(output, name), 'utf8')).join('\n');
const sitemapURLs = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decode(match[1])));
const groups = new Map();
let checkedPages = 0;
for (const path of files) {
  const html = readFileSync(path, 'utf8');
  const rootTag = html.match(/<div\b[^>]*\bdata-catalog-root\b[^>]*>/)?.[0];
  if (!rootTag) continue;
  const key = attr(rootTag, 'data-catalog-key');
  const page = Number(attr(rootTag, 'data-catalog-page'));
  const total = Number(attr(rootTag, 'data-catalog-total'));
  const from = Number(attr(rootTag, 'data-catalog-from'));
  const to = Number(attr(rootTag, 'data-catalog-to'));
  const version = attr(rootTag, 'data-catalog-version');
  const last = Math.ceil(total / CATALOG_PAGE_SIZE);
  const expectedPath = catalogPagePath(key, page);
  const expectedURL = absolute(expectedPath);
  const context = `${key} page ${page}`;
  const titleText = (html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const metaDescriptionTag = [...html.matchAll(/<meta\b[^>]*>/g)].map((match) => match[0]).find((tag) => attr(tag, 'name') === 'description');
  const metaDescription = attr(metaDescriptionTag || '', 'content');
  assert.ok(total > 0 && page >= 1 && page <= last, context);
  assert.equal(relative(output, path).replaceAll('\\', '/'), `${expectedPath.slice(1)}index.html`, context);
  const canonicals = [...html.matchAll(/<link\b[^>]*>/g)].map((match) => match[0]).filter((tag) => attr(tag, 'rel') === 'canonical');
  assert.equal(canonicals.length, 1, `one canonical: ${context}`);
  assert.equal(attr(canonicals[0], 'href'), expectedURL, `self canonical: ${context}`);
  const og = [...html.matchAll(/<meta\b[^>]*>/g)].map((match) => match[0]).find((tag) => attr(tag, 'property') === 'og:url');
  assert.ok(og, context);
  assert.equal(attr(og, 'content'), expectedURL, `OG URL: ${context}`);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `one H1: ${context}`);
  if (key === '/multi-country/') {
    assert.ok(titleText.includes('Multi-country тур'), `multi-country title: ${context}`);
    assert.ok(metaDescription.includes(String(total)), `multi-country description has total: ${context}`);
    if (page === 1) {
      assert.ok(titleText.includes(String(total)), `multi-country root title has dynamic total: ${context}`);
    } else {
      assert.ok(titleText.includes(`страница ${page} из ${last}`), `multi-country numbered SEO title: ${context}`);
      assert.ok(metaDescription.includes(`Маршруты ${from}–${to} из ${total}`), `multi-country range description: ${context}`);
    }
  }
  const links = [...html.matchAll(/<a\b[^>]*>/g)].map((match) => match[0]);
  const hrefs = new Set(links.map((tag) => attr(tag, 'href')).filter(Boolean).map((href) => new URL(href, expectedURL).href));
  if (page > 1) {
    assert.ok(hrefs.has(absolute(key)), `first page link: ${context}`);
    assert.ok(hrefs.has(absolute(catalogPagePath(key, page - 1))), `previous page link: ${context}`);
    assert.ok(titleText.includes(`страница ${page}`), `numbered title: ${context}`);
  }
  const more = links.find((tag) => /\bdata-catalog-load-more\b/.test(tag));
  if (page < last) {
    const nextURL = absolute(catalogPagePath(key, page + 1));
    assert.ok(hrefs.has(nextURL), `next page link: ${context}`);
    assert.ok(more, `load more link: ${context}`);
    assert.equal(new URL(attr(more, 'href'), expectedURL).href, nextURL, context);
  } else assert.ok(!more, `no load more on last page: ${context}`);
  const ids = [...html.matchAll(/data-catalog-item="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(from, (page - 1) * CATALOG_PAGE_SIZE + 1, context);
  assert.equal(to, Math.min(page * CATALOG_PAGE_SIZE, total), context);
  assert.equal(ids.length, to - from + 1, `page size: ${context}`);
  assert.equal(new Set(ids).size, ids.length, `unique page items: ${context}`);
  assert.ok(sitemapURLs.has(expectedURL), `sitemap: ${context}`);
  const schemas = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .flatMap((match) => JSON.parse(match[1])['@graph'] ?? []);
  const list = schemas.find((item) => item['@id'] === `${expectedURL}#catalog`);
  assert.equal(list?.numberOfItems, ids.length, `ItemList count: ${context}`);
  assert.deepEqual(list.itemListElement.map((item) => item.position), ids.map((_, index) => from + index), `ItemList positions: ${context}`);
  for (const item of list.itemListElement) {
    const url = new URL(item.url);
    const logical = base && url.pathname.startsWith(`${base}/`) ? url.pathname.slice(base.length) : url.pathname;
    assert.ok(existsSync(join(output, logical.slice(1), 'index.html')), `item target exists: ${item.url}`);
  }
  const group = groups.get(key) ?? { total, version, pages: new Map() };
  assert.equal(group.total, total, context);
  assert.equal(group.version, version, context);
  assert.ok(!group.pages.has(page), `duplicate page: ${context}`);
  group.pages.set(page, ids);
  groups.set(key, group);
  checkedPages++;
}
assert.ok(checkedPages > 0, 'No catalogue pages were checked');
for (const [key, group] of groups) {
  assert.equal(group.pages.size, Math.ceil(group.total / CATALOG_PAGE_SIZE), `all pages: ${key}`);
  const ids = [...group.pages].sort(([a], [b]) => a - b).flatMap(([, pageIds]) => pageIds);
  assert.equal(ids.length, group.total, `all items: ${key}`);
  assert.equal(new Set(ids).size, group.total, `no repeats across pages: ${key}`);
  assert.equal(createHash('sha256').update(JSON.stringify(ids)).digest('hex').slice(0, 20), group.version, `full original order: ${key}`);
  assert.ok(!existsSync(join(output, key.slice(1), 'page/1/index.html')), `no page-one duplicate: ${key}`);
}
console.log(`Catalogue checks passed: ${groups.size} catalogues, ${checkedPages} pages; canonical, navigation, load-more links, complete unique items, ItemList and sitemap.`);
