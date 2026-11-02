import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFragment } from 'parse5';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { deferImages } from '../src/lib/lazy-images.mjs';
import { isWithinImageWindow, initializeLazyImages } from '../src/scripts/lazy-images.mjs';
import { inspectHtml } from '../src/lib/structured-data-html.mjs';

const attr = (node, name) => node.attrs.find((a) => a.name === name)?.value;
function elements(html) {
  const result = [];
  const walk = (node) => {
    if (node.tagName) result.push(node);
    if (node.tagName !== 'noscript') node.childNodes?.forEach(walk);
  };
  walk(parseFragment(html));
  return result;
}
test('only the LCP cover has a discoverable real src before JS; text and metadata survive', () => {
  const html = '<h1>Фото</h1><img src="/hero.webp" fetchpriority="high"><img class="gallery" src="/photo.webp" srcset="/small.webp 400w, /photo.webp 1200w" width="1200" height="800" alt="Пейзаж" title="Горы"><script>const x = "<img src=other>";</script>';
  const output = deferImages(html);
  const imgs = elements(output).filter((node) => node.tagName === 'img');
  assert.equal(attr(imgs[0], 'src'), '/hero.webp');
  assert.ok(attr(imgs[1], 'src').startsWith('data:'));
  assert.equal(attr(imgs[1], 'srcset'), undefined);
  assert.equal(attr(imgs[1], 'data-lazy-srcset'), '/small.webp 400w, /photo.webp 1200w');
  assert.equal(attr(imgs[1], 'alt'), 'Пейзаж');
  assert.equal(attr(imgs[1], 'title'), 'Горы');
  assert.ok(output.includes("height='800'"));
  assert.ok(output.includes('<noscript><img class="gallery" src="/photo.webp"'));
  assert.ok(output.includes('<script>const x = "<img src=other>";</script>'));
  const facts = inspectHtml(output, { root: 'https://adatours.ru/', pageUrl: 'https://adatours.ru/' }).facts;
  assert.equal(facts.images[1].src, 'https://adatours.ru/photo.webp');
  assert.equal(deferImages(output), output);
});
test('backgrounds are deferred along with custom properties without losing positioning', () => {
  const output = deferImages('<a style="--band-image: url(&quot;/band.webp&quot;);background-position:center"><h2>Тур</h2></a><div style="background-image:url(\'/story.webp\');--story-image-position:20% 50%"></div>');
  const nodes = elements(output).filter((n) => attr(n, 'data-lazy-style'));
  assert.equal(nodes.length, 2);
  assert.ok(!attr(nodes[0], 'style').includes('url('));
  assert.equal(attr(nodes[0], 'style'), 'background-position:center');
  assert.equal(attr(nodes[0], 'data-lazy-style'), '--band-image: url("/band.webp")');
  assert.ok(output.includes('[data-lazy-background="1"]{--band-image: url("/band.webp")}'));
  assert.equal(attr(nodes[1], 'style'), '--story-image-position:20% 50%');
});

test('responsive picture waits as one unit and keeps a complete mobile no-JS fallback', () => {
  const picture = '<picture class="hero-image-responsive"><source media="(max-width: 479px)" srcset="/phone.webp" type="image/webp"><img src="/original.webp" width="1200" height="800" alt="Река" title="Вид на реку"></picture>';
  const output = deferImages(picture);
  const nodes = elements(output);
  assert.equal(attr(nodes.find((n) => n.tagName === 'picture'), 'data-lazy-picture'), '');
  const source = nodes.find((n) => n.tagName === 'source');
  assert.equal(attr(source, 'srcset'), undefined);
  assert.equal(attr(source, 'data-lazy-srcset'), '/phone.webp');
  assert.equal(attr(source, 'media'), '(max-width: 479px)');
  assert.equal(nodes.filter((n) => n.tagName === 'img').length, 1);
  assert.equal(attr(nodes.find((n) => n.tagName === 'img'), 'data-lazy-src'), '/original.webp');
  assert.ok(output.endsWith(`<noscript>${picture}</noscript>`));
  assert.equal(deferImages(output), output);
  const lcp = picture.replace('width="1200"', 'fetchpriority="high" width="1200"');
  assert.equal(deferImages(lcp), lcp, 'first-screen hero source selection stays eager');
});

test('responsive sources activate before img.src and remain untouched outside the load window', () => {
  const keys = ['window', 'document', 'MutationObserver'];
  const saved = Object.fromEntries(keys.map((key) => [key, globalThis[key]]));
  const requests = [], listeners = {};
  const source = { dataset: { lazySrcset: '/phone.webp' }, setAttribute(name, value) { requests.push([name, value]); } };
  const picture = { querySelectorAll: () => [source], removeAttribute(name) { this.removed = name; } };
  const image = { dataset: { lazySrc: '/original.webp' }, top: 2000, isConnected: true,
    closest: () => picture, hasAttribute: () => false,
    getClientRects() { return [this.getBoundingClientRect()]; },
    getBoundingClientRect() { return { top: this.top, bottom: this.top + 300, left: 0, right: 390, width: 390, height: 300 }; },
    setAttribute(name, value) { requests.push([name, value]); } };
  globalThis.window = { innerWidth: 390, innerHeight: 800, addEventListener: (name, fn) => listeners[name] = fn, requestAnimationFrame: (fn) => { fn(); return 1; } };
  globalThis.document = { body: {}, querySelectorAll: () => image.dataset.lazySrc ? [image] : [], addEventListener() {} };
  globalThis.MutationObserver = class { observe() {} };
  try {
    initializeLazyImages();
    assert.deepEqual(requests, []);
    image.top = 1200;
    listeners.resize();
    assert.ok(requests.findIndex(([name]) => name === 'srcset') < requests.findIndex(([name]) => name === 'src'));
    assert.deepEqual(requests.filter(([name]) => name === 'srcset' || name === 'src'), [['srcset', '/phone.webp'], ['src', '/original.webp']]);
    assert.equal(source.dataset.lazySrcset, undefined);
    assert.equal(image.dataset.lazySrc, undefined);
    assert.equal(picture.removed, 'data-lazy-picture');
  } finally {
    for (const [key, value] of Object.entries(saved)) value === undefined ? delete globalThis[key] : globalThis[key] = value;
  }
});

test('adjacent pictures and deferred siblings retain intact fallbacks without live duplicates', () => {
  const picture = '<picture><source media="(max-width: 479px)" srcset="/phone.webp"><img src="/one.webp" alt="Река" title="Река"></picture>';
  const second = picture.replaceAll('/one.webp', '/two.webp');
  for (const sibling of [second, '<img src="/two.webp" alt="Лес" title="Лес">', '<div style="background-image:url(/two.webp)"></div>']) {
    const output = deferImages(picture + sibling);
    assert.ok(output.includes(`<noscript>${picture}</noscript>`));
    if (sibling === second) assert.ok(output.includes(`<noscript>${second}</noscript>`));
    const images = elements(output).filter((n) => n.tagName === 'img');
    assert.deepEqual(images.map((n) => attr(n, 'data-lazy-src')), sibling.startsWith('<div') ? ['/one.webp'] : ['/one.webp', '/two.webp']);
    assert.equal(deferImages(output), output);
  }
});
test('window includes partial second screen and one screen above, excludes boundary and hidden elements', () => {
  const rect = (top, bottom, left = 0, right = 390) => ({ top, bottom, left, right, width: right - left, height: bottom - top });
  assert.ok(isWithinImageWindow(rect(0, 600), 390, 844));
  assert.ok(isWithinImageWindow(rect(1687, 1900), 390, 844));
  assert.ok(!isWithinImageWindow(rect(1688, 1900), 390, 844));
  assert.ok(isWithinImageWindow(rect(-1000, -843), 390, 844));
  assert.ok(!isWithinImageWindow(rect(-1000, -844), 390, 844));
  assert.ok(!isWithinImageWindow(rect(0, 0), 390, 844));
  assert.ok(!isWithinImageWindow(rect(0, 500, 391, 600), 390, 844));
  assert.ok(isWithinImageWindow(rect(1799, 2100), 1440, 900));
  assert.ok(!isWithinImageWindow(rect(1800, 2100), 1440, 900));
});
test('runtime fetches only nearby images and responds to scroll, resize, hidden and appended nodes', () => {
  const saved = Object.fromEntries(['window', 'document', 'IntersectionObserver', 'MutationObserver'].map((k) => [k, globalThis[k]]));
  const listeners = {}, observers = [], frames = [];
  const image = (top, hidden = false) => ({
    dataset: { lazySrc: '/photo-' + top + '.webp' }, top, hidden, isConnected: true,
    attrs: {}, style: { cssText: '' },
    getClientRects() { return this.hidden ? [] : [this.getBoundingClientRect()]; },
    getBoundingClientRect() { return { top: this.top, bottom: this.top + 300, left: 0, right: 390, width: 390, height: 300 }; },
    hasAttribute(name) { return name === 'data-pagefind-meta' && this.metadata; },
    setAttribute(name, value) { this.attrs[name] = value; },
  });
  const near = image(1599), far = image(1600), hidden = image(100, true), metadata = image(100);
  metadata.metadata = true;
  let nodes = [near, far, hidden, metadata], mutation;
  globalThis.window = { innerWidth: 390, innerHeight: 800, IntersectionObserver: true,
    addEventListener: (name, fn) => listeners[name] = fn,
    requestAnimationFrame: (fn) => { frames.push(fn); return frames.length; } };
  globalThis.document = { body: {}, querySelectorAll: () => nodes.filter((n) => n.dataset.lazySrc || n.dataset.lazyStyle),
    addEventListener: (name, fn) => listeners[name] = fn };
  globalThis.IntersectionObserver = class {
    constructor(callback, options) { this.callback = callback; this.options = options; this.observed = new Set(); this.thresholdIndex = new Map(); observers.push(this); }
    observe(node) { this.observed.add(node); } unobserve(node) { this.observed.delete(node); } disconnect() { this.observed.clear(); }
    intersect(node, ratio) {
      // Like the browser, notify only when a threshold index changes. Contact
      // with the root boundary is already intersecting, even with ratio 0.
      const thresholds = [this.options.threshold].flat();
      const index = thresholds.filter((threshold) => threshold <= ratio).length;
      if (this.thresholdIndex.get(node) !== index) {
        this.thresholdIndex.set(node, index);
        this.callback([{ target: node, isIntersecting: true, intersectionRatio: ratio }]);
      }
    }
  };
  globalThis.MutationObserver = class { constructor(callback) { mutation = callback; } observe() {} };
  try {
    initializeLazyImages();
    assert.equal(near.attrs.src, '/photo-1599.webp');
    assert.equal(near.attrs.loading, 'eager');
    assert.equal(far.attrs.src, undefined);
    assert.equal(hidden.attrs.src, undefined);
    assert.equal(metadata.attrs.src, undefined);
    assert.equal(observers[0].options.rootMargin, '800px 0px 800px 0px');
    observers[0].intersect(far, 0);
    assert.equal(far.attrs.src, undefined);
    // A layout shift moves the card one pixel inside without a scroll event.
    far.top = 1599;
    observers[0].intersect(far, 1 / 300);
    assert.equal(far.attrs.src, '/photo-1600.webp');
    hidden.hidden = false;
    observers[0].callback([{ target: hidden, isIntersecting: true }]);
    assert.ok(hidden.attrs.src);
    const appended = image(2000); nodes.push(appended);
    mutation(); frames.shift()();
    assert.equal(appended.attrs.src, undefined);
    assert.ok(observers[0].observed.has(appended));
    window.innerHeight = 1100; listeners.resize();
    assert.equal(observers[1].options.rootMargin, '1100px 0px 1100px 0px');
    assert.ok(appended.attrs.src);
    const reverse = image(-900); nodes.push(reverse);
    mutation(); frames.shift()();
    assert.ok(reverse.attrs.src);
    const distant = image(10000); nodes.push(distant); listeners.beforeprint();
    assert.ok(distant.attrs.src);
    assert.equal(metadata.attrs.src, undefined);
  } finally { for (const [key, value] of Object.entries(saved)) value === undefined ? delete globalThis[key] : globalThis[key] = value; }
});

test('backgrounds load after reload, restored scroll, fonts and layout changes without manual scrolling', async () => {
  const keys = ['window', 'document', 'IntersectionObserver', 'MutationObserver', 'ResizeObserver'];
  const saved = Object.fromEntries(keys.map((key) => [key, globalThis[key]]));
  const listeners = {}, frames = [];
  const requests = [];
  let layoutChanged, contentChanged, finishFonts;
  const fontsReady = new Promise((resolve) => { finishFonts = resolve; });
  const background = (top, hidden = false) => ({
    dataset: { lazyStyle: '--band-image: url("/band-' + top + '.webp")' },
    top, hidden, isConnected: true, style: { cssText: 'background-position:center' },
    getClientRects() { return this.hidden ? [] : [this.getBoundingClientRect()]; },
    getBoundingClientRect() { return { top: this.top, bottom: this.top + 440, left: 0, right: 390, width: 390, height: 440 }; },
    hasAttribute(name) { return name === 'data-pagefind-meta' && this.metadata; },
  });
  const loaded = background(3000), restored = background(3200), resized = background(3300);
  const font = background(3400), hidden = background(100, true), distant = background(10000);
  const metadata = background(100); metadata.metadata = true;
  const nodes = [loaded, restored, resized, font, hidden, distant, metadata];
  const tick = () => { const current = frames.splice(0); current.forEach((fn) => fn()); };
  const dispatch = (event) => listeners[event]?.();
  globalThis.window = { innerWidth: 390, innerHeight: 800, ResizeObserver: true,
    Image: class { set src(value) { requests.push(value); } },
    getComputedStyle: (node) => ({ backgroundImage: node.selectedBackground ?? node.style.cssText.match(/url\("[^"]+"\)/)?.[0] ?? 'none' }),
    addEventListener: (name, fn) => listeners[name] = fn,
    requestAnimationFrame: (fn) => { frames.push(fn); return 1; } };
  globalThis.document = { body: {}, fonts: { ready: fontsReady }, visibilityState: 'visible',
    querySelectorAll: () => nodes.filter((node) => node.dataset.lazyStyle),
    addEventListener: (name, fn) => listeners[name] = fn };
  // Exercise the scroll/resize fallback too; no IntersectionObserver exists.
  delete globalThis.IntersectionObserver;
  globalThis.MutationObserver = class { constructor(fn) { contentChanged = fn; } observe() {} };
  globalThis.ResizeObserver = class { constructor(fn) { layoutChanged = fn; } observe(node) { assert.equal(node, document.body); } };
  const active = (node, originalTop) => {
    assert.ok(node.style.cssText.includes('--band-image: url("/band-' + originalTop + '.webp")'));
    assert.ok(node.style.cssText.includes('background-position:center'));
    assert.equal(node.dataset.lazyStyle, undefined);
  };
  try {
    initializeLazyImages();
    assert.ok(loaded.dataset.lazyStyle);
    loaded.top = 100; dispatch('load'); active(loaded, 3000);
    // Browser restores scroll after pageshow and its first animation frame.
    dispatch('pageshow'); tick(); restored.top = 200; tick(); active(restored, 3200);
    resized.top = 300; layoutChanged(); tick(); active(resized, 3300);
    font.top = 400; finishFonts(); await fontsReady; tick(); active(font, 3400);
    hidden.hidden = false; layoutChanged(); tick(); active(hidden, 100);
    const appended = background(1500); nodes.push(appended); contentChanged(); tick(); active(appended, 1500);
    assert.ok(requests.includes('/band-1500.webp'), 'request starts a screen ahead, before the background is painted');
    const responsive = background(1500);
    responsive.dataset.lazyStyle = '--desktop: url("/desktop.webp");--mobile: url("/mobile.webp")';
    responsive.selectedBackground = 'url("/mobile.webp")';
    nodes.push(responsive); contentChanged(); tick();
    assert.ok(requests.includes('/mobile.webp'));
    assert.ok(!requests.includes('/desktop.webp'), 'unused device cover stays unfetched');
    const duplicate = background(1500); duplicate.selectedBackground = 'url("/mobile.webp")';
    nodes.push(duplicate); contentChanged(); tick();
    assert.equal(requests.filter((src) => src === '/mobile.webp').length, 1);
    assert.ok(!requests.includes('/band-10000.webp'), 'distant backgrounds stay deferred');
    const resumed = background(3500); nodes.push(resumed); resumed.top = 500;
    dispatch('visibilitychange'); active(resumed, 3500);
    assert.ok(distant.dataset.lazyStyle);
    assert.ok(metadata.dataset.lazyStyle);
  } finally {
    for (const [key, value] of Object.entries(saved)) value === undefined ? delete globalThis[key] : globalThis[key] = value;
  }
});

test('gallery orientation ignores the placeholder and updates when the original photo loads', () => {
  const script = readFileSync(new URL('../src/components/editorial/MediaGallery.astro', import.meta.url), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  class Image {
    complete = true; naturalWidth = 1200; naturalHeight = 900; deferred = true;
    hasAttribute() { return this.deferred; }
    addEventListener(name, fn, options) { this.listener = fn; this.once = options?.once; }
  }
  const img = new Image();
  const attributes = { 'data-orientation': 'portrait' };
  const item = { querySelector: () => img,
    setAttribute: (name, value) => attributes[name] = value,
    removeAttribute: (name) => delete attributes[name] };
  runInNewContext(script, { HTMLImageElement: Image,
    document: { querySelectorAll: () => [item], addEventListener() {} } });
  assert.equal(attributes['data-orientation'], 'portrait');
  img.listener(); // placeholder load must not consume the original's listener
  assert.equal(attributes['data-orientation'], 'portrait');
  assert.ok(!img.once);
  img.deferred = false; img.naturalWidth = 700; img.naturalHeight = 1200;
  img.listener();
  assert.equal(attributes['data-orientation'], 'portrait');
  img.naturalWidth = 2200; img.naturalHeight = 900; img.listener();
  assert.equal(attributes['data-orientation'], 'landscape');
  assert.equal(attributes['data-mobile-panorama'], 'true');
});

test('a portrait phone derivative cannot change the original gallery slot orientation', () => {
  const script = readFileSync(new URL('../src/components/editorial/MediaGallery.astro', import.meta.url), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  class Image {
    complete = true; naturalWidth = 480; naturalHeight = 640;
    closest() { return {}; }
    addEventListener() { assert.fail('crop dimensions must not drive gallery orientation'); }
  }
  const item = { querySelector: () => new Image(), setAttribute() { assert.fail('retain server slot orientation'); } };
  runInNewContext(script, { HTMLImageElement: Image,
    document: { querySelectorAll: () => [item], addEventListener() {} } });
});
