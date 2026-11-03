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

export function localizeSharedUiDocument(document,{locale='en',entityLabels=new Map()}={}) {
  let changes=0;
  const translate=value=>{
    if(typeof value!=='string' || value.trim().length<2)return value;
    const source=value.trim(),label=entityLabels.get(source);
    if(label)return value.slice(0,value.indexOf(source))+label+value.slice(value.indexOf(source)+source.length);
    return translateUiText(value,locale);
  };
  const visit=(node,blocked=false)=>{
    if(blocked || skip.has(node.tagName))return;
    if(node.nodeName==='#text') {
      const next=translate(node.value);
      if(next!==node.value){node.value=next;changes++;}
    }
    for(const attr of node.attrs??[]) {
      if(!attributes.has(attr.name))continue;
      const next=translate(attr.value);
      if(next!==attr.value){attr.value=next;changes++;}
    }
    for(const child of node.childNodes??[])visit(child);
    // Search cards and other shared components use native <template> nodes.
    if(node.content)visit(node.content);
  };
  visit(document);
  return changes;
}
