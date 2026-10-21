/** Build-time projection: no network, no source-index entities, no editorial rewrites. */
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMultiCountryCatalog } from '../src/lib/multi-country-catalog.mjs';
import { multiCountrySnapshot, reconcileMultiCountryRegistries, multiCountrySeoSheetRow, multiCountryTypeLabel, csvText } from '../src/lib/multi-country-registry.mjs';
import { reconcileInterestRegistries } from '../src/lib/interest-registry-projection.mjs';

const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
export const PHASE_FILES = ['01-countries.json', '02-interests.json', '03-country-interest.json', '04-country-interest-vip.json', '05-tours.json', '06-places.json', '07-excursions.json'];
export async function readCatalogContent(root = process.cwd()) {
  const { default: yaml } = await import('js-yaml');
  const files = (folder) => readdirSync(folder, { withFileTypes: true }).flatMap((item) => {
    const path = join(folder, item.name);
    return item.isDirectory() ? files(path) : /\.mdx?$/.test(item.name) ? [path] : [];
  });
  const read = (collection) => files(join(root, 'src/content', collection)).sort().map((path) => {
    const raw = readFileSync(path, 'utf8');
    return { data: yaml.load(raw.split(/^---\s*$/m)[1]) };
  });
  return { tours: read('tours'), countries: read('countries'), themes: read('themes'),
    destinations: read('destinations'), excursions: read('excursions') };
}
export function compactRegistry(phase) {
  const { entries, ...head } = phase;
  return JSON.stringify(head, null, 2).replace(/\n}$/, ',\n  "entries": [\n')
    + entries.map((entry) => '    ' + JSON.stringify(entry)).join(',\n') + '\n  ]\n}\n';
}
export async function syncMultiCountryRegistries({ root = process.cwd(), content, write = false } = {}) {
  const source = content ?? await readCatalogContent(root);
  const rows = buildMultiCountryCatalog(source.tours, source.countries, source.themes);
  const snapshot = multiCountrySnapshot(rows, { destinations: json(join(root, 'src/data/catalog/destinations.json')),
    covers: json(join(root, 'src/data/media/multi-country-heroes.json')).covers });
  const registryRoot = join(root, 'data/seo-geo/registry');
  const before = PHASE_FILES.map((name) => json(join(registryRoot, name)));
  const interests = reconcileInterestRegistries(before, source);
  const reconciled = reconcileMultiCountryRegistries(interests, json(join(registryRoot, 'index.json')), snapshot);
  const outputs = new Map();
  PHASE_FILES.forEach((name, i) => {
    if (JSON.stringify(before[i]) !== JSON.stringify(reconciled.phases[i])) outputs.set('data/seo-geo/registry/' + name, compactRegistry(reconciled.phases[i]));
  });
  outputs.set('data/seo-geo/registry/index.json', JSON.stringify(reconciled.index, null, 2) + '\n');
  outputs.set('data/catalogues/multi-country.json', JSON.stringify(snapshot, null, 2) + '\n');
  // Separate derived-catalogue identity inventory. Historical third-party audits
  // stay immutable; a new catalogue has NO implied sameAs on any other domain.
  const external = { version: 1, fingerprint: snapshot.fingerprint, kind: 'derived_catalogues',
    catalogs: snapshot.catalogs.map(({ id, name, path, countryIds, themeId, totalPages, tourIds }) => ({
      id, name, path, countryIds, themeId, totalPages, tourIds, sameAs: [], verification: 'not_claimed',
    })) };
  outputs.set('data/external-identity/multi-country-catalogues.json', JSON.stringify(external, null, 2) + '\n');
  outputs.set('public/data/multi-country-catalogues.json', JSON.stringify(snapshot) + '\n');
  const inventoryHeader = ['ID', 'Название', 'URL', 'Страны', 'Интерес', 'Туров', 'HTML-страниц', 'Тип', 'Отпечаток'];
  const inventoryRows = snapshot.catalogs.filter((row) => row.themeId).map((row) => [row.id, row.name,
    'https://adatours.ru' + row.path, row.countryNames.join(', '), row.themeName, row.count, row.totalPages, multiCountryTypeLabel(row.kind), snapshot.fingerprint]);
  outputs.set('public/data/multi-country-interests.csv', csvText([inventoryHeader, ...inventoryRows]));
  const byPath = new Map(snapshot.catalogs.map((row) => [row.path, row]));
  const entries = reconciled.phases.find((phase) => phase.phase === 5).entries.filter((entry) => byPath.has(entry.url));
  const seoRows = entries.filter((entry) => byPath.get(entry.url).themeId).map((entry) => multiCountrySeoSheetRow(entry, byPath.get(entry.url)));
  // Headerless import files are for one-time copy-as-values into the established
  // editable tabs. The inventory tab imports the version above continuously.
  outputs.set('public/data/multi-country-interests-seo-rows.csv', csvText(seoRows));
  const now = new Date().toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' });
  outputs.set('public/data/multi-country-interests-page-rows.csv', csvText(entries.filter((entry) => byPath.get(entry.url).themeId)
    .map((entry) => ['https://adatours.ru' + entry.url, '', multiCountryTypeLabel(entry.kind), entry.name,
      'Добавлена', now, '', entry.id, 'Производный каталог. ' + byPath.get(entry.url).count + ' туров; ' + snapshot.fingerprint])));
  outputs.set('public/data/multi-country-seo-order.csv', csvText([['URL', '№'], ...reconciled.phases.flatMap((phase) => phase.entries).map((entry) => ['https://adatours.ru' + entry.url, entry.order])]));
  outputs.set('docs/catalogues/multi-country.md', '# Multi-country: автоматически вычисляемые каталоги\n\n'
    + 'Источник: активные production-данные. Скрипт: `npm run sync:multi-country`.\n\n'
    + 'Сочетаний стран: ' + snapshot.counts.combinations + '. Пересечений с интересами: ' + snapshot.counts.intersections
    + '. Общих тематических каталогов: ' + snapshot.counts.thematicIndexes + '.\n\n'
    + '| Каталог | Страны | Интерес | Туров | Страниц |\n|---|---|---|---:|---:|\n'
    + snapshot.catalogs.map((row) => '| [' + row.name + '](' + row.path + ') | ' + row.countryNames.join(', ') + ' | ' + row.themeName + ' | ' + row.count + ' | ' + row.totalPages + ' |').join('\n') + '\n');
  if (write) for (const [file, text] of outputs) {
    const path = join(root, file);
    if (existsSync(path) && readFileSync(path, 'utf8') === text) continue;
    mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text);
  }
  return { snapshot, reconciled, outputs };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await syncMultiCountryRegistries({ write: process.argv.includes('--write') });
  console.log(JSON.stringify({ ...result.snapshot.counts, seoQueue: result.reconciled.index.totalRows,
    fingerprint: result.snapshot.fingerprint, written: process.argv.includes('--write') }));
}
