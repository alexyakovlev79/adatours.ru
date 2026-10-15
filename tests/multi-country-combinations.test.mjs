import test from 'node:test';
import { isActiveEntity } from '../src/lib/archive.mjs';
import { multiCountrySeoMetadata } from '../src/lib/multi-country-seo.mjs';
import { collectSeoPagePrices, enrichSeoPriceMetadata } from '../src/lib/seo-price-meta.mjs';
import assert from 'node:assert/strict';
import {
  buildMultiCountryCombinations,
  multiCountryCombinationKey,
  multiCountryCombinationPath,
  nextMultiCountryOptions,
  extendMultiCountrySelection,
  previousMultiCountrySelection,
  removeMultiCountrySelection,
  formatMultiCountryNames,
} from '../src/lib/multi-country-combinations.mjs';

const codes = Object.fromEntries(['argentina', 'brazil', 'chile', 'peru', 'uruguay']
  .map((slug) => [slug, { slug, name: slug }]));
const getCountries = (tour) => (tour.routeCountries ?? tour.countries).map((slug) => codes[slug]);

test('static combinations are sorted, unique, nonempty and match only main countries', () => {
  const tours = [
    { id: 'abc', countries: ['peru', 'chile', 'argentina', 'brazil'], routeCountries: ['chile', 'brazil', 'argentina'] },
    { id: 'brazil-peru', countries: ['brazil', 'peru'] },
    { id: 'brazil-only', countries: ['brazil'] },
    { id: 'chile-brazil', countries: ['brazil', 'chile'] },
    { id: 'same-country', countries: ['argentina', 'argentina'] },
  ];
  const rows = buildMultiCountryCombinations(tours, getCountries);
  const byKey = new Map(rows.map((row) => [row.slugs.join('_'), row]));
  assert.deepEqual([...byKey.keys()], [...byKey.keys()].sort((a, b) => a.localeCompare(b, 'en')));
  assert.deepEqual(byKey.get('argentina_brazil').tours.map((tour) => tour.id), ['abc']);
  assert.deepEqual(byKey.get('brazil_chile').tours.map((tour) => tour.id), ['abc', 'chile-brazil']);
  assert.deepEqual(byKey.get('brazil_peru').tours.map((tour) => tour.id), ['brazil-peru']);
  assert.deepEqual(byKey.get('argentina_brazil_chile').tours.map((tour) => tour.id), ['abc']);
  assert.ok(!byKey.has('argentina_peru'));
  assert.ok(!byKey.has('argentina_brazil_chile_peru'));
  assert.equal(multiCountryCombinationPath(['chile', 'argentina', 'brazil']), '/multi-country/argentina_brazil_chile/');
  assert.deepEqual(nextMultiCountryOptions(rows, ['argentina', 'brazil']), ['chile']);
  assert.deepEqual(nextMultiCountryOptions(rows, ['brazil']), ['argentina', 'chile', 'peru']);
});

test('fourth selector appears only where a fourth main country exists, even on larger routes', () => {
  const tours = [{ id: 'five', countries: ['uruguay', 'peru', 'brazil', 'chile', 'argentina'] }];
  const rows = buildMultiCountryCombinations(tours, getCountries);
  assert.equal(rows.filter((row) => row.slugs.length === 4).length, 5);
  assert.deepEqual(nextMultiCountryOptions(rows, ['argentina', 'brazil', 'chile']), ['peru', 'uruguay']);
  assert.deepEqual(nextMultiCountryOptions(rows, ['argentina', 'brazil', 'chile', 'peru']), []);
  assert.throws(() => multiCountryCombinationKey(['argentina']));
  assert.throws(() => multiCountryCombinationKey(['argentina', 'argentina']));
  assert.throws(() => multiCountryCombinationKey(['argentina', 'brazil', 'chile', 'peru', 'uruguay']));
});


test('mobile back returns one level through the visitor choice order', () => {
  const first = ['brazil'];
  const pair = extendMultiCountrySelection(first, ['argentina', 'brazil']);
  const triple = extendMultiCountrySelection(pair, ['argentina', 'brazil', 'chile']);
  const quadruple = extendMultiCountrySelection(triple, ['argentina', 'brazil', 'chile', 'peru']);
  assert.deepEqual(pair, ['brazil', 'argentina']);
  assert.deepEqual(triple, ['brazil', 'argentina', 'chile']);
  assert.deepEqual(quadruple, ['brazil', 'argentina', 'chile', 'peru']);
  assert.deepEqual(previousMultiCountrySelection(quadruple), triple);
  assert.deepEqual(previousMultiCountrySelection(triple), pair);
  assert.deepEqual(previousMultiCountrySelection(pair), first);
  assert.deepEqual(previousMultiCountrySelection(first), []);
  assert.throws(() => extendMultiCountrySelection(first, ['brazil', 'brazil']));
  assert.throws(() => extendMultiCountrySelection(pair, ['argentina', 'chile']));
});


test('removing a selected country preserves all other countries, including later ones', () => {
  const triple = ['argentina', 'brazil', 'chile'];
  const withoutSecond = removeMultiCountrySelection(triple, 1);
  assert.deepEqual(withoutSecond, ['argentina', 'chile']);
  assert.equal(multiCountryCombinationPath(withoutSecond), '/multi-country/argentina_chile/');
  const quadruple = ['chile', 'argentina', 'brazil', 'peru'];
  assert.deepEqual(removeMultiCountrySelection(quadruple, 1), ['chile', 'brazil', 'peru']);
  assert.equal(multiCountryCombinationPath(removeMultiCountrySelection(quadruple, 1)),
    '/multi-country/brazil_chile_peru/');
  assert.deepEqual(removeMultiCountrySelection(['argentina', 'brazil'], 1), ['argentina']);
  assert.throws(() => removeMultiCountrySelection(triple, 0));
  assert.throws(() => removeMultiCountrySelection(triple, 3));
  assert.throws(() => removeMultiCountrySelection(['argentina', 'argentina'], 1));
});

test('country names use natural Russian conjunction without changing selection order', () => {
  assert.equal(formatMultiCountryNames([]), '');
  assert.equal(formatMultiCountryNames(['Бразилия']), 'Бразилия');
  assert.equal(formatMultiCountryNames(['Бразилия', 'Аргентина']), 'Бразилия и Аргентина');
  assert.equal(formatMultiCountryNames(['Аргентина', 'Бразилия']), 'Аргентина и Бразилия');
  assert.equal(formatMultiCountryNames(['Бразилия', 'Аргентина', 'Коста-Рика']),
    'Бразилия, Аргентина и Коста-Рика');
  assert.equal(formatMultiCountryNames(['Бразилия', 'Аргентина', 'Коста-Рика', 'Чили']),
    'Бразилия, Аргентина, Коста-Рика и Чили');
  const chosen = ['brazil', 'argentina'];
  const alphabetical = [...chosen].sort();
  assert.equal(multiCountryCombinationPath(chosen), multiCountryCombinationPath(alphabetical));
  assert.deepEqual(chosen, ['brazil', 'argentina']);
});

test('rebuilds pairs and triples when route country changes or tour is archived', () => {
  const slugs = ['argentina','brazil','chile'];
  const lookup = new Map(slugs.map(slug => [slug, { slug, name: slug }]));
  const tour = { data: { id:'test',status:'approved',locale:'ru',countries:slugs,routeCountries:['argentina','brazil'] } };
  const routes = () => buildMultiCountryCombinations([tour].filter(isActiveEntity),
    e => (e.data.routeCountries ?? e.data.countries).map(id=>lookup.get(id))).map(x=>x.path);
  assert.deepEqual(routes(), ['/multi-country/argentina_brazil/']);
  tour.data.routeCountries=['argentina','brazil','chile'];
  assert.deepEqual(new Set(routes()),new Set(['/multi-country/argentina_brazil/','/multi-country/argentina_chile/','/multi-country/brazil_chile/','/multi-country/argentina_brazil_chile/']));
  tour.data.routeCountries=['argentina','chile'];
  assert.deepEqual(routes(),['/multi-country/argentina_chile/']);
  tour.data.status='archived';
  assert.deepEqual(routes(),[]);
});

test('multi-country SEO uses exact selected countries, verified USD minimum and Russian genitives', () => {
  const countries = [
    {id:'country_antarctica',name:'Антарктида'},
    {id:'country_chile',name:'Чили'},
    {id:'country_peru',name:'Перу'},
  ];
  const tours = [
    {data:{id:'one',priceFrom:7800,currency:'USD',routeDestinations:['drake','santiago']}},
    {data:{id:'two',priceFrom:6595,currency:'USD',routeDestinations:['machu']}},
    {data:{id:'three',priceFrom:null,currency:'USD',routeDestinations:['santiago']}},
  ];
  const destinations = [
    {id:'drake',countryId:'country_antarctica',name:'Пролив Дрейка'},
    {id:'santiago',countryId:'country_chile',name:'Сантьяго'},
    {id:'machu',countryId:'country_peru',name:'Мачу-Пикчу'},
  ];
  const seo = multiCountrySeoMetadata({countries,tours,destinations,date:new Date('2026-10-15T06:00:00Z')});
  assert.equal(seo.title.replaceAll('\u00a0',' '),
    'Антарктида, Чили и Перу: Каталог 2026-2027: 3 тура и цены от $6 595 туроператора Ada Tours');
  assert.match(seo.description.replaceAll('\u00a0',' '),
    /^Цены туров: от \$6 595\. Достопримечательности Антарктиды, Чили и Перу\./);
  assert.match(seo.description,/Пролив Дрейка, Сантьяго и Мачу-Пикчу/);
  assert.equal(seo.minUsdPrice,6595);
  const mixed = multiCountrySeoMetadata({countries,tours:[
    tours[0],{data:{...tours[1].data,currency:'EUR'}}
  ],date:new Date('2026-10-15T06:00:00Z')});
  assert.ok(!mixed.title.includes('цены от'));
  assert.ok(mixed.description.startsWith('Достопримечательности Антарктиды, Чили и Перу.'));
  const unchanged = enrichSeoPriceMetadata({
    title:seo.title, description:seo.description,
    prices:[{kind:'tour',amount:6595,currency:'USD',id:'two'}, {kind:'tour',amount:7800,currency:'USD',id:'one'}],
  });
  assert.equal(unchanged.changed,false,'Do not insert the same price twice');
});

test('combination price selection ignores cheaper tours missing a country and uses full list on page 2', () => {
  const kinds = ['antarctica','chile','peru'];
  const records = kinds.map((slug) => ({
    kind:'country',path:'/'+slug+'/',data:{id:'country_'+slug,slug,status:'approved'},
  }));
  const tour = (id, amount, ids) => ({
    kind:'tour',path:'/multi-country/tour/'+id+'/', data:{
      id,status:'approved',priceFrom:amount,currency:'USD',routeCountries:ids,
      countries:ids,
    },
  });
  records.push(
    tour('first',8500,['country_antarctica','country_chile','country_peru']),
    tour('second',6595,['country_antarctica','country_chile','country_peru']),
    tour('cheaper-but-no-peru',800,['country_antarctica','country_chile']),
    tour('peru-only-optional',500,['country_antarctica','country_chile'])
  );
  records.at(-1).data.countries.push('country_peru');
  const params = { records,root:'https://adatours.ru/',
    groups:[{links:[{href:'/multi-country/tour/cheaper-but-no-peru/'}]}] };
  const first = collectSeoPagePrices({...params,path:'/multi-country/antarctica_chile_peru/'});
  const second = collectSeoPagePrices({...params,path:'/multi-country/antarctica_chile_peru/page/2/'});
  assert.deepEqual(first.map((r)=>r.id),['first','second']);
  assert.deepEqual(second,first);
  assert.equal(Math.min(...second.map((r)=>r.amount)),6595);
});
