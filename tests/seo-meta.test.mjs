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
  "Бразилия: 21 достопримечательность и 2 экскурсии. Каталог 5 туров и цены 2026-2027 туроператора Ada Tours");
});
test("countries after 'по' use case",()=>{
 assert.equal(seoPopularCountriesAfterPo(["Бразилия","Аргентина","Перу"]),"Бразилии, Аргентине, Перу");
 assert.equal(seoPopularCountriesAfterPo(["Бразилия","Чили"],true),"Бразилии, Чили и другим странам");
});


import {SEO_CASES,seoCountryCase,seoPlacePhrase,seoPlaceDirectionPhrase,seoInterestCase} from '../src/lib/seo-grammar.mjs';
import {seoCountryTitle,seoDestinationTitle,seoTourTitle,seoExcursionTitle,
 seoThemeHubTitle,seoThemeCatalogTitle,seoCountryTourCatalogTitle,
 seoCountryPlacesCatalogTitle,seoCountryExcursionsCatalogTitle,seoDestinationTourCatalogTitle,
 seoDestinationExcursionsCatalogTitle,seoExcursionTourCatalogTitle,seoPaginatedTitle
} from '../src/lib/seo-page.mjs';

test('case table covers all known countries, themes, and destinations',()=>{
 assert.equal(Object.keys(SEO_CASES.countries).length,24);
 assert.equal(Object.keys(SEO_CASES.interests).length,13);
 assert.ok(Object.keys(SEO_CASES.destinations).length>=700);
 assert.equal(seoCountryCase('country_brazil','genitive'),'Бразилии');
 assert.equal(seoCountryCase('country_belize','dative'),'Белизу');
 assert.equal(seoCountryCase('country_belize','prepositional'),'Белизе');
 assert.equal(seoInterestCase('theme_cruises'),'Круизы и экспедиции');
 assert.equal(seoPlacePhrase('destination_bolivia_samaipata','Самаипата'),'в Самаипате');
 assert.equal(seoPlaceDirectionPhrase('destination_bolivia_samaipata','Самаипата'),'в Самаипату');
 assert.equal(seoPlacePhrase('destination_ecuador_galapagosskie_ostrova','Галапагосские острова'),'на Галапагосских островах');
});
test('missing numbers hide counted phrases and their conjunctions',()=>{
 const one=seoCountryTitle('Перу',0,0,0);
 assert.ok(!one.includes('0 '));assert.ok(!one.includes(' и .'));
 const two=seoDestinationTitle('Самаипата','country_bolivia',0,0);
 assert.match(two,/Самаипата в Боливии: достопримечательности\./);
 assert.ok(!two.includes('0 туров'));
 assert.equal(seoThemeHubTitle('Дайвинг',0),'Дайвинг — впечатления | Ada Tours');
 assert.equal(seoThemeHubTitle('Приключения',3),'Приключения — 3 тура и впечатления | Ada Tours');
 assert.equal(seoThemeHubTitle('Приключения',5),'Приключения — 5 туров и впечатлений | Ada Tours');
});
test('SEO title cases and conditional prices',()=>{
 const place={id:'destination_bolivia_samaipata',name:'Самаипата',countryId:'country_bolivia'};
 assert.match(seoCountryTourCatalogTitle('country_brazil'),/по Бразилии/);
 assert.match(seoCountryPlacesCatalogTitle('country_brazil',21),/^21 достопримечательность Бразилии/);
 assert.match(seoCountryExcursionsCatalogTitle('country_belize',2),/^2 экскурсии в Белизе/);
 assert.match(seoDestinationTourCatalogTitle(place,4),/4 тура .* в Самаипате \(Боливии\)/);
 assert.match(seoDestinationTourCatalogTitle(place,4,true),/заехать в Самаипату/);
 assert.match(seoDestinationExcursionsCatalogTitle(place,'Боливия',2),/^2 экскурсии в Самаипате, Боливия/);
 assert.match(seoExcursionTourCatalogTitle({title:'Парк птиц'},2,'Бразилия','Фоз-ду-Игуасу'),/2 тура .* с экскурсией «Парк птиц» \(Фоз-ду-Игуасу, Бразилия\)/);
 assert.match(seoTourTitle({title:'Роскошная Бразилия',priceFrom:3653,currency:'USD'}),/по цене от \$3\s?653/);
 assert.ok(!seoTourTitle({title:'Тур в Перу',priceFrom:null,currency:'USD'}).includes('цене'));
 assert.ok(!seoTourTitle({title:'Тур в Перу',priceFrom:null,currency:'USD'}).startsWith('Тур Тур'));
 assert.match(seoExcursionTitle({title:'Парк птиц',priceFrom:51,currency:'USD'},'country_brazil','destination_brazil_iguacu','Фоз-ду-Игуасу'),/Парк птиц в Фоз-ду-Игуасу, Бразилия, цена от \$51/);
 assert.ok(!seoExcursionTitle({title:'Полет',priceFrom:null},'country_brazil').includes('цена'));
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
