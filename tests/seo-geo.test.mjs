import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import {
  normalizeSeoGeoPath, seoGeoArticleFile, parseSeoGeoArticle,
  validateSeoGeoMarkdown, interpolateSeoGeoMarkdown, validateSeoGeoHtml,
  extractSeoGeoHeading, seoGeoCount, comparableUsdMinimum, seoGeoPriceBasis,
} from '../src/lib/seo-geo.mjs';

const article = [
  '---',
  'targetPath: /vip/bolivia/',
  'kind: vip_country',
  'status: approved',
  'buttonLabel: "Подробнее о VIP-турах в Боливию"',
  'lead: "Маршрут по Боливии"',
  '---',
  '## Как выбрать тур по Боливии',
  '',
  'В каталоге {{catalog.toursCountPhrase}}.',
  '',
  '{{#if catalog.hasComparableUsdPrice}}',
  'Стоимость начинается от {{catalog.minUsdPriceLabel}}.',
  '{{/if}}',
  '',
  '| Что сравниваем | Значение |',
  '|---|---|',
  '| Туры | {{catalog.toursCountPhrase}} |',
  '',
  '[Туры по Боливии](/bolivia/tour/).',
].join('\n');

test('normalizes canonical paths and forbids pagination, queries and path traversal', () => {
  assert.equal(normalizeSeoGeoPath('/vip/bolivia'), '/vip/bolivia/');
  assert.equal(seoGeoArticleFile('/vip/bolivia/'), 'data/seo-geo/articles/vip/bolivia/index.md');
  for (const path of ['/vip/bolivia/page/2/', '/vip/bolivia/?sort=1', '/foo/#faq',
    '/foo/../../bar/', '/', '//other.example/']) {
    assert.throws(() => normalizeSeoGeoPath(path));
  }
});

test('validates YAML metadata and requires publish approval, lead and heading', () => {
  const parsed = parseSeoGeoArticle(article);
  assert.equal(parsed.targetPath, '/vip/bolivia/');
  assert.equal(parsed.buttonLabel, 'Подробнее о VIP-турах в Боливию');
  assert.equal(parsed.status, 'approved');
  const draft = parseSeoGeoArticle(article.replace('status: approved', 'status: draft'));
  assert.equal(draft.status, 'draft');
  assert.throws(() => parseSeoGeoArticle(article.replace('lead: "Маршрут по Боливии"', 'lead: ""')));
  assert.throws(() => parseSeoGeoArticle(article.replace('## Как выбрать', '# Как выбрать')));
  assert.throws(() => parseSeoGeoArticle(article.replace('status: approved', 'status: published')));
});

test('blocks external links, images, raw HTML and H1 headings', () => {
  for (const bad of [
    '## Текст\n[Сайт](https://example.com)',
    '## Текст\n![Фото](/media/foo.webp)',
    '## Текст\n<img src="/media/foo.webp">',
    '## Текст\n<h3>HTML</h3>',
    '# Другой H1',
    '## Текст\n[Почта](mailto:person@example.com)',
  ]) assert.throws(() => validateSeoGeoMarkdown(bad));
  assert.doesNotThrow(() => validateSeoGeoMarkdown('## Заголовок\n[Туры](/bolivia/tour/)'));
});

test('interpolates dynamic counts, conditions, and validated tour tables', () => {
  const scope = {
    page: { title: 'Боливия' },
    catalog: { toursCountPhrase: '5 туров', hasComparableUsdPrice: false, minUsdPriceLabel: null },
    tourTable(ids) { return '| Тур |\n|---|\n' + ids.map((id) => '| ' + id + ' |').join('\n'); },
  };
  const result = interpolateSeoGeoMarkdown(parseSeoGeoArticle(article).markdown, scope);
  assert.match(result, /5 туров/);
  assert.doesNotMatch(result, /Стоимость начинается/);
  assert.match(interpolateSeoGeoMarkdown('{{catalog.tourTable:tour_one,tour_two}}', scope), /tour_one/);
  assert.throws(() => interpolateSeoGeoMarkdown('{{catalog.unknown}}', scope));
  assert.throws(() => interpolateSeoGeoMarkdown('{{#if catalog.bad}}X{{/if}}', scope));
  assert.throws(() => interpolateSeoGeoMarkdown('{{#if catalog.hasComparableUsdPrice}}X', scope));
  assert.throws(() => interpolateSeoGeoMarkdown('{{catalog.__proto__}}', scope));
  scope.catalog.hasComparableUsdPrice = true;
  scope.catalog.minUsdPriceLabel = '$3 218 на человека';
  assert.match(interpolateSeoGeoMarkdown(parseSeoGeoArticle(article).markdown, scope), /\$3 218 на человека/);
});

test('accepts semantic HTML, rejects external/noncanonical links and interactive elements', () => {
  assert.equal(validateSeoGeoHtml('<h2>Страна</h2><p>О ней <a href="/bolivia/tour/">туры</a></p>'), true);
  assert.throws(() => validateSeoGeoHtml('<h2>Текст</h2><p><a href="https://example.com/">Сайт</a></p>'));
  assert.throws(() => validateSeoGeoHtml('<h2>Текст</h2><a href="/vip/bolivia/page/2/">Страница 2</a>'));
  assert.throws(() => validateSeoGeoHtml('<h2>Текст</h2><img src="/a.webp">'));
  assert.throws(() => validateSeoGeoHtml('<h2>Текст</h2><a href="/foo/" onclick="alert(1)">Ссылка</a>'));
  assert.throws(() => validateSeoGeoHtml('<h1>Второй H1</h1>'));
  assert.throws(() => validateSeoGeoHtml('<h2>Свернутые данные: {{catalog.x}}</h2>'));
  assert.deepEqual(extractSeoGeoHeading('<h2 id="about">Подробнее</h2><p>Текст</p>'), {
    headingHtml: '<h2 id="about">Подробнее</h2>', bodyHtml: '<p>Текст</p>',
  });
});

test('Russian plurals and conservative price minima', () => {
  assert.deepEqual([1, 2, 5, 11, 21, 22, 25].map((n) =>
    seoGeoCount(n, ['тур', 'тура', 'туров'])),
  ['1 тур', '2 тура', '5 туров', '11 туров', '21 тур', '22 тура', '25 туров']);
  assert.equal(seoGeoPriceBasis('Стоимость за группу из 4 человек'), 'за группу');
  assert.equal(seoGeoPriceBasis('Цена на человека в двухместном номере'), 'на человека');
  assert.equal(seoGeoPriceBasis('Стоимость уточняется'), null);
  const a = { data: { currency: 'USD', priceFrom: 3218, priceNote: 'Цена на человека' } };
  const b = { data: { currency: 'USD', priceFrom: 4218, priceNote: 'Стоимость на человека' } };
  assert.equal(comparableUsdMinimum([a, b]), '$3 218 на человека');
  assert.equal(comparableUsdMinimum([a, { data: { ...b.data, priceNote: 'за группу' } }]), null);
  assert.equal(comparableUsdMinimum([a, { data: { ...b.data, currency: 'EUR' } }]), null);
  assert.equal(comparableUsdMinimum([a, { data: { ...b.data, priceFrom: null } }]), null);
  assert.equal(comparableUsdMinimum([]), null);
});


test('Astro GFM renderer produces static headings, tables and anchored links', async () => {
  const processor = await createMarkdownProcessor();
  const output = await processor.render('## Маршруты\n\n' +
    '| Тур | Дни |\n|---|---:|\n| [Боливия](/bolivia/tour/) | 7 |\n');
  assert.match(output.code, /<h2/);
  assert.match(output.code, /<table>/);
  assert.match(output.code, /href="\/bolivia\/tour\/"/);
  assert.doesNotThrow(() => validateSeoGeoHtml(output.code));
});
