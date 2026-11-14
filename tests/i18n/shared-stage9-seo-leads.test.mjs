import test from 'node:test';
import assert from 'node:assert/strict';
import {parse,serialize} from 'parse5';
import {localizeSourceBoundSeoLead} from '../../src/lib/i18n/stage9-seo-leads.mjs';

const ru="Обелиск Буэнос-Айреса стоит на площади Республики, на пересечении проспекта 9 Июля и улицы Корриентес. Монумент высотой 67,5 м построили в 1936 году к 400-летию первого основания города. Сегодня это одна из главных точек городской прогулки и место, где можно увидеть широкие центральные проспекты аргентинской столицы.";
function documentFor(content){return parse('<html><body><main><p class="seo-geo__lead">'+content+'</p></main></body></html>');}
test('stage 9 uses exact page and source hash for EN SEO lead',()=>{
 const doc=documentFor(ru);
 assert.equal(localizeSourceBoundSeoLead(doc,'/argentina/place/buenos-aires-obelisk/'),1);
 assert.match(serialize(doc),/Buenos Aires Obelisk stands/);
 assert.doesNotMatch(serialize(doc),/Обелиск/);
});
test('changed facts and unrelated routes retain original text',()=>{
 const mismatched=documentFor(ru.replace('1936','1940'));
 assert.equal(localizeSourceBoundSeoLead(mismatched,'/argentina/place/buenos-aires-obelisk/'),0);
 assert.match(serialize(mismatched),/1940/);
 const wrongRoute=documentFor(ru);
 assert.equal(localizeSourceBoundSeoLead(wrongRoute,'/brazil/tour/amazon/'),0);
 assert.match(serialize(wrongRoute),/Обелиск/);
});
