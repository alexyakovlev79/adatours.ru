const selector = '[data-lazy-src], [data-lazy-style]';

export function isWithinImageWindow(rect, width, height) {
  return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < width
    && rect.bottom > -height && rect.top < height * 2;
}

export function initializeLazyImages() {
  let observer;
  const pending = new Set();
  const backgroundRequests = new Map();
  const warmBackground = (element) => {
    // Resolve CSS first: mobile/desktop custom properties may contain two URLs,
    // but only the background selected for this device should be requested.
    const background = window.getComputedStyle(element).backgroundImage;
    for (const match of background.matchAll(/url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/g)) {
      const src = (match[1] ?? match[2] ?? match[3]).trim();
      if (!src || src.startsWith('data:') || backgroundRequests.has(src)) continue;
      const image = new window.Image();
      backgroundRequests.set(src, image);
      image.onload = image.onerror = () => backgroundRequests.set(src, null);
      image.src = src;
    }
  };
  const activate = (element) => {
    if (element.dataset.lazySrc) {
      // Runtime-inserted images can still carry native loading="lazy".
      // Our geometry window owns scheduling, so do not defer a second time.
      element.setAttribute('loading', 'eager');
      // Set sizes/srcset before src so a responsive image makes one request.
      if (element.dataset.lazySrcset) {
        element.setAttribute('srcset', element.dataset.lazySrcset);
        delete element.dataset.lazySrcset;
      }
      element.setAttribute('src', element.dataset.lazySrc);
      delete element.dataset.lazySrc;
    }
    if (element.dataset.lazyStyle) {
      element.style.cssText += ';' + element.dataset.lazyStyle;
      delete element.dataset.lazyStyle;
      // Start the request now, even when the CSS background is not painted yet.
      warmBackground(element);
    }
    pending.delete(element);
    observer?.unobserve(element);
  };
  const nearViewport = (element) => element.getClientRects().length > 0
    && isWithinImageWindow(element.getBoundingClientRect(), window.innerWidth, window.innerHeight);
  const register = () => {
    document.querySelectorAll(selector).forEach((element) => {
      if (element.hasAttribute('data-pagefind-meta')) return;
      if (nearViewport(element)) activate(element);
      else if (!pending.has(element)) {
        pending.add(element);
        observer?.observe(element);
      }
    });
    // Remove detached catalogue/overlay nodes from the observation set.
    for (const element of pending) if (!element.isConnected) {
      observer?.unobserve(element);
      pending.delete(element);
    }
  };
  const rebuild = () => {
    observer?.disconnect();
    if ('IntersectionObserver' in window) {
      const height = window.innerHeight;
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) if (entry.isIntersecting && nearViewport(entry.target)) activate(entry.target);
      // Edge contact has ratio 0 but can already be isIntersecting. Observe
      // positive intersection too, otherwise the strict window check can
      // reject that first notification and never receive another one.
      }, { rootMargin: `${height}px 0px ${height}px 0px`, threshold: [0, Number.EPSILON] });
      pending.forEach((element) => observer.observe(element));
    }
    register();
  };
  let frame = 0;
  const schedule = () => {
    if (!frame) frame = window.requestAnimationFrame(() => { frame = 0; register(); });
  };
  const restore = () => {
    rebuild();
    // Reload/back-forward scroll restoration can happen after pageshow.
    // Check again after the next layout, without requiring a manual scroll.
    window.requestAnimationFrame(schedule);
  };
  rebuild();
  const mutations = new MutationObserver(schedule);
  mutations.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', rebuild, { passive: true });
  window.visualViewport?.addEventListener('resize', rebuild, { passive: true });
  // Old browsers still respect the same loading window.
  window.addEventListener('scroll', schedule, { passive: true });
  document.addEventListener('toggle', schedule, true);
  window.addEventListener('load', restore);
  window.addEventListener('pageshow', restore);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') restore();
  });
  document.fonts?.ready.then(schedule);
  // Hero images, fonts and filter menus can move a card inside the loading
  // window while it stays intersecting the observer's expanded root.
  if ('ResizeObserver' in window) {
    const layout = new ResizeObserver(schedule);
    layout.observe(document.body);
  }
  window.addEventListener('beforeprint', () => {
    document.querySelectorAll(selector).forEach((element) => {
      if (!element.hasAttribute('data-pagefind-meta')) activate(element);
    });
  });
}
