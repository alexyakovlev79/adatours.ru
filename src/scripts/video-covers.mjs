import { selectHeroVideo } from '../lib/hero-video-selection.mjs';
import { isWithinImageWindow } from './lazy-images.mjs';
import { isPlayableVisible, selectCoverVideo, TouchCoverQueue, usesTouchPlayback } from '../lib/cover-playback-policy.mjs';

const managers = new WeakMap();

export function initializeVideoCovers(view = window) {
  if (managers.has(view)) return managers.get(view);
  const doc = view.document;
  const entries = new Set();
  const queue = new TouchCoverQueue();
  let frame;
  let nextId = 0;
  let pointer;
  const fineHover = view.matchMedia('(hover: hover) and (pointer: fine)');
  const viewport = () => {
    const visual = view.visualViewport;
    const left = visual?.offsetLeft ?? 0;
    const top = visual?.offsetTop ?? 0;
    return { left, top, right: left + (visual?.width ?? view.innerWidth), bottom: top + (visual?.height ?? view.innerHeight) };
  };
  const touch = () => usesTouchPlayback(view.navigator, fineHover.matches);
  const tick = () => {
    frame = undefined;
    const screen = viewport();
    const touchMode = touch();
    const items = [];
    for (const entry of entries) {
      const rect = entry.surface.getBoundingClientRect();
      const displayed = entry.surface.getClientRects().length > 0;
      if (displayed && (entry.hero || isWithinImageWindow(rect, view.innerWidth, view.innerHeight))) entry.prepare(rect);
      const item = { id: entry.id, order: entry.order, rect, entry, displayed };
      items.push(item);
    }
    const current = touchMode ? queue.choose(items.filter((i) => i.displayed && i.entry.selected && !i.entry.failed && !i.entry.hero), screen) : undefined;
    for (const item of items) {
      const { entry, rect } = item;
      const visibleEnough = item.displayed && isPlayableVisible(rect, screen);
      const active = !doc.hidden && visibleEnough && (touchMode ? entry.hero || current === entry.id : entry.hoverHost.matches(':hover') && pointer && pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom);
      entry.setPlaying(active, touchMode);
    }
  };
  const schedule = () => { if (frame === undefined) frame = view.requestAnimationFrame(tick); };
  const resize = view.ResizeObserver ? new view.ResizeObserver(schedule) : undefined;
  resize?.observe(doc.body);
  const manager = {
    register(entry) {
      entry.id = `video-cover-${++nextId}`;
      entry.order = nextId;
      entries.add(entry);
      resize?.observe(entry.surface);
      schedule();
    },
    remove(entry) { entries.delete(entry); resize?.unobserve(entry.surface); schedule(); },
    ended(entry) { if (touch() && !entry.hero) queue.ended(entry.id); schedule(); },
    schedule,
    point(event) { pointer = { x: event.clientX, y: event.clientY }; schedule(); },
  };
  managers.set(view, manager);
  view.addEventListener('scroll', schedule, { capture: true, passive: true });
  view.addEventListener('resize', schedule, { passive: true });
  view.addEventListener('pointermove', manager.point, { passive: true });
  view.addEventListener('pageshow', schedule);
  view.addEventListener('load', schedule);
  view.visualViewport?.addEventListener('resize', schedule);
  view.visualViewport?.addEventListener('scroll', schedule);
  fineHover.addEventListener('change', schedule);
  doc.addEventListener('visibilitychange', () => {
    if (doc.hidden) for (const entry of entries) entry.stop();
    schedule();
  });
  doc.addEventListener('toggle', schedule, true);
  doc.fonts?.ready.then(schedule);

  class HeroBackgroundVideo extends view.HTMLElement {
    connectedCallback() {
      this.cleanup?.();
      this.video = this.querySelector('video');
      if (!this.video) return;
      this.button = this.querySelector('button');
      this.surface = this.closest('[data-video-surface]') ?? this.parentElement;
      this.hoverHost = this.surface.closest('a, [data-video-hover]') ?? this.surface;
      this.hero = this.dataset.placement !== 'cover';
      this.events = new view.AbortController();
      const options = { signal: this.events.signal };
      this.photoNodes ??= [];
      this.selected = undefined;
      this.key = undefined;
      this.failed = false;
      this.blocked = false;
      this.wanted = false;
      this.userPaused ??= false;
      this.dataset.loadState = 'pending';
      this.video.addEventListener('playing', () => {
        if (!this.wanted) { this.stop(); return; }
        this.video.classList.add('is-playing');
        if (this.button) this.button.hidden = false;
        this.updateButton();
      }, options);
      this.video.addEventListener('pause', () => this.updateButton(), options);
      this.video.addEventListener('ended', () => { this.stop(); manager.ended(this); }, options);
      this.video.addEventListener('error', () => {
        this.failed = true;
        this.stop();
        if (this.button) this.button.hidden = true;
        manager.schedule();
      }, options);
      this.button?.addEventListener('click', () => {
        this.userPaused = !this.video.paused;
        this.blocked = false;
        if (this.userPaused) this.stop();
        else if (this.allowed && isPlayableVisible(this.surface.getBoundingClientRect(), viewport())) this.setPlaying(true, touch());
        manager.schedule();
      }, options);
      this.hoverHost.addEventListener('pointerenter', manager.point, options);
      this.hoverHost.addEventListener('pointerleave', () => {
        if (!touch()) this.stop();
        manager.schedule();
      }, options);
      // Intersection catches layout shifts that do not resize the element itself.
      this.intersection = view.IntersectionObserver ? new view.IntersectionObserver(schedule, { threshold: [0, Number.EPSILON, 1] }) : undefined;
      this.intersection?.observe(this.surface);
      manager.register(this);
      this.cleanup = () => {
        this.stop();
        this.events.abort();
        this.intersection?.disconnect();
        manager.remove(this);
      };
    }

    prepare(rect) {
      const selected = this.dataset.selection === 'orientation'
        ? selectCoverVideo(this.video.dataset, rect) : selectHeroVideo(this.video.dataset, view.navigator);
      const key = selected ? `${selected.src}|${selected.poster ?? ''}` : 'photo';
      if (key === this.key) return;
      this.stop();
      this.video.removeAttribute('src');
      this.video.load();
      this.querySelector('.hero-video-poster')?.remove();
      for (const node of this.photoNodes) node.remove();
      this.photoNodes = [];
      this.key = key;
      this.selected = selected;
      this.failed = false;
      this.blocked = false;
      this.dataset.loadState = 'loaded';
      this.dataset.mode = selected ? 'video' : 'photo';
      if (selected) {
        const template = this.querySelector('template[data-first-frame]');
        const fragment = template?.content.cloneNode(true);
        const image = fragment?.querySelector('img');
        if (image && selected.poster) { image.src = selected.poster; this.insertBefore(fragment, this.video); }
      } else {
        const fragment = this.querySelector('template[data-static-hero]')?.content.cloneNode(true);
        if (fragment) {
          // Our geometry window already decided to load; do not defer again natively.
          for (const image of fragment.querySelectorAll('img')) image.loading = 'eager';
          this.photoNodes = [...fragment.childNodes];
          this.append(fragment);
        }
      }
    }

    setPlaying(active, touchMode) {
      this.allowed = Boolean(active);
      if (!active || !this.selected || this.failed || this.userPaused) { this.stop(); return; }
      this.wanted = true;
      this.video.loop = !touchMode || this.hero;
      if (this.blocked || this.playRequest || !this.video.paused) return;
      // Poster scheduling uses the shared lazy window; movie bytes wait for intent.
      if (!this.video.getAttribute('src')) this.video.src = this.selected.src;
      this.video.muted = true;
      this.playRequest = this.video.play().catch((error) => {
        if (!this.wanted || error.name === 'AbortError') return;
        this.blocked = true;
        if (this.button) this.button.hidden = false;
        this.updateButton();
      }).finally(() => { this.playRequest = undefined; manager.schedule(); });
    }

    stop() {
      this.wanted = false;
      if (!this.video) return;
      this.video.classList.remove('is-playing');
      this.video.pause();
      if (this.video.readyState && this.video.currentTime) {
        try { this.video.currentTime = 0; } catch { /* A not-yet-seekable movie keeps its first-frame layer. */ }
      }
      this.updateButton();
    }

    updateButton() {
      if (!this.button) return;
      this.button.setAttribute('aria-label', this.video.paused ? 'Воспроизвести видео' : 'Приостановить видео');
      this.button.firstElementChild.textContent = this.video.paused ? '▶' : 'Ⅱ';
    }

    disconnectedCallback() { this.cleanup?.(); }
  }
  if (!view.customElements.get('hero-background-video')) view.customElements.define('hero-background-video', HeroBackgroundVideo);
  return manager;
}
