/** Apply the existing UI dictionary to the one shared rendered document.
 * Content translations happen in Astro's canonical loader, not this pass.
 * This covers unchanged shared components and SSR shell fallbacks without
 * cloning templates or replacing substrings in authored prose/scripts.
 */
import {translateUiText} from './shared-ui-locale.mjs';

const skip=new Set(['script','style','code','pre','textarea','svg','math']);
const attributes=new Set(['aria-label','title','placeholder','alt']);

export function localizedEntityLabels(receipt) {
  const labels=new Map(),ambiguous=new Set();
  for(const item of receipt?.entries??[]) {
    if(!item.applied || !item.sourceName || !item.displayName || item.sourceName===item.displayName)continue;
    const old=labels.get(item.sourceName);
    if(old && old!==item.displayName)ambiguous.add(item.sourceName);
    else labels.set(item.sourceName,item.displayName);
  }
  for(const name of ambiguous)labels.delete(name);
  return labels;
}

/**
 * Translate only visitor-facing catalogue metadata assembled from known UI
 * labels. Product titles, body prose, locations and source values are never
 * machine-transliterated or changed by partial substring replacement.
 */
const getClass=node=>(node?.attrs?.find(x=>x.name==='class')?.value??'').split(/\s+/u);
const isMetadataNode=node=>{
  const parts=new Set(getClass(node));
  return ['eyebrow','band-card__eyebrow','destination-card__meta','interest-card__meta','catalog-meta'].some(x=>parts.has(x));
};
function translateMetadataPart(part,locale) {
  const raw=part.trim();
  const fixed=translateUiText(raw,locale);
  if(fixed!==raw)return fixed;
  // A price is already canonical. Only replace its display prefix.
  if(/^от\s+(?=[$€£¥₽]\s*[\d.,]|(?:USD|EUR|BRL)\s*[\d.,])/u.test(raw))
    return raw.replace(/^от\b/u,'from');
  const duration=/^(\d+(?:[,.]\d+)?(?:\s*[–-]\s*\d+(?:[,.]\d+)?)?)\s+(?:час(?:а|ов)?|ч)\.?$/u.exec(raw);
  if(duration)return duration[1].replaceAll(',','.')+' '+(duration[1]==='1'?'hour':'hours');
  return raw;
}
export function translateEnglishCatalogueMeta(value,locale='en') {
  if(locale!=='en'||typeof value!=='string'||!value.trim())return value;
  const lead=value.match(/^\s*/u)?.[0]??'',trail=value.match(/\s*$/u)?.[0]??'';
  const core=value.trim();
  const translated=core.split(/\s+·\s+/u).map(part=>translateMetadataPart(part,locale)).join(' · ');
  return lead+translated+trail;
}
function translateMoreCatalogueLinks(value,locale='en') {
  if(locale!=='en'||typeof value!=='string')return value;
  const match=/^(\s*)(.+?):\s*все (туры|экскурсии)(\s*)$/u.exec(value);
  if(!match)return value;
  return match[1]+match[2]+': all '+(match[3]==='туры'?'tours':'excursions')+match[4];
}

export function localizeSharedUiDocument(document,{locale='en',entityLabels=new Map()}={}) {
  let changes=0;
  const translate=value=>{
    if(typeof value!=='string' || value.trim().length<2)return value;
    const source=value.trim(),label=entityLabels.get(source);
    if(label)return value.slice(0,value.indexOf(source))+label+value.slice(value.indexOf(source)+source.length);
    return translateUiText(value,locale);
  };
  const visit=(node,blocked=false,ancestors=[])=>{
    if(blocked || skip.has(node.tagName))return;
    if(node.nodeName==='#text') {
      const parent=ancestors.at(-1);
      const isCatalogueMore=ancestors.some(x=>getClass(x).includes('catalog-more__link'));
      const contextual=isMetadataNode(parent)?translateEnglishCatalogueMeta(node.value,locale):
        isCatalogueMore?translateMoreCatalogueLinks(node.value,locale):node.value;
      const next=translate(contextual);
      if(next!==node.value){node.value=next;changes++;}
    }
    for(const attr of node.attrs??[]) {
      if(!attributes.has(attr.name))continue;
      const next=translate(attr.value);
      if(next!==attr.value){attr.value=next;changes++;}
    }
    for(const child of node.childNodes??[])visit(child,false,node.tagName?[...ancestors,node]:ancestors);
    // Search cards and other shared components use native <template> nodes.
    if(node.content)visit(node.content,false,node.tagName?[...ancestors,node]:ancestors);
  };
  visit(document);
  return changes;
}
