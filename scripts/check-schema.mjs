/** Full-output acceptance check, run after Astro and before Pagefind. No network. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { inspectHtml } from '../src/lib/structured-data-html.mjs';
import { hasType, types, logicalPath, cleanText, SCHEMA_VERSION } from '../src/lib/structured-data.mjs';
import { isArchivedPath } from '../src/lib/archive.mjs';
const output = 'dist';
const origin = process.env.SITE_ORIGIN || 'https://adatours.ru';
const base = `/${(process.env.SITE_BASE || '/').split('/').filter(Boolean).join('/')}`.replace(/\/$/, '');
const root = new URL(`${base}/`, origin).href;
const files = [];
function walkFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path);
    else if (entry.name.endsWith('.html')) files.push(path);
  }
}
function* objects(value) {
  if (Array.isArray(value)) { for (const v of value) yield* objects(v); }
  else if (value && typeof value === 'object') { yield value; for (const v of Object.values(value)) yield* objects(v); }
}
const pageTypes = new Set(['WebPage', 'CollectionPage', 'AboutPage', 'ContactPage', 'ProfilePage', 'FAQPage']);
const allowedTypes = new Set([...pageTypes, 'Organization', 'TravelAgency', 'WebSite', 'ImageObject', 'ContactPoint', 'PostalAddress', 'PropertyValue', 'Country', 'City', 'Place', 'TouristDestination', 'TouristTrip', 'Trip', 'Service', 'Offer', 'PriceSpecification', 'ItemList', 'ListItem', 'BreadcrumbList', 'DefinedTerm', 'DefinedTermSet', 'Person', 'Article', 'Review', 'Question', 'Answer']);
const report = { schemaVersion: SCHEMA_VERSION, root, totalHtml: 0, contentPages: 0, redirects: 0, archives: 0, withSchema: 0, catalogPages: 0, faqPages: 0, offerPages: 0, pageTypes: {}, mainEntityTypes: {}, errors: [], pages: [] };
const definitions = new Set();
const references = [];
const urlsChecked = new Set();
function checkLocalUrl(value) {
  if (!value || urlsChecked.has(value)) return;
  urlsChecked.add(value);
  const url = new URL(value);
  assert.ok(['http:', 'https:'].includes(url.protocol), `Non-web URL: ${value}`);
  if (url.origin !== new URL(root).origin) return;
  const path = logicalPath(url.href, root);
  // A Schema.org identifier fragment is not necessarily an HTML anchor.
  const target = path.endsWith('/') ? join(output, decodeURIComponent(path.slice(1)), 'index.html') : join(output, decodeURIComponent(path.slice(1)));
  assert.ok(existsSync(target), `Internal target not built: ${value}`);
}
walkFiles(output);
for (const file of files.sort()) {
  const filePath = relative(output, file).replaceAll('\\', '/');
  try {
    const html = readFileSync(file, 'utf8');
    const inferredPath = filePath === 'index.html' ? '/' : `/${filePath.replace(/index\.html$/, '')}`;
    const pageUrl = new URL(`${base}${inferredPath}`, origin).href;
    const inspected = inspectHtml(html, { root, pageUrl, fullDocument: true });
    assert.equal(inspected.metadata.scripts, 1, 'Exactly one JSON-LD graph per HTML page');
    const graph = inspected.legacy[0];
    assert.equal(graph['@context'], 'https://schema.org');
    assert.ok(Array.isArray(graph['@graph']) && graph['@graph'].length > 0, 'Nonempty graph');
    assert.ok(html.includes(`data-schema-version="${SCHEMA_VERSION}"`), 'Current generator version');
    const nodes = graph['@graph'];
    const byId = new Map(nodes.map((n) => [n['@id'], n]));
    assert.equal(byId.size, nodes.length, 'No duplicate top-level IDs');
    const canonical = inspected.metadata.canonical;
    assert.ok(canonical, 'Canonical URL');
    const primaryId = `${inspected.metadata.redirect ? pageUrl : canonical}#webpage`;
    const page = byId.get(primaryId);
    assert.ok(page && types(page).some((t) => pageTypes.has(t)), `Main WebPage: ${primaryId}`);
    assert.ok(page.name && page.inLanguage && page.isPartOf, 'Named page with language and website');
    assert.equal(page.url, inspected.metadata.redirect ? pageUrl : canonical, 'WebPage URL follows canonical policy');
    const archived = isArchivedPath(new URL(canonical).pathname, base || '/');
    if (inspected.metadata.redirect) {
      assert.ok(/noindex/.test(inspected.metadata.robots), 'Redirect remains noindex');
      assert.equal(nodes.filter((n) => hasType(n, 'TouristTrip') || hasType(n, 'Offer')).length, 0, 'Redirect is not another product');
      report.redirects++;
    } else {
      assert.equal(nodes.filter((n) => hasType(n, 'Organization')).length, 1, 'One organization');
      assert.equal(nodes.filter((n) => hasType(n, 'WebSite')).length, 1, 'One website');
      assert.ok(page.description, 'Page description');
      assert.equal(inspected.metadata.ogUrl, canonical, 'Open Graph URL equals canonical');
      assert.ok(inspected.metadata.ogTitle, 'Open Graph title');
      assert.equal(inspected.metadata.ogLocale, 'ru_RU', 'Open Graph locale');
      assert.ok(['summary', 'summary_large_image'].includes(inspected.metadata.twitterCard), 'Twitter card');
      assert.ok(inspected.metadata.twitterTitle, 'Twitter title');
      if (!base && !/noindex/i.test(inspected.metadata.robots)) {
        for (const directive of ['index', 'follow', 'max-image-preview:large', 'max-snippet:-1', 'max-video-preview:-1']) {
          assert.ok(inspected.metadata.robots.includes(directive), `Production robots directive: ${directive}`);
        }
      }
      if (archived) {
        assert.ok(/noindex/.test(inspected.metadata.robots) && /nofollow/.test(inspected.metadata.robots), 'Archive stays noindex,nofollow');
        assert.equal(nodes.filter((n) => hasType(n, 'Offer')).length, 0, 'No archived sales offer');
        report.archives++;
      }
      if (base) assert.ok(/noindex/.test(inspected.metadata.robots), 'Preview stays noindex');
      report.contentPages++;
    }
    for (const node of objects(graph)) {
      for (const type of types(node)) assert.ok(allowedTypes.has(type), `Unknown type ${type}`);
      if (node['@id']) {
        assert.ok(/^https?:\/\//.test(node['@id']), `Absolute @id: ${node['@id']}`);
        if (node['@type']) definitions.add(node['@id']);
        else references.push({ from: filePath, id: node['@id'] });
      }
      if (node.url && typeof node.url === 'string') checkLocalUrl(node.url);
      if (hasType(node, 'BreadcrumbList')) for (const item of node.itemListElement || []) checkLocalUrl(item.item);
      if (hasType(node, 'TouristTrip') || hasType(node, 'Trip')) assert.equal(node.duration, undefined, 'Trip duration is not a schema.org property');
      if (hasType(node, 'Offer')) {
        assert.ok(inspected.facts.priceVisible, 'Offer has a visible pricing block');
        assert.ok(node.priceSpecification?.minPrice > 0, 'Positive starting price');
        assert.ok(/^[A-Z]{3}$/.test(node.priceCurrency), 'Currency code');
        assert.equal(node.price, undefined, 'Do not misrepresent a starting price as fixed');
        assert.equal(node.availability, undefined, 'No guessed availability');
      }
      if (hasType(node, 'FAQPage')) for (const q of node.mainEntity || []) {
        assert.ok(inspected.facts.text.includes(cleanText(q.name)), `Visible FAQ question: ${q.name}`);
        assert.ok(inspected.facts.text.includes(cleanText(q.acceptedAnswer?.text)), `Visible FAQ answer: ${q.name}`);
      }
      if (hasType(node, 'Review')) assert.ok(inspected.facts.text.includes(cleanText(node.reviewBody)), 'Visible review');
      if (hasType(node, 'ItemList')) assert.equal(node.numberOfItems, node.itemListElement?.length, 'ItemList count equals rendered items');
      for (const key of ['reviewRating', 'aggregateRating', 'foundingDate']) assert.equal(node[key], undefined, `No unsupported claim ${key}`);
    }
    if (inspected.facts.catalog) {
      const group = inspected.facts.groups.find((g) => g.catalog);
      const list = byId.get(`${canonical}#catalog`);
      assert.ok(list && hasType(list, 'ItemList'), 'Catalog ItemList');
      assert.equal(list.numberOfItems, group.expectedIds.length, 'Every visible catalog card is represented');
      assert.deepEqual(list.itemListElement.map((n) => n.position), group.expectedIds.map((_, i) => group.offset + i + 1), 'Actual pagination positions');
      assert.deepEqual(list.itemListElement.map((n) => n.url), [...new Set(group.links.map((n) => n.href))], 'Actual card URLs and order');
      assert.equal(page.mainEntity?.['@id'], list['@id'], 'CollectionPage is connected to its list');
      report.catalogPages++;
    }
    const main = byId.get(page.mainEntity?.['@id']);
    const mainType = main ? types(main).join('+') : 'WebPage only';
    report.pageTypes[page['@type']] = (report.pageTypes[page['@type']] || 0) + 1;
    report.mainEntityTypes[mainType] = (report.mainEntityTypes[mainType] || 0) + 1;
    if (nodes.some((n) => hasType(n, 'FAQPage'))) report.faqPages++;
    if (nodes.some((n) => hasType(n, 'Offer'))) report.offerPages++;
    report.withSchema++;
    report.pages.push({ path: inferredPath, type: page['@type'], mainEntity: mainType, nodes: nodes.length, archived: archived && !inspected.metadata.redirect, redirect: inspected.metadata.redirect });
  } catch (error) { report.errors.push({ path: filePath, message: error.message }); }
}
for (const { from, id } of references) {
  // The operator is globally identified on the production domain, even in previews.
  if (id === 'https://adatours.ru/#organization' || definitions.has(id)) continue;
  if (new URL(id).origin === new URL(root).origin) report.errors.push({ path: from, message: `Unresolved entity reference: ${id}` });
}
report.totalHtml = files.length;
writeFileSync(join(output, 'schema-coverage.json'), `${JSON.stringify(report, null, 2)}\n`);
const { pages, ...summary } = report;
console.log(JSON.stringify(summary, null, 2));
assert.ok(files.length > 0, 'No HTML output');
assert.equal(report.errors.length, 0, `Schema acceptance failed. See dist/schema-coverage.json; first errors: ${JSON.stringify(report.errors.slice(0, 8))}`);
assert.equal(report.withSchema, files.length, '100% HTML coverage');
console.log(`Schema checks passed: ${report.totalHtml} HTML pages; ${report.contentPages} content pages, ${report.redirects} redirects, ${report.catalogPages} paginated catalog pages, ${report.archives} archived pages.`);
