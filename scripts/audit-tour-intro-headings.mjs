import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { isMisplacedTourIntroHeading, splitTourIntroHtml } from '../src/lib/tour-intro-heading.mjs';

const toursDir = fileURLToPath(new URL('../src/content/tours/', import.meta.url));
const files = readdirSync(toursDir).filter(name => name.endsWith('.md')).sort();
const relocated = [], editorial = [], withoutLeadingHeading = [];
let excluded = 0;
for (const filename of files) {
  const content = readFileSync(join(toursDir, filename), 'utf8');
  const fm = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  if (!fm) throw new Error('Invalid tour frontmatter: ' + filename);
  const body = content.slice(fm[0].length);
  // After a body paragraph, a heading already has the right section position.
  const match = body.match(/^\s*##[ \t]+([^\r\n]+)/);
  if (!match) { withoutLeadingHeading.push(filename); continue; }
  const original = match[1].trim();
  if (!isMisplacedTourIntroHeading(original)) { editorial.push(filename); continue; }
  const testHtml = '<h2>' + original + '</h2><p>Section content</p>';
  const result = splitTourIntroHtml(testHtml);
  if (result.introHeadingHtml !== '<h2>О путешествии</h2>' ||
      !result.descriptionHtml.includes('<h3>' + original + '</h3>')) {
    throw new Error('Tour heading would not relocate: ' + filename + ': ' + original);
  }
  const status = fm[0].match(/^status:\s*(\S+)/m)?.[1] ?? 'unknown';
  if (status === 'draft' || status === 'archived') excluded++;
  relocated.push({file:filename, original, status});
}
const report = {
  scanned:files.length, leadingEditorial:editorial.length,
  headingRepositioned:relocated.length,
  noLeadingHeading:withoutLeadingHeading.length,
  archivedOrDraftAmongRepositioned:excluded, repositioned:relocated,
};
if (process.argv.includes('--json')) console.log(JSON.stringify(report,null,2));
else {
  console.log('Tour heading audit: ' + report.scanned + ' tour files; ' + report.headingRepositioned +
              ' service/price headings relocated; ' + report.leadingEditorial +
              ' editorial headings kept; ' + report.noLeadingHeading + ' neutral headings.');
  for (const row of relocated) console.log('  ' + row.file + ': ' + row.original);
}
