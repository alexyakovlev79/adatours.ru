import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import {
  aliasesForEntity, countryBreadcrumbs, countryPath, destinationBreadcrumbs, destinationPath,
  excursionBreadcrumbs, excursionPath, expandBreadcrumbTrails,
  isLegacyRedirectPath, pageAliases, tourBreadcrumbs, tourPath,
} from '../src/lib/routes.ts';

// Inspect the output of an existing build. This command never runs a build.
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, process.argv[2] ?? 'dist');
const read = (file) => readFileSync(file, 'utf8');
const htmlCache = new Map();
const fileFor = (path) => resolve(output, `.${path}`, 'index.html');
function html(path) {
  if (!htmlCache.has(path)) htmlCache.set(path, read(fileFor(path)));
  return htmlCache.get(path);
}
function attr(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return tag.match(new RegExp(`(?:\\s|^)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(1).find((value) => value !== undefined);
}
function tagWith(source, tag, name, value) {
  return [...source.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'gi'))].map((match) => match[0]).find((item) => attr(item, name) === value);
}
function canonical(source) {
  return attr(tagWith(source, 'link', 'rel', 'canonical') ?? '', 'href');
}
const siteRoot = new URL(canonical(html('/')));
const base = siteRoot.pathname.replace(/\/$/, '');
const absolute = (path) => new URL(path.replace(/^\//, ''), siteRoot).toString();
const href = (path) => `${base}${path}`;
const sitemap = readdirSync(output).filter((name) => /^sitemap.*\.xml$/.test(name)).map((name) => read(resolve(output, name))).join('\n');
const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
assert.ok(sitemapUrls.size, 'build must contain a sitemap');

const definitions = [
  { collection: 'countries', type: 'country', path: countryPath, breadcrumbs: countryBreadcrumbs },
  { collection: 'destinations', type: 'destination', path: destinationPath, breadcrumbs: destinationBreadcrumbs },
  { collection: 'tours', type: 'tour', path: tourPath, breadcrumbs: tourBreadcrumbs },
  { collection: 'excursions', type: 'excursion', path: excursionPath, breadcrumbs: excursionBreadcrumbs },
];
let details = 0;
let parallelCountryTrails = 0;
const catalogues = new Set();
const catalogueAnchorCache = new Map();
function catalogueAnchors(path) {
  if (catalogueAnchorCache.has(path)) return catalogueAnchorCache.get(path);
  const anchors = new Set();
  // A catalogue's first page intentionally does not contain every entity.
  // Inspect every built page, and require a real navigation link to each next page.
  const pages = [path];
  for (let page = 2; existsSync(fileFor(`${path}page/${page}/`)); page++) pages.push(`${path}page/${page}/`);
  for (let index = 0; index < pages.length; index++) {
    const current = pages[index];
    const source = html(current);
    assert.equal(canonical(source), absolute(current), `catalogue page canonical: ${current}`);
    const links = [...source.matchAll(/<a\b[^>]*>/g)].map((match) => attr(match[0], 'href'));
    if (index + 1 < pages.length) assert.ok(links.includes(href(pages[index + 1])), `catalogue pagination is not reachable: ${current}`);
    links.forEach((value) => anchors.add(value));
    catalogues.add(current);
  }
  catalogueAnchorCache.set(path, anchors);
  return anchors;
}
const redirectTargets = new Map();
function verifyRedirect(from, to) {
  const previous = redirectTargets.get(from);
  if (previous) {
    assert.equal(previous, to, `alias has conflicting targets: ${from}`);
    return;
  }
  assert.ok(existsSync(fileFor(from)), `redirect page missing: ${from}`);
  assert.ok(existsSync(fileFor(to)), `redirect target missing: ${from} → ${to}`);
  assert.equal(isLegacyRedirectPath(to), false, `redirect target must be final: ${from} → ${to}`);
  const redirect = html(from);
  const target = absolute(to);
  assert.equal(canonical(redirect), target, `redirect canonical: ${from}`);
  assert.equal(canonical(html(to)), target, `redirect targets a noncanonical page: ${from} → ${to}`);
  assert.equal(tagWith(html(to), 'meta', 'http-equiv', 'refresh'), undefined, `redirect chain: ${from} → ${to}`);
  assert.ok((attr(tagWith(redirect, 'meta', 'name', 'robots') ?? '', 'content') ?? '').includes('noindex'), `redirect robots: ${from}`);
  assert.equal(attr(tagWith(redirect, 'meta', 'http-equiv', 'refresh') ?? '', 'content'), `0;url=${href(to)}`, `redirect refresh: ${from}`);
  assert.ok(redirect.includes('window.location.search') && redirect.includes('window.location.hash'), `redirect loses query/hash: ${from}`);
  assert.ok(redirect.includes('data-pagefind-ignore') && !redirect.includes('data-pagefind-body'), `redirect search exclusion: ${from}`);
  assert.ok(!sitemapUrls.has(absolute(from)), `redirect present in sitemap: ${from}`);
  redirectTargets.set(from, to);
}
for (const definition of definitions) {
  const directory = resolve(root, 'src/content', definition.collection);
  const entries = readdirSync(directory).filter((name) => name.endsWith('.md')).map((name) => yaml.load(read(resolve(directory, name)).split(/^---\s*$/m)[1]))
    .filter((entry) => entry.locale === 'ru' && !['draft', 'archived'].includes(entry.status));
  for (const entry of entries) {
    const path = definition.path(entry);
    const source = html(path);
    const target = absolute(path);
    assert.equal(canonical(source), target, `canonical: ${entry.id}`);
    assert.equal(attr(tagWith(source, 'meta', 'property', 'og:url') ?? '', 'content'), target, `og:url: ${entry.id}`);
    assert.ok(source.includes('data-pagefind-body'), `search record missing: ${entry.id}`);
    assert.ok(sitemapUrls.has(target), `canonical absent from sitemap: ${entry.id}`);

    const crumbs = definition.breadcrumbs(entry);
    const expectedTrails = expandBreadcrumbTrails(crumbs);
    const graphs = [...source.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
    const schemaNodes = graphs.flatMap((graph) => graph['@graph'] ?? [graph]);
    const actualTrails = schemaNodes.filter((node) => node['@type'] === 'BreadcrumbList');
    assert.equal(actualTrails.length, expectedTrails.length, `breadcrumb trail count: ${entry.id}`);
    expectedTrails.forEach((trail, index) => {
      assert.deepEqual(actualTrails[index].itemListElement.map((item) => [item.position, item.name, item.item]),
        [{ label: 'Главная', href: '/' }, ...trail].map((item, position) => [position + 1, item.label, absolute(item.href)]), `JSON-LD trail: ${entry.id}`);
    });
    const nav = source.match(/<nav\b[^>]*aria-label="Хлебные крошки"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(nav, `visible breadcrumbs missing: ${entry.id}`);
    const levels = [...nav.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((match) => match[1]);
    assert.equal(levels.length, crumbs.length, `visual breadcrumb levels: ${entry.id}`);
    if (!('links' in crumbs.at(-1))) assert.ok(levels.at(-1).includes('aria-current="page"'), `current breadcrumb missing: ${entry.id}`);
    crumbs.forEach((crumb, index) => {
      const links = 'links' in crumb ? crumb.links : [crumb];
      if ('links' in crumb) {
        parallelCountryTrails++;
        const actual = [...levels[index].matchAll(/<a\b[^>]*>/g)].map((match) => attr(match[0], 'href'));
        assert.deepEqual(actual, links.map((link) => href(link.href)), `parallel country links: ${entry.id}`);
      }
      if (index === crumbs.length - 1) return;
      for (const link of links) {
        assert.ok(existsSync(fileFor(link.href)), `breadcrumb links to missing page: ${entry.id} → ${link.href}`);
        assert.ok(catalogueAnchors(link.href).has(href(path)), `catalogue missing its entity across all pages: ${link.href} → ${entry.id}`);
      }
    });
    details++;

    for (const legacy of aliasesForEntity(definition.type, entry, path)) verifyRedirect(legacy, path);
  }
}
const entityAliases = redirectTargets.size;
for (const { from, to } of pageAliases) verifyRedirect(from, to);

// Check all rendered canonical pages, including static pages and catalogue pages.
let canonicalPages = 0;
let internalLinks = 0;
const pageFiles = readdirSync(output, { recursive: true }).filter((name) => name === 'index.html' || name.endsWith('/index.html'));
for (const file of pageFiles) {
  const path = `/${file.replace(/(?:^|\/)index\.html$/, '')}`.replace(/\/?$/, '/');
  const source = html(path);
  const canonicalUrl = canonical(source);
  if (!canonicalUrl || isLegacyRedirectPath(path)) continue;
  assert.equal(canonicalUrl, absolute(path), `canonical metadata disagrees with rendered path: ${path}`);
  canonicalPages++;
  for (const match of source.matchAll(/<a\b[^>]*>/gi)) {
    const value = attr(match[0], 'href');
    if (!value) continue;
    let linked;
    try { linked = new URL(value.replace(/&amp;/g, '&'), canonicalUrl); }
    catch { continue; }
    if (linked.origin !== siteRoot.origin || !['http:', 'https:'].includes(linked.protocol)) continue;
    internalLinks++;
    assert.equal(isLegacyRedirectPath(linked.pathname, base), false, `canonical page links to legacy URL: ${path} → ${value}`);
  }
}
assert.ok(existsSync(fileFor('/multi-country/')), 'existing multi-country editorial page must remain');
assert.ok(existsSync(fileFor('/multi-country/tour/')), 'multi-country tour catalogue must exist');
console.log(JSON.stringify({
  ok: true, site: siteRoot.toString(), details, aliases: redirectTargets.size,
  entityAliases, pageAliases: pageAliases.length, cataloguePages: catalogues.size,
  canonicalPages, internalLinks, parallelCountryTrails,
}, null, 2));
