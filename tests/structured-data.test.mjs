import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStructuredData, absoluteUrl, logicalPath, hasType, safeJsonLd } from '../src/lib/structured-data.mjs';
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
const adventure = record('theme', 'adventure', '/interests/adventure/', { name: 'Приключения' });
const rio = record('destination', 'rio', '/brazil/place/rio/', { name: 'Рио', countryId: 'br', destinationType: 'city', themes: ['adventure'] });
const tour = record('tour', 'trip', '/brazil/tour/trip/', { name: undefined, title: 'Рио за 3 дня', lead: 'Поездка в Рио.', durationDays: 3, durationNights: 2, countries: ['br'], destinations: ['rio', 'reserved'], primaryThemes: ['adventure'], audiences: ['Частные путешественники'], route: ['Рио', 'Будущее место'], priceFrom: 1200.6, currency: 'USD', itinerary: [{ day: 1, title: 'Прибытие', text: 'Встреча в аэропорту' }, { title: 'Дополнительная экскурсия', text: 'Не отдельный день' }] });
const all = [brazil, adventure, rio, tour];
function build(path = tour.path, options = {}) {
  return buildStructuredData({ root, organization, records: all, page: { path, url: absoluteUrl(path, root), title: 'Страница', description: 'Описание', lang: 'ru' }, ...options });
}
const nodes = (graph, type) => graph['@graph'].filter((node) => hasType(node, type));
const entity = (graph) => graph['@graph'].find((node) => node['@id'] === `${root}brazil/tour/trip/#tour`);

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
test('reviews keep displayed authors/text without invented ratings', () => {
  const review = { '@type': 'Review', author: { name: 'Анна' }, reviewBody: 'Спасибо за поездку!', reviewRating: { ratingValue: 5 } };
  const graph = build('/reviews/', { extra: [review], document: { text: 'Анна Спасибо за поездку!' } });
  assert.equal(nodes(graph, 'Review').length, 1);
  assert.equal(nodes(graph, 'Review')[0].reviewRating, undefined);
  assert.equal(nodes(graph, 'AggregateRating').length, 0);
});
test('people, static services and geography get distinct semantic types', () => {
  const person = record('person', 'anna', '/team/anna/', { name: 'Анна', role: 'Менеджер', languages: ['Английский', 'Русский'] });
  const profile = build(person.path, { records: [person] });
  assert.equal(nodes(profile, 'ProfilePage').length, 1);
  assert.equal(nodes(profile, 'Person')[0].worksFor['@id'], `${root}#organization`);
  assert.deepEqual(nodes(profile, 'Person')[0].knowsLanguage, ['en', 'ru']);
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
