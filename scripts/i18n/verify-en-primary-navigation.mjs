/** Verify only primary shared EN navigation. Nested RU fallback is allowed. */
import {parse} from 'parse5';
const attr=(node,name)=>node?.attrs?.find(a=>a.name===name)?.value??'';
const has=(node,name)=>attr(node,'class').split(/\s+/u).includes(name);
const kids=node=>node?.childNodes??[];
const find=(node,p)=>{
 if(p(node))return node;
 for(const child of kids(node)){const result=find(child,p);if(result)return result;}
 return null;
};
const textOf=node=>node?.nodeName==='#text'?node.value:kids(node).map(textOf).join(' ');
export function primaryEnglishMenuLabels(html){
 const doc=parse(html),header=find(doc,n=>n.tagName==='header'&&n.attrs?.some(a=>a.name==='data-site-header'));
 const nav=header&&find(header,n=>n.tagName==='nav'&&has(n,'desktop-nav'));
 if(!nav)return [];
 return kids(nav).flatMap(node=>{
  if(node.tagName==='a')return [textOf(node).replace(/\s+/gu,' ').trim()];
  if(!has(node,'desktop-nav__group'))return [];
  const link=kids(node).find(n=>n.tagName==='a'&&has(n,'desktop-nav__parent'));
  return link?[textOf(link).replace(/\s+/gu,' ').trim()]:[];
 }).filter(Boolean);
}
