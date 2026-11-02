/** English staging: mirror canonical Russian HTML as non-indexed temporary content.
 * Native translated English pages take priority; GitHub source remains shared.
 */
import fs from 'node:fs';
import path from 'node:path';
import {parse,parseFragment,serialize} from 'parse5';
import {EN_STAGING_BASE} from '../../src/lib/i18n/en-staging-site.mjs';
const ROBOTS='noindex,nofollow,noarchive,nosnippet';
const fail=m=>{throw Error('EN Russian fallback: '+m)};
const get=(n,k)=>n?.attrs?.find(x=>x.name===k)?.value??null;
const set=(n,k,v)=>{n.attrs??=[];const a=n.attrs.find(x=>x.name===k);if(a)a.value=v;else n.attrs.push({name:k,value:v})};
const walk=(n,p)=>{const r=[];const v=x=>{if(p(x))r.push(x);for(const c of x.childNodes??[])v(c)};v(n);return r};
const prune=(n,p)=>{for(const c of [...(n.childNodes??[])]){if(p(c))n.childNodes.splice(n.childNodes.indexOf(c),1);else prune(c,p)}};
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
const notice='<aside lang="en" role="note" data-ada-translation-notice="ru" style="position:relative;z-index:30;padding:14px 5%;background:#f2cc67;color:#171815;font-size:15px;line-height:1.5;text-align:center">This page is currently available in Russian. Its English translation is in progress. <a href="'+EN_STAGING_BASE+'en/tours/" style="font-weight:700;color:inherit;text-decoration:underline">Browse journeys in English</a>.</aside>';
export function russianFallbackHtml(source,route,known){
 if(typeof source!=='string'||!source.includes('<html')||!known?.has(route))fail('Unknown source route '+route);
 const doc=parse(source),root=walk(doc,n=>n.tagName==='html')[0],
 head=walk(doc,n=>n.tagName==='head')[0],body=walk(doc,n=>n.tagName==='body')[0];
 if(!root||!head||!body||get(root,'lang')!=='ru')fail('Expected canonical RU HTML '+route);
 if(walk(head,n=>n.tagName==='meta'&&get(n,'http-equiv')?.toLowerCase()==='refresh').length)return null;
 set(root,'data-ada-ru-fallback','true');
 const unwanted=n=>n.tagName==='form'||n.tagName==='iframe'||n.tagName==='noscript'||
  n.attrs?.some(a=>a.name==='data-search-overlay'||a.name==='data-search-open')||
  (n.tagName==='script'&&!get(n,'src')?.startsWith(EN_STAGING_BASE+'_astro/'))||
  (n.tagName==='link'&&['canonical','alternate'].includes((get(n,'rel')||'').toLowerCase()))||
  (n.tagName==='meta'&&['og:','twitter:'].some(x=>(get(n,'name')||get(n,'property')||'').startsWith(x)))||
  (n.tagName==='img'&&/^https?:\/\/(?:mc\.yandex\.ru|www\.googletagmanager\.com)\//.test(get(n,'src')||''));
 prune(doc,unwanted);
 const robots=walk(head,n=>n.tagName==='meta'&&get(n,'name')==='robots');
 if(robots.length!==1)fail('Robots meta invalid '+route);
 set(robots[0],'content',ROBOTS);
 const banner=parseFragment(notice).childNodes??[];
 for(const n of banner)n.parentNode=body;
 body.childNodes.unshift(...banner);
 const linkTo=href=>{
  if(!href||/^(?:https?:|mailto:|tel:|javascript:)/i.test(href))return href;
  if(href==='#request'||href==='#lead-form')return 'mailto:info@adatours.ru';
  if(href.startsWith('#')||!href.startsWith(EN_STAGING_BASE))return href;
  const rel=href.slice(EN_STAGING_BASE.length);
  if(rel.startsWith('en/')||rel.startsWith('_astro/')||rel.startsWith('brand/'))return href;
  const i=rel.search(/[?#]/),pathname=i===-1?rel:rel.slice(0,i),suffix=i===-1?'':rel.slice(i);
  if(suffix==='#request'||suffix==='#lead-form')return 'mailto:info@adatours.ru';
  const target=normal(pathname);
  return target==='/tours/'?EN_STAGING_BASE+'en/tours-ru/'+suffix:
   known.has(target)?EN_STAGING_BASE+'en/'+target.slice(1)+suffix:'https://adatours.ru/'+rel;
 };
 for(const a of walk(doc,n=>n.tagName==='a')){
  const v=get(a,'href');if(v!==null)set(a,'href',linkTo(v));
  a.attrs=a.attrs?.filter(x=>x.name!=='data-lead-modal')??[];
 }
 for(const img of walk(doc,n=>n.tagName==='img'||n.tagName==='source'))
  for(const k of ['src','data-lazy-src','poster']){
   const v=get(img,k);
   if(v?.startsWith(EN_STAGING_BASE+'media/'))
    set(img,k,'https://img.adatours.ru/'+v.slice(EN_STAGING_BASE.length));
  }
 if(walk(doc,n=>n.tagName==='form'||n.tagName==='iframe'||n.tagName==='script'&&!get(n,'src')?.startsWith(EN_STAGING_BASE+'_astro/')).length)
  fail('Active form or script');
 // CSS backgrounds and srcsets must resolve to shared S3, not local Pages media.
 const out=serialize(doc).replaceAll(EN_STAGING_BASE+'media/','https://img.adatours.ru/media/');
 if(!out.includes('data-ada-ru-fallback')||!out.includes('data-ada-translation-notice')||!out.includes(ROBOTS))fail('Unsafe transformed output');
 return out;
}
export function stageRussianFallback({dist,output,minPages=1000,maxBytes=950_000_000}={}){
 const root=path.resolve(dist),target=path.resolve(output);
 if(root===target||target.startsWith(root+path.sep))fail('Unsafe output');
 const pages=discoverRussianPages(root),known=new Set(pages.map(p=>p.route));
 if(pages.length<minPages)fail('Incomplete RU build: '+pages.length);
 let added=0,existing=0,redirects=0,bytes=0;
 for(const row of pages){
  const filename=path.join(target,'en',row.route.slice(1),'index.html');
  if(fs.existsSync(filename)){existing++;continue}
  const rendered=russianFallbackHtml(fs.readFileSync(row.file,'utf8'),row.route,known);
  if(rendered===null){redirects++;continue}
  fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,rendered);
  added++;bytes+=Buffer.byteLength(rendered);
  if(bytes>maxBytes)fail('Fallback HTML exceeds Pages size budget');
 }
 if(added+existing+redirects!==pages.length||added<minPages-300)fail('Incomplete fallback');
 // The native EN /tours/ contains three translated journeys. A separate
 // first page keeps the full canonical RU catalogue reachable.
 let fullCatalogueAlias=0;
 const sourceTours=pages.find(x=>x.route==='/tours/');
 if(sourceTours&&fs.existsSync(path.join(target,'en/tours/index.html'))){
  const alias=path.join(target,'en/tours-ru/index.html');
  if(fs.existsSync(alias))fail('Full RU Tour catalogue alias already exists');
  const content=russianFallbackHtml(fs.readFileSync(sourceTours.file,'utf8'),'/tours/',known);
  if(!content)fail('Invalid full Russian catalogue');
  fs.mkdirSync(path.dirname(alias),{recursive:true});fs.writeFileSync(alias,content);
  fullCatalogueAlias=1;bytes+=Buffer.byteLength(content);
 }
 if(bytes>maxBytes)fail('Fallback HTML exceeds Pages budget');
 return {ruSourcePages:pages.length,ruFallbackPages:added+fullCatalogueAlias,
  englishPrecedence:existing,redirectAliases:redirects,fullCatalogueAlias,bytes};
}
