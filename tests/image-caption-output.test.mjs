import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectImageCaptions } from '../scripts/lib/image-caption-output.mjs';
import { deferImages } from '../src/lib/lazy-images.mjs';

test('new content paths must have alt and hover even without a registry entry', () => {
  const result = inspectImageCaptions('<div class="day__media"><img src="/media/new.webp" alt="Река"></div>');
  assert.equal(result.substantive, 1);
  assert.deepEqual(result.sources, ['/media/new.webp']);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].reason, /hover/);
  const missing = inspectImageCaptions('<figure class="media-gallery__item"><img src="/media/new.webp" alt="" title=""></figure>');
  assert.ok(missing.errors.some((e) => /description/.test(e.reason)));
});

test('a CSS-only content photo fails but an equivalent responsive img passes after deferral', () => {
  const css = '<div class="day__media"><span class="hero-image-responsive" role="img" aria-label="Река" title="Река" style="background-image:url(/media/river.webp)"></span></div>';
  assert.ok(inspectImageCaptions(css).errors.some((e) => /CSS background/.test(e.reason)));
  const picture = '<div class="day__media"><picture class="hero-image-responsive"><source media="(max-width: 479px)" srcset="/media/phone.webp"><img src="/media/river.webp" alt="Река" title="Река"></picture></div>';
  const result = inspectImageCaptions(deferImages(picture));
  assert.deepEqual(result.errors, []);
  assert.equal(result.substantive, 1, 'no-JS copy must not inflate placement counts');
  assert.deepEqual(result.sources, ['/media/river.webp']);
});

test('decorative posters and inherited hidden images keep empty alt without hover', () => {
  const result = inspectImageCaptions('<div class="day__media"><img class="hero-video-poster" aria-hidden="true" src="/media/frame.webp" alt=""></div><div aria-hidden="true"><img src="/brand/logo.svg" alt=""></div>');
  assert.deepEqual(result.errors, []);
  assert.equal(result.decorative, 2);
  assert.equal(result.substantive, 0);
  assert.ok(inspectImageCaptions('<img class="hero__media" src="/media/hero.webp" alt="" title="Лишнее">').errors.length);
});

test('deferred CDN paths still match exact editorial overrides; video photo slots are checked', () => {
  const rows = new Map([['/media/reviewed.webp', { alt: 'Река', hover: 'Вид на реку' }]]);
  const html = '<div class="day__media"><template data-static-hero><img src="https://img.adatours.ru/media/reviewed.webp" alt="Река" title="Неверно"></template></div>';
  assert.ok(inspectImageCaptions(html, rows).errors.some((e) => /editorial/.test(e.reason)));
  const valid = deferImages('<div class="day__media"><img src="https://img.adatours.ru/media/reviewed.webp" alt="Река" title="Вид на реку"></div>');
  assert.deepEqual(inspectImageCaptions(valid, rows).errors, []);
  assert.ok(inspectImageCaptions('<img src="/photo.webp">').errors.some((e) => /alt attribute/.test(e.reason)));
});
