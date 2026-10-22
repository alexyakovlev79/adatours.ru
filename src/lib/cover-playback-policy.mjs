import { isPhoneDevice } from './phone-device.mjs';

export function usesTouchPlayback(browser = {}, fineHover = false) {
  return isPhoneDevice(browser)
    || /iPad|Tablet|Android|Silk\/|Kindle|PlayBook/i.test(browser.userAgent || '')
    || (/Mac/i.test(browser.platform || '') && browser.maxTouchPoints > 1)
    || !fineHover;
}

export function isFullyVisible(rect, viewport) {
  const epsilon = 0.01;
  return rect.width > 0 && rect.height > 0
    && rect.top >= viewport.top - epsilon && rect.bottom <= viewport.bottom + epsilon
    && rect.left >= viewport.left - epsilon && rect.right <= viewport.right + epsilon;
}

// Covers select by their measured shape, never by device or viewport width.
export function selectCoverVideo(sources, rect) {
  if (!(rect.width > 0 && rect.height > 0)) return undefined;
  const portrait = rect.height > rect.width;
  const src = portrait ? sources.mobileSrc : sources.src;
  const poster = portrait ? sources.mobilePoster : sources.poster;
  return src ? { src, poster: poster || undefined } : undefined;
}

export function coverRows(items) {
  const rows = [];
  for (const item of [...items].sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left)) {
    const row = rows.find((r) => Math.abs(r.top - item.rect.top) <= 2 && Math.abs(r.height - item.rect.height) <= 2);
    if (row) row.items.push(item);
    else rows.push({ top: item.rect.top, height: item.rect.height, items: [item] });
  }
  for (const row of rows) {
    row.items.sort((a, b) => a.rect.left - b.rect.left || a.order - b.order);
    row.key = row.items.map((i) => i.id).join('|');
    row.center = row.top + row.height / 2;
  }
  return rows;
}

// A row is latched after crossing the centre. It can keep its turn while the
// user scrolls, but full visibility always wins. A newly centred row takes over.
export class TouchCoverQueue {
  previous = new Map();
  activeKey;
  activeItems = [];
  cursor = 0;
  current;

  choose(items, viewport) {
    const rows = coverRows(items);
    const middle = (viewport.top + viewport.bottom) / 2;
    const crossed = [];
    const next = new Map();
    for (const row of rows) {
      const delta = row.center - middle;
      const before = this.previous.get(row.key);
      const reached = before === undefined ? delta <= 0
        : (before > 0 && delta <= 0) || (before < 0 && delta >= 0);
      if (reached && row.items.every((i) => isFullyVisible(i.rect, viewport))) crossed.push(row);
      next.set(row.key, delta);
    }
    this.previous = next;
    const trigger = crossed.sort((a, b) => Math.abs(a.center - middle) - Math.abs(b.center - middle))[0];
    if (trigger && trigger.key !== this.activeKey) {
      this.activeKey = trigger.key;
      this.cursor = 0;
    }
    const row = rows.find((r) => r.key === this.activeKey);
    this.activeItems = row?.items.map((i) => i.id) ?? [];
    if (!row) { this.current = undefined; return undefined; }
    this.cursor %= row.items.length;
    const candidate = row.items[this.cursor];
    this.current = isFullyVisible(candidate.rect, viewport) ? candidate.id : undefined;
    return this.current;
  }

  ended(id) {
    if (id !== this.current || !this.activeItems.length) return;
    this.cursor = (this.cursor + 1) % this.activeItems.length;
    this.current = undefined;
  }
}
