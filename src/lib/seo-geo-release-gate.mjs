import { checkSeoGeoFaqFormat } from './seo-geo-faq-format.mjs';

// Fast source-only release intake: only the prepared MD already fetched by
// the publisher. No Astro build, route scan, remote calls or second fetch.
const PATH = /^data\/seo-geo\/articles\/(?:[a-z0-9_-]+\/)+index\.md$/;
const URL = /^\/(?:[a-z0-9]+(?:[-_][a-z0-9]+)*\/)+$/;
const FRONT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

function scalar(fm, key) {
  const m = fm.match(new RegExp('^' + key + ':[ \\t]*(.*?)\\s*$', 'm'));
  if (!m) return null;
  const value = m[1].trim();
  if (value.length > 1 && ((value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'")))) return value.slice(1, -1);
  return value;
}

/** Input: {url, path, content}, using the publisher's existing staging fetch. */
export function inspectSeoGeoReleaseCandidate({ url, path, content } = {}) {
  try {
    if (typeof path !== 'string' || !PATH.test(path)) throw Error('Invalid article path');
    if (typeof url !== 'string' || !URL.test(url) || /\/page\/\d+\/$/.test(url))
      throw Error('Invalid canonical URL');
    if (path !== 'data/seo-geo/articles' + url + 'index.md') throw Error('Article path differs from URL');
    const m = typeof content === 'string' && FRONT.exec(content);
    if (!m) throw Error('Missing or invalid article frontmatter/content');
    if (scalar(m[1], 'status') !== 'approved') throw Error('Article is not approved');
    if (scalar(m[1], 'targetPath') !== url) throw Error('targetPath differs from URL');
    if (!scalar(m[1], 'lead') || !scalar(m[1], 'buttonLabel')) throw Error('Missing lead or buttonLabel');
    const body = m[2].trim();
    if (!/^##\s+\S/.test(body)) throw Error('SEO/GEO body must start with H2');
    if (/^#\s+\S/m.test(body)) throw Error('H1 in SEO/GEO body');
    const faqErrors = checkSeoGeoFaqFormat(body, path);
    if (faqErrors.length) throw Error(faqErrors[0]);
    return { ok: true, url, path };
  } catch (error) {
    return { ok: false, url, path, reason: error.message };
  }
}

/** Invalid rows remain prepared; a bad one cannot prevent valid publication. */
export function partitionSeoGeoReleaseCandidates(rows) {
  if (!Array.isArray(rows)) throw TypeError('Expected array of prepared articles');
  const accepted = [], held = [], seen = new Set();
  for (const row of rows) {
    const result = inspectSeoGeoReleaseCandidate(row);
    if (result.ok && seen.has(result.url))
      held.push({ ...result, ok: false, reason: 'Duplicate URL in publication batch' });
    else if (result.ok) { accepted.push(row); seen.add(result.url); }
    else held.push(result);
  }
  return { accepted, held };
}
