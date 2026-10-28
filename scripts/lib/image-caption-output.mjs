import { parse } from 'parse5';
import { logicalImagePath } from './image-captions.mjs';

const contentMedia = new Set([
  'media-gallery__item', 'day__media', 'day__embedded-excursion__media',
  'highlight__media', 'team-hero__visual', 'person__media', 'home-service',
]);

/** Check actual HTML, including new paths that are absent from the old registry. */
export function inspectImageCaptions(html, bySrc = new Map()) {
  const errors = [], sources = new Set(), reviewedSources = new Set();
  let substantive = 0, decorative = 0;
  const visit = (node, content = false, hidden = false) => {
    // No-JS copies repeat the same placement. Static video slots, on the other
    // hand, are checked below through their template content.
    if (['noscript', 'script', 'style'].includes(node.tagName)) return;
    const attrs = Object.fromEntries((node.attrs ?? []).map((a) => [a.name, a.value]));
    const classes = new Set((attrs.class ?? '').split(/\s+/));
    const meaningful = content || [...classes].some((c) => contentMedia.has(c));
    const ariaHidden = hidden || attrs['aria-hidden'] === 'true';
    if (meaningful && classes.has('hero-image-responsive') && node.tagName !== 'picture') {
      errors.push({ reason: 'content photo must use picture/img, not a CSS background', label: attrs['aria-label'] });
    }
    if (node.tagName === 'img') {
      const src = logicalImagePath(attrs['data-lazy-src'] || attrs.src);
      const row = bySrc.get(src);
      const isDecorative = ariaHidden || classes.has('hero__media') || classes.has('band-card__media');
      if (attrs.alt === undefined) errors.push({ src, reason: 'img is missing its alt attribute' });
      if (isDecorative) {
        decorative++;
        if (attrs.alt !== '' || attrs.title !== undefined) {
          errors.push({ src, reason: 'decorative image must retain empty alt and no title' });
        }
      } else if (meaningful || attrs.alt?.trim()) {
        substantive++;
        if (src) sources.add(src);
        if (!attrs.alt?.trim()) errors.push({ src, reason: 'content image is missing its description' });
        if (!attrs.title?.trim()) errors.push({ src, reason: 'content image is missing its hover' });
        if (row) {
          reviewedSources.add(src);
          if (attrs.alt !== row.alt || attrs.title !== row.hover) {
            errors.push({ src, reason: 'editorial image description changed', alt: attrs.alt, title: attrs.title });
          }
        }
      }
    }
    for (const child of node.childNodes ?? []) visit(child, meaningful, ariaHidden);
    // parse5 keeps template children in a separate DocumentFragment.
    if (node.tagName === 'template' && node.content) visit(node.content, meaningful, ariaHidden);
  };
  visit(parse(html));
  return { substantive, decorative, sources: [...sources], reviewedSources: [...reviewedSources], errors };
}
