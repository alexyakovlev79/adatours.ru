import {promises as f} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parse} from 'parse5';
import {fileURLToPath} from 'node:url';
const parts=[['header','header','<header class="site-header'],['search','div','<div class="search-overlay"'],['footer','footer','<footer class="footer"'],['cookie','div','<div class="cookie-notice"']];
const navigation=[['/country/','Страны'],['/tours/','Туры'],['/multi-country/','Multi-country'],['/interests/','По интересам'],['/vip/','VIP'],['/mice/','MICE'],['/dmc/','Для агентств'],['/about/','О нас'],['/contacts/','Контакты']].map(([href,label])=>`<a href="${href}">${label}</a>`).join('');
function element(html,tag,prefix){
  const start=html.indexOf(prefix);if(start<0)return null;
  const re=new RegExp(`</?${tag}(?=[\\s>/])[^>]*>`,'gi');re.lastIndex=start;
  let depth=0,m;while((m=re.exec(html))){depth+=m[0].startsWith('</')?-1:1;if(depth===0)return{start,end:re.lastIndex,raw:html.slice(start,re.lastIndex)}}
  throw Error('Unclosed '+tag);
}
function comparable(key,raw){
  if(key==='header')return raw.replace(/site-header--(?:light|dark)/,'site-header--THEME');
  return raw;
}
function stub(key,raw,url){
  if(key==='header'){
    const first=raw.slice(0,raw.indexOf('>'));const inner=element(raw,'div','<div class="site-header__inner"');
    const desktop=inner&&element(inner.raw,'nav','<nav class="desktop-nav"');const mobile=element(raw,'div','<div class="mobile-menu"');
    if(!inner||!desktop||!mobile)throw Error('Header changed');
    const scope=(first.match(/data-astro-cid-[a-z0-9]+/)||[''])[0];const attr=scope?' '+scope:'';
    const replacement=`<nav class="desktop-nav" aria-label="Основная навигация"${attr}>${navigation}</nav>`;
    const compact=inner.raw.slice(0,desktop.start)+replacement+inner.raw.slice(desktop.end);
    const mobStart=mobile.raw.slice(0,mobile.raw.indexOf('>'));
    const mob=`${mobStart}><div class="mobile-menu__stage"${attr}><section class="mobile-menu__panel mobile-menu__panel--main" data-mobile-panel="main"${attr}><nav aria-label="Мобильная навигация"${attr}>${navigation}</nav></section></div></div>`;
    return `${first} data-site-shell="header" data-pagefind-ignore="all" data-site-shell-src="${url}">`+raw.slice(0,inner.start).replace(/^.*?>/,'')+compact+raw.slice(inner.end,mobile.start)+mob+raw.slice(mobile.end);
  }
  if(key==='search')return '<div id="site-search" data-site-shell="search" hidden></div>';
  if(key==='footer'){
    // The footer has separate navigation, contact, legal and credit sections.
    // Preserve useful SSR fallback content before the shared fragment loads.
    const contact=element(raw,'div','<div class="footer__contact"');
    const legal=element(raw,'div','<div class="footer__legal"');
    const credit=element(raw,'div','<div class="footer__credit"');
    if(!contact||!legal||!credit)throw Error('Footer contact, legal or credit markup changed');
    return `<footer class="footer" data-site-shell="footer" data-pagefind-ignore="all"><nav aria-label="Навигация в подвале">${navigation}</nav>${contact.raw}${legal.raw}${credit.raw}</footer>`;
  }
  if(key==='cookie')return '<div data-site-shell="cookie" hidden></div>';
  throw Error('Unknown shared site-shell part: '+key);
}

/** Compact only parser-identified indentation and non-functional comments.
 * Text, tag attributes, script/style, noscript fallbacks and sensitive tags
 * are preserved byte for byte; SEO articles remain in the original HTML.
 */
export function compactSafeHtml(html) {
  const root=parse(html,{sourceCodeLocationInfo:true});
  const edits=[];
  const preserve=new Set(['pre','textarea','script','style','code','svg','math','noscript','template']);
  const visit=(node,sensitive=false)=>{
    const keep=sensitive||preserve.has(node.tagName);
    const loc=node.sourceCodeLocation;
    if(!keep && loc){
      if(node.nodeName==='#comment' && !(node.data||'').trimStart().startsWith('[if')) {
        edits.push({start:loc.startOffset,end:loc.endOffset,text:''});
      } else if(node.nodeName==='#text') {
        const raw=html.slice(loc.startOffset,loc.endOffset);
        if(raw.length>1 && /^[ \t\r\n]+$/.test(raw))
          edits.push({start:loc.startOffset,end:loc.endOffset,text:' '});
      }
    }
    for(const child of node.childNodes||[])visit(child,keep);
  };
  visit(root);
  for(const edit of edits.sort((a,b)=>b.start-a.start))
    html=html.slice(0,edit.start)+edit.text+html.slice(edit.end);
  return html;
}
async function* htmlFiles(dir){for(const e of await f.readdir(dir,{withFileTypes:true})){
  if(['media','pagefind','shared'].includes(e.name))continue;const p=path.join(dir,e.name);
  if(e.isDirectory())yield* htmlFiles(p);else if(e.isFile()&&e.name.endsWith('.html'))yield p;
}}
async function size(dir){let total=0;for(const e of await f.readdir(dir,{withFileTypes:true})){
  const p=path.join(dir,e.name);total+=e.isDirectory()?await size(p):e.isFile()?(await f.stat(p)).size:0;
}return total}
export async function dedupeSiteShell(dir=path.resolve('dist')){
  let common=null,href='',pages=0,redirects=0,saved=0,compacted=0;
  for await(const file of htmlFiles(dir)){
    let html=await f.readFile(file,'utf8');if(!html.includes('<header class="site-header')){redirects++;continue}
    // Keep the interactive form in SSR HTML so its country selector, input
    // handlers and modal attach to the actual node without shell hydration.
    const fullForm=element(html,'form','<form class="form"');
    const requiredFormMarkup=['data-lead-form','data-phone-field','data-phone-input','data-phone-menu',
      'data-phone-country','data-phone-dial-hidden','name="name"','name="email"','name="comment"',
      'name="contact_method"','name="entity_id"','name="tour_id"','name="page_url"','name="locale"'];
    if(!fullForm||requiredFormMarkup.some((part)=>!fullForm.raw.includes(part)))
      throw Error('Incomplete interactive lead form: '+file);
    const found=new Map();for(const [name,tag,begin] of parts){
      const block=element(html,tag,begin);if(!block)throw Error('Missing '+name+' in '+file);
      found.set(name,block);if(common&&comparable(name,block.raw)!==comparable(name,common.get(name)))throw Error('Page-specific '+name+' differs: '+file)
    }
    if(!common){common=new Map([...found].map(([name,block])=>[name,block.raw]));
      const markup=[...common.values()].join('\n');href='/shared/site-shell-'+createHash('sha256').update(markup).digest('hex').slice(0,16)+'.html';
      await f.mkdir(path.join(dir,'shared'),{recursive:true});
      await f.writeFile(path.join(dir,href.slice(1)),'<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"></head><body>'+markup+'</body></html>');
    }
    const before=Buffer.byteLength(html);for(const [name,block] of [...found].sort((a,b)=>b[1].start-a[1].start))
      html=html.slice(0,block.start)+stub(name,block.raw,href)+html.slice(block.end);
    if(element(html,'form','<form class="form"')?.raw!==fullForm.raw)
      throw Error('Lead form altered during deduplication: '+file);
    const beforeCompact=Buffer.byteLength(html);
    html=compactSafeHtml(html);
    compacted+=beforeCompact-Buffer.byteLength(html);
    saved+=before-Buffer.byteLength(html);await f.writeFile(file,html);pages++;
  }
  if(!pages)throw Error('No complete pages found');const bytes=await size(dir);
  console.log(JSON.stringify({pages,redirects,sharedFragment:href,savedBytes:saved,compactedBytes:compacted,publishedBytes:bytes,publishedMB:+(bytes/1e6).toFixed(2)}));
  if(bytes>950_000_000)throw Error('Site size target exceeded (950 MB): '+bytes);
  return {pages,redirects,href,saved,bytes};
}
if(process.argv[1]&&path.resolve(fileURLToPath(import.meta.url))===path.resolve(process.argv[1]))await dedupeSiteShell(process.argv[2]?path.resolve(process.argv[2]):path.resolve('dist'));
