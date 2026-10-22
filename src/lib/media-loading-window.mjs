import { isWithinImageWindow } from '../scripts/lazy-images.mjs';

// The same current/adjacent-screen window as images, measured on the surface
// (a display:contents custom element has no useful rectangle of its own).
export function observeMediaLoadingWindow(surface, activate) {
  const view = surface.ownerDocument.defaultView;
  const doc = surface.ownerDocument;
  let done = false;
  let frame;
  let intersection;
  let resize;
  const events = new view.AbortController();
  const stop = () => {
    done = true;
    events.abort();
    intersection?.disconnect();
    resize?.disconnect();
    if (frame !== undefined) view.cancelAnimationFrame(frame);
  };
  const check = () => {
    frame = undefined;
    if (done || !surface.getClientRects().length) return;
    if (isWithinImageWindow(surface.getBoundingClientRect(), view.innerWidth, view.innerHeight)) {
      stop();
      activate();
    }
  };
  const schedule = () => {
    if (!done && frame === undefined) frame = view.requestAnimationFrame(check);
  };
  const observe = () => {
    intersection?.disconnect();
    if (view.IntersectionObserver) {
      intersection = new view.IntersectionObserver(schedule, {
        rootMargin: `${view.innerHeight}px 0px ${view.innerHeight}px 0px`,
        threshold: [0, Number.EPSILON],
      });
      intersection.observe(surface);
    }
    schedule();
  };
  view.addEventListener('scroll', schedule, { capture: true, passive: true, signal: events.signal });
  view.addEventListener('resize', observe, { passive: true, signal: events.signal });
  view.visualViewport?.addEventListener('resize', observe, { signal: events.signal });
  view.addEventListener('pageshow', schedule, { signal: events.signal });
  view.addEventListener('load', schedule, { signal: events.signal });
  doc.addEventListener('visibilitychange', schedule, { signal: events.signal });
  doc.addEventListener('toggle', schedule, { capture: true, signal: events.signal });
  if (view.ResizeObserver) {
    resize = new view.ResizeObserver(schedule);
    resize.observe(doc.body);
    resize.observe(surface);
  }
  doc.fonts?.ready.then(schedule);
  observe();
  check();
  return stop;
}
