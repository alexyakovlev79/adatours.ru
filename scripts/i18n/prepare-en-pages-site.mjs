#!/usr/bin/env node
/** Assemble only the EN route tree and shared site assets for deployment by
 * a dedicated Pages repository, never this source repository's RU Pages.
 * This is website deployment staging, NOT a user-downloadable ZIP.
 */
import fs from 'node:fs';
import path from 'node:path';
import {enStagingSiteEnabled,EN_STAGING_BASE} from '../../src/lib/i18n/en-staging-site.mjs';
import {stageRussianFallback} from './ru-fallback.mjs';
const fail=m=>{throw Error('EN Pages deployment staging: '+m)};
if(!enStagingSiteEnabled(process.env))fail('Not a verified EN GitHub Pages context');
const dist=path.resolve(process.argv[2]||'dist');
const output=path.resolve(process.argv[3]||'pages-site');
if(output===dist||output.startsWith(dist+path.sep))fail('Refusing to deploy into build output');
const read=(p)=>path.join(dist,p);
if(!fs.statSync(read('en')).isDirectory()||!fs.existsSync(read('en/tours/index.html')))fail('EN pages missing');
fs.rmSync(output,{recursive:true,force:true});fs.mkdirSync(output,{recursive:true});
// Publish the complete shared Russian Astro site as the baseline, not the
// separate 22-page English demonstration which omits production sections.
for(const folder of ['_astro','brand','pagefind']){
 if(!fs.existsSync(read(folder)))fail('Required site asset missing '+folder);
 fs.cpSync(read(folder),path.join(output,folder),{recursive:true});
}
for(const folder of ['phone-flags','data'])if(fs.existsSync(read(folder)))
 fs.cpSync(read(folder),path.join(output,folder),{recursive:true});
for(const file of ['search-geo-places.json'])if(fs.existsSync(read(file)))
 fs.copyFileSync(read(file),path.join(output,file));
const ruFallback=stageRussianFallback({dist,output});
if(ruFallback.englishPrecedence!==0||ruFallback.fullCatalogueAlias!==0)
 fail('Legacy limited EN demo replaced canonical full-site pages');
// Site media are offloaded to Yandex S3 in RU production. EN staging must
// rewrite bundled CSS/JS references without copying binary media into Git.
const localMedia=EN_STAGING_BASE+'media/',cdnMedia='https://img.adatours.ru/media/';
for(const asset of fs.readdirSync(path.join(output,'_astro'),{recursive:true,withFileTypes:true})){
 if(!asset.isFile()||!/\.(?:css|js|mjs)$/.test(asset.name))continue;
 const file=path.join(asset.parentPath,asset.name),old=fs.readFileSync(file,'utf8');
 const next=old.replaceAll(localMedia,cdnMedia);
 if(old!==next)fs.writeFileSync(file,next);
 if(next.includes(localMedia))fail('Unresolved media asset URL '+file);
}
for(const file of ['favicon.svg','favicon.ico','favicon-48x48.png','favicon-32x32.png','favicon-16x16.png','apple-touch-icon.png']){
 if(fs.existsSync(read(file)))fs.copyFileSync(read(file),path.join(output,file));
}
const target=EN_STAGING_BASE+'en/';
fs.writeFileSync(path.join(output,'index.html'),
 '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><meta http-equiv="refresh" content="0;url='+target+'"><title>Ada Tours — Latin America</title></head><body><a href="'+target+'">Discover Ada Tours journeys</a></body></html>\n');
fs.writeFileSync(path.join(output,'robots.txt'),'User-agent: *\nDisallow: /\n');
fs.writeFileSync(path.join(output,'.nojekyll'),'');
const html=(p)=>fs.readdirSync(p,{withFileTypes:true}).flatMap(x=>x.isDirectory()?html(path.join(p,x.name)):x.name.endsWith('.html')?[path.join(p,x.name)]:[]);
const siteHtml=html(output);
if(siteHtml.length!==1+ruFallback.ruFallbackPages||siteHtml.some(p=>!p.startsWith(path.join(output,'en')+path.sep)&&p!==path.join(output,'index.html')))
 fail('Non-EN HTML escaped staging filter');
if(fs.existsSync(path.join(output,'CNAME'))||fs.existsSync(path.join(output,'sitemap-index.xml')))
 fail('RU Pages configuration leaked');
// Keep the artifact inside GitHub Pages' supported 1 GB site limit.
const bytes=fs.readdirSync(output,{recursive:true,withFileTypes:true})
 .filter(x=>x.isFile()).reduce((sum,x)=>sum+fs.statSync(path.join(x.parentPath,x.name)).size,0);
if(bytes>950_000_000)fail('Staging artifact exceeds conservative 950 MB budget: '+bytes);
console.log(JSON.stringify({status:'ready_for_dedicated_github_pages',htmlPages:siteHtml.length,
 enPages:0,canonicalFullSite:true,ruFallback,rootRedirect:true,bytes,output,
 sourceFiles:'single Ada Tours repo',liveForms:false}));
