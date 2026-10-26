// Pre-extraction SSR source validation: every combination must exist in Astro's header.
// After this check and Pagefind, the final artifact deduplicates shared HTML.
// Crawlers retain all links on the /multi-country/ catalogue and in sitemap.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const output = 'dist';
const root = join(output, 'multi-country');
const names = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^(?:[a-z0-9-]+_){1,3}[a-z0-9-]+$/.test(entry.name))
  .filter((entry) => existsSync(join(root, entry.name, 'index.html')))
  .map((entry) => entry.name);
const expected = new Set(names.map((name) => '/multi-country/' + name + '/'));
const examples = [
  join(output, 'index.html'),
  join(output, 'multi-country', 'index.html'),
  join(output, 'vip', 'index.html'),
  ...names.slice(0, 3).map((name) => join(root, name, 'index.html')),
];
for (const file of examples) {
  const html = readFileSync(file, 'utf8');
  const header = html.match(/<header\b[^>]*data-site-header[^>]*>[\s\S]*?<\/header>/)?.[0];
  assert.ok(header, 'Missing header: ' + file);
  assert.ok(!/<script\b[^>]*\btype="module"/.test(header),
    'Module entrypoints must survive shared-header extraction: ' + file);
  const linked = [...header.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)]
    .map((match) => match[1].replaceAll('&amp;', '&'))
    .filter((href) => /^\/multi-country\/[a-z0-9_-]+\/$/.test(href));
  assert.deepEqual([...new Set(linked)].sort(), [...expected].sort(), 'Header links differ: ' + file);
  assert.equal(linked.length, expected.size, 'Every combination must appear exactly once in source HTML: ' + file);
  assert.ok(header.includes('data-mc-menu-source="true"'), 'Mobile menu must own the real SSR links: ' + file);
}
const pair = [...expected].find((path) => path.split('_').length === 2);
if (pair) {
  const html = readFileSync(join(output, pair.slice(1), 'index.html'), 'utf8');
  assert.ok(/<h1\b[^>]*>[\s\S]*?\sи\s[\s\S]*?<\/h1>/.test(html),
    'Pair catalogue H1 should use the natural country conjunction');
  assert.ok(!/<h1\b[^>]*>[\s\S]*?\s\+\s[\s\S]*?<\/h1>/.test(html),
    'Pair catalogue H1 must not separate countries with plus signs');
}
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
const picker = indexHtml.match(/<section\b[^>]*data-multi-country-picker[^>]*>[\s\S]*?<\/section>/)?.[0];
assert.ok(picker, 'Multi-country selector missing');
assert.equal((picker.match(/data-mc-select=/g) ?? []).length, 4, 'Expected four progressive selectors');
assert.ok(!/data-mc-pair-link|data-mc-extended-link|data-mc-alternative-link/.test(picker),
  'All combination link collections must be moved into the header');
assert.ok(!picker.includes('>Выберите страну</option>'), 'Selector placeholder must name the country position');
assert.ok(picker.includes('>Первая страна</option>'), 'First dropdown must have an ordinal placeholder');
const interests = picker.match(/<select\b[^>]*data-mc-interest-select[^>]*>[\s\S]*?<\/select>/)?.[0];
assert.ok(interests, 'Interest control must be a native select like country controls');
assert.match(interests, /<option[^>]*value=""[^>]*disabled[^>]*>Выбрать интерес<\/option>/,
  'Interest placeholder must be disabled and muted in Firefox dropdown');
assert.ok(interests.includes('data-mc-interest-reset'), 'Reset interest must stay available');
assert.ok(picker.includes('mc-picker__interest-fallback'), 'Interest links must remain usable without JavaScript');
for (const label of ['Первая страна', 'Вторая страна', 'Третья страна', 'Четвертая страна']) {
  assert.match(picker, new RegExp('<option[^>]*value=""[^>]*\\bdisabled\\b[^>]*>' + label + '</option>'),
    'Native popup placeholder must be disabled and therefore muted: ' + label);
}
const pickerSource = readFileSync('src/components/catalog/MultiCountrySelector.astro', 'utf8');
const pickerClient = readFileSync('src/scripts/multi-country-selector.ts', 'utf8');
assert.match(pickerSource, /option value="" disabled selected=\{!step\.value\}/,
  'SSR must keep the empty disabled option selected instead of auto-selecting a country');
assert.match(pickerClient, /placeholderOption\.disabled = true;/,
  'JS render must preserve the muted disabled option after replacing dropdown choices');
assert.match(pickerClient, /new Option\(placeholders\[index\], '', !value, !value\)/,
  'JS render must retain selected placeholder for every empty country position');
assert.match(pickerClient, /data-mc-remove/,
  'Country controls must keep the explicit removal action');
assert.match(pickerSource, /data-mc-reset/,
  'The whole selection must remain resettable');
if (names.length) {
const combinationHtml = readFileSync(join(root, names[0], 'index.html'), 'utf8');
assert.ok(combinationHtml.includes('data-mc-remove="1"'),
  'Second selected country must have a client-side removal control');
assert.ok(combinationHtml.includes('mc-picker__reset'),
  'Combination catalogue must display its styled reset action');
}
console.log('Multi-country menu: ' + expected.size + ' combination URLs on ' + examples.length + ' sampled pages.');
