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
