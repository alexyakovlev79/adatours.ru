/** Stage 6: source-bound EN labels for the shared photo archive.
 * The Russian records and media files remain canonical. This projection is
 * display-only, opt-in for the noindex English site, and never translates an
 * unrelated image based on the phrase alone.
 */
import mediaEn from '../../data/i18n/media-captions.en.json' with {type:'json'};
import shard1 from '../../data/i18n/stage6-shards/6-1.en.json' with {type:'json'};
import shard2 from '../../data/i18n/stage6-shards/6-2.en.json' with {type:'json'};
import shard3 from '../../data/i18n/stage6-shards/6-3.en.json' with {type:'json'};
import shard4 from '../../data/i18n/stage6-shards/6-4.en.json' with {type:'json'};
import shard5 from '../../data/i18n/stage6-shards/6-5.en.json' with {type:'json'};
import shard6 from '../../data/i18n/stage6-shards/6-6.en.json' with {type:'json'};
import shard7 from '../../data/i18n/stage6-shards/6-7.en.json' with {type:'json'};
import shard8 from '../../data/i18n/stage6-shards/6-8.en.json' with {type:'json'};
import shard9 from '../../data/i18n/stage6-shards/6-9.en.json' with {type:'json'};

const entries = new Map(Object.entries(mediaEn.entries));
for(const [i,shard] of [shard1,shard2,shard3,shard4,shard5,shard6,shard7,shard8,shard9].entries()){
 if(shard.schemaVersion!==1||shard.stage!=='6.'+(i+1))throw Error('Invalid Stage 6 shard '+(i+1));
 for(const [src,record] of Object.entries(shard.entries)){
  if(entries.has(src))throw Error('Conflicting English media caption '+src);
  entries.set(src,record);
 }
}
const containsRussian = value => /[А-Яа-яЁё]/u.test(value ?? '');
const own = (node,key) => node?.attrs?.find(attr => attr.name===key);
const get = (node,key) => own(node,key)?.value;
const set = (node,key,value) => {const a=own(node,key);if(a)a.value=value;};
export const mediaSourceKey = src => {
  if(typeof src!=='string') return null;
  let value=src.trim();
  if(/^https?:\/\//i.test(value)){
    try {
      const url=new URL(value);
      if(!['img.adatours.ru','adatours.ru','www.adatours.ru','alexyakovlev79.github.io'].includes(url.hostname))return null;
      value=url.pathname;
    }catch{return null;}
  }
  if(value.startsWith('public/'))value='/'+value.slice('public/'.length);
  if(value.startsWith('/media/'))return value;
  // GitHub Pages and EN preview base prefixes are display paths, not IDs.
  const index=value.indexOf('/media/');
  return index>0 && value.startsWith('/') ? value.slice(index) : null;
};
export const mediaEnglishEntry = src => entries.get(mediaSourceKey(src)) ?? null;

/** Reuse an already-rendered English description on another appearance of
 * the SAME source image, never by matching Russian phrases or file names.
 * Conflicting descriptions are excluded: no arbitrary scene selection.
 */
export function collectRenderedEnglishMediaLabels(html,seen=new Map()) {
  if(typeof html!=='string')return seen;
  const russian=/[А-Яа-яЁё]/u, latin=/[A-Za-z]/u;
  for(const found of html.matchAll(/<img\b[^>]*>/gi)){
    const attrs=new Map();
    for(const m of found[0].matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))
      attrs.set(m[1].toLowerCase(),m[2]??m[3]);
    if(attrs.get('aria-hidden')==='true'||attrs.get('role')==='presentation')continue;
    const source=mediaSourceKey(attrs.get('data-lazy-src')??attrs.get('src'));
    const alt=attrs.get('alt')?.replace(/&amp;/g,'&').replace(/&quot;/g,'"')
      .replace(/&#39;|&apos;/g,"'").trim();
    if(!source||!alt||alt.length<16||alt.length>240||!latin.test(alt)||russian.test(alt)||
      alt.split(/\s+/).length<3)continue;
    if(!seen.has(source))seen.set(source,alt);
    else if(seen.get(source)!==alt)seen.set(source,null);
  }
  return seen;
}
export function unambiguousEnglishMediaLabels(seen){
  return new Map([...seen].filter(([,label])=>typeof label==='string'&&Boolean(label)));
}


export function localizeMediaField(src,value,{locale='en',field='alt',decorative=false,reusedLabels=null}={}) {
  if(locale!=='en'||decorative||typeof value!=='string'||!value.trim()||!containsRussian(value))return value;
  const entry=mediaEnglishEntry(src);
  const translated=entry?.alt ?? reusedLabels?.get(mediaSourceKey(src));
  if(!translated)return value;
  return field==='alt'||field==='hover'||field==='title'||field==='aria-label'||field==='caption' ? translated : value;
}

/** DOM pass is intentionally constrained to captions linked to an actual image.
 * Existing approved EN field translations always win, as does empty decorative alt.
 */
export function localizeMediaDocument(document,{locale='en',reusedLabels=null}={}) {
  if(locale!=='en')return {attributes:0,captions:0};
  let attributes=0,captions=0;
  const visit=node=>{
    if(!node)return;
    if(node.tagName==='img') {
      const src=get(node,'data-lazy-src') ?? get(node,'src');
      const entry=mediaEnglishEntry(src) ?? (reusedLabels?.has(mediaSourceKey(src)) ? {alt:reusedLabels.get(mediaSourceKey(src))} : null);
      const decorative=get(node,'aria-hidden')==='true'||get(node,'role')==='presentation';
      if(entry&&!decorative)for(const field of ['alt','title','aria-label']) {
        const value=get(node,field);
        const next=localizeMediaField(src,value,{locale,field,decorative,reusedLabels});
        if(next!==value){set(node,field,next);attributes++;}
      }
    }
    if(node.tagName==='figure'){
      const findImage=n=>n?.tagName==='img'?n:(n?.childNodes??[]).map(findImage).find(Boolean);
      const img=findImage(node),src=img&&(get(img,'data-lazy-src')??get(img,'src')),entry=mediaEnglishEntry(src);
      if(entry)for(const child of node.childNodes??[])if(child.tagName==='figcaption'){
        const textNodes=(child.childNodes??[]).filter(c=>c.nodeName==='#text');
        if(textNodes.length!==1||(child.childNodes??[]).some(c=>c.nodeName!=='#text'))continue;
        const value=textNodes[0].value;
        // Figure labels may contain extra editorial facts: only replace the
        // original registered caption verbatim, never an unrelated sentence.
        if(value?.trim()===entry.sourceAlt || (containsRussian(value) && value?.trim()===get(img,'alt')?.trim())){
          textNodes[0].value=entry.alt;
          captions++;
        }
      }
    }
    for(const child of node.childNodes??[])visit(child);
    if(node.content)visit(node.content);
  };
  visit(document);
  return {attributes,captions};
}
