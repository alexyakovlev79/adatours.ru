/** English staging: mirror canonical Russian HTML as non-indexed temporary content.
 * Native translated English pages take priority; GitHub source remains shared.
 */
import fs from 'node:fs';
import path from 'node:path';
import {parse,serialize} from 'parse5';
import {localizeSharedUiDocument,localizedEntityLabels} from '../../src/lib/i18n/shared-ui-html.mjs';
import {EN_STAGING_BASE} from '../../src/lib/i18n/en-staging-site.mjs';
const ROBOTS='noindex,nofollow,noarchive,nosnippet';
const fail=m=>{throw Error('EN Russian fallback: '+m)};
const get=(n,k)=>n?.attrs?.find(x=>x.name===k)?.value??null;
const set=(n,k,v)=>{n.attrs??=[];const a=n.attrs.find(x=>x.name===k);if(a)a.value=v;else n.attrs.push({name:k,value:v})};
const walk=(n,p)=>{const r=[];const v=x=>{if(p(x))r.push(x);for(const c of x.childNodes??[])v(c)};v(n);return r};
const prune=(n,p)=>{for(const c of [...(n.childNodes??[])]){if(p(c))n.childNodes.splice(n.childNodes.indexOf(c),1);else prune(c,p)}};
// Redirect aliases are real RU output but must not be advertised as EN pages.
// Reject an unexpected redirect later in the renderer if this preflight misses one.
const isSourceRedirect=html=>/<meta\b[^>]*\bhttp-equiv\s*=\s*(?:"refresh"|'refresh'|refresh)(?=[\s/>])/i.test(html);
const normal=s=>{if(!s||s==='/')return '/';const p=s.split('/').filter(Boolean);if(p.some(x=>x==='.'||x==='..'||x.includes('\\')||x.includes('%')))fail('Unsafe route '+s);return '/'+p.join('/')+'/'};
export function discoverRussianPages(root){
 const pages=[];
 function visit(folder,parts){for(const d of fs.readdirSync(folder,{withFileTypes:true})){
  if(d.isSymbolicLink())fail('Symlink '+d.name);
  if(d.isDirectory()){
   if(!parts.length&&['en','en-pilot-private','_astro','brand','media'].includes(d.name))continue;
   visit(path.join(folder,d.name),[...parts,d.name]);
  }else if(d.isFile()&&d.name==='index.html')pages.push({route:normal(parts.join('/')),file:path.join(folder,d.name)});
 }}
 visit(path.resolve(root),[]);
 const ids=new Set();for(const item of pages){if(ids.has(item.route))fail('Duplicate route '+item.route);ids.add(item.route)}
 return pages.sort((a,b)=>a.route.localeCompare(b.route,'en'));
}
/** Build full shared EN pages; legacy nonshared fallback still blocks submissions. */
export function russianFallbackHtml(source,route,known,{sharedContent=false,entityLabels=new Map()}={}){
 if(typeof source!=='string'||!source.includes('<html')||!known?.has(route))fail('Unknown source route '+route);
 const doc=parse(source),root=walk(doc,n=>n.tagName==='html')[0],
  head=walk(doc,n=>n.tagName==='head')[0];
 if(!root||!head||(!sharedContent && get(root,'lang')!=='ru')||
   (sharedContent && (!['ru','en'].includes(get(root,'lang')) || get(root,'data-ada-shared-locale')!=='en')))
  fail((sharedContent?'Expected canonical shared HTML ':'Expected canonical RU HTML ')+route);
 if(walk(head,n=>n.tagName==='meta'&&get(n,'http-equiv')?.toLowerCase()==='refresh').length)return null;
 if(get(root,'lang')==='ru')set(root,'data-ada-ru-fallback','true');
 else set(root,'data-ada-en-content','true');
 if(sharedContent)localizeSharedUiDocument(doc,{entityLabels});
 // Keep search, first-party JS, hero video and all shared editorial components.
 prune(doc,n=>
  (n.tagName==='script' && !get(n,'src')?.startsWith(EN_STAGING_BASE+'_astro/') &&
   !(sharedContent && get(n,'src')?.startsWith(EN_STAGING_BASE+'form-config.js')))||
  (n.tagName==='noscript'&&/mc\.yandex\.ru|googletagmanager/i.test(serialize(n)))||
  (n.tagName==='link'&&['canonical','alternate'].includes((get(n,'rel')||'').toLowerCase()))||
  (n.tagName==='meta'&&['og:','twitter:'].some(x=>(get(n,'name')||get(n,'property')||'').startsWith(x))));
 const robots=walk(head,n=>n.tagName==='meta'&&get(n,'name')==='robots');
 if(robots.length!==1)fail('Robots meta invalid '+route);
 set(robots[0],'content',ROBOTS);
 if(!sharedContent)for(const form of walk(doc,n=>n.tagName==='form')){
  set(form,'inert','');set(form,'aria-disabled','true');
  set(form,'data-ada-staging-inert-form','true');
  form.attrs=form.attrs.filter(a=>!['data-lead-form','method','action','onsubmit'].includes(a.name));
  for(const button of walk(form,n=>n.tagName==='button'&&get(n,'type')==='submit'))set(button,'type','button');
 }
 // Source build defers many photos to JavaScript. Resolve those URLs in HTML
 // so hero, highlights, galleries and inline backgrounds are never placeholders.
 for(const n of walk(doc,n=>Boolean(n.attrs))){
  const src=get(n,'data-lazy-src'),srcset=get(n,'data-lazy-srcset'),style=get(n,'data-lazy-style');
  if(src){set(n,'src',src);n.attrs=n.attrs.filter(a=>a.name!=='data-lazy-src');
   if(n.tagName==='img'&&get(n,'fetchpriority')!=='high')set(n,'loading','lazy');}
  if(srcset){set(n,'srcset',srcset);n.attrs=n.attrs.filter(a=>a.name!=='data-lazy-srcset');}
  if(style){set(n,'style',[get(n,'style'),style].filter(Boolean).join(';'));
   n.attrs=n.attrs.filter(a=>!['data-lazy-style','data-lazy-background'].includes(a.name));}
  if(n.tagName==='picture')n.attrs=n.attrs.filter(a=>a.name!=='data-lazy-picture');
  if(n.attrs?.some(a=>a.name==='data-search-overlay'))set(n,'data-search-base',EN_STAGING_BASE+'en/');
  const fragment=get(n,'data-site-shell-src');
  if(fragment?.startsWith('/shared/'))set(n,'data-site-shell-src',EN_STAGING_BASE+fragment.slice(1));
 }
 const linkTo=href=>{
  if(!href||/^(?:https?:|mailto:|tel:|javascript:)/i.test(href))return href;
  if(href==='#request'||href==='#lead-form')return sharedContent ? '#request' : 'mailto:info@adatours.ru';
  if(href.startsWith('#')||href.startsWith('//')||href.startsWith('?'))return href;
  // HTML and authored Markdown can contain either withBase links or clean
  // absolute RU paths. Resolve both from the same canonical route allowlist.
  const rel=href.startsWith(EN_STAGING_BASE)?href.slice(EN_STAGING_BASE.length):
    href.startsWith('/')?href.slice(1):null;
  if(rel===null)return href;
  if(rel.startsWith('en/'))return EN_STAGING_BASE+rel;
  if(['_astro/','brand/','pagefind/','data/','phone-flags/'].some(p=>rel.startsWith(p)))
   return EN_STAGING_BASE+rel;
  if(rel.startsWith('media/'))return 'https://img.adatours.ru/'+rel;
  const i=rel.search(/[?#]/),pathname=i===-1?rel:rel.slice(0,i),suffix=i===-1?'':rel.slice(i);
  if((suffix==='#request'||suffix==='#lead-form')&&!sharedContent)return 'mailto:info@adatours.ru';
  const target=normal(pathname);
  return known.has(target)?EN_STAGING_BASE+'en/'+target.slice(1)+suffix:'https://adatours.ru/'+rel;
 };
 for(const a of walk(doc,n=>n.tagName==='a')){
  const href=get(a,'href');if(href!==null)set(a,'href',linkTo(href));
  if(!sharedContent)a.attrs=a.attrs?.filter(x=>x.name!=='data-lead-modal')??[];
 }
 // Script-driven filters navigate through data-href rather than anchor href.
 // Keep country/interest/VIP selectors in the same complete EN route tree.
 for(const n of walk(doc,n=>Boolean(n.attrs))){
  for(const key of ['data-href','data-root-href','data-current-root-href']){
   const href=get(n,key);if(href?.startsWith('/')&&!href.startsWith('//'))set(n,key,linkTo(href));
  }
  // Pop-up links are assigned from the same canonical route-map JSON at
  // runtime. Rebase only hrefs, preserving shared coordinates/media/data.
  const encoded=get(n,'data-geo-map-payload');
  if(encoded!==null){
   let payload;
   try{payload=JSON.parse(encoded)}catch{fail('Invalid route-map payload '+route)}
   if(!Array.isArray(payload?.points))fail('Missing route-map points '+route);
   for(const point of payload.points)if(typeof point?.href==='string')point.href=linkTo(point.href);
   set(n,'data-geo-map-payload',JSON.stringify(payload));
  }
 }
 const out=serialize(doc).replaceAll(EN_STAGING_BASE+'media/','https://img.adatours.ru/media/');
 if(!(out.includes('data-ada-ru-fallback')||out.includes('data-ada-en-content'))||!out.includes(ROBOTS))fail('Unsafe transformed output');
 if(/data-ada-translation-notice|This page is currently available in Russian/i.test(out))fail('Unrequested translation notice');
 return out;
}

export function stageRussianFallback({dist,output,minPages=1000,maxBytes=950_000_000,sharedContent=false,receipt=null}={}){
 const root=path.resolve(dist),target=path.resolve(output);
 if(root===target||target.startsWith(root+path.sep))fail('Unsafe output');
 const pages=discoverRussianPages(root);
 const localization={sharedContent,entityLabels:localizedEntityLabels(receipt)};
 if(pages.length<minPages)fail('Incomplete RU build: '+pages.length);
 // Only the old mixed-language pilot needed a second full Tour catalogue.
 const nativeTourCatalogue=fs.existsSync(path.join(target,'en/tours/index.html'));
 // Build the link allowlist from renderable pages, not from redirect aliases.
 // Otherwise an old RU alias can lead to an EN URL which was never emitted.
 const aliasRoutes=new Set();
 for(const row of pages){
  if(isSourceRedirect(fs.readFileSync(row.file,'utf8')))aliasRoutes.add(row.route);
 }
 const known=new Set(pages.filter(row=>!aliasRoutes.has(row.route)).map(row=>row.route));
 let added=0,existing=0,redirects=0,bytes=0,englishPages=0;
 for(const row of pages){
  if(aliasRoutes.has(row.route)){redirects++;continue}
  const filename=path.join(target,'en',row.route.slice(1),'index.html');
  if(fs.existsSync(filename)){existing++;continue}
  const rendered=russianFallbackHtml(fs.readFileSync(row.file,'utf8'),row.route,known,localization);
  if(rendered===null)fail('Unclassified RU redirect alias: '+row.route);
  fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,rendered);
  added++;if(rendered.includes('data-ada-en-content="true"'))englishPages++;bytes+=Buffer.byteLength(rendered);
  if(bytes>maxBytes)fail('Fallback HTML exceeds Pages size budget');
 }
 if(added+existing+redirects!==pages.length||added<minPages-300)fail('Incomplete fallback');
 // The deduplicated header/search/footer is one real asset, not optional UI.
 // Its links and image sources must be rebased just like ordinary pages.
 const sourceShared=path.join(root,'shared');
 let sharedFragments=0;
 if(fs.existsSync(sourceShared)){
  const outShared=path.join(target,'shared');
  fs.mkdirSync(outShared,{recursive:true});
  for(const item of fs.readdirSync(sourceShared,{withFileTypes:true})){
   if(!item.isFile()||!/^site-shell-[a-f0-9]+\.html$/.test(item.name))continue;
   const rendered=russianFallbackHtml(fs.readFileSync(path.join(sourceShared,item.name),'utf8'),'/',known,localization);
   if(!rendered)fail('Invalid shared HTML fragment '+item.name);
   fs.writeFileSync(path.join(outShared,item.name),rendered);
   sharedFragments++;bytes+=Buffer.byteLength(rendered);
  }
 }
 // The native EN /tours/ contains three translated journeys. A separate
 // first page keeps the full canonical RU catalogue reachable.
 let fullCatalogueAlias=0;
 const sourceTours=pages.find(x=>x.route==='/tours/');
 if(sourceTours&&nativeTourCatalogue){
  const alias=path.join(target,'en/tours-ru/index.html');
  if(fs.existsSync(alias))fail('Full RU Tour catalogue alias already exists');
  const content=russianFallbackHtml(fs.readFileSync(sourceTours.file,'utf8'),'/tours/',known,localization);
  if(!content)fail('Invalid full Russian catalogue');
  fs.mkdirSync(path.dirname(alias),{recursive:true});fs.writeFileSync(alias,content);
  fullCatalogueAlias=1;bytes+=Buffer.byteLength(content);
 }
 if(bytes>maxBytes)fail('Fallback HTML exceeds Pages budget');
 return {ruSourcePages:pages.length,ruFallbackPages:added+fullCatalogueAlias,
  englishPrecedence:existing,englishPages,sharedContent,redirectAliases:redirects,fullCatalogueAlias,sharedFragments,bytes};
}

