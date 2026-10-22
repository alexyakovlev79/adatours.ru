import test from 'node:test';
import assert from 'node:assert/strict';
import { usesTouchPlayback, isFullyVisible, isPlayableVisible, selectCoverVideo, coverRows, TouchCoverQueue } from '../src/lib/cover-playback-policy.mjs';
import { buildHeroVideoCatalog, borrowedHeroVideo, withFirstFrames } from '../src/lib/hero-video-catalog.mjs';

const screen = { top: 0, bottom: 800, left: 0, right: 1000 };
const rect = (top, left = 0, width = 500, height = 300) => ({ top, left, width, height, bottom: top + height, right: left + width });
const item = (id, top, left = 0, width = 500, height = 300) => ({ id, order: 0, rect: rect(top, left, width, height) });
const sources = { src: 'wide.mp4', poster: 'wide-frame.webp', mobileSrc: 'tall.mp4', mobilePoster: 'tall-frame.webp' };

test('any landscape or square surface uses the wide pair, any portrait the tall pair', () => {
  assert.deepEqual(selectCoverVideo(sources, rect(0, 0, 400, 350)), { src: 'wide.mp4', poster: 'wide-frame.webp' });
  assert.deepEqual(selectCoverVideo(sources, rect(0, 0, 350, 350)), { src: 'wide.mp4', poster: 'wide-frame.webp' });
  assert.deepEqual(selectCoverVideo(sources, rect(0, 0, 350, 400)), { src: 'tall.mp4', poster: 'tall-frame.webp' });
  assert.equal(selectCoverVideo({ src: 'wide.mp4' }, rect(0, 0, 350, 400)), undefined);
  assert.equal(selectCoverVideo(sources, rect(0, 0, 0, 0)), undefined);
});

test('phone/tablet playback is independent of a narrow desktop viewport or connected tablet trackpad', () => {
  assert.equal(usesTouchPlayback({ userAgent: 'Desktop' }, true), false);
  assert.equal(usesTouchPlayback({ userAgent: 'iPhone' }, true), true);
  assert.equal(usesTouchPlayback({ userAgent: 'iPad' }, true), true);
  assert.equal(usesTouchPlayback({ userAgent: 'Android' }, true), true);
  assert.equal(usesTouchPlayback({ platform: 'MacIntel', maxTouchPoints: 5 }, true), true);
  assert.equal(usesTouchPlayback({ userAgent: 'Desktop', maxTouchPoints: 0 }, false), false);
  assert.equal(usesTouchPlayback({ userAgent: 'Other touch device', maxTouchPoints: 5 }, false), true);
});

test('a one-pixel loss at any edge stops eligibility; oversized and hidden surfaces never play', () => {
  assert.equal(isFullyVisible(rect(0, 0, 1000, 800), screen), true);
  for (const r of [rect(-1), rect(501), rect(0, -1), rect(0, 501), rect(0, 0, 0, 0), rect(0, 0, 1000, 801)]) {
    assert.equal(isFullyVisible(r, screen), false);
  }
});

test('small laptop with 150% Windows scaling can play an oversized home hero', () => {
  const laptop = { top: 0, bottom: 535, left: 0, right: 1050 };
  assert.equal(isPlayableVisible(rect(0, 0, 1050, 900), laptop), true);
  assert.equal(isPlayableVisible(rect(-150, 0, 1050, 900), laptop), true);
  assert.equal(isPlayableVisible(rect(-690, 0, 1050, 900), laptop), false);
});

test('minor clipping no longer prevents playback; a narrow visible strip still pauses', () => {
  assert.equal(isPlayableVisible(rect(-1), screen), true);
  assert.equal(isPlayableVisible(rect(750), screen), false);
  assert.equal(isPlayableVisible(rect(0, -1), screen), true);
  assert.equal(isPlayableVisible(rect(-160), screen), false);
  assert.equal(isPlayableVisible(rect(-100), screen), true);
  assert.equal(isPlayableVisible(rect(0, 0, 0, 300), screen), false);
});

test('a row is generic and ordered by actual horizontal position, not names or DOM order', () => {
  const rows = coverRows([item('third', 200, 600, 200), item('first', 200, 0, 200), item('second', 200, 300, 200)]);
  assert.deepEqual(rows[0].items.map(i => i.id), ['first', 'second', 'third']);
});

test('centre crossing works between animation frames, then continues the row above centre', () => {
  const q = new TouchCoverQueue();
  assert.equal(q.choose([item('left', 300), item('right', 300, 500)], screen), undefined);
  assert.equal(q.choose([item('left', 240), item('right', 240, 500)], screen), 'left');
  q.ended('left');
  assert.equal(q.choose([item('left', 100), item('right', 100, 500)], screen), 'right');
  q.ended('right');
  assert.equal(q.choose([item('left', 100), item('right', 100, 500)], screen), 'left');
});

test('four videos advance left-to-right, and an unrelated ended event cannot steal a turn', () => {
  const q = new TouchCoverQueue();
  const row = ['a', 'b', 'c', 'd'].map((id, n) => item(id, 250, n * 250, 250));
  assert.equal(q.choose(row, screen), 'a');
  q.ended('c'); assert.equal(q.choose(row, screen), 'a');
  for (const id of ['a', 'b', 'c', 'd']) { assert.equal(q.choose(row, screen), id); q.ended(id); }
  assert.equal(q.choose(row, screen), 'a');
});

test('sufficient overlap keeps a latched row playing until it leaves; the next row still waits for centre', () => {
  const q = new TouchCoverQueue();
  assert.equal(q.choose([item('old', 250), item('new', 650)], screen), 'old');
  assert.equal(q.choose([item('old', -1), item('new', 399)], screen), 'old');
  assert.equal(q.choose([item('old', -160), item('new', 240)], screen), 'new');
});

test('scrolling up through a centre also activates that row; visual viewport offsets are respected', () => {
  const q = new TouchCoverQueue();
  q.choose([item('x', 100)], screen);
  assert.equal(q.choose([item('x', 260)], screen), 'x');
  assert.equal(isFullyVisible(rect(0), { ...screen, top: 30 }), false);
});

test('borrowed heroes match source identity, retain owner exclusion and require registered first frames', () => {
  const frames = [{ src: 'wide.mp4', poster: 'wide-frame.webp' }, { src: 'tall.mp4', poster: 'tall-frame.webp' }];
  const catalog = buildHeroVideoCatalog([{ image: '/media/shared.webp', path: '/owner/', video: sources }], frames);
  assert.equal(borrowedHeroVideo(catalog, '/media/shared.webp', '/owner/'), undefined);
  assert.deepEqual(borrowedHeroVideo(catalog, 'https://img.adatours.ru/media/shared.webp', '/other/'), sources);
  assert.equal(borrowedHeroVideo(catalog, '/media/unrelated.webp', '/other/'), undefined);
  assert.equal(withFirstFrames({ src: 'unregistered.mp4' }, frames), undefined);
  assert.deepEqual(withFirstFrames({ src: 'wide.mp4', mobileSrc: 'unregistered.mp4' }, frames), { src: 'wide.mp4', poster: 'wide-frame.webp' });
});

test('conflicting videos for a shared hero fail visibly instead of selecting an arbitrary movie', () => {
  assert.throws(() => buildHeroVideoCatalog([
    { image: '/media/shared.webp', path: '/one/', video: { src: 'a.mp4' } },
    { image: '/media/shared.webp', path: '/two/', video: { src: 'b.mp4' } },
  ], [{ src: 'a.mp4', poster: 'a.webp' }, { src: 'b.mp4', poster: 'b.webp' }]), /Ambiguous/);
});
