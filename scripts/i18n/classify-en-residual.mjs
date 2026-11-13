/** Stage 9: keep source-bound titles and navigational names separate from
 * actual UI controls. Every hit remains in the per-URL evidence inventory. */
const attr=(node,key)=>node?.attrs?.find(a=>a.name===key)?.value??null;
export function classifyEnResidual({stack,field,fallback,route}){
 const tags=stack.map(node=>node.tagName);
 const leaf=tags.at(-1)??'';
 const hasClass=name=>stack.some(node=>(attr(node,'class')??'').split(/\s+/).includes(name));
 if(tags.includes('head')&&(leaf==='title'||leaf==='meta'||field==='meta-content'))
  return 'seo_pending_stage7';
 if(tags.includes('section')&&hasClass('pagefind-record'))return 'technical_pagefind_index';
 if(tags.includes('noscript'))return 'noscript_fallback_markup';
 if(field==='alt'||tags.includes('figcaption'))return 'media_pending_stage6';
 if(field==='js-data')return 'js_state_candidate';
 // Tour day summaries come from source-specific itinerary fields, not
 // the shared interface dictionary. Do not hide a missing translation.
 if(leaf==='span'&&hasClass('day__title')&&tags.includes('summary'))
  return 'tour_itinerary_source_review';
 if(leaf==='span'&&hasClass('breadcrumbs')&&tags.includes('nav'))
  return 'entity_breadcrumb_source_review';
 if(hasClass('seo-geo')&&(hasClass('seo-geo__toggle')||hasClass('seo-geo__heading')))
  return 'seo_article_heading_source_review';
 if(tags.some(t=>t==='nav'||t==='header'||t==='footer'||['button','label','option','summary','select'].includes(t))||
    ['aria-label','aria-description','placeholder','aria-valuetext'].includes(field))
  return 'ui_localization_gap';
 if(tags.includes('blockquote')||tags.includes('q')||tags.includes('cite'))
  return 'source_quote_review';
 if(tags.includes('h1')&&/^\/en\/(?:about|contacts|team|reviews|cases|privacy|personal-data|vip|interests|tours|places|excursions|country|multi-country)(?:\/|$)/.test(route))
  return 'standard_page_heading_review';
 if(fallback)return 'permitted_ru_body_fallback';
 return 'mixed_content_or_name_review';
}
