import test from 'node:test';
import assert from 'node:assert/strict';
import { auditThematicTables } from '../scripts/check-seo-interest-tables.mjs';
const themes = [
  { id: 'theme_nature', slug: 'nature', name: 'Природа', locale: 'ru' },
  { id: 'theme_wildlife', slug: 'wildlife', name: 'Животные и сафари', locale: 'ru' },
];
const countries = [{ id: 'country_brazil', slug: 'brazil', name: 'Бразилия', locale: 'ru' }];
const tour = { id: 'landscape', title: 'Игуасу', locale: 'ru', countries: ['country_brazil'], primaryThemes: ['theme_nature'], themes: [] };
const animal = { ...tour, id: 'safari', primaryThemes: ['theme_wildlife'] };
const content = { themes, countries, tours: [tour, animal], destinations: [], excursions: [] };
const article = (path, id, status = 'approved') => ({ file: 'example.md', text: `---\ntargetPath: ${path}\nstatus: ${status}\n---\n{{catalog.tourTable:${id}}}` });
test('wrong thematic table fails even when the tour is still active elsewhere; draft and unavailable targets do not render', () => {
  const rows = auditThematicTables([
    article('/interests/wildlife/tours/', 'landscape'),
    article('/interests/nature/tours/', 'landscape'),
    article('/interests/wildlife/tours/', 'safari'),
    article('/interests/wildlife/tours/', 'landscape', 'draft'),
    article('/vip/argentina/interests/wildlife/', 'landscape'),
  ], content);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].outside, ['landscape']);
});
