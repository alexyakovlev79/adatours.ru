import test from 'node:test';
import assert from 'node:assert/strict';
import { observeMediaLoadingWindow } from '../src/lib/media-loading-window.mjs';

function fixture(top = 1600) {
  const view = new EventTarget();
  const doc = new EventTarget();
  Object.assign(view, { innerWidth: 1200, innerHeight: 800, AbortController });
  const frames = new Map();
  let next = 0;
  view.requestAnimationFrame = (fn) => { frames.set(++next, fn); return next; };
  view.cancelAnimationFrame = (id) => frames.delete(id);
  const observers = [];
  view.IntersectionObserver = class {
    constructor(callback, options) { this.callback = callback; this.options = options; observers.push(this); }
    observe() {} disconnect() { this.disconnected = true; }
  };
  view.ResizeObserver = class { observe() {} disconnect() {} };
  Object.assign(doc, { defaultView: view, body: {} });
  let hidden = false;
  const rect = { top, bottom: top + 600, left: 0, right: 1200, width: 1200, height: 600 };
  const surface = { ownerDocument: doc, getClientRects: () => hidden ? [] : [rect], getBoundingClientRect: () => rect };
  let calls = 0;
  const stop = observeMediaLoadingWindow(surface, () => calls++);
  return { view, rect, observers, stop, get calls() { return calls; }, hide(value) { hidden = value; },
    flush() { const batch = [...frames.values()]; frames.clear(); batch.forEach((fn) => fn()); },
    scroll() { view.dispatchEvent(new Event('scroll')); this.flush(); },
  };
}

test('waits at the strict two-screen boundary; starts once after entering the window', () => {
  const f = fixture();
  assert.equal(f.calls, 0);
  f.flush();
  assert.equal(f.calls, 0);
  f.rect.top = 1599;
  f.scroll();
  assert.equal(f.calls, 1);
  f.scroll();
  assert.equal(f.calls, 1);
  assert.ok(f.observers.every((o) => o.disconnected));
});

test('tall initial viewport starts immediately; height changes update the loading margin', () => {
  const immediate = fixture(1500);
  assert.equal(immediate.calls, 1);
  const f = fixture(1800);
  assert.equal(f.calls, 0);
  f.view.innerHeight = 1000;
  f.view.dispatchEvent(new Event('resize'));
  assert.equal(f.observers.at(-1).options.rootMargin, '1000px 0px 1000px 0px');
  f.flush();
  assert.equal(f.calls, 1);
});

test('hidden or horizontally out-of-view surfaces do not activate', () => {
  const f = fixture();
  f.rect.top = 100;
  f.hide(true);
  f.scroll();
  assert.equal(f.calls, 0);
  f.hide(false);
  f.rect.left = 1200;
  f.scroll();
  assert.equal(f.calls, 0);
  f.rect.left = 0;
  f.scroll();
  assert.equal(f.calls, 1);
});

test('disconnect cancels pending activation', () => {
  const f = fixture();
  f.stop();
  f.rect.top = 100;
  f.scroll();
  assert.equal(f.calls, 0);
});
