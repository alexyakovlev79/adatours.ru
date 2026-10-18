/**
 * Ada Tours SEO/GEO: conservative voice-only rewrite gate.
 * Pure ESM: usable by Node, GitHub Actions and connector Code Mode.
 * Structural fidelity is machine-checked; factual fidelity remains an editorial duty.
 */
export const REWRITE_BRANCH = 'seo-geo/voice-rewrite-staging';
export const CONTROL_BRANCH = 'seo-geo/voice-rewrite-control';
export const PHASE_FILES = [
  '01-countries.json', '02-interests.json', '03-country-interest.json',
  '04-country-interest-vip.json', '05-tours.json', '06-places.json',
  '07-excursions.json',
];
export const REWRITE_ROOT = 'data/seo-geo/voice-rewrite';
export const ARTICLE_ROOT = 'data/seo-geo/articles';
export const MAX_BATCH = 10;
export const MAX_CYCLES = 10;
export const BATCH_MINUTES = 30;

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
const URL = /^\/(?:[a-z0-9]+(?:[-_][a-z0-9]+)*\/)+$/;
const PROTECTED = /\[[^\]\n]+\]\([^) \n]+\)|\{\{[^}]*\}\}|\x60[^\x60\n]*\x60/g;
const NUMBER = /[$€£¥]?\d+(?:[.,]\d+)*(?:[-–—/]\d+(?:[.,]\d+)*)?%?/g;

function assert(condition, message) {
  if (!condition) throw Error('SEO voice rewrite: ' + message);
}
export function articlePath(url) {
  assert(typeof url === 'string' && URL.test(url) && !/\/page\/\d+\/$/.test(url),
    'invalid canonical URL ' + url);
  return ARTICLE_ROOT + url + 'index.md';
}
export function parseArticle(raw) {
  assert(typeof raw === 'string', 'article is not a string');
  const m = FRONTMATTER.exec(raw);
  assert(m, 'missing Markdown frontmatter');
  return { front: m[1], body: m[2] };
}
function field(front, name) {
  const m = front.match(new RegExp('^' + name + ':\\s*(.*)$', 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}
function leadMask(front) {
  const rows = front.split('\n');
  const index = rows.findIndex(line => /^lead:\s*/.test(line));
  assert(index !== -1, 'lead is missing');
  const leadValues = [];
  const marker = rows[index].match(/^lead:\s*([>|][-+]?)\s*$/);
  if (marker) {
    let i = index + 1;
    for (; i < rows.length && (rows[i].startsWith(' ') || !rows[i]); i++) {
      if (!rows[i].trim()) {
        leadValues.push('');
      } else {
        leadValues.push(rows[i].trim());
        rows[i] = rows[i].match(/^\s*/)[0] + '<LEAD>';
      }
    }
  } else {
    const value = rows[index].match(/^(lead:\s*)(["']?)(.*?)(\2)$/);
    assert(value, 'unsupported scalar lead');
    leadValues.push(value[3]);
    rows[index] = value[1] + value[2] + '<LEAD>' + value[4];
  }
  return { masked: rows.join('\n'), value: leadValues.join('\n') };
}
function matches(value, regex) { return [...value.matchAll(regex)].map(x => x[0]); }
function count(value, needle) { return value.split(needle).length - 1; }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function invariantText(oldLine, newLine, where) {
  assert(same(matches(oldLine, PROTECTED), matches(newLine, PROTECTED)),
    where + ': hyperlink, shortcode or inline code changed');
  assert(same(matches(oldLine, NUMBER), matches(newLine, NUMBER)),
    where + ': number, price or date changed');
  for (const mark of ['**', '__', '~~', '*', '_', '€', '$', '%']) {
    assert(count(oldLine, mark) === count(newLine, mark),
      where + ': markup or currency marker changed (' + mark + ')');
  }
  assert(!/https?:\/\/|javascript:|<script\b|<img\b/i.test(newLine),
    where + ': new link, HTML or script is forbidden');
}
function linePrefix(line) {
  return line.match(/^(\s*(?:(?:[-+*]|\d+[.)])\s+|>\s*)?)/)[0];
}
function frozenLine(line, inFence) {
  return inFence || /^\s*(?:#{1,6}\s|\x60{3}|~~~|\|.*\||\{\{[#/]|-{3,}\s*$|_{3,}\s*$|<)/.test(line)
    || /^\s*\|?\s*:?-{2,}/.test(line);
}
export function validateVoiceRewrite(original, rewritten, expectedUrl) {
  const a = parseArticle(original), b = parseArticle(rewritten);
  assert(expectedUrl && field(a.front, 'targetPath') === expectedUrl,
    'source targetPath mismatch');
  assert(field(a.front, 'status') === 'approved' && field(b.front, 'status') === 'approved',
    'the original article must remain approved');
  assert(a.body.startsWith('\n## ') || a.body.startsWith('## '),
    'source body has no leading H2');
  const oldLead = leadMask(a.front), newLead = leadMask(b.front);
  assert(oldLead.masked === newLead.masked,
    'frontmatter changed outside the lead text');
  const leadA = oldLead.value.split('\n'), leadB = newLead.value.split('\n');
  assert(leadA.length === leadB.length, 'lead line layout changed');
  for (let i = 0; i < leadA.length; i++)
    invariantText(leadA[i], leadB[i], 'lead line ' + (i + 1));
  const oldLines = a.body.split('\n'), newLines = b.body.split('\n');
  assert(oldLines.length === newLines.length,
    'paragraphs, blank lines or line layout changed');
  let changedLines = 0, fence = false;
  for (let i = 0; i < oldLines.length; i++) {
    const before = oldLines[i], after = newLines[i];
    if (before !== after) {
      assert(!frozenLine(before, fence) && !frozenLine(after, fence),
        'fixed heading, table, shortcode, HTML or fenced code changed at line ' + (i+1));
      assert(Boolean(before.trim()) === Boolean(after.trim()),
        'blank line changed at ' + (i+1));
      assert(linePrefix(before) === linePrefix(after),
        'list/quote structure changed at ' + (i+1));
      invariantText(before, after, 'body line ' + (i+1));
      changedLines++;
    }
    if (/^\s*(\x60{3}|~~~)/.test(before)) fence = !fence;
  }
  return { url: expectedUrl, changed: rewritten !== original,
    changedLines, leadChanged: oldLead.value !== newLead.value,
    totalLines: oldLines.length };
}
export function possibleThirdPartyVoice(raw) {
  const patterns = [
    /(?:в (?:актуальной |действующей )?(?:подборке|каталоге|предложениях)) (?:представлен|указан|заявлен)/ig,
    /(?:в программе|в описании|в карточке|на сайте) (?:указан|отмечен|назван|предусмотрен|заявлен)/ig,
    /(?:ниже (?:приведены|представлены)|как (?:указано|заявлено)|согласно программе)/ig,
    /(?:каталог|раздел|подборка) (?:собирается|формируется|строится) по/ig,
    /(?:он|тур|маршрут|услуга) (?:заявлен|представлен|указан) как/ig,
  ];
  return [...new Set(patterns.flatMap(re => matches(raw,re)))].slice(0,30);
}
export function eligiblePublishedRows(phases, claims, prepared, now = Date.now(), max = MAX_BATCH) {
  assert(Number.isInteger(max) && max > 0 && max <= MAX_BATCH, 'batch size must be 1..10');
  const excluded = new Set(['archived','temporarily_unavailable','missing']);
  return phases.flatMap(phase => phase.entries || []).filter(row => {
    if (row.work !== 'published' || excluded.has(row.availability) || !row.url) return false;
    if (prepared?.[row.url]) return false;
    const lock = claims?.[row.url];
    return !lock || Number.isFinite(Date.parse(lock.expiresAt)) && Date.parse(lock.expiresAt) <= now;
  }).sort((x,y) => x.order - y.order).slice(0,max)
    .map(row => ({ url:row.url, order:row.order, path:articlePath(row.url),
      phase:row.phase, name:row.name }));
}
export function newClaim(runId, cycle, now=Date.now()) {
  assert(/^[a-zA-Z0-9_-]{8,95}$/.test(runId), 'invalid runId');
  assert(Number.isInteger(cycle) && cycle >= 1 && cycle <= MAX_CYCLES,
    'cycle must be 1..10');
  const at = new Date(now).toISOString(), expiresAt = new Date(now + BATCH_MINUTES * 60000).toISOString();
  return { ownerId:'rewrite-'+runId, batchId:'rewrite-'+runId+'-c'+cycle,
    claimedAt:at, expiresAt, cycle };
}
