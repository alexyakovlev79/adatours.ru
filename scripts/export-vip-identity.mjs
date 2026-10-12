/** Export VIP catalogues using the site's own filter and pagination rules. */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { buildVipFilterIndex } from '../src/lib/vip-filters.mjs';
import { paginateCatalog } from '../src/lib/catalog-pagination.ts';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = (collection) => readdirSync(join(root, 'src/content', collection)).filter(f => f.endsWith('.md')).sort().map(file => ({
  data: yaml.load(readFileSync(join(root, 'src/content', collection, file), 'utf8').split(/^---\s*$/m)[1]),
}));
const rows = buildVipFilterIndex(load('tours'), load('countries'), load('themes')).flatMap(row =>
  paginateCatalog(row.entries, row.href).map(({ entries, pagination }) => ({
    catalog_id: ['vip', row.countryId, row.themeId].filter(Boolean).join(':'),
    name: row.title, ru_url: `https://adatours.ru${pagination.canonical}`,
    root_url: `https://adatours.ru${row.href}`, country_id: row.countryId ?? '',
    country_name: row.country?.data.name ?? '', theme_id: row.themeId ?? '',
    theme_name: row.theme?.data.name ?? '', page_number: pagination.currentPage,
    total_pages: pagination.totalPages, total_tours: row.count,
    tour_ids: entries.map(entry => entry.data.id),
  }))
).sort((a,b) => a.ru_url.localeCompare(b.ru_url, 'en'));
if (new Set(rows.map(row => row.ru_url)).size !== rows.length) throw Error('Duplicate VIP URL');
if (!process.argv[2]) throw Error('Usage: node scripts/export-vip-identity.mjs <output.json>');
writeFileSync(process.argv[2], JSON.stringify(rows, null, 2) + '\n');
console.log(JSON.stringify({pages: rows.length, catalogues: new Set(rows.map(r => r.root_url)).size}));
