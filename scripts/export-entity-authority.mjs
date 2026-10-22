import { readFileSync, writeFileSync } from 'node:fs';

// Deterministic, reviewable spreadsheet export; JSON remains the source of truth.
const registryUrl = new URL('../data/external-identity/entity-authority-20261022.json', import.meta.url);
const exportUrl = new URL('../data/external-identity/entity-authority-20261022.csv', import.meta.url);
const registry = JSON.parse(readFileSync(registryUrl, 'utf8'));
const columns = ['id', 'url', 'name', 'kind', 'schema_type', 'status', 'probability',
  'deployment', 'relations', 'display_on', 'publisher', 'language', 'date_published',
  'date_modified', 'start_date', 'checked_at', 'verification_mode', 'evidence',
  'evidence_urls', 'notes'];
const rows = [
  ...registry.sources.map((source) => [source.id, source.url, source.name, source.kind,
    source.schemaType, source.status, source.probability, source.deployment,
    Object.entries(source.relations).map(([property, entities]) => `${property}: ${entities.join(', ')}`).join(' | '),
    source.displayOn.join(' | '), source.publisher?.name, source.language,
    source.datePublished, source.dateModified, source.startDate, source.checkedAt,
    source.verificationMode, source.evidence, source.evidenceUrls?.join(' | '), source.notes]),
  ...registry.candidates.map((candidate) => ['', candidate.url, candidate.name, candidate.kind,
    '', candidate.status, candidate.probability, 'not_published', '', '', '', '', '', '', '',
    candidate.checkedAt, candidate.verificationMode, candidate.evidence,
    candidate.evidenceUrls?.join(' | '), candidate.decision]),
];
const cell = (value) => {
  const string = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
};
const csv = [columns, ...rows].map((row) => row.map(cell).join(',')).join('\n') + '\n';
if (process.argv.includes('--check')) {
  let current;
  try { current = readFileSync(exportUrl, 'utf8'); } catch { current = ''; }
  if (current !== csv) {
    console.error('Entity authority CSV is stale. Run: node scripts/export-entity-authority.mjs');
    process.exitCode = 1;
  } else console.log(`Entity authority export is current: ${registry.sources.length} verified sources, ${registry.candidates.length} excluded candidate/rejected rows.`);
} else {
  writeFileSync(exportUrl, csv);
  console.log(`Wrote ${rows.length} entity authority rows.`);
}
