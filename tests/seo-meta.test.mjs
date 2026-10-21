import test from "node:test";
import assert from "node:assert/strict";
import {SEO,seoFill,seoCountLabel,seoYearRange,seoPopularCountriesAfterPo} from "../src/lib/seo-meta.mjs";
test("declension for counted objects and irregular 'places'",()=>{
 assert.equal(seoFill("[число] тур[ов], [число] экскурси[й], [число] достопримечательност[ей]",{numbers:[1,2,5]}),
  "1 тур, 2 экскурсии, 5 достопримечательностей");
 assert.equal(seoFill("[число] экскурсий; [число] интересных и красивых мест",{numbers:[21,1]}),
  "21 экскурсия; 1 интересное и красивое место");
 assert.equal(seoFill("[число] интересных и красивых мест",{numbers:[22]}),"22 интересных и красивых места");
 assert.equal(seoCountLabel(11,["тур","тура","туров"]),"11 туров");
 assert.equal(seoCountLabel(24,["маршрут","маршрута","маршрутов"]),"24 маршрута");
});
test("computed total countries and total minus two",()=>{
 assert.equal(seoFill("[24] стран[ы] и еще [22] стран[ы]",{countries:24}),"24 страны и еще 22 страны");
 assert.equal(seoFill("[24] стран[ы] и еще [22] стран[ы]",{countries:23}),"23 страны и еще 21 страна");
 assert.equal(seoFill("[число] VIP и Luxury тур[ов] по [24] странам",{numbers:[2],countries:24}),
  "2 VIP и Luxury тура по 24 странам");
});
test("annual rollover at Moscow Jan 1",()=>{
 assert.equal(seoYearRange(new Date("2026-12-31T20:59:00Z")),"2026-2027");
 assert.equal(seoYearRange(new Date("2026-12-31T21:00:00Z")),"2027-2028");
 assert.equal(seoFill(SEO.country.title,{country:"Бразилия",numbers:[21,2,5],date:new Date("2026-10-09T12:00:00Z")}),
  "Бразилия: 21 локация и 2 экскурсии. Каталог 2026-2027: 5 туров и цены туроператора Ada Tours");
});
test("countries after 'по' use case",()=>{
 assert.equal(seoPopularCountriesAfterPo(["Бразилия","Аргентина","Перу"]),"Бразилии, Аргентине, Перу");
 assert.equal(seoPopularCountriesAfterPo(["Бразилия","Чили"],true),"Бразилии, Чили и другим странам");
});


import {SEO_CASES,seoCountryCase,seoCountryDirection,seoPlacePhrase,seoPlaceDirectionPhrase,seoInterestCase} from '../src/lib/seo-grammar.mjs';
import {seoCountryTitle,seoDestinationTitle,seoTourTitle,seoExcursionTitle,
 seoThemeHubTitle,seoThemeCatalogTitle,seoCountryTourCatalogTitle,
 seoCountryPlacesCatalogTitle,seoCountryExcursionsCatalogTitle,seoDestinationTourCatalogTitle,
 seoDestinationExcursionsCatalogTitle,seoExcursionTourCatalogTitle,seoPaginatedTitle,seoRelatedToursDescription,
 seoCompactTitle,seoAttractionsDescription
} from '../src/lib/seo-page.mjs';

test('case table covers all known countries, themes, and destinations',()=>{
 assert.equal(Object.keys(SEO_CASES.countries).length,24);
 assert.equal(Object.keys(SEO_CASES.interests).length,15);
 assert.ok(Object.keys(SEO_CASES.destinations).length>=700);
 assert.equal(seoCountryCase('country_brazil','genitive'),'Бразилии');
 assert.equal(seoCountryCase('country_belize','dative'),'Белизу');
 assert.equal(seoCountryCase('country_belize','prepositional'),'Белизе');
 assert.equal(seoInterestCase('theme_cruises'),'Круизы и экспедиции');
 assert.equal(seoInterestCase('theme_nature','genitive'),'природы');
 assert.equal(seoInterestCase('theme_wildlife','genitive'),'животных и сафари');
 assert.equal(seoPlacePhrase('destination_bolivia_samaipata','Самаипата'),'в Самаипате');
 assert.equal(seoPlaceDirectionPhrase('destination_bolivia_samaipata','Самаипата'),'в Самаипату');
 assert.equal(seoPlacePhrase('destination_ecuador_galapagosskie_ostrova','Галапагосские острова'),'на Галапагосских островах');
});
test('zero tours show destination availability while other missing counts stay hidden',()=>{
 const one=seoCountryTitle('Перу',0,0,0);
 assert.ok(!one.includes('0 '));assert.ok(!one.includes(' и .'));
 const two=seoDestinationTitle('Самаипата','country_bolivia',0,0);
 assert.match(two,/Самаипата в Боливии: локации\. Пока нет туров в это место\./);
 assert.ok(!two.includes('0 туров'));
 assert.equal(seoThemeHubTitle('Дайвинг',0),'Дайвинг — впечатления | Ada Tours');
 assert.equal(seoThemeHubTitle('Приключения',3),'Приключения — 3 тура и впечатления | Ada Tours');
 assert.equal(seoThemeHubTitle('Приключения',5),'Приключения — 5 туров и впечатлений | Ada Tours');
});
test('country and destination place the catalogue year before dynamic prices', () => {
 const yr=seoYearRange();
 assert.equal(seoCountryTitle('Антарктида',41,0,9),
  'Антарктида: 41 локация. Каталог '+yr+': 9 туров и цены туроператора Ada Tours');
 const priced=enrichSeoPriceMetadata({
  title:seoCountryTitle('Антарктида',41,0,9),description:'',
  prices:[{id:'a',kind:'tour',amount:6595,currency:'USD'}, {id:'b',kind:'tour',amount:8000,currency:'USD'}],
 });
 assert.equal(priced.title.replaceAll('\u00a0',' '),
  'Антарктида: 41 локация. Каталог '+yr+': 9 туров и цены от $6 595 туроператора Ada Tours');
 assert.match(seoDestinationTitle('Самаипата','country_bolivia',2,3),
  new RegExp('Каталог '+yr+': цены принимающего'));
});

test('SEO title cases and conditional prices',()=>{
 const place={id:'destination_bolivia_samaipata',name:'Самаипата',countryId:'country_bolivia'};
 assert.match(seoCountryTourCatalogTitle('country_brazil'),/по Бразилии/);
 assert.match(seoCountryPlacesCatalogTitle('country_brazil',21),/^21 локация Бразилии/);
 assert.match(seoCountryExcursionsCatalogTitle('country_belize',2),/^2 экскурсии в Белиз/);
 assert.match(seoDestinationTourCatalogTitle(place,4),/4 тура .* в Самаипате \(Боливии\)/);
 assert.match(seoDestinationTourCatalogTitle(place,4,true),/заехать в Самаипату/);
 assert.match(seoDestinationExcursionsCatalogTitle(place,'Боливия',2),/^2 экскурсии в Самаипате, Боливия/);
 assert.match(seoExcursionTourCatalogTitle({title:'Парк птиц'},2,'Бразилия','Фоз-ду-Игуасу'),/2 тура .* с экскурсией «Парк птиц» \(Фоз-ду-Игуасу, Бразилия\)/);
 assert.match(seoTourTitle({title:'Роскошная Бразилия',priceFrom:3653,currency:'USD'}),/по цене от \$3\s?653/);
 assert.ok(!seoTourTitle({title:'Тур в Перу',priceFrom:null,currency:'USD'}).includes('цене'));
 assert.ok(!seoTourTitle({title:'Тур в Перу',priceFrom:null,currency:'USD'}).startsWith('Тур Тур'));
 assert.ok(!seoTourTitle({title:'Тур в Бразилию',priceFrom:900,currency:'BRL'}).includes('по цене'));
 assert.ok(!seoExcursionTitle({title:'Прогулка',priceFrom:900,currency:'BRL'},'country_brazil').includes('цена от'));
 assert.match(seoExcursionTitle({title:'Парк птиц',priceFrom:51,currency:'USD'},'country_brazil','destination_brazil_iguacu','Фоз-ду-Игуасу'),/Парк птиц в Фоз-ду-Игуасу, Бразилия, цена от \$51/);
 assert.ok(!seoExcursionTitle({title:'Полет',priceFrom:null},'country_brazil').includes('цена'));
});

test('SEO titles compact every grammatical case without changing source names',()=>{
 const original='Достопримечательность, достопримечательности, достопримечательностей, достопримечательностям, достопримечательностями, достопримечательностях, достопримечательностью';
 assert.equal(seoCompactTitle(original),'Локация, локации, локаций, локациям, локациями, локациях, локацией');
 const tour={title:'Тур в Аргентину по лучшим достопримечательностям'};
 assert.match(seoTourTitle(tour),/по лучшим локациям/);
 assert.equal(tour.title,'Тур в Аргентину по лучшим достопримечательностям');
 for(const [count,noun] of [[1,'локация'],[2,'локации'],[5,'локаций'],[11,'локаций'],[21,'локация'],[24,'локации']]) {
  assert.match(seoCountryTitle('Бразилия',count,0,2),new RegExp(count+' '+noun));
  assert.equal(seoFill('[число] локаци[й]',{numbers:[count]}),count+' '+noun);
 }
 assert.equal(seoFill('[число] локаци[й] и [число] экскурси[й]',{numbers:[0,2]}),'2 экскурсии');
 assert.ok(!/достопримечательност/iu.test(seoFill(SEO.placesIndex.title,{numbers:[721]})));
});

test('descriptions retain the attraction keyword and exact nonzero place count',()=>{
 for(const [count,noun] of [[1,'достопримечательность'],[2,'достопримечательности'],[5,'достопримечательностей'],[11,'достопримечательностей'],[21,'достопримечательность']]) {
  assert.equal(seoAttractionsDescription('Выбирайте туры.',count,'Бразилии'),count+' '+noun+' Бразилии. Выбирайте туры.');
 }
 assert.equal(seoAttractionsDescription('Тур в Аргентину.',7,'в маршруте'),'7 достопримечательностей в маршруте. Тур в Аргентину.');
 assert.equal(seoAttractionsDescription('Описание.',0),'Описание.');
 assert.equal(seoAttractionsDescription('',0),'');
});
test('theme substitutions, year, and pagination title position',()=>{
 assert.match(seoThemeCatalogTitle('Дайвинг',7,'Бразилия'),/^Бразилия, Дайвинг: 7 туров/);
 assert.equal(seoPaginatedTitle('Приключения: 5 туров 2026-2027 | Ada Tours',3),'Приключения: 5 туров 2026-2027 — страница 3 | Ada Tours');
 assert.equal(seoPaginatedTitle('Каталог туров Ada Tours',3),'Каталог туров Ada Tours — страница 3');
});

test('individual theme catalogue titles override the generic colon template',()=>{
 assert.match(seoThemeCatalogTitle('Приключения',5),/^Приключения — 5 туров на 2026-2027/);
 assert.match(seoThemeCatalogTitle('Приключения',5,'Бразилия'),/^Бразилия, Приключения: 5 туров 2026-2027/);
});

test('directional case overrides for complicated geographical names',()=>{
 assert.equal(seoPlaceDirectionPhrase('', 'Солончак Уюни'),'на солончак Уюни');
 assert.equal(seoPlaceDirectionPhrase('', 'Гвианская Амазония'),'в Гвианскую Амазонию');
 assert.equal(seoPlaceDirectionPhrase('', 'Галапагосские острова'),'на Галапагосские острова');
 assert.equal(seoPlaceDirectionPhrase('', 'Остров Пасхи'),'на остров Пасхи');
});

test('zero counts suppress the complete numbered phrase, not just its marker',()=>{
 assert.equal(seoFill('[число] тур[ов]',{numbers:[0]}),'');
 assert.equal(seoFill('Главная: [число] тур[ов] и [число] экскурси[й]',{numbers:[0,2]}),'Главная: 2 экскурсии');
 assert.equal(seoFill('[число] достопримечательност[ей] и [число] экскурси[й]',{numbers:[2,0]}),'2 достопримечательности');
 assert.equal(seoFill('Путешествия и [число] тур[ов] в Южную Америку',{numbers:[0]}),'Путешествия в Южную Америку');
 assert.equal(seoFill('Бразилия, Аргентина и еще [22] стран[ы]',{countries:2}),'Бразилия, Аргентина');
 assert.ok(!seoFill('[число] VIP и Luxury тур[ов] по Южной Америке',{numbers:[0]}).includes('0'));
});

test('availability follows active related tour counts for places and excursions',()=>{
 const placeTitle=seoDestinationTitle('Самаипата','country_bolivia',2,0);
 assert.match(placeTitle,/2 экскурсии\. Пока нет туров в это место\./);
 assert.ok(!placeTitle.includes('0 туров'));
 for(const count of [1,2,5,21]) {
  const title=seoDestinationTitle('Самаипата','country_bolivia',0,count);
  assert.ok(!title.includes('Пока нет'));
  assert.ok(title.includes(seoCountLabel(count,['тур','тура','туров'])));
 }
 const excursion={title:'Парк птиц',priceFrom:51,currency:'USD'};
 assert.match(seoExcursionTitle(excursion,'country_brazil',undefined,undefined,0),
  /цена от \$51\. Пока нет туров с этой экскурсией \| Ada Tours$/);
 for(const count of [undefined,1,2,5]) {
  assert.ok(!seoExcursionTitle(excursion,'country_brazil',undefined,undefined,count).includes('Пока нет'));
 }
 assert.equal(seoRelatedToursDescription('Описание места.',0,'destination'),
  'Описание места. Пока нет туров в это место.');
 assert.equal(seoRelatedToursDescription('Описание экскурсии',0,'excursion'),
  'Описание экскурсии. Пока нет туров с этой экскурсией.');
 assert.equal(seoRelatedToursDescription('Что посмотреть?',0,'destination'),
  'Что посмотреть? Пока нет туров в это место.');
 assert.equal(seoRelatedToursDescription('',0,'excursion'),'Пока нет туров с этой экскурсией.');
 for(const kind of ['destination','excursion']) {
  for(const count of [undefined,1,2,5]) {
   assert.equal(seoRelatedToursDescription('Исходное описание.',count,kind),'Исходное описание.');
  }
 }
});


import { collectSeoPagePrices, enrichSeoPriceMetadata } from '../src/lib/seo-price-meta.mjs';

const moneyText = (text) => text.replaceAll('\u00a0', ' ');
const seoRoot = 'https://adatours.ru/';
const pricedRecord = (kind, id, path, priceFrom, currency = 'USD', archived = false, routeCountries = []) =>
  ({ kind, path, archived, data: { id, status: 'approved', priceFrom, currency, routeCountries, countries: routeCountries,
    slug: kind === 'country' ? path.split('/').filter(Boolean)[0] : undefined } });

test('SEO: no quotation means no change even when price claim exists', () => {
  const original = { title: 'Купить по лучшей цене', description: 'Выбирайте по выгодным ценам.' };
  assert.deepEqual(enrichSeoPriceMetadata({ ...original, prices: [] }), {
    ...original, quote: null, changed: false,
  });
});

test('SEO: one real price appears without от beside a price claim', () => {
  const record = pricedRecord('tour', 'single', '/brazil/tour/single/', 1450);
  const prices = collectSeoPagePrices({ root: seoRoot, path: '/tours/', records: [record],
    groups: [{ links: [{ href: record.path }] }] });
  const output = enrichSeoPriceMetadata({
    title: 'Туры купить по лучшей цене | Ada Tours',
    description: 'Сравните стоимость путешествий.',
    prices,
  });
  assert.equal(moneyText(output.title), 'Туры купить по лучшей цене $1 450 | Ada Tours');
  assert.equal(moneyText(output.description), 'Сравните стоимость $1 450 путешествий.');
});

test('SEO: multiple priced products use от and a real minimum', () => {
  const records = [
    pricedRecord('tour', 'a', '/brazil/tour/a/', 2600, 'USD', false, ['country_brazil']),
    pricedRecord('tour', 'b', '/brazil/tour/b/', 1500, 'USD', false, ['country_brazil']),
    pricedRecord('tour', 'archived', '/brazil/tour/archived/', 2, 'USD', true, ['country_brazil']),
    pricedRecord('tour', 'unpriced', '/brazil/tour/unpriced/', null, 'USD', false, ['country_brazil']),
    pricedRecord('excursion', 'exc', '/brazil/excursion/exc/', 30),
  ];
  const links = records.map((r) => ({ href: r.path }));
  const prices = collectSeoPagePrices({ root: seoRoot, path: '/brazil/',
    records: [pricedRecord('country', 'country_brazil', '/brazil/', null), ...records],
    groups: [{ links: [...links, links[1]] }] });
  assert.deepEqual(prices.map((r) => r.id), ['a', 'b']);
  const output = enrichSeoPriceMetadata({ title: 'Туры по лучшей цене в Бразилию',
    description: 'Туры по лучшим ценам и каталоги.', prices });
  assert.equal(moneyText(output.title), 'Туры по лучшей цене от $1 500 в Бразилию');
  assert.equal(moneyText(output.description), 'Туры по лучшим ценам от $1 500 и каталоги.');
});

test('SEO: non-USD and mixed-currency prices do not add numeric metadata', () => {
  const prices = [
    { id: 'usd', kind: 'tour', currency: 'USD', amount: 2000 },
    { id: 'brl', kind: 'tour', currency: 'BRL', amount: 900 },
  ];
  const output = enrichSeoPriceMetadata({ title: 'VIP по выгодным ценам',
    description: 'Каталог и цены 2026-2027', prices });
  assert.equal(output.changed, false);
  assert.equal(output.quote, null);
  assert.equal(output.title, 'VIP по выгодным ценам');
  assert.equal(output.description, 'Каталог и цены 2026-2027');
  const singleLocal = enrichSeoPriceMetadata({
    title: 'Туры по лучшей цене',
    description: 'Стоимость туров',
    prices: [{ id: 'local', kind: 'tour', currency: 'BRL', amount: 900 }],
  });
  assert.equal(singleLocal.changed, false);
  assert.equal(singleLocal.quote, null);
  assert.equal(singleLocal.title, 'Туры по лучшей цене');
  assert.equal(singleLocal.description, 'Стоимость туров');
});

test('SEO: absent price wording means metadata stays unchanged', () => {
  const output = enrichSeoPriceMetadata({ title: 'Страны Латинской Америки',
    description: 'Туры по Бразилии', prices: [{ id: 'one', kind: 'tour', currency: 'USD', amount: 750 }] });
  assert.equal(output.changed, false);
  assert.equal(output.title, 'Страны Латинской Америки');
  assert.equal(output.description, 'Туры по Бразилии');
});

test('SEO: an already displayed price is not repeated in the title', () => {
  const output = enrichSeoPriceMetadata({ title: 'Тур по цене от $1 500 | Ada Tours',
    description: 'Подробности путешествия.', prices: [{ id: 'x', kind: 'tour', currency: 'USD', amount: 1500 }] });
  assert.equal(output.title, 'Тур по цене от $1 500 | Ada Tours');
  assert.equal(output.changed, false);
});

test('SEO: detail price must be visible; full catalog is independent of rendered links', () => {
  const own = pricedRecord('excursion', 'e', '/brazil/excursion/e/', 70);
  const other = pricedRecord('excursion', 'f', '/brazil/excursion/f/', 80);
  const records = [own, other];
  assert.equal(collectSeoPagePrices({ records, root: seoRoot, path: own.path, priceVisible: false }).length, 0);
  assert.deepEqual(collectSeoPagePrices({ records, root: seoRoot, path: own.path, priceVisible: true }).map((v) => v.amount), [70]);
  assert.deepEqual(collectSeoPagePrices({ records, root: seoRoot, path: '/excursions/',
    groups: [{ links: [{ href: other.path }] }] }).map((v) => v.id), ['e', 'f']);
});


test('SEO: prices across all Brazil tour pages use one full-country minimum', () => {
  const rows = [
    pricedRecord('country', 'country_brazil', '/brazil/', null),
    pricedRecord('tour', 'high', '/brazil/tour/high/', 5900, 'USD', false, ['country_brazil']),
    pricedRecord('tour', 'low', '/brazil/tour/low/', 950, 'USD', false, ['country_brazil']),
    pricedRecord('tour', 'other-country', '/peru/tour/a/', 50, 'USD', false, ['country_peru']),
  ];
  const first = collectSeoPagePrices({ records: rows, root: seoRoot, path: '/brazil/tour/',
    groups: [{ links: [{ href: rows[1].path }] }] });
  const second = collectSeoPagePrices({ records: rows, root: seoRoot, path: '/brazil/tour/page/2/',
    groups: [{ links: [{ href: rows[2].path }] }] });
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((r) => r.id), ['high', 'low']);
  const quote = enrichSeoPriceMetadata({ title: 'Купить в Бразилию по лучшей цене',
    description: 'Каталог и цены.', prices: second });
  assert.match(moneyText(quote.title), /по лучшей цене от \$950/);
  assert.match(moneyText(quote.description), /цены от \$950/);
});

test('SEO: home uses full catalog and optional destination tours remain in the calculation', () => {
  const rows = [
    pricedRecord('destination', 'd', '/brazil/place/rio/', null),
    { ...pricedRecord('tour', 'main', '/brazil/tour/main/', 3500), data: {
      id: 'main', status: 'approved', priceFrom: 3500, currency: 'USD',
      destinations: ['d'], routeDestinations: ['d'],
    }},
    { ...pricedRecord('tour', 'optional', '/brazil/tour/optional/', 1400), data: {
      id: 'optional', status: 'approved', priceFrom: 1400, currency: 'USD',
      destinations: ['d'], routeDestinations: [],
    }},
  ];
  assert.deepEqual(collectSeoPagePrices({ records: rows, root: seoRoot, path: '/',
    groups: [] }).map((r) => r.id), ['main','optional']);
  assert.deepEqual(collectSeoPagePrices({ records: rows, root: seoRoot, path: '/brazil/place/rio/',
    groups: [] }).map((r) => r.id), ['main','optional']);
});

test('SEO: a single price uses singular wording without от', () => {
  const result = enrichSeoPriceMetadata({ title: 'По лучшим ценам',
    description: 'Каталог и цены 2026-2027',
    prices: [{ id: 'one', kind: 'tour', currency: 'USD', amount: 1350 }] });
  assert.equal(moneyText(result.title), 'По лучшей цене $1 350');
  assert.equal(moneyText(result.description), 'Каталог и цена $1 350 2026-2027');
});

test('all 24 country directions are explicit and agree with the catalogues', async () => {
 const {readFileSync}=await import('node:fs');
 const list=JSON.parse(readFileSync(new URL('../data/source-index/catalogs/countries.json',import.meta.url),'utf8')).entries;
 const expected={
  country_brazil:'в Бразилию',country_argentina:'в Аргентину',
  country_peru:'в Перу',country_antarctica:'в Антарктиду',
  country_belize:'в Белиз',country_bolivia:'в Боливию',
  country_venezuela:'в Венесуэлу',country_guyana:'в Гайану',
  country_guatemala:'в Гватемалу',country_honduras:'в Гондурас',
  country_dominican_republic:'в Доминикану',country_colombia:'в Колумбию',
  country_costa_rica:'в Коста-Рику',country_cuba:'на Кубу',
  country_mexico:'в Мексику',country_nicaragua:'в Никарагуа',
  country_panama:'в Панаму',country_paraguay:'в Парагвай',
  country_suriname:'в Суринам',country_uruguay:'в Уругвай',
  country_french_guiana:'во Французскую Гвиану',
  country_chile:'в Чили',country_ecuador:'в Эквадор',
  country_el_salvador:'в Эль-Сальвадор'
 };
 assert.equal(list.length,24);
 assert.deepEqual(Object.keys(SEO_CASES.countries).sort(),list.map(x=>x.id).sort());
 assert.deepEqual(Object.keys(expected).sort(),list.map(x=>x.id).sort());
 const {vipCountryTitle}=await import('../src/lib/vip-countries.mjs');
 for(const country of list) {
  const direction=expected[country.id];
  assert.equal(seoCountryDirection(country.id),direction,country.id);
  assert.equal(seoCountryDirection(country.name),direction,country.name);
  assert.equal(vipCountryTitle(country),'VIP-туры '+direction,country.id);
  assert.ok(seoCountryExcursionsCatalogTitle(country.id,2).includes('2 экскурсии '+direction+' | Ada Tours'));
 }
 assert.throws(()=>seoCountryDirection('country_unknown'),/Missing country direction/);
 const layout=readFileSync(new URL('../src/layouts/CountryLayout.astro',import.meta.url),'utf8');
 assert.ok(layout.includes('<h2 id="country-tours-title">Туры {countryDirection}</h2>'));
 assert.ok(layout.includes('<h2 id="country-excursions-title">Экскурсии {countryDirection}</h2>'));
});
