import test from 'node:test';
import assert from 'node:assert/strict';
import {PILOT_TOURS,pilotTourUrl,pilotCatalogUrl,privatePilotEnabled,
 escapePilotHtml,renderPilotMarkdown,pilotMediaUrl,formatPilotPrice,assertPilotRenderSource,
 pilotExcursionDependencies}
 from '../../src/lib/i18n/pilot-html.mjs';
test('private English routes cannot be emitted by normal RU/public EN builds',()=>{
 assert.equal(privatePilotEnabled({}),false);
 assert.equal(privatePilotEnabled({EN_PILOT_PREVIEW:'1',SITE_LOCALE:'en'}),false);
 assert.equal(privatePilotEnabled({EN_PILOT_PREVIEW:'1',PUBLIC_EN_RELEASE:'1'}),false);
 assert.equal(privatePilotEnabled({EN_PILOT_PREVIEW:'1',SITE_LOCALE:'ru'}),true);
 assert.equal(PILOT_TOURS.length,3);
 assert.match(pilotCatalogUrl(),/en-pilot-private\/tours\/$/);
 assert.throws(()=>pilotTourUrl('made-up-tour'),/Non-pilot/);
});
test('Markdown tables have no raw HTML injection and preserve USD pricing',()=>{
 const html=renderPilotMarkdown('## 2027 prices\n\n| Cat | TRP |\n| --- | ---: |\n| 3★ | $1,255 |\n\n<script>alert(1)</script>');
 assert.match(html,/<table>/);assert.match(html,/\$1,255/);
 assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
 assert.equal(formatPilotPrice(1492),'$1,492');
 assert.equal(escapePilotHtml('<&'), '&lt;&amp;');
 assert.throws(()=>renderPilotMarkdown('| a | b |\n| c |'),/irregular/);
});
test('hero media only points at the existing verified S3 CDN',()=>{
 assert.match(pilotMediaUrl('/media/tours/example/hero.webp'),/^https:\/\/img\.adatours\.ru\/media/);
 assert.throws(()=>pilotMediaUrl('https://example.org/asset.webp'),/Unsafe/);
 assert.throws(()=>pilotMediaUrl('/media/../../secret.png'),/Unsafe/);
});
test('render source requires exact stable identity, prices and sealed 172-block receipt',()=>{
 const summary={phase:'approved_nonpublishing_pilot',publicationAuthorized:false,
 totalSourceSlots:172,totalReadyPrevious:30,totalAdditional:142,failures:[],
 reports:PILOT_TOURS.map(x=>({entityId:x.id,state:'ready',issues:0,fullCoverage:true,
 approved:true,alreadyApprovedWordBlocks:8,alreadyApprovedAiBlocks:1,
 proposedAdditionalBlocks:43,sourceVisibleBlocks:52}))};
 const records=PILOT_TOURS.map(x=>({id:x.id,locale:'en',body:'## Price\n\nEnglish text',
 data:{id:x.id,slug:x.slug,locale:'en',currency:'USD',priceFrom:x.price,
 durationDays:x.days,title:'Tour '+x.slug,lead:'English introduction',
 hero:{src:'/media/tours/valid/hero.webp'},
 itinerary:Array.from({length:x.days},(_,i)=>({day:i+1,text:'English day'})),
 included:[],notIncluded:[]}}));
 assert.equal(assertPilotRenderSource(records,summary),true);
 const wrong=structuredClone(records);wrong[0].data.priceFrom=123;
 assert.throws(()=>assertPilotRenderSource(wrong,summary),/not ready/);
});

test('canonical Excursion dependencies are accounted for without RU fallback',()=>{
 const x=[{day:1,contentBlocks:[{type:'excursion',excursionRef:'excursion_one'},{type:'text',text:'hi'}]},
  {excursionRef:'excursion_two'}, {day:2,contentBlocks:[{type:'excursion',excursionRef:'excursion_one'}]}];
 assert.deepEqual(pilotExcursionDependencies(x),['excursion_one','excursion_two']);
 assert.throws(()=>pilotExcursionDependencies([{excursionRef:'../outside'}]),/Invalid/);
 assert.throws(()=>pilotExcursionDependencies(null),/array/);
});
