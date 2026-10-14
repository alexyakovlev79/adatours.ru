import yaml from 'js-yaml';
import { parseFragment } from 'parse5';

// One canonical article per page: data/seo-geo/articles/<canonical>/index.md.
const PATH_RE = /^\/(?:[a-z0-9]+(?:[-_][a-z0-9]+)*\/)+$/;
const KEY_RE = /^[a-z][A-Za-z0-9_]*(?:\.[a-z][A-Za-z0-9_]*)*$/;
const BLOCK_RE = /\{\{#if\s+([a-z][A-Za-z0-9_.]*)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g;
const VALUE_RE = /\{\{([a-z][A-Za-z0-9_.]*)\}\}/g;
const TABLE_RE = /\{\{catalog\.tourTable:([a-z0-9_]+(?:,[a-z0-9_]+)*)\}\}/g;
const FORBIDDEN_TAGS = new Set(['script', 'style', 'img', 'picture', 'source', 'video', 'audio',
  'iframe', 'object', 'embed', 'svg', 'form', 'input', 'button', 'h1', 'link', 'meta']);

export function normalizeSeoGeoPath(path) {
  if (typeof path !== 'string') throw new Error('SEO/GEO path must be a string');
  if (/[?#]/.test(path) || /\/page\/[0-9]+\/?$/.test(path)) {
    throw new Error('SEO/GEO article cannot target pagination, query or hash: ' + path);
  }
  const normalized = path.endsWith('/') ? path : path + '/';
  if (!PATH_RE.test(normalized)) throw new Error('Invalid SEO/GEO canonical path: ' + path);
  return normalized;
}

export function seoGeoArticleFile(path) {
  return 'data/seo-geo/articles' + normalizeSeoGeoPath(path) + 'index.md';
}

export function parseSeoGeoArticle(raw, file = 'article.md') {
  if (typeof raw !== 'string') throw new Error('Invalid SEO/GEO file: ' + file);
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error('SEO/GEO frontmatter is required: ' + file);
  const data = yaml.load(match[1]);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid SEO/GEO frontmatter: ' + file);
  }
  const targetPath = normalizeSeoGeoPath(data.targetPath);
  const status = data.status ?? 'draft';
  if (!['draft', 'approved', 'paused'].includes(status)) {
    throw new Error('Unsupported SEO/GEO article status: ' + status + ' (' + file + ')');
  }
  const lead = String(data.lead ?? '').trim();
  const buttonLabel = String(data.buttonLabel ?? '').trim();
  const markdown = match[2].trim();
  if (status === 'approved') {
    if (!lead || !buttonLabel || !markdown) {
      throw new Error('Published SEO/GEO text requires lead, buttonLabel and body: ' + file);
    }
    if (!/^##\s+\S/m.test(markdown) || !/^##\s+\S/.test(markdown)) {
      throw new Error('SEO/GEO body must start with an H2 heading: ' + file);
    }
    if (buttonLabel.length > 140 || lead.length > 1200) {
      throw new Error('SEO/GEO lead or buttonLabel is too long: ' + file);
    }
    validateSeoGeoMarkdown(markdown, file);
  }
  return { targetPath, kind: String(data.kind ?? ''), status, lead, buttonLabel, markdown, file };
}

export function validateSeoGeoMarkdown(markdown, file = 'article.md') {
  // Raw HTML is not required for this content format and may circumvent link/image checks.
  if (/<\/?[a-z][^>]*>/i.test(markdown) || /!\[[^\]]*\]\s*\(/.test(markdown)
    || /!\[[^\]]*\]\s*\[/.test(markdown) || /https?:\/\//i.test(markdown)
    || /\b(?:data|javascript|mailto|tel):/i.test(markdown)) {
    throw new Error('SEO/GEO body cannot contain HTML, external links or images: ' + file);
  }
  if (/^#\s+\S/m.test(markdown)) throw new Error('H1 is not allowed inside SEO/GEO article: ' + file);
}

export function seoGeoValue(context, key, allowMissing = false) {
  if (!KEY_RE.test(key) || key.split('.').some((part) =>
    part === '__proto__' || part === 'constructor' || part === 'prototype')) {
    throw new Error('Invalid SEO/GEO variable: ' + key);
  }
  let value = context;
  for (const part of key.split('.')) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part)) {
      throw new Error('Unknown SEO/GEO variable: ' + key);
    }
    value = value[part];
  }
  if (value == null && !allowMissing) {
    throw new Error('SEO/GEO variable has no value: ' + key);
  }
  return value;
}

export function interpolateSeoGeoMarkdown(source, context) {
  const text = source.replace(BLOCK_RE, (_whole, key, body) => {
    return seoGeoValue(context, key, true) ? body : '';
  });
  if (/\{\{#if\b|\{\{\/if\}\}/.test(text)) {
    throw new Error('Unbalanced or nested SEO/GEO conditional block');
  }
  const tables = text.replace(TABLE_RE, (_whole, values) => {
    if (typeof context.tourTable !== 'function') throw new Error('Missing SEO/GEO tourTable function');
    return context.tourTable(values.split(','));
  });
  const interpolated = tables.replace(VALUE_RE, (_whole, key) => {
    const value = seoGeoValue(context, key);
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new Error('SEO/GEO variable must be a string or number: ' + key);
    }
    return String(value);
  });
  if (/\{\{[\s\S]*?\}\}/.test(interpolated)) {
    throw new Error('Unresolved or unsupported SEO/GEO template marker');
  }
  validateSeoGeoMarkdown(interpolated);
  return interpolated;
}

export function validateSeoGeoHtml(html, { targetPath, isCanonicalLink } = {}) {
  if (typeof html !== 'string') throw new Error('Invalid SEO/GEO HTML');
  const visit = (node) => {
    const tag = node.tagName;
    if (FORBIDDEN_TAGS.has(tag)) throw new Error('Forbidden SEO/GEO HTML element: ' + tag);
    if (tag) {
      for (const attr of node.attrs ?? []) {
        if (attr.name.startsWith('on')) throw new Error('Inline event handlers are forbidden: ' + attr.name);
        if (attr.name === 'style') throw new Error('Inline SEO/GEO styles are forbidden');
      }
      if (tag === 'a') {
        const href = node.attrs?.find((attr) => attr.name === 'href')?.value ?? '';
        if (!(href.startsWith('/') && !href.startsWith('//')) || /[?#]/.test(href)) {
          throw new Error('SEO/GEO link must be a clean internal canonical URL: ' + href);
        }
        const link = normalizeSeoGeoPath(href);
        if (isCanonicalLink && !isCanonicalLink(link)) {
          throw new Error('SEO/GEO link target is unavailable/noncanonical: ' + href + ' on ' + targetPath);
        }
      }
    }
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(parseFragment(html));
  if (!/^\s*<h2\b/i.test(html)) throw new Error('SEO/GEO rendered text must start with H2');
  if (/\{\{[^}]+\}\}/.test(html)) throw new Error('Unresolved SEO/GEO variable in HTML');
  return true;
}

export function extractSeoGeoHeading(html) {
  const match = html.match(/^\s*(<h2\b[^>]*>[\s\S]*?<\/h2>)([\s\S]*)$/i);
  if (!match) throw new Error('SEO/GEO article is missing its opening H2');
  return { headingHtml: match[1], bodyHtml: match[2].trim() };
}

export function seoGeoCount(count, forms) {
  const n = Number(count);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Invalid SEO/GEO count');
  const mod100 = n % 100, mod10 = n % 10;
  const formIndex = mod100 >= 11 && mod100 <= 14 ? 2 : mod10 === 1 ? 0 : mod10 >= 2 && mod10 <= 4 ? 1 : 2;
  return String(n) + ' ' + forms[formIndex];
}

export function seoGeoPriceBasis(note) {
  const s = String(note ?? '').toLowerCase();
  if (/(?:^|[\s(])(?:на|за)\s+(?:одного\s+)?человека(?:$|[\s.,;)])/u.test(s)) return 'на человека';
  if (/(?:^|[\s(])за\s+группу(?:$|[\s.,;)])/u.test(s)) return 'за группу';
  if (/(?:^|[\s(])за\s+(?:весь\s+)?тур(?:$|[\s.,;)])/u.test(s)) return 'за тур';
  return null;
}

export function comparableUsdMinimum(tours) {
  // A catalog-wide minimum is defensible only when every displayed tour has
  // a positive USD price with the same explicitly documented price basis.
  if (!tours.length) return null;
  const prices = tours.map((entry) => {
    const d = entry.data ?? entry;
    const basis = seoGeoPriceBasis(d.priceNote);
    if (d.currency !== 'USD' || !basis || !Number.isFinite(d.priceFrom) || d.priceFrom <= 0) return null;
    return { price: d.priceFrom, basis };
  });
  if (prices.some((item) => !item) || prices.some((item) => item.basis !== prices[0].basis)) return null;
  const min = Math.min(...prices.map((item) => item.price));
  return '$' + new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(min) + ' ' + prices[0].basis;
}
