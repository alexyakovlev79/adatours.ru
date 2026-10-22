import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectSeoGeoArticle } from '../src/lib/seo-geo-schema.mjs';
import { buildStructuredData, hasType } from '../src/lib/structured-data.mjs';

const root = 'https://adatours.ru/';
const opts = { root, pageUrl: root + 'brazil/' };
const org = { name: 'Ada Tours', url: root, logo: '/brand/adatours-logo-black.svg', languages: ['Русский'] };
const record = (kind, id, path, data = {}, archived = false) =>
  ({ kind, path, archived, data: { id, status: 'published', name: id, slug: id, ...data } });
const brazil = record('country', 'country_brazil', '/brazil/', { name: 'Бразилия', slug: 'brazil' });
const argentina = record('country', 'country_argentina', '/argentina/', { name: 'Аргентина', slug: 'argentina' });
const pantanal = record('destination', 'destination_pantanal', '/brazil/place/pantanal/',
  { name: 'Пантанал', countryId: 'country_brazil', destinationType: 'natural_area' });
const tour = record('tour', 'tour_pantanal', '/brazil/tour/pantanal-five-days/',
  { title: 'Пантанал за пять дней', countries: ['country_brazil'], destinations: ['destination_pantanal'] });
const theme = record('theme', 'theme_wildlife', '/interests/wildlife/',
  { name: 'Природа и животные', slug: 'wildlife' });
const all = [brazil, argentina, pantanal, tour, theme];
const article = {
  targetPath: '/brazil/',
  headingHtml: '<h2 id="guide-brazil">Путешествие по Бразилии</h2>',
  lead: 'Сравните регионы, маршрут и погоду.',
  bodyHtml: '<h2 id="regions">Регионы</h2>' +
    '<h3 id="pantanal">Пантанал: природа</h3>' +
    '<p>В <a href="/brazil/place/pantanal/">Пантанале</a> наблюдают животных.</p>' +
    '<table><thead><tr><th>Маршрут</th><th>Длительность</th></tr></thead>' +
    '<tbody><tr><td><a href="/brazil/tour/pantanal-five-days/">Пантанал за пять дней</a></td><td>5 дней</td></tr></tbody></table>' +
    '<h2 id="faq">Частые вопросы о Бразилии</h2>' +
    '<h3 id="can-go">Можно ли увидеть Пантанал?</h3>' +
    '<p>Да, откройте <a href="/brazil/place/pantanal/">Пантанал</a> и программу тура.</p>',
};
const node = (graph, type) => graph['@graph'].find((n) => hasType(n, type));
const id = (graph, key) => graph['@graph'].find((n) => n['@id'] === key);

test('editorial parser extracts real sections, canonical links, tabular facts and H2/H3 FAQ', () => {
  const data = inspectSeoGeoArticle(article, opts);
  assert.equal(data.headline, 'Путешествие по Бразилии');
  assert.equal(data.sections[0].level, 2);
  assert.equal(data.sections.find((section) => section.headingId === 'pantanal').parentKey, 'section-2');
  assert.equal(data.tables.length, 1);
  assert.equal(data.tables[0].rowCount, 1);
  assert.deepEqual(data.tables[0].columns, ['Маршрут', 'Длительность']);
  assert.deepEqual(data.faq, [{
    question: 'Можно ли увидеть Пантанал?',
    answer: 'Да, откройте Пантанал и программу тура.',
    links: [root + 'brazil/place/pantanal/'], headingId: 'can-go',
  }]);
  assert.equal(data.links.length, 2);
});

test('every SEO article is a WebPage part with mentions, precise about and reverse subjectOf', () => {
  const data = inspectSeoGeoArticle(article, opts);
  const graph = buildStructuredData({ root, organization: org, records: all,
    page: { path: '/brazil/', url: root + 'brazil/', title: 'Бразилия', description: 'Путеводитель', lang: 'ru' },
    document: { editorial: data, faq: [], text: 'Пантанал' } });
  const page = node(graph, 'CollectionPage');
  const work = id(graph, root + 'brazil/#seo-geo-article');
  assert.equal(work['@type'], 'Article');
  assert.equal(work.isPartOf['@id'], page['@id']);
  assert.ok(page.hasPart.some((part) => part['@id'] === work['@id']));
  assert.equal(work.url, root + 'brazil/#seo-geo-content-brazil');
  assert.ok(work.mentions.some((item) => item['@id'] === root + 'brazil/tour/pantanal-five-days/#tour'));
  const place = id(graph, root + 'brazil/place/pantanal/#place');
  const sectionId = root + 'brazil/#seo-geo-section-3';
  assert.equal(id(graph, sectionId).about[0]['@id'], place['@id']);
  assert.ok(place.subjectOf.some((item) => item['@id'] === sectionId));
  const country = id(graph, root + 'brazil/#country');
  assert.ok(country.subjectOf.some((item) => item['@id'] === work['@id']));
  assert.equal(country.containsPlace[0]['@id'], place['@id']);
  const table = node(graph, 'Table');
  assert.equal(table.text.includes('5 дней'), true);
  assert.equal(table.isPartOf['@id'], sectionId);
  const faq = node(graph, 'FAQPage');
  assert.equal(faq.mainEntity[0].name, 'Можно ли увидеть Пантанал?');
  assert.equal(faq.mainEntity[0].acceptedAnswer.mentions[0]['@id'], place['@id']);
});

test('unresolved external and archival destinations do not create false subjectOf links', () => {
  const data = inspectSeoGeoArticle({
    ...article,
    bodyHtml: '<h2>Места</h2><h3>Пантанал</h3><p><a href="/brazil/place/pantanal/">Пантанал</a>' +
      ' и <a href="https://not-adatours.example/">внешний сайт</a>.</p>',
  }, opts);
  const records = [brazil, { ...pantanal, archived: true }];
  const graph = buildStructuredData({ root, organization: org, records,
    page: { path: '/brazil/', url: root + 'brazil/', title: 'Бразилия', description: 'Маршрут', lang: 'ru' },
    document: { editorial: data } });
  assert.ok(!graph['@graph'].some((n) => n['@id'] === root + 'brazil/place/pantanal/#place'));
  assert.ok(!JSON.stringify(graph).includes('not-adatours.example'));
});

test('filtered country combinations get actual multi-country Service and do not replace ItemList', () => {
  const path = '/multi-country/argentina_brazil/';
  const graph = buildStructuredData({ root, organization: org, records: all,
    page: { path, url: root + 'multi-country/argentina_brazil/', title: 'Аргентина и Бразилия',
      description: 'Маршруты', lang: 'ru' },
    document: { catalog: true, groups: [{
      catalog: true, offset: 0, links: [{ href: tour.path }],
    }] } });
  const service = id(graph, root + 'multi-country/argentina_brazil/#service');
  const page = id(graph, root + 'multi-country/argentina_brazil/#webpage');
  assert.equal(service['@type'], 'Service');
  assert.equal(service.areaServed.length, 2);
  assert.equal(page.about['@id'], service['@id']);
  assert.equal(page.mainEntity['@id'], root + 'multi-country/argentina_brazil/#catalog');
});

test('pagination and pages with no SEO article do not claim hidden editorial content', () => {
  const data = inspectSeoGeoArticle(article, opts);
  const graph = buildStructuredData({ root, organization: org, records: all,
    page: { path: '/brazil/tour/page/2/', url: root + 'brazil/tour/page/2/',
      title: 'Страница 2', description: 'Далее', lang: 'ru' },
    document: { editorial: data } });
  assert.equal(node(graph, 'Article'), undefined);
  assert.equal(node(graph, 'FAQPage'), undefined);
});

test('organization uses a confirmed visible independent article as subjectOf', () => {
  const input = { root, organization: {
    ...org, externalMentions: [{ name: 'Ada Tours — история', url: 'https://example.org/story' }],
  }, records: all,
    page: { path: '/about/', url: root + 'about/', title: 'О нас', description: 'О нас', lang: 'ru' } };
  const graph = buildStructuredData({ ...input,
    document: { groups: [{ links: [{ href: 'https://example.org/story' }] }] } });
  const external = id(graph, 'https://example.org/story#article');
  assert.equal(external['@type'], 'Article');
  assert.equal(node(graph, 'Organization').subjectOf[0]['@id'], external['@id']);
  assert.equal(node(buildStructuredData(input), 'Article'), undefined);
});

test('only explicitly verified cross-language canonical pairs become entity sameAs', () => {
  const identified = { ...pantanal, data: { ...pantanal.data,
    verifiedSameAs: ['https://adatours.com/pantanal'] } };
  const graph = buildStructuredData({ root, organization: org, records: [brazil, identified],
    page: { path: identified.path, url: root + 'brazil/place/pantanal/',
      title: 'Пантанал', description: 'Природа', lang: 'ru' } });
  const place = id(graph, root + 'brazil/place/pantanal/#place');
  assert.deepEqual(place.sameAs, ['https://adatours.com/pantanal']);
  const without = buildStructuredData({ root, organization: org, records: [brazil, pantanal],
    page: { path: pantanal.path, url: root + 'brazil/place/pantanal/',
      title: 'Пантанал', description: 'Природа', lang: 'ru' } });
  assert.equal(id(without, root + 'brazil/place/pantanal/#place').sameAs, undefined);
});
