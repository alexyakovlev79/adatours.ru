import { parseFragment } from 'parse5';

const escapeAttribute = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const attribute = (node, name) => node.attrs.find((item) => item.name === name)?.value;
const openingTag = (node) => `<${node.tagName}${node.attrs.map(({ name, value }) => ` ${name}="${escapeAttribute(value)}"`).join('')}>`;
const set = (node, name, value) => {
  node.attrs = node.attrs.filter((item) => item.name !== name);
  node.attrs.push({ name, value });
};
const shouldDefer = (node) => {
  const src = attribute(node, 'src');
  return src && !src.startsWith('data:') && !attribute(node, 'data-lazy-src')
    && attribute(node, 'fetchpriority') !== 'high';
};

/** Transform before the browser preload scanner can discover offscreen URLs.
 * Keep the high-priority LCP cover and provide ordinary HTML when JS is disabled.
 * Patches preserve all content outside the changed opening tags byte-for-byte.
 */
export function deferImages(html) {
  const root = parseFragment(html, { sourceCodeLocationInfo: true });
  const edits = [];
  let backgroundIndex = 0;
  const walk = (node, inDeferredPicture = false) => {
    if (['script', 'style', 'noscript', 'template'].includes(node.tagName)) return;
    const location = node.sourceCodeLocation?.startTag;
    if (location && node.attrs) {
      const original = html.slice(location.startOffset, location.endOffset);
      let changed = false;
      let fallback = '';
      const pictureImage = node.tagName === 'picture' && node.childNodes.find((child) => child.tagName === 'img');
      if (pictureImage && shouldDefer(pictureImage)) {
        inDeferredPicture = true;
        set(node, 'data-lazy-picture', '');
        changed = true;
        // One complete picture is the no-JS fallback. A per-img fallback would
        // lose the phone source and create duplicate grid items.
        const end = node.sourceCodeLocation.endOffset;
        edits.push({ start: end, end, value: `<noscript>${html.slice(node.sourceCodeLocation.startOffset, end)}</noscript>` });
      }
      if (node.tagName === 'source' && inDeferredPicture && attribute(node, 'srcset')) {
        set(node, 'data-lazy-srcset', attribute(node, 'srcset'));
        node.attrs = node.attrs.filter((item) => item.name !== 'srcset');
        changed = true;
      }
      const src = attribute(node, 'src');
      if (node.tagName === 'img' && shouldDefer(node)) {
        set(node, 'data-lazy-src', src);
        const srcset = attribute(node, 'srcset');
        if (srcset) {
          set(node, 'data-lazy-srcset', srcset);
          node.attrs = node.attrs.filter((item) => item.name !== 'srcset');
        }
        // Intrinsic placeholder dimensions prevent natural-size galleries collapsing.
        const width = Number(attribute(node, 'width')) || 1200;
        const height = Number(attribute(node, 'height')) || 900;
        set(node, 'src', `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'/%3E`);
        set(node, 'loading', 'eager');
        set(node, 'decoding', 'async');
        const meta = attribute(node, 'data-pagefind-meta');
        if (meta) set(node, 'data-pagefind-meta', meta.replaceAll('[src]', '[data-lazy-src]'));
        // Hidden search-index images are metadata only: never fetch them.
        fallback = meta || inDeferredPicture ? '' : `<noscript>${original}</noscript>`;
        changed = true;
      }
      const style = attribute(node, 'style');
      if (style && /url\(/i.test(style)) {
        // Current templates use individual background/custom-property declarations.
        const declarations = style.split(/;(?![^()]*\))/);
        const deferred = declarations.filter((value) => /url\(/i.test(value)).join(';');
        set(node, 'style', declarations.filter((value) => !/url\(/i.test(value)).join(';'));
        set(node, 'data-lazy-style', deferred);
        const key = String(++backgroundIndex);
        set(node, 'data-lazy-background', key);
        fallback += `<noscript><style>[data-lazy-background="${key}"]{${deferred.replaceAll('<', '\\3c ')}}</style></noscript>`;
        changed = true;
      }
      if (changed) edits.push({ start: location.startOffset, end: location.endOffset, value: openingTag(node) + fallback });
    }
    for (const child of node.childNodes || []) walk(child, inDeferredPicture);
  };
  walk(root);
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    html = html.slice(0, edit.start) + edit.value + html.slice(edit.end);
  }
  return html;
}
