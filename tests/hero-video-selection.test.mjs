import test from 'node:test';
import assert from 'node:assert/strict';
import { selectHeroVideo } from '../src/lib/hero-video-selection.mjs';

const sources = { src: '/desktop.mp4', poster: '/desktop.webp', mobileSrc: '/mobile.mp4', mobilePoster: '/mobile.webp' };
const phone = { userAgent: 'Mozilla/5.0 (Linux; Android 14) Mobile' };
const tablet = { userAgent: 'Mozilla/5.0 (Linux; Android 14) Tablet' };

test('phones select the mobile movie and its own first frame', () => {
  assert.deepEqual(selectHeroVideo(sources, phone), { src: '/mobile.mp4', poster: '/mobile.webp' });
  assert.deepEqual(selectHeroVideo(sources, { userAgent: 'iPhone' }), { src: '/mobile.mp4', poster: '/mobile.webp' });
});
test('tablets and desktops select the desktop pair regardless of viewport', () => {
  for (const browser of [tablet, { userAgent: 'iPad', userAgentData: { mobile: true } }, {}])
    assert.deepEqual(selectHeroVideo(sources, browser), { src: '/desktop.mp4', poster: '/desktop.webp' });
});
test('an absent device variant selects photo, never the other movie', () => {
  assert.equal(selectHeroVideo({ src: sources.src, poster: sources.poster }, phone), undefined);
  assert.equal(selectHeroVideo({ mobileSrc: sources.mobileSrc, mobilePoster: sources.mobilePoster }, tablet), undefined);
});
test('missing first frame leaves a blank video surface, never the other poster', () => {
  assert.deepEqual(selectHeroVideo({ ...sources, mobilePoster: undefined }, phone), { src: '/mobile.mp4', poster: undefined });
});
