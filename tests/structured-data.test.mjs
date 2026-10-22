import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStructuredData, absoluteUrl, logicalPath, hasType, safeJsonLd } from '../src/lib/structured-data.mjs';
import { inspectHtml } from '../src/lib/structured-data-html.mjs';
import programmeExamples from '../src/data/commercial/mice-programme-examples.json' with { type: 'json' };
const root = 'https://adatours.ru/';
const organization = {
  name: 'Ada Tours', url: root, legalName: 'Ada Tours 2007 - Operadora de Turismo LTDA',
  logo: '/brand/adatours-logo-black.svg', languages: ['Русский', 'English'], email: 'info@adatours.com',
  description: 'Принимающий туроператор и DMC.', cnpj: '08.537.782/0001-04',
  sameAs: ['https://adatours.com/'],
  areaServed: [{ '@type': 'Country', name: 'Бразилия' }, { '@type': 'Place', name: 'Латинская Америка' }],
};
const record = (kind, id, path, data = {}, archived = false) => ({ kind, path, archived, data: { id, status: 'published', slug: id, name: id, ...data } });
const brazil = record('country', 'br', '/brazil/', { name: 'Бразилия' });
const argentina = record('country', 'ar', '/argentina/', { name: 'Аргентина' });
const adventure = record('theme', 'adventure', '/interests/adventure/', { name: 'Приключения' });
const rio = record('destination', 'rio', '/brazil/place/rio/', { name: 'Рио', countryId: 'br', destinationType: 'city', themes: ['adventure'] });
const tour = record('tour', 'trip', '/brazil/tour/trip/', { name: undefined, title: 'Рио за 3 дня', lead: 'Поездка в Рио.', durationDays: 3, durationNights: 2, countries: ['br'], destinations: ['rio', 'reserved'], primaryThemes: ['adventure'], audiences: ['Частные путешественники'], route: ['Рио', 'Будущее место'], priceFrom: 1200.6, currency: 'USD', itinerary: [{ day: 1, title: 'Прибытие', text: 'Встреча в аэропорту' }, { title: 'Дополнительная экскурсия', text: 'Не отдельный день' }] });
const multiTour = record('tour', 'multi', '/multi-country/tour/multi/', { name: undefined, title: 'Бразилия и Аргентина', lead: 'Маршрут по двум странам.', durationDays: 10, countries: ['br', 'ar'], routeCountries: ['br', 'ar'], destinations: ['rio'], primaryThemes: ['adventure'] });
const vipTour = record('tour', 'vip', '/brazil/tour/vip/', { name: undefined, title: 'VIP Бразилия', lead: 'Частный VIP-маршрут.', durationDays: 8, countries: ['br'], routeCountries: ['br'], destinations: ['rio'], priceFrom: 5000, currency: 'USD' });
const all = [brazil, argentina, adventure, rio, tour, multiTour, vipTour];
function build(path = tour.path, options = {}) {
  return buildStructuredData({ root, organization, records: all, page: { path, url: absoluteUrl(path, root), title: 'Страница', description: 'Описание', lang: 'ru' }, ...options });
}
const nodes = (graph, type) => graph['@graph'].filter((node) => hasType(node, type));
const entity = (graph) => graph['@graph'].find((node) => node['@id'] === `${root}brazil/tour/trip/#tour`);

const peru = record('country', 'country_peru', '/peru/', { name: 'Перу' });
const bolivia = record('country', 'country_bolivia', '/bolivia/', { name: 'Боливия' });
const fitCase = record('case', 'case_fit_peru_bolivia_complex_trip', '/cases/peru-bolivia-complex-trip/', {
  name: undefined, title: 'Перу и Боливия: выполненная поездка', projectStatus: 'completed',
  countries: ['country_peru', 'country_bolivia'], relatedServices: ['/dmc/', '/dmc/travel-agencies/'],
  testimonial: { quote: 'Спасибо за <Перу> & Боливию!\nВсё прошло отлично.', caption: 'Отзыв о поездке' },
});
const quoteMarkup = `<blockquote data-case-quotation="${fitCase.data.id}"><p>Спасибо за &lt;Перу&gt; &amp; Боливию!<br>Всё прошло отлично.</p></blockquote>`;
function buildCasePage(path, html, data = fitCase) {
  return build(path, { records: [peru, bolivia, data], document: inspectHtml(html, { root, pageUrl: absoluteUrl(path, root) }).facts });
}

test('completed FIT case links its real countries and DMC services to an anonymous visible quotation', () => {
  const graph = buildCasePage(fitCase.path, `<h1>Перу и Боливия</h1>${quoteMarkup}<a href="/dmc/">DMC</a><a href="/dmc/travel-agencies/">Турагентствам</a>`);
  const article = nodes(graph, 'Article')[0];
  const quote = nodes(graph, 'Quotation')[0];
  assert.equal(quote['@id'], `${root}cases/peru-bolivia-complex-trip/#testimonial`);
  assert.equal(quote.text, 'Спасибо за <Перу> & Боливию! Всё прошло отлично.');
  assert.equal(quote.isPartOf['@id'], article['@id']);
  assert.deepEqual(article.hasPart, [{ '@id': quote['@id'] }]);
  assert.deepEqual(article.spatialCoverage.map((item) => item['@id']), [`${root}peru/#country`, `${root}bolivia/#country`]);
  assert.equal(nodes(graph, 'Country').length, 2);
  assert.equal(nodes(graph, 'Service').length, 2);
  for (const service of nodes(graph, 'Service')) {
    assert.equal(service.provider['@id'], `${root}#organization`);
    assert.ok(service.subjectOf.some((item) => item['@id'] === article['@id']));
    assert.ok(article.about.some((item) => item['@id'] === service['@id']));
    assert.ok(quote.about.some((item) => item['@id'] === service['@id']));
  }
  for (const field of ['author', 'creator', 'reviewRating', 'aggregateRating', 'datePublished']) assert.equal(quote[field], undefined);
  assert.equal(nodes(graph, 'Person').length, 0);
  assert.equal(nodes(graph, 'Review').length, 0);
  assert.equal(nodes(graph, 'AggregateRating').length, 0);
  assert.equal(article.datePublished, undefined);
  assert.ok(!safeJsonLd(graph).includes('<Перу>'));
  assert.equal(JSON.parse(safeJsonLd(graph))['@graph'].find((item) => hasType(item, 'Quotation')).text, quote.text);
});

test('hidden, mismatched and unmarked case text never becomes a quotation', () => {
  for (const html of [
    quoteMarkup.replace('<blockquote ', '<blockquote hidden '),
    quoteMarkup.replace(fitCase.data.id, 'case_someone_else'),
    quoteMarkup.replace('Всё прошло отлично.', 'Другая формулировка.'),
    quoteMarkup.replace(/blockquote/g, 'div'),
  ]) {
    assert.equal(nodes(buildCasePage(fitCase.path, html), 'Quotation').length, 0);
  }
  const planned = { ...fitCase, data: { ...fitCase.data, projectStatus: 'planned' } };
  const graph = buildCasePage(fitCase.path, `${quoteMarkup}<a href="/dmc/">DMC</a>`, planned);
  assert.equal(nodes(graph, 'Quotation').length, 0);
  assert.equal(nodes(graph, 'Service').length, 0);
});

test('DMC proof follows a visible completed case link and does not turn the FIT case into MICE evidence', () => {
  const html = `<h1>Для турагентств</h1><a href="${fitCase.path}">Перу и Боливия</a>${quoteMarkup}<a href="/dmc/terms/">Условия работы</a>`;
  const graph = buildCasePage('/dmc/travel-agencies/', html);
  const service = nodes(graph, 'Service')[0];
  const article = nodes(graph, 'Article')[0];
  assert.equal(service['@id'], `${root}dmc/travel-agencies/#service`);
  assert.equal(service.termsOfService, `${root}dmc/terms/`);
  assert.equal(nodes(graph, 'WebPage')[0].mainEntity['@id'], service['@id']);
  assert.deepEqual(service.subjectOf, [{ '@id': article['@id'] }]);
  assert.equal(nodes(graph, 'Quotation').length, 1);
  assert.deepEqual(nodes(graph, 'Quotation')[0].about, [{ '@id': service['@id'] }]);
  const absent = buildCasePage('/dmc/', '<h1>DMC</h1>');
  assert.equal(nodes(absent, 'Service')[0].subjectOf, undefined);
  assert.equal(nodes(absent, 'Article').length, 0);
  const mice = buildCasePage('/mice/', `<h1>MICE</h1><a href="${fitCase.path}">Пример логистики</a>`);
  assert.equal(nodes(mice, 'Service')[0].subjectOf, undefined);
  assert.equal(nodes(mice, 'Quotation').length, 0);
});

test('a visible quotation on partnership terms keeps only the case actual service relations', () => {
  const graph = buildCasePage('/dmc/terms/', `<h1>Условия сотрудничества</h1>
    <a href="${fitCase.path}">Кейс Перу и Боливии</a>${quoteMarkup}
    <a href="/dmc/">DMC</a><a href="/dmc/travel-agencies/">Турагентствам</a>`);
  const services = nodes(graph, 'Service');
  const terms = services.find((item) => item['@id'] === `${root}dmc/terms/#service`);
  const quote = nodes(graph, 'Quotation')[0];
  const article = nodes(graph, 'Article')[0];
  assert.equal(terms.subjectOf, undefined);
  assert.equal(nodes(graph, 'Quotation').length, 1);
  assert.deepEqual(quote.about.map((item) => item['@id']), [`${root}dmc/#service`, `${root}dmc/travel-agencies/#service`]);
  assert.deepEqual(article.hasPart, [{ '@id': quote['@id'] }]);
  assert.ok(!article.about.some((item) => item['@id'] === terms['@id']));
  for (const service of services.filter((item) => item !== terms)) {
    assert.deepEqual(service.subjectOf, [{ '@id': article['@id'] }]);
  }
});

test('B2B programme collection describes one ordered list of actual cards, excluding repeated and hidden links', () => {
  const first = { ...tour, data: { ...tour.data, audiences: ['b2b'], priceFrom: null } };
  const second = { ...multiTour, data: { ...multiTour.data, audiences: ['b2b'] } };
  const hidden = { ...vipTour, data: { ...vipTour.data, audiences: ['b2b'] } };
  const html = `<h1>B2B-программы</h1><section><a href="${first.path}">Пояснение</a><a href="${hidden.path}">Дополнительная ссылка</a></section>
    <div data-schema-programmes><section><a href="${second.path}">Вторая программа</a></section><section><a href="${first.path}">Первая программа</a><a href="${first.path}">Подробнее</a></section><section hidden><a href="${hidden.path}">Скрыта</a></section></div>`;
  const document = inspectHtml(html, { root, pageUrl: `${root}mice/programmes/` }).facts;
  const graph = build('/mice/programmes/', { records: [brazil, argentina, first, second, hidden], document });
  const page = nodes(graph, 'CollectionPage')[0];
  const lists = nodes(graph, 'ItemList');
  assert.equal(lists.length, 1);
  assert.equal(page.mainEntity['@id'], `${root}mice/programmes/#programmes`);
  assert.equal(lists[0].numberOfItems, 2);
  assert.deepEqual(lists[0].itemListElement.map((item) => item.url), [absoluteUrl(second.path, root), absoluteUrl(first.path, root)]);
  assert.deepEqual(lists[0].itemListElement.map((item) => item.position), [1, 2]);
  assert.equal(nodes(graph, 'TouristTrip').length, 2);
  const missing = build('/mice/programmes/', { document: { groups: document.groups } });
  assert.equal(nodes(missing, 'ItemList').length, 0);
  assert.equal(nodes(missing, 'CollectionPage')[0].mainEntity, undefined);
});

test('a legacy review without an author is ignored safely', () => {
  const graph = build('/dmc/', { extra: { '@type': 'Review', reviewBody: 'Спасибо!' }, document: { text: 'Спасибо!' } });
  assert.equal(nodes(graph, 'Review').length, 0);
});

test('programme citations include only visible registered sources without creating products or identity links', () => {
  const [first, second, third] = programmeExamples;
  const html = `<h1>Примеры программ</h1><section>
    <a href="${first.url}">${first.title}</a><a href="${first.url}">Повторная ссылка</a>
    <a href="${second.url}">${second.title}</a>
    <div hidden><a href="${third.url}">${third.title}</a></div>
    <a href="https://example.com/unregistered">Другой материал</a></section>`;
  const document = inspectHtml(html, { root, pageUrl: `${root}mice/programmes/` }).facts;
  const graph = build('/mice/programmes/', { document });
  assert.deepEqual(nodes(graph, 'CollectionPage')[0].citation, [first.url, second.url]);
  for (const type of ['TouristTrip', 'Product', 'Article']) assert.equal(nodes(graph, type).length, 0);
  assert.ok(!graph['@graph'].some((node) => node.sameAs?.some((url) => programmeExamples.some((item) => item.url === url))));
  assert.equal(nodes(build('/mice/', { document }), 'WebPage')[0].citation, undefined);
});

test('production and preview paths have one base prefix and reject non-web protocols', () => {
  const preview = 'https://alexyakovlev79.github.io/adatours.ru/';
  for (const path of ['/brazil/', '/adatours.ru/brazil/', `${preview}brazil/`]) assert.equal(absoluteUrl(path, preview), `${preview}brazil/`);
  assert.equal(logicalPath(`${preview}brazil/`, preview), '/brazil/');
  assert.equal(logicalPath(`${preview}brand/logo.svg`, preview), '/brand/logo.svg');
  for (const url of ['javascript:alert(1)', 'data:text/plain,x', 'tel:123', '//example.org/']) assert.equal(absoluteUrl(url, root), undefined);
});
test('tour is the page main entity, linked to provider, country and real places', () => {
  const graph = build(); const trip = entity(graph); const page = nodes(graph, 'WebPage')[0];
  assert.equal(page.mainEntity['@id'], trip['@id']);
  assert.equal(trip.provider['@id'], `${root}#organization`);
  assert.deepEqual(trip.touristType, ['Приключения', 'Частные путешественники']);
  assert.equal(page.spatialCoverage[0]['@id'], `${root}brazil/#country`);
  assert.match(trip.description, /3 дней, 2 ночей/);
  assert.equal(trip.duration, undefined);
  const itinerary = nodes(graph, 'ItemList').find((n) => n['@id'].endsWith('#itinerary'));
  assert.equal(itinerary.itemListElement[0].item['@id'], `${root}brazil/place/rio/#place`);
  assert.deepEqual(itinerary.itemListElement[1].item, { '@type': 'Place', name: 'Будущее место' });
  assert.equal(nodes(graph, 'Trip').length, 1);
  assert.equal(nodes(graph, 'Trip')[0].partOfTrip['@id'], trip['@id']);
});
test('from price is rounded to the UI and not presented as an exact fixed price', () => {
  const offer = nodes(build(), 'Offer')[0];
  assert.equal(offer.priceSpecification.minPrice, 1201);
  assert.equal(offer.price, undefined); assert.equal(offer.availability, undefined);
  assert.equal(offer.priceCurrency, 'USD');
  assert.equal(offer.offeredBy['@id'], `${root}#organization`);
});
test('missing, zero, hidden and archived prices do not create offers', () => {
  for (const priceFrom of [0, null, undefined, NaN]) {
    const altered = { ...tour, data: { ...tour.data, priceFrom } };
    assert.equal(nodes(build(tour.path, { records: [brazil, rio, altered] }), 'Offer').length, 0);
  }
  assert.equal(nodes(build(tour.path, { document: { priceVisible: false } }), 'Offer').length, 0);
  const archived = build(tour.path, { records: [brazil, rio, { ...tour, archived: true }] });
  assert.equal(nodes(archived, 'Offer').length, 0);
  assert.ok(entity(archived));
  assert.match(nodes(archived, 'WebPage')[0].description, /Архивная программа/);
});
test('page-two catalog describes only visible cards with global positions', () => {
  const graph = build('/tours/page/2/', { document: { catalog: true, groups: [{ catalog: true, offset: 10, links: [{ href: tour.path }, { href: rio.path }] }] } });
  const list = nodes(graph, 'ItemList')[0];
  assert.equal(list['@id'], `${root}tours/page/2/#catalog`);
  assert.equal(list.numberOfItems, 2);
  assert.deepEqual(list.itemListElement.map((n) => n.position), [11, 12]);
  assert.equal(nodes(graph, 'CollectionPage')[0].mainEntity['@id'], list['@id']);
});
test('multi-country root and pagination share a Service, dynamic coverage and page-local ItemList', () => {
  for (const path of ['/multi-country/', '/multi-country/page/2/']) {
    const graph = build(path, { document: { catalog: true, groups: [{ catalog: true, offset: path.includes('/page/2/') ? 10 : 0, links: [{ href: multiTour.path }] }] } });
    const page = nodes(graph, 'CollectionPage')[0];
    const service = graph['@graph'].find((node) => node['@id'] === `${root}multi-country/#service`);
    const list = graph['@graph'].find((node) => node['@id'] === `${absoluteUrl(path, root)}#catalog`);
    assert.ok(service && hasType(service, 'Service'));
    assert.equal(service.url, `${root}multi-country/`);
    assert.equal(page.about['@id'], service['@id']);
    assert.deepEqual(page.spatialCoverage.map((item) => item['@id']).sort(), [`${root}argentina/#country`, `${root}brazil/#country`]);
    assert.deepEqual(service.areaServed.map((item) => item['@id']).sort(), page.spatialCoverage.map((item) => item['@id']).sort());
    assert.equal(page.mainEntity['@id'], list['@id']);
    assert.equal(list.itemListElement[0].position, path.includes('/page/2/') ? 11 : 1);
    assert.equal(list.itemListElement[0].item['@id'], `${root}multi-country/tour/multi/#tour`);
  }
});
test('VIP root and pagination share one Service and dynamic VIP geography', () => {
  for (const path of ['/vip/', '/vip/page/2/']) {
    const graph = build(path, { document: { catalog: true, groups: [{ catalog: true, offset: path.includes('/page/2/') ? 10 : 0, links: [{ href: vipTour.path }] }] } });
    const page = nodes(graph, 'CollectionPage')[0];
    const service = graph['@graph'].find((node) => node['@id'] === `${root}vip/#service`);
    assert.ok(service && hasType(service, 'Service'));
    assert.equal(service.url, `${root}vip/`);
    assert.equal(service.serviceType, 'Организация индивидуальных VIP-путешествий');
    assert.equal(page.about['@id'], service['@id']);
    assert.deepEqual(page.spatialCoverage.map((item) => item['@id']), [`${root}brazil/#country`]);
    assert.deepEqual(service.areaServed.map((item) => item['@id']), page.spatialCoverage.map((item) => item['@id']));
    assert.equal(page.mainEntity['@id'], `${absoluteUrl(path, root)}#catalog`);
  }
});

test('archives and drafts are excluded from visible catalogs even when linked', () => {
  const graph = build('/tours/', { records: [{ ...tour, archived: true }, { ...rio, data: { ...rio.data, status: 'draft' } }], document: { catalog: true, groups: [{ catalog: true, links: [{ href: tour.path }, { href: rio.path }] }] } });
  assert.equal(nodes(graph, 'ItemList')[0].numberOfItems, 0);
  assert.deepEqual(nodes(graph, 'ItemList')[0].itemListElement, []);
  assert.equal(nodes(graph, 'TouristTrip').length, 0);
});
test('fallback groups do not repeat cards already described in sections', () => {
  const graph = build('/country/', { document: { groups: [{ links: [{ href: brazil.path }] }, { fallback: true, links: [{ href: brazil.path }, { href: rio.path }] }] } });
  assert.deepEqual(nodes(graph, 'ItemList').map((n) => n.numberOfItems), [1, 1]);
});
test('thematic country links remain catalogs, not wrong URLs for countries', () => {
  const graph = build('/interests/adventure/', { document: { groups: [{ links: [{ href: '/interests/adventure/brazil/tours/', entityId: 'br', name: 'Бразилия' }] }] } });
  const linked = graph['@graph'].find((n) => n['@id'] === `${root}interests/adventure/brazil/tours/#webpage`);
  assert.equal(linked['@type'], 'CollectionPage');
  assert.equal(linked.about['@id'], `${root}brazil/#country`);
});
test('FAQ is not generated from unused tour frontmatter or invisible legacy data', () => {
  const modified = { ...tour, data: { ...tour.data, faq: [{ question: 'Скрытый вопрос?', answer: 'Скрытый ответ.' }] } };
  const graph = build(tour.path, { records: [modified], extra: { '@type': 'FAQPage', mainEntity: [{ name: 'Скрытый вопрос?', acceptedAnswer: { text: 'Скрытый ответ.' } }] }, document: { text: 'Текст страницы' } });
  assert.equal(nodes(graph, 'FAQPage').length, 0);
  const visible = build(tour.path, { document: { faq: [{ question: 'Видимый вопрос?', answer: 'Видимый ответ.' }] } });
  assert.equal(nodes(visible, 'FAQPage')[0].mainEntity[0].acceptedAnswer.text, 'Видимый ответ.');
});
test('reviews keep displayed authors/text and an explicitly supplied aggregate rating', () => {
  const review = { '@type': 'Review', author: { name: 'Анна' }, reviewBody: 'Спасибо за поездку!', reviewRating: { ratingValue: 5 } };
  const aggregate = { '@type': 'AggregateRating', ratingValue: 5, bestRating: 5, worstRating: 1, reviewCount: 1 };
  const graph = build('/reviews/', { extra: [review, aggregate], document: { text: 'Анна Спасибо за поездку!' } });
  assert.equal(nodes(graph, 'Review').length, 1);
  assert.equal(nodes(graph, 'Review')[0].reviewRating, undefined);
  assert.equal(nodes(graph, 'AggregateRating').length, 1);
  assert.equal(nodes(graph, 'AggregateRating')[0].ratingValue, 5);
  assert.equal(nodes(graph, 'AggregateRating')[0].reviewCount, 1);
  assert.equal(nodes(graph, 'AggregateRating')[0].itemReviewed, undefined);
  assert.equal(nodes(graph, 'Review')[0].itemReviewed['@id'], `${root}#organization`);
  assert.equal(nodes(graph, 'Organization')[0].aggregateRating['@id'], `${root}#aggregate-rating`);
  assert.equal(nodes(graph, 'CollectionPage')[0].mainEntity['@id'], `${root}reviews/#reviews`);
});
test('homepage describes visible sections, services, catalogs and customer reviews', () => {
  const review = { '@type': 'Review', author: { name: 'Мария' }, reviewBody: 'Спасибо за поездку!' };
  const aggregate = { '@type': 'AggregateRating', ratingValue: 5, bestRating: 5, worstRating: 1, reviewCount: 1 };
  const links = ['/country/', '/interests/', '/tours/', '/places/', '/excursions/', '/multi-country/', '/vip/', '/mice/', '/dmc/'];
  const graph = build('/', {
    extra: [review, aggregate],
    document: {
      text: 'Мария Спасибо за поездку! Анна Аванесова Оценка клиентов: 5,0 из 5 · Отзывов: 1',
      sections: [
        { id: 'home-countries', name: 'Куда поедем?' },
        { id: 'home-interests', name: 'Ради чего хочется лететь?' },
        { id: 'home-tours', name: 'Маршруты, с которых удобно начать' },
        { id: 'home-services', name: 'От частного путешествия до деловой делегации' },
        { id: 'home-reviews', name: 'Отзывы об Ada Tours' },
      ],
      groups: [
        { name: 'Куда поедем?', links: [{ href: `${root}brazil/` }, { href: `${root}country/` }] },
        { fallback: true, links: links.map((path) => ({ href: absoluteUrl(path, root) })) },
      ],
    },
  });
  const page = nodes(graph, 'WebPage')[0];
  const org = nodes(graph, 'Organization')[0];
  assert.equal(page.mainEntity['@id'], `${root}#organization`);
  assert.equal(org.aggregateRating['@id'], `${root}#aggregate-rating`);
  assert.equal(nodes(graph, 'Review').length, 1);
  assert.equal(nodes(graph, 'AggregateRating')[0].reviewCount, 1);
  assert.equal(nodes(graph, 'AggregateRating')[0].itemReviewed, undefined);
  assert.equal(nodes(graph, 'Review')[0].itemReviewed['@id'], `${root}#organization`);
  assert.equal(nodes(graph, 'WebPageElement').length, 5);
  assert.equal(nodes(graph, 'Service').length, 4);
  assert.ok(nodes(graph, 'CollectionPage').some((node) => node['@id'] === `${root}country/#webpage`));
  assert.ok(page.hasPart.some((part) => part['@id'] === `${root}#section-home-reviews`));
  assert.ok(page.mentions.some((item) => item['@id'] === `${root}#reviews`));
});

test('people, static services and geography get distinct semantic types', () => {
  const person = record('person', 'person_anna', '/team/anna-avanesova/', {
    name: 'Анна Аванесова', role: 'Основатель и CEO Ada Tours',
    expertise: ['Бразилия', 'MICE'], languages: ['Английский', 'Русский'],
  });
  const profile = build(person.path, { records: [person] });
  assert.equal(nodes(profile, 'ProfilePage').length, 1);
  assert.equal(nodes(profile, 'Person')[0].worksFor['@id'], `${root}#organization`);
  assert.equal(nodes(profile, 'Person')[0].description, 'Описание');
  assert.deepEqual(nodes(profile, 'Person')[0].knowsLanguage, ['en', 'ru']);
  assert.equal(nodes(profile, 'Organization')[0].founder['@id'], `${root}team/anna-avanesova/#person`);
  assert.equal(nodes(build('/vip/'), 'Service').length, 1);
  assert.equal(nodes(build('/contacts/'), 'ContactPage').length, 1);
  const antarctica = record('country', 'antarctica', '/antarctica/', { name: 'Антарктида', slug: 'antarctica' });
  const graph = build(antarctica.path, { records: [antarctica] });
  assert.equal(nodes(graph, 'Country').length, 0); assert.equal(nodes(graph, 'TouristDestination').length, 1);
});
test('JSON-LD is safe inside a script and node IDs are unique', () => {
  const payload = { text: '</script><script>alert(1)</script> & \u2028' };
  const serialized = safeJsonLd(payload);
  assert.ok(!serialized.includes('<')); assert.deepEqual(JSON.parse(serialized), payload);
  const graph = build(); const ids = graph['@graph'].map((n) => n['@id']);
  assert.equal(new Set(ids).size, ids.length);
  const org = nodes(graph, 'Organization')[0];
  assert.equal(org.foundingDate, undefined);
  assert.equal(org.taxID, '08.537.782/0001-04');
  assert.deepEqual(org.sameAs, ['https://adatours.com/']);
  assert.deepEqual(org.knowsLanguage, ['ru', 'en']);
  assert.deepEqual(org.contactPoint.availableLanguage, ['ru', 'en']);
  assert.equal(org.areaServed[0].name, 'Бразилия');
});

test('country pages offer price range only for tours, not excursions', () => {
  const pricedMulti = { ...multiTour, data: { ...multiTour.data, priceFrom: 3400, currency: 'USD' } };
  const ex1 = record('excursion', 'ex1', '/brazil/excursion/ex1/', { title: 'Экскурсия 1', priceFrom: 50, currency: 'USD' });
  const ex2 = record('excursion', 'ex2', '/brazil/excursion/ex2/', { title: 'Экскурсия 2', priceFrom: 100, currency: 'USD' });
  const graph = build('/brazil/', { records: [brazil, tour, pricedMulti, ex1, ex2], document: {
    groups: [{ links: [tour.path, pricedMulti.path, ex1.path, ex2.path].map((href) => ({ href })) }],
  } });
  const aggregates = nodes(graph, 'AggregateOffer');
  assert.equal(aggregates.length, 1);
  assert.deepEqual([aggregates[0].lowPrice, aggregates[0].highPrice, aggregates[0].offerCount, aggregates[0].priceCurrency],
    [1201, 3400, 2, 'USD']);
  const selection = graph['@graph'].find((n) => n['@id'] === `${root}brazil/#tour-USD-selection`);
  assert.equal(selection.offers['@id'], aggregates[0]['@id']);
});

test('catalog ranges use rendered products only, group types/currencies and deduplicate', () => {
  const pricedMulti = { ...multiTour, data: { ...multiTour.data, priceFrom: 3456, currency: 'USD' } };
  const pricedEur = { ...vipTour, data: { ...vipTour.data, priceFrom: 500, currency: 'EUR' } };
  const ex1 = record('excursion', 'ex1', '/brazil/excursion/ex1/', { title: 'Экскурсия 1', priceFrom: 45, currency: 'USD' });
  const ex2 = record('excursion', 'ex2', '/brazil/excursion/ex2/', { title: 'Экскурсия 2', priceFrom: 75, currency: 'USD' });
  const noPrice = record('tour', 'noPrice', '/brazil/tour/noPrice/', { title: 'Цена неизвестна', priceFrom: null, currency: 'USD' });
  const archived = { ...record('tour', 'old', '/brazil/tour/old/', { title: 'Архив', priceFrom: 1, currency: 'USD' }), archived: true };
  const graph = build('/tours/page/2/', { records: [tour, pricedMulti, pricedEur, ex1, ex2, noPrice, archived],
    document: { catalog: true, groups: [{ catalog: true, offset: 10, links: [
      tour.path, tour.path, pricedMulti.path, pricedEur.path, ex1.path, ex2.path, noPrice.path, archived.path,
    ].map((href) => ({ href })) }] },
  });
  const offers = nodes(graph, 'AggregateOffer');
  assert.equal(offers.length, 2);
  assert.deepEqual(offers.map((n) => [n.lowPrice, n.highPrice, n.offerCount, n.priceCurrency]),
    [[1201, 3456, 2, 'USD'], [45, 75, 2, 'USD']]);
  assert.equal(nodes(graph, 'Service').filter((n) => n.offers?.['@id']?.includes('price-range')).length, 2);
});

test('catalog cannot invent a range from a single price or different currencies', () => {
  const eurTour = { ...vipTour, data: { ...vipTour.data, priceFrom: 2000, currency: 'EUR' } };
  const graph = build('/tours/', { records: [tour, eurTour, multiTour], document: { catalog: true,
    groups: [{ catalog: true, links: [tour.path, eurTour.path, multiTour.path].map((href) => ({ href })) }] } });
  assert.equal(nodes(graph, 'AggregateOffer').length, 0);
});
