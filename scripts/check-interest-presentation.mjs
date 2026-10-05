import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { INTERESTS, buildInterestHub, buildInterestIndex, interestTourCatalogPath, countLabel } from '../src/lib/interest-model.mjs';
import { interestCopy, interestTourCount, relatedInterestCount, interestCatalogDescription } from '../src/lib/interest-copy.mjs';
const collections = Object.fromEntries(['tours','countries','destinations','excursions','themes'].map(collection => [collection,
  readdirSync(`src/content/${collection}`).filter(f=>f.endsWith('.md')).map(file=>({data:yaml.load(readFileSync(`src/content/${collection}/${file}`,'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)[1])}))
]));
const at=path=>readFileSync(join('dist',path,'index.html'),'utf8');
const ids=(html,attribute)=>[...html.matchAll(new RegExp(`${attribute}="([^"]+)"`,'g'))].map(m=>m[1]);
const text=html=>html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
const heroSection=html=>html.match(/<section\b[^>]*class="[^"]*\bhero\b[^"]*"[\s\S]*?<\/section>/)?.[0]??'';
const expectedThemeAlign=new Map([['motorcycle-tours','left'],['adventure','left'],['weddings-and-romance','right'],['wildlife','right']]);
const index=at('/interests/'), expected=buildInterestIndex(collections.themes,collections.tours);
assert.equal(expected.length,13);
assert.deepEqual(ids(index,'data-interest-index-item'),expected.map(r=>r.entry.data.id));
assert.deepEqual(ids(index,'data-interest-tour-count').map(Number),expected.map(r=>r.tourCount));
for (const {id,slug} of INTERESTS) {
  const theme=collections.themes.find(entry=>entry.data.id===id), themeHero=theme?.data.hero?.src;
  assert.ok(themeHero,`${slug}: theme hero`);
  const hub=buildInterestHub(id,collections), html=at(`/interests/${slug}/`), copy=interestCopy(id);
  if(expectedThemeAlign.has(slug)) assert.ok(heroSection(html).includes(`data-image-text-align="${expectedThemeAlign.get(slug)}"`),`${slug}: requested theme hero alignment`);
  assert.ok(text(html).includes(`Готовые маршруты · ${countLabel(hub.allTours.length)}`),`${slug}: current full count`);
  assert.ok(html.includes(copy.tourIntro),`${slug}: tour intro`);
  if(hub.countries.length) assert.ok(html.includes(copy.geographyIntro),`${slug}: geography intro`);
  const coverTourIds=hub.countries.map(row=>row.coverTour?.data.id).filter(Boolean);
  assert.deepEqual(ids(html,'data-interest-cover-tour'),coverTourIds);
  assert.equal(new Set(coverTourIds).size,coverTourIds.length,`${slug}: unique geography tour covers`);
  const geographyStart=html.indexOf('data-interest-section="countries"');
  for (const row of hub.countries) {
    const start=html.indexOf(`data-interest-item="${row.entry.data.id}"`,geographyStart);
    assert.ok(start>=0,`${slug}: ${row.entry.data.id} band`);
    const end=html.indexOf('</a>',start);
    const block=html.slice(start,end>=0?end:start+20000);
    const expectedImage=row.coverTour?.data.hero?.src??row.entry.data.hero?.src;
    if(row.coverTour) {
      assert.ok(row.coverTour.data.hero?.src,`${slug}: assigned cover tour has a hero`);
      assert.ok(block.includes(row.coverTour.data.hero.src),`${slug}: assigned unique tour hero`);
    } else if(expectedImage) {
      assert.ok(block.includes(expectedImage),`${slug}: country hero fallback after unique tours are exhausted`);
    }
  }
  for(const row of [...hub.stories,...hub.experiences]) if(row.tourCount) assert.ok(html.includes(interestTourCount(id,row.tourCount)));
  for(const row of hub.relatedThemes) assert.ok(html.includes(relatedInterestCount(row.tourCount)));
  for(const phrase of ['Сначала — путешествия, для которых','Страны, которые встречаются в действующих','туров с этим интересом','41 тур объединяют']) assert.ok(!html.includes(phrase));
  if(hub.allTours.length) {
    const catalogHtml=at(interestTourCatalogPath({slug}));
    assert.ok(catalogHtml.includes(interestCatalogDescription(id,hub.allTours.length)));
    assert.ok(heroSection(catalogHtml).includes(themeHero),`${slug}: interest tour catalog uses theme hero`);
  }
  for(const row of hub.allCountries) {
    const countryRoot=interestTourCatalogPath({slug},row.entry), countryHtml=at(countryRoot);
    assert.ok(countryHtml.includes(interestCatalogDescription(id,row.tourCount,row.entry.data.name)));
    assert.ok(heroSection(countryHtml).includes(themeHero),`${slug}: ${row.entry.data.id} catalog uses theme hero`);
    if(row.tours.length>10) assert.ok(heroSection(at(`${countryRoot}page/2/`)).includes(themeHero),`${slug}: ${row.entry.data.id} page 2 uses theme hero`);
  }
}
const enhancements=JSON.parse(readFileSync('src/data/media/photo-enhancements.json','utf8')).enhancements;
for (const slug of ['wildlife','culture-and-history','cruises-and-expeditions','events-and-festivals']) {
  const image=`/media/themes/${slug}/hero-enhanced-20261005.webp`;
  assert.ok(existsSync(`public${image}`));
  assert.ok(index.includes(image),`${slug}: generated image is actually connected to index`);
  assert.ok(at(`/interests/${slug}/`).includes(image));
  assert.equal(enhancements.filter(r=>r.enhanced===image&&r.method==='gpt-image').length,1);
}
let pages=0;
for(const file of readdirSync('dist',{recursive:true}).filter(f=>f.endsWith('.html'))) {
  const html=readFileSync(join('dist',file),'utf8');
  if(!/<footer\b[^>]*class="footer"/.test(html)) { assert.ok(/http-equiv="refresh"/i.test(html),`real page missing shared layout: ${file}`); continue; }
  assert.equal((html.match(/\bdata-lead-form(?:\s|=|>)/g)??[]).length,1,`exactly one lead form: ${file}`);
  assert.equal((html.match(/\bid="request"/g)??[]).length,1,`one request anchor: ${file}`);
  const footerStart=html.indexOf('data-lead-location="footer"');
  assert.ok(footerStart>=0&&footerStart<html.indexOf('<footer'),`form before footer: ${file}`);
  const form=html.slice(footerStart).match(/<form\b[\s\S]*?<\/form>/)?.[0]??'';
  for(const name of ['name','phone','email','comment','contact_method','entity_id','page_url','locale']) assert.ok(form.includes(`name="${name}"`),`${file}: ${name}`);
  assert.ok(html.includes('class="footer__request" href="#request"'));
  pages++;
}
assert.ok(pages>700,'all real site pages are checked, not just a handful of examples');
console.log(`Interest presentation checks passed: 13 sorted interests, 13 individual copy sets, 4 generated covers, unique bottom-up tour geography covers, theme-owned catalog heroes, requested theme hero alignment and inflected counters; exactly one footer form on all ${pages} real HTML pages.`);
