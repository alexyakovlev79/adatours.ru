const selector = '[data-lazy-src], [data-lazy-style]';

export function isWithinImageWindow(rect, width, height) {
  return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < width
    && rect.bottom > -height && rect.top < height * 2;
}

export function initializeLazyImages() {
  let observer;
  const pending = new Set();
  const activate = (element) => {
    if (element.dataset.lazySrc) {
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
      }, { rootMargin: `${height}px 0px ${height}px 0px`, threshold: 0 });
      pending.forEach((element) => observer.observe(element));
    }
    register();
  };
  let frame = 0;
  const schedule = () => {
    if (!frame) frame = window.requestAnimationFrame(() => { frame = 0; register(); });
  };
  rebuild();
  const mutations = new MutationObserver(schedule);
  mutations.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', rebuild, { passive: true });
  window.visualViewport?.addEventListener('resize', rebuild, { passive: true });
  // Old browsers still respect the same loading window.
  window.addEventListener('scroll', schedule, { passive: true });
  document.addEventListener('toggle', schedule, true);
  window.addEventListener('pageshow', schedule);
  window.addEventListener('beforeprint', () => {
    document.querySelectorAll(selector).forEach((element) => {
      if (!element.hasAttribute('data-pagefind-meta')) activate(element);
    });
  });
}
