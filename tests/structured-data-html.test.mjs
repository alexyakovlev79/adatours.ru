import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectHtml } from '../src/lib/structured-data-html.mjs';
const options = { root: 'https://adatours.ru/', pageUrl: 'https://adatours.ru/tours/' };
test('rendered catalog order, pagination, hidden content and legacy JSON-LD', () => {
  const html = '<h1>Туры</h1><div hidden>Скрытый текст</div><div data-catalog-root data-catalog-from="11"><div data-catalog-items><div data-catalog-item="one"><a href="/brazil/tour/one/"><h2>Первый</h2></a></div><div data-catalog-item="two"><a href="/brazil/tour/two/"><strong>Второй</strong></a></div></div></div><script type="application/ld+json">{"@type":"Person","name":"Old"}</script><script>window.example = 1;</script>';
  const result = inspectHtml(html, options);
  assert.equal(result.facts.catalog, true); assert.equal(result.facts.groups[0].offset, 10);
  assert.deepEqual(result.facts.groups[0].expectedIds, ['one', 'two']);
  assert.equal(result.facts.groups[0].links[0].entityId, 'one');
  assert.equal(result.legacy.length, 1); assert.ok(!result.html.includes('application/ld+json'));
  assert.ok(result.html.includes('<script>window.example = 1;</script>'));
  assert.ok(!result.facts.text.includes('Скрытый текст'));
});
test('visible FAQ details and Markdown FAQ, not generic accordions', () => {
  const html = '<section id="faq"><h2>Вопросы и ответы</h2><details><summary>Когда ехать?</summary><p>В любое время.</p></details></section><details><summary>День 1</summary><p>Программа дня.</p></details><div><h2>FAQ</h2><h3>Как оплатить?</h3><p>По договору.</p><h2>Далее</h2></div>';
  const result = inspectHtml(html, options);
  assert.deepEqual(result.facts.faq, [{ question: 'Когда ехать?', answer: 'В любое время.' }, { question: 'Как оплатить?', answer: 'По договору.' }]);
});
test('real pricing class and HTML entities are recognized', () => {
  const result = inspectHtml('<h1>Туры &amp; экскурсии</h1><section class="pricing section"><h2>от $1 200</h2></section>', options);
  assert.equal(result.facts.h1, 'Туры & экскурсии'); assert.equal(result.facts.priceVisible, true);
});
test('all ordinary HTML remains byte-for-byte unchanged', () => {
  const html = '<section data-astro-cid-abcd><a href="/brazil/?a=1&amp;b=2">Бразилия</a><img src="/media/image.webp" alt="Фото" /></section>';
  assert.equal(inspectHtml(html, options).html, html);
});
test('full-document inspection finds canonical, robots, social metadata and redirect', () => {
  const html = '<!doctype html><html><head><link rel="canonical" href="https://adatours.ru/brazil/"><meta name="robots" content="noindex,follow"><meta property="og:url" content="https://adatours.ru/brazil/"><meta property="og:title" content="Бразилия | Ada Tours"><meta property="og:locale" content="ru_RU"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Бразилия | Ada Tours"><meta http-equiv="refresh" content="0;url=/brazil/"></head><body><p>Переход</p></body></html>';
  const result = inspectHtml(html, { ...options, fullDocument: true });
  assert.equal(result.metadata.canonical, 'https://adatours.ru/brazil/');
  assert.equal(result.metadata.ogUrl, result.metadata.canonical);
  assert.equal(result.metadata.ogLocale, 'ru_RU');
  assert.equal(result.metadata.twitterCard, 'summary_large_image');
  assert.equal(result.metadata.twitterTitle, 'Бразилия | Ada Tours');
  assert.equal(result.metadata.redirect, true); assert.equal(result.metadata.robots, 'noindex,follow');
});
