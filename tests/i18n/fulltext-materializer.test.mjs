import test from 'node:test';
import assert from 'node:assert/strict';
import {applyFulltextToSource,fulltextSourceKind,splitFulltextMarkdown} from '../../scripts/i18n/materialize-fulltext-en.mjs';

test('fulltext overlay changes only human-readable text and retains identities, media, prices, and links',()=>{
 const ru='---\nid: destination_test\nlocale: ru\nslug: test\nstatus: approved\nname: Город\nsummary: Русское описание\ncountryId: country_test\npriceFrom: 100\nhero:\n  src: /media/hero.webp\n  alt: Русское фото\n---\n\nСмотрите [место](/test/) и {{catalog.toursCountPhrase}}.\n';
 const en='---\nid: destination_test\nlocale: en\nslug: test\nstatus: approved\nname: City\nsummary: English description\ncountryId: country_wrong\npriceFrom: 999\nhero:\n  src: /media/changed.webp\n  alt: English photo\n---\n\nSee [the place](/test/) and {{catalog.toursCountPhrase}}.\n';
 const result=applyFulltextToSource(ru,en,'destinations','abcdef123');
 assert.equal(result.status,'applied');
 const projected=splitFulltextMarkdown(result.content);
 assert.equal(projected.data.locale,'ru');
 assert.equal(projected.data.name,'City');
 assert.equal(projected.data.summary,'English description');
 assert.equal(projected.data.countryId,'country_test');
 assert.equal(projected.data.priceFrom,100);
 assert.equal(projected.data.hero.src,'/media/hero.webp');
 assert.equal(projected.data.hero.alt,'English photo');
 assert.equal(projected.data._i18n.contentLanguage,'en');
 assert.match(projected.body,/See \[the place\]\(\/test\/\)/);
});
test('body with changed links stays Russian fallback even when EN labels are valid',()=>{
 const ru='---\ntargetPath: /example/\nkind: multi_country_combination\nstatus: approved\nbuttonLabel: Кнопка\n---\n\n[Тур](/tour/)\n';
 const en='---\ntargetPath: /example/\nkind: multi_country_combination\nstatus: approved\nbuttonLabel: Explore\n---\n\n[Tour](/wrong/)\n';
 const result=applyFulltextToSource(ru,en,'seo_geo_article','abc');
 assert.equal(result.status,'partial');
 assert.equal(splitFulltextMarkdown(result.content).data.buttonLabel,'Explore');
 assert.match(splitFulltextMarkdown(result.content).body,/\[Тур\]\(\/tour\/\)/);
});
test('reject identity changes and unknown paths',()=>{
 assert.equal(fulltextSourceKind('src/content/tours/tour.md'),null);
 assert.equal(fulltextSourceKind('data/seo-geo/articles/interests/wildlife/index.md'),'seo_geo_article');
 const ru='---\nid: test\nlocale: ru\nslug: example\nstatus: approved\nname: Город\n---\n\nПример';
 const en='---\nid: other\nlocale: en\nslug: example\nstatus: approved\nname: City\n---\n\nExample';
 assert.throws(()=>applyFulltextToSource(ru,en,'destinations','abc'),/identity/);
});

test('preserves canonical YAML date values rather than coercing them to empty objects',()=>{
 const ru='---\nid: destination_example\nlocale: ru\nslug: example\nstatus: approved\nname: Город\nupdatedAt: 2026-10-09\n---\n\nГород';
 const en='---\nid: destination_example\nlocale: en\nslug: example\nstatus: approved\nname: City\nupdatedAt: 2026-11-12\n---\n\nCity';
 const p=splitFulltextMarkdown(applyFulltextToSource(ru,en,'destinations','sha').content);
 assert.equal(p.data.name,'City');
 assert.equal(p.data.updatedAt.toISOString().slice(0,10),'2026-10-09');
});


test('stage 9: immutable EN SEO lead accepts only equivalent numeric formatting',()=>{
 const ru='---\ntargetPath: /brazil/tour/\nkind: country_tours\nstatus: approved\nlead: "65 км, высота 1050 м, 67,5 км, цена $150"\n---\n\n## Маршрут\nРусское описание\n';
 const en='---\ntargetPath: /brazil/tour/\nkind: country_tours\nstatus: approved\nlead: "65 km, elevation 1,050 m, 67.5 km, price $150"\n---\n\n## Itinerary\nEnglish description\n';
 const projected=splitFulltextMarkdown(applyFulltextToSource(ru,en,'seo_geo_article','x').content);
 assert.equal(projected.data.lead,'65 km, elevation 1,050 m, 67.5 km, price $150');
 assert.equal(projected.data.status,'approved');
 const brokenPrice=en.replace('$150','$151');
 const blocked=splitFulltextMarkdown(applyFulltextToSource(ru,brokenPrice,'seo_geo_article','x').content);
 assert.equal(blocked.data.lead,'65 км, высота 1050 м, 67,5 км, цена $150');
 const extraDigit=en.replace('65 km','65 km in 2028');
 const blockedExtra=splitFulltextMarkdown(applyFulltextToSource(ru,extraDigit,'seo_geo_article','x').content);
 assert.equal(blockedExtra.data.lead,'65 км, высота 1050 м, 67,5 км, цена $150');
});

test('stage 9: grouped thousands in immutable SEO lead do not mutate common source facts',()=>{
 const ru='---\nid: destination_test\nlocale: ru\nslug: test\nstatus: approved\nname: Место\nsummary: "Высота 4600 м"\n---\n\nТекст';
 const en='---\nid: destination_test\nlocale: en\nslug: test\nstatus: approved\nname: Place\nsummary: "Altitude 4,600 m"\n---\n\nText';
 const projected=splitFulltextMarkdown(applyFulltextToSource(ru,en,'destinations','x').content);
 // The formatting exemption must remain confined to SEO article leads.
 assert.equal(projected.data.summary,'Высота 4600 м');
});
