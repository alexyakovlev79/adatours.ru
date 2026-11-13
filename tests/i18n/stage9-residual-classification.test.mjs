import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyEnResidual} from '../../scripts/i18n/classify-en-residual.mjs';

const node=(tagName,classes='')=>({tagName,attrs:classes?[{name:'class',value:classes}]:[]});
const classify=(stack,field='text',fallback=false)=>classifyEnResidual({
 stack,field,fallback,route:'/en/antarctica/tour/example/'
});
test('stage9: source-bound day titles are not classified as missing shared UI',()=>{
 assert.equal(classify([node('div','itinerary__days'),node('details','day'),node('summary'),node('span','day__title')]),'tour_itinerary_source_review');
 assert.equal(classify([node('nav','breadcrumbs'),node('ol'),node('li'),node('span')]),'entity_breadcrumb_source_review');
 assert.equal(classify([node('section','seo-geo'),node('div','container'),node('button','seo-geo__toggle'),node('span')]),'seo_article_heading_source_review');
});
test('stage9: real buttons, aria, visible media and noindex rule retain their classes',()=>{
 assert.equal(classify([node('main'),node('button')]),'ui_localization_gap');
 assert.equal(classify([node('div'),node('input')],'aria-label'),'ui_localization_gap');
 assert.equal(classify([node('img')],'alt'),'media_pending_stage6');
 assert.equal(classify([node('noscript'),node('div')]),'noscript_fallback_markup');
 assert.equal(classify([node('section','pagefind-record'),node('p')]),'technical_pagefind_index');
 assert.equal(classify([node('main'),node('p')],'text',true),'permitted_ru_body_fallback');
 assert.equal(classify([node('nav','breadcrumbs'),node('a')]),'ui_localization_gap');
});

test('stage9: archive Tour H1 is a separately evidenced source fallback, not an open active heading',()=>{
 const stack=[node('body'),node('main'),node('h1')];
 const route='/en/multi-country/tour/brazil-argentina-fun/';
 assert.equal(classifyEnResidual({stack,field:'text',fallback:true,route,archivedTour:true}),
  'archived_source_tour_title');
 assert.equal(classifyEnResidual({stack,field:'text',fallback:true,route,archivedTour:false}),
  'standard_page_heading_review');
});
