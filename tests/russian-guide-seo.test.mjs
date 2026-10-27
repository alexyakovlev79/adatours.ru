import test from 'node:test';
import assert from 'node:assert/strict';
import settings from '../src/data/seo/russian-guide-targets.json' with { type: 'json' };
import destinations from '../src/data/catalog/destinations.json' with { type: 'json' };
import countries from '../data/source-index/catalogs/countries.json' with { type: 'json' };
import { isRussianGuidePage, russianGuideSeoMetadata } from '../src/lib/russian-guide-seo.mjs';

const record = (kind, id, path, data = {}, archived = false) =>
  ({ kind, path, archived, data: { id, slug: path.split('/').filter(Boolean).at(-1), ...data } });
const country = (id, slug) => record('country', id, '/' + slug + '/', { slug });
const records = [
  country('country_brazil', 'brazil'), country('country_argentina', 'argentina'),
  country('country_chile', 'chile'), country('country_peru', 'peru'),
  country('country_bolivia', 'bolivia'), country('country_mexico', 'mexico'),
  country('country_ecuador', 'ecuador'), country('country_venezuela', 'venezuela'),
  record('destination', 'destination_brazil_rio', '/brazil/place/rio-de-janeiro/', { countryId: 'country_brazil' }),
  record('destination', 'destination_brazil_morro_de_sao_paulo', '/brazil/place/morro-de-sao-paulo/', { countryId: 'country_brazil' }),
  record('tour', 'tour_rio', '/brazil/tour/rio/', { countries: ['country_brazil'], destinations: ['destination_brazil_rio'] }),
  record('tour', 'tour_non_rio', '/brazil/tour/salvador/', { countries: ['country_brazil'], destinations: ['destination_brazil_salvador'] }),
  record('tour', 'tour_pata', '/multi-country/tour/patagonia/', { countries: ['country_argentina', 'country_chile'], routeDestinations: ['destination_argentina_el_calafate'] }),
  record('excursion', 'exc_rio', '/brazil/rio-de-janeiro/rio-walk/', { country: 'country_brazil', destination: 'destination_brazil_rio' }),
  record('excursion', 'exc_salvador', '/brazil/salvador/walk/', { country: 'country_brazil', destination: 'destination_brazil_salvador' }),
];
const hit = (path, entries = records, lang = 'ru') => isRussianGuidePage({ path, records: entries, lang });

test('all editable IDs are valid and nonduplicated', () => {
  const c = new Set(countries.entries.map((r) => r.id));
  const d = new Set(destinations.map((r) => r.id));
  const ids = settings.destinationGroups.flatMap((r) => r.destinationIds);
  assert.equal(settings.countryIds.length, 11);
  assert.equal(settings.destinationGroups.length, 20);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of settings.countryIds) assert.ok(c.has(id), 'country ' + id);
  for (const id of ids) assert.ok(d.has(id), 'destination ' + id);
});

test('a selected city, its products and scoped catalogues receive the keyword', () => {
  for (const path of ['/brazil/place/rio-de-janeiro/', '/brazil/tour/rio/',
    '/brazil/rio-de-janeiro/rio-walk/', '/brazil/place/rio-de-janeiro/tour/',
    '/brazil/rio-de-janeiro/page/2/']) assert.ok(hit(path), path);
  const a = russianGuideSeoMetadata({ path: '/brazil/tour/rio/',
    title: 'Тур по Рио | Ada Tours', description: 'Путешествие в Рио.', records });
  assert.equal(a.title, 'Тур по Рио, русский гид | Ada Tours');
  assert.ok(a.description.startsWith('Русский гид: Ada Tours организует экскурсии и сопровождение на русском языке.'), a.description);
  assert.match(a.description, /Путешествие в Рио\./);
  assert.deepEqual(russianGuideSeoMetadata({ path: '/brazil/tour/rio/',
    title: a.title, description: a.description, records }), a);
});

test('unrelated destinations and broad Brazil/Argentina/Chile catalogues remain unchanged', () => {
  for (const path of ['/brazil/tour/salvador/', '/brazil/salvador/walk/',
    '/brazil/place/morro-de-sao-paulo/', '/brazil/tour/', '/brazil/',
    '/argentina/', '/chile/', '/multi-country/argentina_chile/', '/tours/'])
    assert.equal(hit(path), false, path);
  assert.ok(hit('/multi-country/tour/patagonia/'));
});

test('whole target countries, paginated country filters and optional-country routes match', () => {
  for (const path of ['/bolivia/', '/bolivia/place/', '/bolivia/excursion/page/2/',
    '/vip/bolivia/page/2/', '/interests/adventure/tours/bolivia/page/3/',
    '/multi-country/argentina_bolivia/']) assert.ok(hit(path), path);
  const optional = record('tour', 'opt', '/multi-country/tour/optional/', {
    countries: ['country_brazil', 'country_mexico'], routeCountries: ['country_brazil'],
    destinations: ['destination_brazil_salvador'] });
  assert.ok(hit(optional.path, [...records, optional]));
});

test('RU only, archive excluded, price copy retained, bare brand normalized once', () => {
  assert.equal(hit('/brazil/tour/rio/', records, 'en'), false);
  const archived = record('tour', 'old', '/bolivia/tour/old/', {
    countries: ['country_bolivia'], status: 'archived' }, true);
  assert.equal(hit(archived.path, [...records, archived]), false);
  const a = russianGuideSeoMetadata({ path: '/bolivia/', records,
    title: 'Боливия: цены от $1 250 туроператора Ada Tours',
    description: 'Стартовые цены: от $1 250. Туры по Боливии.' });
  assert.equal(a.title, 'Боливия: цены от $1 250, русский гид | Ada Tours');
  assert.match(a.description, /Стартовые цены: от \$1 250/);
  const b = russianGuideSeoMetadata({ path: '/bolivia/', records,
    title: 'Поездки с Ada Tours', description: 'Описание.' });
  assert.equal(b.title, 'Поездки, русский гид | Ada Tours');
  assert.equal(russianGuideSeoMetadata({ path: '/country/', title: 'Страны | Ada Tours',
    description: 'Все страны.', records }).title, 'Страны | Ada Tours');
});
