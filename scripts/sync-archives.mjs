/** Idempotent lifecycle synchronization. No body, media or identity changes. */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'node:url';
import { archiveEntries, archiveById } from '../src/lib/archive.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const apply = process.argv.includes('--apply');
const updates = [];
function stage(file, next) {
  const current = fs.readFileSync(file, 'utf8');
  if (current !== next) { updates.push(path.relative(root, file)); if (apply) fs.writeFileSync(file, next); }
}
for (const a of archiveEntries) {
  const sourceFile = path.join(root, 'data/source-index/entries', `${a.id}.json`);
  const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  if (!['tour', 'excursion'].includes(a.type) || source.id !== a.id || source.url !== a.url || source.contentPath !== a.contentPath) throw new Error(`Archive identity mismatch: ${a.id}`);
  if (a.duplicateOf === a.id || a.duplicateOf && archiveById.has(a.duplicateOf)) throw new Error(`Archive replacement must be active: ${a.id}`);
  source.status = 'archived'; source.archivedAt = a.archivedAt;
  source.archiveReason = a.reason;
  if (a.duplicateOf) source.archiveDuplicateOf = a.duplicateOf;
  else delete source.archiveDuplicateOf;
  stage(sourceFile, JSON.stringify(source, null, 2) + '\n');
  const contentFile = path.join(root, a.contentPath);
  if (!fs.existsSync(contentFile)) {
    if (a.hadPage) throw new Error(`Previously published archive missing: ${a.id}`);
    continue; // A source-only record never creates a placeholder page.
  }
  const current = fs.readFileSync(contentFile, 'utf8');
  const parts = current.match(/^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))([\s\S]*)$/);
  if (!parts) throw new Error(`Missing YAML: ${a.contentPath}`);
  const data = yaml.load(parts[2]);
  if (data.id !== a.id) throw new Error(`Content ID mismatch: ${a.id}`);
  let front = parts[2].replace(/^status:\s*.*$/m, 'status: archived');
  if (!/^status:/m.test(front)) front = `status: archived\n${front}`;
  front = front.replace(/^(?:archivedAt|archiveReason|archiveDuplicateOf):.*\r?\n?/gm, '').trimEnd();
  front += `\narchivedAt: "${a.archivedAt}"\narchiveReason: ${JSON.stringify(a.reason)}`;
  if (a.duplicateOf) front += `\narchiveDuplicateOf: ${JSON.stringify(a.duplicateOf)}`;
  stage(contentFile, parts[1] + front + parts[3] + parts[4]);
}
if (apply) await import('./sync-source-catalogs.mjs');
console.log(JSON.stringify({ archiveRecords: archiveEntries.length, apply, changedFiles: updates }, null, 2));
if (!apply && updates.length) { console.error('Archive lifecycle drift: run node scripts/sync-archives.mjs --apply'); process.exitCode = 1; }
