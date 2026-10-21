/** Validate IDs in thematic editorial tables against the exact current catalog selection. */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCatalogContent } from './sync-multi-country-registries.mjs';
import { buildTourFilterIndex } from '../src/lib/tour-filters.mjs';
import { buildVipFilterIndex } from '../src/lib/vip-filters.mjs';
import { buildMultiCountryCatalog } from '../src/lib/multi-country-catalog.mjs';
import { buildInterestHub } from '../src/lib/interest-model.mjs';

export function auditThematicTables(articles, content) {
  const scopes = new Map();
  for (const row of buildTourFilterIndex(content.tours, content.countries, content.themes)) scopes.set(row.href, row.entries);
  for (const row of buildVipFilterIndex(content.tours, content.countries, content.themes)) scopes.set(row.href, row.entries);
  for (const row of buildMultiCountryCatalog(content.tours, content.countries, content.themes)) scopes.set(row.path, row.tours);
  for (const theme of content.themes) {
    const d = theme.data ?? theme, hub = buildInterestHub(d.id, content);
    for (const suffix of ['', 'places/', 'excursions/', 'related/']) scopes.set(`/interests/${d.slug}/` + suffix, hub.allTours);
  }
  const problems = [];
  for (const article of articles) {
    if (!/^status:\s*approved\s*$/m.test(article.text)) continue;
    const path = article.text.match(/^targetPath:\s*(\S+)/m)?.[1];
    if (!path?.includes('/interests/')) continue;
    const scope = scopes.get(path);
    // Missing catalogs retain historical articles; they are not rendered.
    if (!scope) continue;
    const valid = new Set(scope.map(tour => (tour.data ?? tour).id));
    for (const match of article.text.matchAll(/\{\{catalog\.tourTable:([^}]+)\}\}/g)) {
      const ids = match[1].split(',').map(id => id.trim());
      const outside = ids.filter(id => !valid.has(id));
      if (outside.length) problems.push({ path, file: article.file, ids, outside });
    }
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory()
    ? files(join(dir, item.name)) : [join(dir, item.name)]);
  const articles = files('data/seo-geo/articles').filter(file => file.endsWith('.md')).map(file => ({ file, text: readFileSync(file, 'utf8') }));
  const problems = auditThematicTables(articles, await readCatalogContent());
  if (problems.length) { console.error(JSON.stringify(problems, null, 2)); process.exitCode = 1; }
  else console.log('Thematic SEO tables: all approved live tables use only tours in their exact current selections.');
}
