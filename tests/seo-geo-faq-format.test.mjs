import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSeoGeoFaqFormat } from '../src/lib/seo-geo-faq-format.mjs';

test('canonical H2 FAQ and H3 questions are allowed', () => {
  const text = '## Частые вопросы\n\n### Когда ехать?\n\nВесной, см. [маршрут](/brazil/tour/).\n\n### Нужна ли виза?\n\nЗависит от гражданства.\n';
  assert.deepEqual(checkSeoGeoFaqFormat(text), []);
});

test('noncanonical H3 FAQ heading is rejected', () => {
  assert.match(checkSeoGeoFaqFormat('### Частые вопросы\n\n### Когда?\n\nВесной.').join(' '), /must be H2/);
});

test('inline bold questions and H4 question headings are rejected', () => {
  assert.match(checkSeoGeoFaqFormat('## FAQ\n\n**Можно ли?** Да.').join(' '), /question must be H3/);
  assert.match(checkSeoGeoFaqFormat('## FAQ\n\n#### Можно ли?\n\nДа.').join(' '), /question must be H3/);
});

test('a question outside FAQ is unaffected', () => {
  assert.deepEqual(checkSeoGeoFaqFormat('## Варианты\n\n**Можно ли?** Да.'), []);
});

test('the next independent H2 closes FAQ', () => {
  assert.deepEqual(checkSeoGeoFaqFormat('## Частые вопросы\n\n### Когда?\n\nЛетом.\n\n## Другое\n\n**Почему?** Потому что.'), []);
});
