import { parseFragment } from 'parse5';
import { absoluteUrl, cleanText } from './structured-data.mjs';

/**
 * Read an already-approved SEO/GEO article as structured editorial evidence.
 * Only the text/links/tables that also render in SeoGeoSection are inspected.
 * No keyword inference, network requests or speculative external entities.
 */
const textContent = (node) => node?.nodeName === '#text'
  ? node.value : (node?.childNodes || []).map(textContent).join(' ');
const text = (node) => cleanText(textContent(node));
function* walk(node) {
  yield node;
  for (const child of node?.childNodes || []) yield* walk(child);
}
const attr = (node, key) => node?.attrs?.find((item) => item.name === key)?.value;
const unique = (values) => [...new Set(values.filter(Boolean))];
const faqTitle = (name) => /(?:^|\\b)(?:faq|частые вопросы|часто задаваемые|вопросы и ответы|популярные вопросы)/iu.test(name);
function linksIn(node, root, pageUrl) {
  return unique([...walk(node)].filter((item) => item.tagName === 'a')
    .map((item) => absoluteUrl(attr(item, 'href'), root))
    .filter((url) => {
      if (!url) return false;
      try {
        const page = new URL(pageUrl);
        const target = new URL(url);
        return target.origin === page.origin && !target.search && !target.hash;
      } catch { return false; }
    }));
}
const esc = (value) => String(value ?? '').replace(/&/g, '&amp;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const heading = (node) => node?.tagName && /^h[2-4]$/.test(node.tagName);
const MAX_SECTIONS = 32;
const MAX_TABLES = 16;
const MAX_QUESTIONS = 30;

export function inspectSeoGeoArticle(article, { root, pageUrl } = {}) {
  if (!article?.headingHtml || !article?.bodyHtml || !root || !pageUrl) return null;
  const fragment = parseFragment(article.headingHtml + '<p>' + esc(article.lead) + '</p>' + article.bodyHtml);
  const children = fragment.childNodes || [];
  const sections = [], tables = [], faq = [], allLinks = [];
  let current = null, h2Key = null, faqOpen = false, answer = null;
  const flushAnswer = () => {
    if (!answer) return;
    const value = cleanText(answer.chunks.join(' '));
    if (answer.question && value && faq.length < MAX_QUESTIONS) {
      faq.push({ question: answer.question, answer: value.slice(0, 3500),
        links: unique(answer.links), headingId: answer.headingId });
    }
    answer = null;
  };
  for (const node of children) {
    const tag = node.tagName;
    if (heading(node)) {
      const level = Number(tag.slice(1));
      const name = text(node);
      if (level === 2) {
        flushAnswer();
        faqOpen = faqTitle(name);
        if (sections.length < MAX_SECTIONS) {
          current = { key: 'section-' + (sections.length + 1), level, name,
            headingId: attr(node, 'id'), links: [], description: '', parentKey: null };
          sections.push(current); h2Key = current.key;
        } else { current = null; h2Key = null; }
      } else if (level === 3) {
        flushAnswer();
        if (faqOpen && name.endsWith('?')) answer = {
          question: name, headingId: attr(node, 'id'), chunks: [], links: [],
        };
        if (sections.length < MAX_SECTIONS) {
          current = { key: 'section-' + (sections.length + 1), level, name,
            headingId: attr(node, 'id'), links: [], description: '', parentKey: h2Key };
          sections.push(current);
        } else current = null;
      }
      allLinks.push(...linksIn(node, root, pageUrl));
      continue;
    }
    if (!tag) continue;
    const links = linksIn(node, root, pageUrl);
    allLinks.push(...links);
    if (current) {
      current.links.push(...links);
      if (!current.description && ['p', 'ul', 'ol'].includes(tag)) {
        const description = text(node);
        if (description.length >= 24) current.description = description.slice(0, 360);
      }
    }
    if (answer) {
      answer.chunks.push(text(node));
      answer.links.push(...links);
    }
    if (tag === 'table' && tables.length < MAX_TABLES) {
      const rows = [...walk(node)].filter((item) => item.tagName === 'tr');
      const cells = (row) => [...walk(row)].filter((item) => item.tagName === 'th' || item.tagName === 'td').map(text);
      const first = rows[0] && cells(rows[0]);
      const columns = first?.length && rows[0].childNodes?.length ? first : [];
      tables.push({ key: 'table-' + (tables.length + 1), sectionKey: current?.key || null,
        name: current?.name || 'Сравнение', columns: columns.slice(0, 12),
        rowCount: Math.max(0, rows.length - 1), text: text(node).slice(0, 900),
        links });
    }
  }
  flushAnswer();
  for (const section of sections) section.links = unique(section.links);
  return { headline: sections.find((section) => section.level === 2)?.name || '',
    lead: cleanText(article.lead).slice(0, 1000),
    targetPath: article.targetPath,
    links: unique(allLinks),
    sections, tables, faq };
}
