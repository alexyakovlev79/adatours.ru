import assert from 'node:assert/strict';
import test from 'node:test';
import { rewriteMediaUrls, hasLocalMediaUrls } from '../scripts/prepare-pages-media.mjs';
const host = 'https://img.adatours.ru';

test('images srcset and video sources are redirected', () => {
  const input = '<img src="/media/a.webp" srcset="/media/b.webp 480w, /media/c.webp 1280w">'
    + '<video src="/media/hero.mp4" poster="/media/hero.webp"></video>';
  const out = rewriteMediaUrls(input, host);
  for (const item of ['a.webp', 'b.webp', 'c.webp', 'hero.mp4', 'hero.webp'])
    assert.ok(out.includes(host + '/media/' + item));
  assert.equal(hasLocalMediaUrls(out), false);
});
test('CSS backgrounds OG images and JSON-LD image URLs are redirected', () => {
  const input = '.hero{background:url(/media/b.webp)}'
    + '<meta property="og:image" content="https://adatours.ru/media/cover.webp">'
    + '{"contentUrl":"https://www.adatours.ru/media/c.webp"}';
  const out = rewriteMediaUrls(input, host);
  assert.ok(out.includes('url(' + host + '/media/b.webp)'));
  assert.ok(out.includes('content="' + host + '/media/cover.webp"'));
  assert.ok(out.includes('"contentUrl":"' + host + '/media/c.webp"'));
  assert.equal(hasLocalMediaUrls(out), false);
});
test('external donor links and regular routes stay untouched', () => {
  const input = '<img src="https://brasiltours.ru/media/old.jpg">'
    + '<img src="https://other.example/media/old.jpg">'
    + '<a href="/brazil/tour/rio/">Rio</a>';
  assert.equal(rewriteMediaUrls(input, host), input);
});
test('escaped JSON URLs remain valid after rewriting', () => {
  const input = '{"src":"\\/media\\/a.webp","old":"https:\\/\\/adatours.ru\\/media\\/a.webp"}';
  const out = rewriteMediaUrls(input, host);
  assert.equal(JSON.parse(out).src, host + '/media/a.webp');
  assert.equal(JSON.parse(out).old, host + '/media/a.webp');
  assert.equal(hasLocalMediaUrls(out), false);
});
test('already-CDN image URLs remain unchanged', () => {
  const input = '<img src="https://img.adatours.ru/media/x.webp">';
  assert.equal(rewriteMediaUrls(input, host), input);
});
