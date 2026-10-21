import { CATALOG_PAGE_SIZE } from '../src/lib/catalog-pagination.ts';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readCatalogContent } from './sync-multi-country-registries.mjs';
import { buildMultiCountryCatalog, multiCountryCatalogPath, multiCountryPickerOptions } from '../src/lib/multi-country-catalog.mjs';
const data = await readCatalogContent();
const rows = buildMultiCountryCatalog(data.tours, data.countries, data.themes);
const phase = JSON.parse(readFileSync('data/seo-geo/registry/05-tours.json', 'utf8'));
const records = new Map(phase.entries.map((row) => [row.url, row]));
const exported = JSON.parse(readFileSync('dist/data/multi-country-catalogues.json', 'utf8'));
assert.deepEqual(new Set(exported.catalogs.map((row) => row.path)), new Set(rows.map((row) => row.path)));
const attr = (tag, name) => tag.match(new RegExp('\\b' + name + '="([^"]*)"'))?.[1]?.replaceAll('&amp;', '&');
let checked = 0;
for (const row of rows.filter((item) => item.themeId)) {
  const metadata = records.get(row.path);
  assert.ok(metadata, 'SEO registry entry: ' + row.path);
  assert.equal(metadata.themeId, row.themeId);
  assert.equal(metadata.tours, row.count);
  const p = multiCountryPickerOptions(rows, row.slugs, row.themeId);
  const ids = [];
  for (let page = 1; page <= Math.ceil(row.count / CATALOG_PAGE_SIZE); page++) {
    const path = row.path + (page > 1 ? 'page/' + page + '/' : '');
    const file = join('dist', path, 'index.html');
    assert.ok(existsSync(file), 'Static page exists: ' + path);
    const html = readFileSync(file, 'utf8');
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1, 'One H1: ' + path);
    assert.ok(html.includes(row.theme.name), 'Interest name: ' + path);
    const picker = html.match(/<section\b[^>]*data-multi-country-picker[^>]*>[\s\S]*?<\/section>/)?.[0];
    assert.ok(picker, 'Country + interest selector: ' + path);
    assert.ok(picker.indexOf('data-mc-select=') < picker.indexOf('data-filter-context="multi-country"'));
    assert.ok(picker.indexOf('data-filter-context="multi-country"') < picker.indexOf('data-mc-reset'));
    assert.ok(!picker.includes('data-tour-vip-toggle'), 'No VIP toggle: ' + path);
    assert.ok(picker.includes('href="' + multiCountryCatalogPath(row.slugs) + '"'), 'Interest reset preserves countries');
    for (const option of p.interests) assert.ok(picker.includes('href="' + option.href + '"'), 'Interest link: ' + option.href);
    const found = [...html.matchAll(/data-catalog-item="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(found, row.tours.slice((page - 1) * CATALOG_PAGE_SIZE, page * CATALOG_PAGE_SIZE).map((entry) => entry.data.id));
    ids.push(...found); checked++;
  }
  assert.deepEqual(ids, row.tours.map((entry) => entry.data.id), 'Full thematic sort: ' + row.path);
  // A real, crawlable link exists even when JS is disabled.
  const parent = readFileSync(join('dist', multiCountryCatalogPath(row.slugs), 'index.html'), 'utf8');
  assert.ok(parent.includes('href="' + row.path + '"'), 'Parent links to intersection: ' + row.path);
}
console.log('Multi-country interests: ' + rows.filter((row) => row.themeId).length + ' catalogue roots; ' + checked + ' HTML pages, exact tour sets and selector links.');

// Country-specific interest catalogues must not repeat the multi-country links.
let countryPages = 0;
function checkCountryPages(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) checkCountryPages(file);
    else if (entry.name === 'index.html') {
      const html = readFileSync(file, 'utf8');
      assert.ok(!html.includes('data-multi-country-related'), 'No multi-country recommendations: ' + file);
      countryPages++;
    }
  }
}
for (const interest of readdirSync('dist/interests', { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
  const tours = join('dist/interests', interest.name, 'tours');
  if (!existsSync(tours)) continue;
  for (const country of readdirSync(tours, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'page')) {
    checkCountryPages(join(tours, country.name));
  }
}
assert.ok(countryPages > 0, 'Country-specific interest catalogues exist');
console.log('Interest + country: ' + countryPages + ' pages without multi-country recommendations.');
