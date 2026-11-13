/** Read-only count of EN photo text still using Cyrillic after the noindex build.
 * Never rewrites RU, translation receipts, images or public URLs.
 */
import fs from 'node:fs';
import path from 'node:path';
import {mediaSourceKey,mediaEnglishEntry} from '../../src/lib/i18n/media-copy.mjs';

const root=path.resolve(process.argv[2]??'../en-pages-site');
const output=path.resolve(process.argv[3]??path.join(root,'stage6-media-audit.json'));
const russian=/[А-Яа-яЁё]/u,lat=/[A-Za-z]/u;
const files=[];
function walk(folder){
  for(const d of fs.readdirSync(folder,{withFileTypes:true})){
    if(d.isDirectory())walk(path.join(folder,d.name));
    else if(d.isFile()&&d.name==='index.html')files.push(path.join(folder,d.name));
  }
}
walk(path.join(root,'en'));
const attrs=tag=>{
  const result=new Map();
  for(const m of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))result.set(m[1].toLowerCase(),m[2]??m[3]);
  return result;
};
const residual=new Map(),samples=[],deferred=new Set(),knownLeaks=new Map();
let imageTags=0,described=0,english=0,russianAlts=0,unlabelled=0,captionsRu=0,pagesWithRussian=0;
for(const file of files){
  const html=fs.readFileSync(file,'utf8');
  let pageRussian=false;
  for(const found of html.matchAll(/<img\b[^>]*>/gi)){
    const a=attrs(found[0]), src=mediaSourceKey(a.get('data-lazy-src')??a.get('src'));
    if(!src)continue;
    if(a.get('aria-hidden')==='true'||a.get('role')==='presentation')continue;
    imageTags++;
    const alt=a.get('alt')??'';
    if(!alt.trim()){unlabelled++;continue;}
    described++;
    if(russian.test(alt)){
      russianAlts++;pageRussian=true;
      const current=residual.get(src)??{src,occurrences:0,values:new Set(),pages:0,samplePages:[]};
      current.occurrences++;
      current.values.add(alt);current.pages++;
      const page=path.relative(root,file).split(path.sep).join('/');
      if(current.samplePages.length<5&&!current.samplePages.includes(page))current.samplePages.push(page);
      residual.set(src,current);
      if(samples.length<45&&!samples.some(s=>s.src===src))samples.push({src,alt:alt.slice(0,180),page:path.relative(root,file)});
      if(mediaEnglishEntry(src))knownLeaks.set(src,(knownLeaks.get(src)??0)+1);
    } else if(lat.test(alt))english++;
  }
  const captions=[...html.matchAll(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/gi)];
  for(const cap of captions){
    const text=cap[1].replace(/<[^>]*>/g,'').trim();
    if(russian.test(text)){captionsRu++;pageRussian=true;}
  }
  if(pageRussian)pagesWithRussian++;
}
const summary={
  schemaVersion:1,scope:'noindex-EN-media-read-only',pagesScanned:files.length,
  imageTags,describedImages:described,englishImageAlts:english,russianImageAlts:russianAlts,
  emptyOrDecorativeAlts:unlabelled,uniqueImagesWithRussianAlt:residual.size,
  figuresWithRussianCaption:captionsRu,pagesWithRussianPhotoText:pagesWithRussian,
  translatedKnownMediaStillWithRussianAlt:knownLeaks.size,
  knownLeaks:[...knownLeaks].slice(0,20).map(([src,occurrences])=>({src,occurrences})),
  // Full keyed backlog for resuming stage six without repeating the HTML crawl.
  // Only user-visible observed alt values and exact media src; never technical registry notes.
  residualBySrc:[...residual.values()].sort((a,b)=>b.occurrences-a.occurrences||a.src.localeCompare(b.src))
    .map(row=>({src:row.src,occurrences:row.occurrences,alts:[...row.values],samplePages:row.samplePages})),
  examples:samples,
};
fs.writeFileSync(output,JSON.stringify(summary,null,2)+'\n');
console.log('Stage 6 EN media inventory: '+JSON.stringify({...summary,examples:undefined,knownLeaks:undefined}));
if(knownLeaks.size)throw Error('Known EN media captions still Russian in '+knownLeaks.size+' exact image paths');
