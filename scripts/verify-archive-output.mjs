/** Verify existing build: archives open, noindex/nofollow, no public links/search/sitemap. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { archiveEntries, archiveById, isArchivedPath } from '../src/lib/archive.mjs';
import { aliasesForEntity } from '../src/lib/routes.ts';
import { readPhotoInputs, buildPhotoQueue } from './photo-queue.mjs';
const output = path.resolve(process.argv[2] ?? 'dist');
const files = [];
function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) walk(f); else files.push(f); } }
walk(output);
const sitemap = files.filter((f) => /sitemap.*\.xml$/.test(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const home = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
const site = new URL(home.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1] ?? home.match(/<link[^>]*href="([^"]+)"[^>]*rel="canonical"/)?.[1]);
const fileFor = (url) => path.join(output, url.replace(/^\//, ''), 'index.html');
let details = 0, aliases = 0;
for (const a of archiveEntries) {
  assert.ok(!sitemap.includes(new URL(a.url.replace(/^\//, ''), site).href + '</loc>'), `Archive in sitemap: ${a.id}`);
  if (!a.hadPage) { assert.ok(!fs.existsSync(fileFor(a.url)), `Source-only placeholder must not be published: ${a.id}`); continue; }
  const html = fs.readFileSync(fileFor(a.url), 'utf8');
  assert.match(html, /<meta\b[^>]*name="robots"[^>]*content="noindex, nofollow"/);
  assert.match(html, /data-catalog-status="archived"/);
  assert.ok(!html.includes('data-pagefind-body'), `Archive in search: ${a.id}`);
  assert.ok(!/<meta\b[^>]*http-equiv="refresh"/.test(html), `Canonical archive must not redirect: ${a.id}`);
  for (const old of aliasesForEntity(a.type, JSON.parse(fs.readFileSync(`data/source-index/entries/${a.id}.json`, 'utf8')), a.url)) {
    const redirect = fs.readFileSync(fileFor(old), 'utf8');
    assert.ok(redirect.includes('noindex') && redirect.includes(a.url));
    aliases++;
  }
  details++;
}
for (const file of files.filter((f) => f.endsWith('.html'))) {
  const html = fs.readFileSync(file, 'utf8');
  if (/name="robots"[^>]*content="[^"]*noindex/.test(html)) continue;
  for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)) {
    const url = new URL(match[1].replaceAll('&amp;', '&'), site);
    if (url.origin === site.origin) assert.ok(!isArchivedPath(url.pathname, site.pathname), `Public link to archive: ${path.relative(output, file)} -> ${url.pathname}`);
  }
  assert.ok(!html.includes('data-excursion-ref="excursion_source_makuko_safari"'), `Archived excursion card: ${file}`);
}
const queue = buildPhotoQueue({ ...readPhotoInputs(), all: true });
assert.ok(queue.selectedEntityIds.every((id) => !archiveById.has(id)));
assert.ok([...queue.photos, ...queue.reuse].every((group) => group.slots.every((slot) => !archiveById.has(slot.entityId))));
console.log(JSON.stringify({ archiveRecords: archiveEntries.length, accessibleArchivedDetails: details, preservedAliases: aliases, sourceOnlyArchiveRecords: archiveEntries.length - details, publicLinksToArchive: 0, archiveSearchRecords: 0, archivePhotoJobs: 0 }, null, 2));
