#!/usr/bin/env node
/** Package 15 nonpublic Tour/Excursion HTML pages and referenced local assets. */
import fs from 'node:fs';
import path from 'node:path';
import {parse} from 'parse5';
const src=path.resolve(process.argv[2]||'dist');
const out=path.resolve(process.argv[3]||'/tmp/ada-en-html-review');
const copy=relative=>{
 if(!/^[A-Za-z0-9/_.,-]+$/.test(relative)||relative.split('/').some(s=>!s||s==='.'||s==='..'))throw Error('Unsafe output path '+relative);
 const dest=path.join(out,relative);
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 fs.copyFileSync(path.join(src,relative),dest);
};
const manifest=JSON.parse(fs.readFileSync('data/i18n/pilot-excursions/v1/manifest.json','utf8'));
if(manifest.entries?.length!==11||manifest.publicationAuthorized!==false)
 throw Error('Private EN Excursion manifest missing');
const pages=[
 'en-pilot-private/tours/index.html',
 'en-pilot-private/tour/rio-de-janeiro-four-days/index.html',
 'en-pilot-private/tour/easter-island-3-days/index.html',
 'en-pilot-private/tour/colombia-essential-5-days/index.html',
 ...manifest.entries.map(e=>'en-pilot-private/excursion/'+e.slug+'/index.html')
];
const assets=new Set(['brand/adatours-logo-black.svg','favicon.svg']);
for(const p of pages){
 copy(p);
 const doc=parse(fs.readFileSync(path.join(src,p),'utf8'));
 const walk=n=>{
  for(const a of n.attrs||[]){
   if(['src','href'].includes(a.name)&&a.value?.startsWith('/_astro/'))assets.add(a.value.slice(1));
  }
  for(const child of n.childNodes||[])walk(child);
 };
 walk(doc);
}
for(const a of assets)copy(a);
const readme=[
 'Ada Tours — PRIVATE EN HTML PILOT',
 '',
 'Fifteen working Astro-generated HTML pages (3 Tours, 11 Excursions, 1 catalogue).',
 'These are nonpublic internal preview files, not a live booking site.',
 'Run in this extracted folder (requires Python 3):',
 '',
 '  python3 -m http.server 8123 --directory .',
 '',
 'Open in a browser: http://localhost:8123/en-pilot-private/tours/',
 'Navigate between all three English Tour pages and eleven Excursions.',
 '',
 'Tour images load from the existing https://img.adatours.ru CDN (internet required).',
 'The enquiry link opens an email client; no live POST form is enabled.',
 'All pages are noindex and have no public canonical/hreflang.',
 'Separate editorial QA of 142 additional blocks, full site forms/search/schema',
 'and approved domain remain release gates. DO NOT upload this as a public site.',
 ''
].join('\n');
fs.writeFileSync(path.join(out,'README.txt'),readme,'utf8');
console.log(JSON.stringify({pages:pages.length,assets:[...assets],out}));
