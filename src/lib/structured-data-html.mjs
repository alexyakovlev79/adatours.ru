import { parse, parseFragment } from 'parse5';
import { absoluteUrl, cleanText } from './structured-data.mjs';
export const attr = (node, name) => node?.attrs?.find((a) => a.name === name)?.value;
export const hasAttr = (node, name) => node?.attrs?.some((a) => a.name === name) || false;
export function* walk(node) { yield node; for (const child of node.childNodes || []) yield* walk(child); }
const ignored = (node) => ['script', 'style', 'template', 'noscript'].includes(node.tagName)
  || hasAttr(node, 'hidden') || hasAttr(node, 'inert') || attr(node, 'aria-hidden') === 'true'
  || /(?:^|\s)(?:sr-only|search-index-record|visually-hidden)(?:\s|$)/.test(attr(node, 'class') || '');
export function visible(node) { for (let p = node; p; p = p.parentNode) if (ignored(p)) return false; return true; }
export function textContent(node) {
  if (!node || ignored(node)) return '';
  if (node.nodeName === '#text') return node.value;
  return (node.childNodes || []).map(textContent).join(' ');
}
export const text = (node) => cleanText(textContent(node));
const first = (node, predicate) => [...walk(node)].find(predicate);
const ancestors = (node, predicate) => { for (let p = node; p; p = p.parentNode) if (predicate(p)) return p; };
const heading = (node) => first(node, (n) => /^h[1-6]$/.test(n.tagName || '') && visible(n));
const faqLabel = (value) => /faq|частые вопросы|вопросы и ответы|часто задаваемые/i.test(value || '');
const positive = (value) => /^\d+$/.test(value || '') && Number(value) > 0 ? Number(value) : undefined;
/** Inspect only the HTML emitted by templates; never fetch external content. */
export function inspectHtml(html, { root, pageUrl, fullDocument = false } = {}) {
  const dom = fullDocument ? parse(html, { sourceCodeLocationInfo: true }) : parseFragment(html, { sourceCodeLocationInfo: true });
  const all = [...walk(dom)];
  const ldNodes = all.filter((n) => n.tagName === 'script' && (attr(n, 'type') || '').toLowerCase() === 'application/ld+json');
  const legacy = ldNodes.map((n) => JSON.parse((n.childNodes || []).map((c) => c.value || '').join('')));
  let cleanHtml = html;
  for (const n of [...ldNodes].reverse()) {
    const location = n.sourceCodeLocation;
    if (location) cleanHtml = cleanHtml.slice(0, location.startOffset) + cleanHtml.slice(location.endOffset);
  }
  const content = fullDocument ? first(dom, (n) => n.tagName === 'main') || first(dom, (n) => n.tagName === 'body') || dom : dom;
  const elements = [...walk(content)].filter(visible);
  const resolve = (href) => {
    if (!href || /^(?:mailto:|tel:|javascript:|data:|#)/i.test(href)) return undefined;
    try { return new URL(href, pageUrl || root).href; } catch { return undefined; }
  };
  const linkData = (n) => {
    const href = resolve(attr(n, 'href'));
    const holder = ancestors(n, (p) => hasAttr(p, 'data-catalog-item') || hasAttr(p, 'data-interest-item'));
    return { href, entityId: attr(holder, 'data-catalog-item') || attr(holder, 'data-interest-item'),
      name: text(heading(n)) || attr(n, 'aria-label') || text(n).slice(0, 180) };
  };
  const linksFor = (n) => [...walk(n)].filter((c) => c.tagName === 'a' && visible(c)).map(linkData).filter((l) => l.href);
  const catalog = elements.find((n) => hasAttr(n, 'data-catalog-root'));
  const catalogItems = elements.find((n) => hasAttr(n, 'data-catalog-items'));
  const groups = [];
  if (catalogItems) groups.push({ catalog: true, name: text(elements.find((n) => n.tagName === 'h1')),
    offset: Math.max(0, Number(attr(catalog, 'data-catalog-from') || 1) - 1), links: linksFor(catalogItems),
    expectedIds: [...walk(catalogItems)].filter((n) => hasAttr(n, 'data-catalog-item')).map((n) => attr(n, 'data-catalog-item')) });
  if (!catalogItems) {
    const sections = elements.filter((n) => hasAttr(n, 'data-interest-section') || n.tagName === 'section');
    for (const section of sections) {
      // Inner sections are already represented by their containing semantic section.
      if (ancestors(section.parentNode, (n) => n.tagName === 'section' || hasAttr(n, 'data-interest-section'))) continue;
      const links = linksFor(section);
      if (links.length) groups.push({ name: text(heading(section)), links });
    }
    // Flat indexes (team/reviews/countries) may use a div rather than section.
    groups.push({ fallback: true, name: text(elements.find((n) => n.tagName === 'h1')), links: linksFor(content) });
  }
  const images = elements.filter((n) => n.tagName === 'img').map((n) => ({
    src: absoluteUrl(attr(n, 'src'), root), alt: attr(n, 'alt'), width: positive(attr(n, 'width')), height: positive(attr(n, 'height')),
  })).filter((n) => n.src);
  const faq = [];
  for (const detail of elements.filter((n) => n.tagName === 'details')) {
    const summary = (detail.childNodes || []).find((n) => n.tagName === 'summary');
    const container = ancestors(detail, (n) => faqLabel(`${attr(n, 'class') || ''} ${attr(n, 'id') || ''}`)
      || n.tagName === 'section' && faqLabel(text(heading(n))));
    if (!container || !summary) continue;
    const answer = cleanText((detail.childNodes || []).filter((n) => n !== summary).map(textContent).join(' '));
    if (text(summary) && answer) faq.push({ question: text(summary), answer });
  }
  // Also support authored Markdown FAQ: an explicit FAQ heading followed by Q headings.
  for (const node of elements.filter((n) => /^h[1-6]$/.test(n.tagName || '') && faqLabel(text(n)))) {
    const level = Number(node.tagName.slice(1));
    const siblings = node.parentNode?.childNodes || [];
    let question = ''; let answer = [];
    const flush = () => { const value = cleanText(answer.join(' ')); if (question && value) faq.push({ question, answer: value }); question = ''; answer = []; };
    for (const sibling of siblings.slice(siblings.indexOf(node) + 1)) {
      if (/^h[1-6]$/.test(sibling.tagName || '')) {
        if (Number(sibling.tagName.slice(1)) <= level) { flush(); break; }
        flush(); question = text(sibling);
      } else if (question) answer.push(textContent(sibling));
    }
    flush();
  }
  const uniqueFaq = [...new Map(faq.map((q) => [q.question, q])).values()];
  return { dom, legacy, html: cleanHtml, facts: { text: text(content), h1: text(elements.find((n) => n.tagName === 'h1')),
    images, primaryImage: images[0], catalog: Boolean(catalog), groups, faq: uniqueFaq,
    priceVisible: elements.some((n) => /(?:^|\s)(?:tour-pricing|pricing)(?:\s|$)/.test(attr(n, 'class') || '')) },
    metadata: { canonical: attr(all.find((n) => n.tagName === 'link' && attr(n, 'rel') === 'canonical'), 'href'),
      robots: attr(all.find((n) => n.tagName === 'meta' && attr(n, 'name') === 'robots'), 'content') || '',
      ogUrl: attr(all.find((n) => n.tagName === 'meta' && attr(n, 'property') === 'og:url'), 'content') || '',
      ogTitle: attr(all.find((n) => n.tagName === 'meta' && attr(n, 'property') === 'og:title'), 'content') || '',
      ogLocale: attr(all.find((n) => n.tagName === 'meta' && attr(n, 'property') === 'og:locale'), 'content') || '',
      twitterCard: attr(all.find((n) => n.tagName === 'meta' && attr(n, 'name') === 'twitter:card'), 'content') || '',
      twitterTitle: attr(all.find((n) => n.tagName === 'meta' && attr(n, 'name') === 'twitter:title'), 'content') || '',
      redirect: all.some((n) => n.tagName === 'meta' && (attr(n, 'http-equiv') || '').toLowerCase() === 'refresh'),
      scripts: ldNodes.length } };
}
