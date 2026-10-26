#!/usr/bin/env node
/** Deterministic navigation, label and regression adjustments for taxonomy release. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { DESTINATION_TYPES, NAVIGATION_ROLES, TYPE_LABELS } from '../src/lib/destination-taxonomy.mjs';
const root='data/migrations/destination-taxonomy-20261026/swarm';
const read=p=>fs.readFileSync(p,'utf8');
const json=p=>JSON.parse(read(p));
function substitute(path,oldText,newText) {
  const before=read(path);
  assert.equal(before.split(oldText).length,2,'Missing/nonunique source anchor: '+path+' '+oldText.slice(0,50));
  fs.writeFileSync(path,before.replace(oldText,newText));
}
substitute('src/lib/destination-popularity.ts',
  "import { isActiveEntity } from './archive.mjs';",
  "import { isActiveEntity } from './archive.mjs';\nimport { compareDestinationsForNavigation } from './destination-taxonomy.mjs';");
substitute('src/lib/destination-popularity.ts',
  "  const countDifference =\n    (counts.get(b.data.id) ?? 0) - (counts.get(a.data.id) ?? 0);\n\n  return countDifference || a.data.name.localeCompare(b.data.name, 'ru');",
  "  return compareDestinationsForNavigation(a, b, (left, right) => {\n    const countDifference = (counts.get(right.data.id) ?? 0) - (counts.get(left.data.id) ?? 0);\n    return countDifference || left.data.name.localeCompare(right.data.name, 'ru');\n  });");
substitute('src/layouts/EntityCatalogLayout.astro',
  "import catalogHeroOverrides from '../data/media/catalog-hero-overrides.json';",
  "import { destinationTypeLabel } from '../lib/destination-taxonomy.mjs';\nimport catalogHeroOverrides from '../data/media/catalog-hero-overrides.json';");
substitute('src/layouts/EntityCatalogLayout.astro',
  "meta: variant === 'global-places' ? countryRoute(d.countryId).name : ''",
  "meta: [variant === 'global-places' ? countryRoute(d.countryId).name : '', destinationTypeLabel(d.destinationType)].filter(Boolean).join(' · ')");
substitute('tests/destination-reservations.test.mjs',
  "const request = (name, extra = {}) => ({ countryId: 'country_argentina', name, discoveredIn: discovery, ...extra });",
  "const request = (name, extra = {}) => ({ countryId: 'country_argentina', name, destinationType: 'city', navigationRole: 'hub', discoveredIn: discovery, ...extra });");
substitute('tests/destination-reservations.test.mjs',
  "  assert.equal(first.catalog[0].destinationType, undefined);",
  "  assert.equal(first.catalog[0].destinationType, 'city');\n  assert.equal(first.catalog[0].navigationRole, 'hub');");
substitute('tests/destination-reservations.test.mjs',
  "sourceUrl: 'https://brasiltours.ru/existing', aliases: ['El Chaltén']",
  "sourceUrl: 'https://brasiltours.ru/existing', destinationType: 'city', navigationRole: 'hub', aliases: ['El Chaltén']");
fs.appendFileSync('tests/destination-reservations.test.mjs','\n' + [
"test('new places require two independently validated taxonomy fields', () => {",
"  for (const override of [{ destinationType: undefined }, { navigationRole: undefined }, { destinationType: 'unknown' }, { navigationRole: 'maybe' }]) {",
"    const result = reserveDestinations(empty(), newRequest('Тигре', 'Tigre', override));",
"    assert.equal(result.ok, false);",
"    assert.equal(result.results[0].outcome, 'invalid');",
"  }",
"  const w = reserveDestinations(empty(), newRequest('Водопад Тест', 'Test Falls', { destinationType: 'waterfall', navigationRole: 'sight' }));",
"  assert.equal(w.ok, true);",
"  assert.equal(w.catalog[0].destinationType, 'waterfall');",
"  assert.equal(w.catalog[0].navigationRole, 'sight');",
"  assert.equal(reserveDestinations(continueWith(w), request('Водопад Тест', { destinationType: 'city', navigationRole: 'hub' })).ok, false);",
"  assert.equal(reserveDestinations(continueWith(w), request('Водопад Тест', { destinationType: undefined, navigationRole: undefined })).changed, false);",
"});"
].join('\n')+'\n');
const manifest=json(root+'/manifest.json');
const catalog=json('src/data/catalog/destinations.json');
const compact=json('data/source-index/catalogs/destinations.json');
assert.equal(manifest.status,'prepared');
assert.equal(manifest.classification.ready,1018);
assert.equal(manifest.classification.review,0);
assert.equal(catalog.length,1018);
assert.equal(compact.entries.length,1018);
assert.equal(DESTINATION_TYPES.length,36);
assert.equal(Object.keys(TYPE_LABELS).length,36);
const jobs=new Map();
for(const packet of manifest.packets) {
  const job=json(packet.jobPath);
  assert.equal(job.records.length,packet.count);
  assert.equal(job.sourceFingerprint,packet.sourceFingerprint);
  for(const r of job.records) {
    assert.ok(!jobs.has(r.id),'Duplicate immutable ID '+r.id);
    jobs.set(r.id,r);
  }
}
assert.equal(jobs.size,1018);
const byCompact=new Map(compact.entries.map(x=>[x.id,x]));
assert.equal(byCompact.size,1018);
const ids=new Set(),urls=new Set(),typeCounts={},roleCounts={};
let entriesChecked=0,mdChecked=0;
for(const row of catalog) {
  const job=jobs.get(row.id),linked=byCompact.get(row.id);
  assert.ok(job&&linked,'Missing identity '+row.id);
  assert.ok(!ids.has(row.id),'Duplicate ID '+row.id); ids.add(row.id);
  assert.ok(!urls.has(row.url),'Duplicate URL '+row.url); urls.add(row.url);
  for(const key of ['id','name','slug','countryId','url'])
    assert.equal(row[key],job[key],'Frozen identity changed: '+row.id+':'+key);
  assert.equal(linked.url,row.url);
  assert.equal(linked.destinationType,row.destinationType);
  assert.equal(linked.navigationRole,row.navigationRole);
  assert.ok(DESTINATION_TYPES.includes(row.destinationType),'Bad type '+row.id);
  assert.ok(NAVIGATION_ROLES.includes(row.navigationRole),'Bad role '+row.id);
  typeCounts[row.destinationType]=(typeCounts[row.destinationType]||0)+1;
  roleCounts[row.navigationRole]=(roleCounts[row.navigationRole]||0)+1;
  if(linked.entryPath && fs.existsSync(linked.entryPath)) {
    const entry=json(linked.entryPath);
    assert.equal(entry.id,row.id);
    assert.equal(entry.destinationType,row.destinationType);
    assert.equal(entry.navigationRole,row.navigationRole);
    entriesChecked++;
  }
  if(linked.contentPath && fs.existsSync(linked.contentPath)) {
    const md=read(linked.contentPath);
    const fm=md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(fm,'Bad YAML frontmatter '+row.id);
    for(const [key,value] of [['destinationType',row.destinationType],['navigationRole',row.navigationRole]]) {
      const matches=[...fm[1].matchAll(new RegExp('^'+key+':\\s*([^\\r\\n]+)$','gm'))];
      assert.equal(matches.length,1,'Missing/duplicate MD key '+row.id+' '+key);
      assert.equal(matches[0][1].trim(),value,'Wrong MD key '+row.id+' '+key);
    }
    mdChecked++;
  }
}
const report={status:'PREPARED_NOT_DEPLOYED',checked:1018,packets:51,review:0,sourceEntriesChecked:entriesChecked,contentMdChecked:mdChecked,
  types:typeCounts,roles:roleCounts,sourceCommit:manifest.sourceCommit};
fs.writeFileSync(root+'/cutover-validation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
