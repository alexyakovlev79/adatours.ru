import test from 'node:test';
import assert from 'node:assert/strict';
import { extractHeroUsages, groupHeroAssets, heroAssetId, logicalHeroSource } from '../scripts/mobile-hero-inventory.mjs';

const original = '/media/countries/example/hero.webp';
const page = (body, path = '/example/') => `<html><head><link rel="canonical" href="https://adatours.ru${path}"></head><body>${body}</body></html>`;
const hero = (attributes = '', media = `<img class="hero__media" src="${original}">`) => `<section class="hero hero--compact hero--image" ${attributes}>${media}<h1>Пример &amp; фокус</h1></section>`;

test('editorial photograph inside video template survives; video first frames are independent', () => {
  const html = page(hero('', `<hero-background-video><template data-static-hero><picture><source srcset="/media/crops/old.webp 480w"><img class="hero__media" src="https://img.adatours.ru${original}"></picture></template><noscript><img class="hero__media" src="${original}"></noscript><template data-first-frame><img class="hero-video-poster" src="/media/poster.webp"></template><video data-src="/media/movie.mp4" data-poster="/media/first-frame.webp" data-mobile-poster="/media/phone-frame.webp"></video></hero-background-video>`));
  const result = extractHeroUsages(html, { pagePath: '/example/' });
  assert.equal(result.usages.length, 1);
  assert.equal(result.usages[0].source, original);
  assert.equal(result.usages[0].context.title, 'Пример & фокус');
  assert.equal(result.usages[0].context.videoAlternative.src, '/media/movie.mp4');
  assert.deepEqual(result.videoPosters.map((row) => row.source), ['/media/first-frame.webp', '/media/phone-frame.webp']);
});

test('archived usage is excluded while the shared active source remains one job', () => {
  const archived = extractHeroUsages(page(hero()), { pagePath: '/archived/', archived: true });
  const active = extractHeroUsages(page(hero()), { pagePath: '/active/', archived: false });
  assert.equal(archived.usages.length, 0);
  assert.equal(archived.excluded[0].reason, 'archived-page');
  const assets = groupHeroAssets([...archived.usages, ...active.usages]);
  assert.equal(assets.length, 1);
  assert.equal(assets[0].usages[0].pagePath, '/active/');
  assert.equal(assets[0].status, 'PENDING');
});

test('photo-lead manual position and geometry are retained separately from portrait profile', () => {
  const html = page(`<section class="hero hero--content-sized hero--photo-lead" style="--hero-image-position-mobile: 62% 54%"><img class="hero__media" src="${original}"><h1>Бразилия</h1></section>`);
  const [usage] = extractHeroUsages(html, { pagePath: '/brazil/' }).usages;
  assert.equal(usage.profile, 'photo-lead');
  assert.equal(usage.objectPosition, '62% 54%');
  assert.equal(usage.geometry.heightCss, 'clamp(270px, 90vw, 420px)');
  assert.equal(usage.geometry.minimumHeightOnly, false);
});

test('complete team portrait is registered for preservation; body portraits are not hero photos', () => {
  const html = page(`<section class="team-hero"><div><img class="team-hero__photo" src="${original}"></div><h1>Команда</h1></section><section><img src="/media/people/person.webp"></section>`, '/team/');
  const result = extractHeroUsages(html, { pagePath: '/team/' });
  assert.equal(result.usages.length, 1);
  assert.equal(result.usages[0].profile, 'preserve-full-image');
  assert.equal(groupHeroAssets(result.usages)[0].status, 'PRESERVE_ORIGINAL');
});

test('prepared crop preserves exact-page coverage and does not complete other uses of same source', () => {
  const media = `<picture><source srcset="/media/crop.webp 480w"><img class="hero__media" data-mobile-hero="p06" style="--hero-mobile-crop-position: center top" src="${original}"></picture>`;
  const first = extractHeroUsages(page(hero('', media)), { pagePath: '/prepared/' }).usages;
  const next = extractHeroUsages(page(hero()), { pagePath: '/generated/interests/nature/' }).usages;
  const manifests = [{ path: 'pilot.json', data: { items: [{ pagePath: '/prepared/', source: original, status: 'READY', sourceSha256: 'a'.repeat(64), crop: { left: 3, top: 0, width: 300, height: 400 }, variants: [{ key: 'media/crop.webp', width: 480 }] }] } }];
  assert.equal(groupHeroAssets(first, { manifests })[0].status, 'PREPARED');
  const [asset] = groupHeroAssets([...first, ...next], { manifests });
  assert.equal(asset.status, 'PENDING');
  assert.equal(asset.existingCrops.length, 1);
  assert.equal(asset.usages.length, 2);
  assert.equal(asset.sourceSha256, 'a'.repeat(64));
  assert.equal(first[0].context.preparedCrop.objectPosition, 'center top');
});

test('source identity is stable across production CDN/base URLs and independent of usage ordering', () => {
  assert.equal(logicalHeroSource(`https://img.adatours.ru${original}?cache=1`), original);
  assert.equal(logicalHeroSource(`/preview${original}`, { base: '/preview/' }), original);
  const rows = ['/vip/example/', '/multi-country/a-b/interests/nature/', '/interests/nature/'].flatMap((pagePath) => extractHeroUsages(page(hero()), { pagePath }).usages);
  assert.equal(groupHeroAssets(rows)[0].id, heroAssetId(original));
  assert.equal(groupHeroAssets(rows.reverse())[0].id, heroAssetId(original));
});

test('text-only Hero and redirect do not create photo jobs', () => {
  const result = extractHeroUsages(page(hero('', '')), { pagePath: '/team/person/' });
  assert.equal(result.usages.length, 0);
  assert.equal(result.excluded[0].reason, 'hero-without-editorial-photograph');
  const redirect = extractHeroUsages('<head><meta http-equiv="refresh" content="0;url=/active/"></head>', { pagePath: '/old/' });
  assert.equal(redirect.excluded[0].reason, 'redirect');
});
