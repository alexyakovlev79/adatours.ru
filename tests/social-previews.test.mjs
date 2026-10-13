import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import {
  chooseSocialPhoto, mediaPhotoPath, setSocialMetadata,
  previewKey, fitPhoto, renderPreview, SOCIAL_HEIGHT, SOCIAL_WIDTH, DEFAULT_PHOTO,
} from '../scripts/build-social-previews.mjs';

const photo = '/media/home/rio-night-enhanced-20260930.webp';

test('MICE without og:image picks the Hero image', () => {
  const html = '<html><head><title>MICE</title></head><body>' +
    '<section class="hero hero--image"><img class="hero__media" src="' + photo + '"></section></body></html>';
  assert.equal(chooseSocialPhoto(html), photo);
});

test('OG source with official image host is preferred to unrelated Hero', () => {
  const html = '<head><meta property="og:image" content="https://img.adatours.ru' + photo +
    '"></head><body><img class="hero__media" src="/media/something-else.webp"></body>';
  assert.equal(chooseSocialPhoto(html), photo);
});

test('foreign hosts, absent images and previous social derivatives are rejected', () => {
  assert.equal(mediaPhotoPath('https://brasiltours.ru/media/a.webp'), null);
  assert.equal(mediaPhotoPath('https://img.adatours.ru/media/social-previews/v1/aaa.jpg'), null);
  assert.equal(chooseSocialPhoto('<html><head></head><body></body></html>'), DEFAULT_PHOTO);
});

test('OG and Twitter image metadata are unique and idempotent', () => {
  const source = '<html><head><meta property="og:image" content="old.webp">' +
    '<meta name="twitter:card" content="summary"><title>ADA</title></head><body></body></html>';
  const url = 'https://img.adatours.ru/media/social-previews/v1/foo.jpg';
  const html = setSocialMetadata(source, url);
  for (const part of ['property="og:image"', 'property="og:image:width"', 'property="og:image:height"',
    'name="twitter:card"', 'name="twitter:image"']) {
    assert.equal(html.split(part).length - 1, 1, part);
  }
  assert.ok(html.includes('content="1200"') && html.includes('content="630"'));
  assert.ok(html.includes('content="summary_large_image"'));
  assert.equal(setSocialMetadata(html, url), html);
});

test('the entire wide or portrait original fits within the photo area', () => {
  const wide = fitPhoto(2400, 480);
  const tall = fitPhoto(500, 1400);
  assert.equal(wide.width, 1152);
  assert.ok(wide.height > 0 && wide.height < SOCIAL_HEIGHT);
  assert.equal(tall.height, 562);
  assert.ok(tall.width > 0 && tall.width < SOCIAL_WIDTH);
  assert.equal(previewKey(photo), previewKey(photo));
  assert.notEqual(previewKey(photo), previewKey('/media/other.webp'));
});

test('an actual wide photo renders to the Telegram-compatible 1200x630 JPEG', async () => {
  const original = await sharp({ create: { width: 2400, height: 450, channels: 3,
    background: { r: 80, g: 145, b: 180 } } }).jpeg().toBuffer();
  const logo = await readFile('public/brand/adatours-logo-white.svg');
  const jpeg = await renderPreview(original, logo);
  const meta = await sharp(jpeg).metadata();
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 630);
  assert.equal(meta.format, 'jpeg');
  assert.ok(jpeg.length > 1000);
});
