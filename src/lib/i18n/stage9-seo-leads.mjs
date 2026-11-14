/** Stage 9: source-bound EN SEO lead projection for a specific published route.
 * Exact SHA-256 match of the rendered Russian paragraph prevents stale translations.
 * Never changes RU Markdown, article data, other paragraphs, links or monetary facts.
 */
import {createHash} from 'node:crypto';
import translations from '../../data/i18n/stage9-seo-leads.en.json' with {type:'json'};
const byRoute=new Map();
for(const item of translations.entries){
 if(!/^\/(?:[a-z0-9_-]+\/)+$/.test(item.targetPath)||
    !/^[a-f0-9]{64}$/.test(item.sourceTextSha256)||
    typeof item.en!=='string'||!item.en.trim()||/[\u0400-\u052f]/u.test(item.en)||
    byRoute.has(item.targetPath))throw Error('Invalid source-bound SEO lead '+item.targetPath);
 byRoute.set(item.targetPath,item);
}
const normalized=s=>String(s).replace(/\s+/gu,' ').trim();
const digest=s=>createHash('sha256').update(normalized(s)).digest('hex');
const classes=node=>(node.attrs??[]).find(x=>x.name==='class')?.value?.split(/\s+/u)??[];
function visit(node,fn){
 if(fn(node))return;
 for(const child of node.childNodes??[])visit(child,fn);
}
export function localizeSourceBoundSeoLead(document,route){
 const item=byRoute.get(route);
 if(!item)return 0;
 let changed=0;
 visit(document,node=>{
  if(node.tagName!=='p'||!classes(node).includes('seo-geo__lead'))return false;
  const nodes=node.childNodes??[];
  if(nodes.length!==1||nodes[0].nodeName!=='#text')return false;
  const text=nodes[0];
  if(digest(text.value)!==item.sourceTextSha256)return false;
  const leading=text.value.match(/^\s*/u)?.[0]??'';
  const trailing=text.value.match(/\s*$/u)?.[0]??'';
  text.value=leading+item.en+trailing;changed++;return true;
 });
 return changed;
}
