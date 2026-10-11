/** Export entity identities using the same routes and archive rules as the site. */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { countryPath, destinationPath, tourPath, excursionPath, themePath } from '../src/lib/routes.ts';
import { isActiveEntity, isArchivedEntity } from '../src/lib/archive.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const types = { countries: 'country', destinations: 'destination', tours: 'tour', excursions: 'excursion', themes: 'theme', people: 'person', cases: 'case', articles: 'article' };
const paths = { country: countryPath, destination: destinationPath, tour: tourPath, excursion: excursionPath, theme: themePath,
  person: d => `/team/${d.slug}/`, case: d => `/cases/${d.slug}/`, article: d => `/articles/${d.slug}/` };
const entities = [];
for (const [collection, type] of Object.entries(types)) {
 const dir = join(root, 'src/content', collection);
 for (const file of readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
  const full = join(dir, file), raw = readFileSync(full, 'utf8');
  const data = yaml.load(raw.split(/^---\s*$/m)[1]);
  if (data.locale !== 'ru' || !(isActiveEntity(data) || ['tour','excursion'].includes(type) && isArchivedEntity(data))) continue;
  entities.push({ id: data.id, type, name: data.name || data.title || data.slug, path: paths[type](data), contentPath: relative(root, full),
    data: Object.fromEntries(['id','slug','countryId','countries','routeCountries','country','destination','status'].filter(k => k in data).map(k => [k,data[k]])) });
 }
}
const ids = entities.map(e => e.id), routes = entities.map(e => e.path);
if (new Set(ids).size !== ids.length || new Set(routes).size !== routes.length) throw Error('Duplicate ID or entity route');
const target = process.argv[2];
if (!target) throw Error('Usage: node scripts/identity-entities.mjs <output.json>');
writeFileSync(target, JSON.stringify(entities));
console.log(JSON.stringify({entities: entities.length, types: Object.fromEntries(Object.values(types).map(t => [t, entities.filter(e => e.type === t).length]))}));
