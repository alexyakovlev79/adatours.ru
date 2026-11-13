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
const residual=new Map(),hoverResidual=new Map(),samples=[],deferred=new Set(),knownLeaks=new Map();
const recordKnownLeak=(src,field)=>{
 const row=knownLeaks.get(src)??{src,occurrences:0,fields:{}};
 row.occurrences++;row.fields[field]=(row.fields[field]??0)+1;
 knownLeaks.set(src,row);
};
let imageTags=0,described=0,english=0,russianAlts=0,russianHovers=0,russianAriaLabels=0,unlabelled=0,captionsRu=0,pagesWithRussian=0;
for(const file of files){
  const html=fs.readFileSync(file,'utf8');
  let pageRussian=false;
  for(const found of html.matchAll(/<img\b[^>]*>/gi)){
    const a=attrs(found[0]), src=mediaSourceKey(a.get('data-lazy-src')??a.get('src'));
    if(!src)continue;
    if(a.get('aria-hidden')==='true'||a.get('role')==='presentation')continue;
    imageTags++;
    const hover=a.get('title')??'';
    if(russian.test(hover)){
      russianHovers++;pageRussian=true;
      const current=hoverResidual.get(src)??{src,occurrences:0,values:new Set()};
      current.occurrences++;current.values.add(hover);hoverResidual.set(src,current);
      if(mediaEnglishEntry(src))recordKnownLeak(src,'title');
    }
    const aria=a.get('aria-label')??'';
    if(russian.test(aria)){
      russianAriaLabels++;pageRussian=true;
      if(mediaEnglishEntry(src))recordKnownLeak(src,'aria-label');
    }
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
      if(mediaEnglishEntry(src))recordKnownLeak(src,'alt');
    } else if(lat.test(alt))english++;
  }
  const captions=[...html.matchAll(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/gi)];
  for(const cap of captions){
    const text=cap[1].replace(/<[^>]*>/g,'').trim();
    if(russian.test(text)){captionsRu++;pageRussian=true;}
  }
  // A translated image must not retain its original Russian label in a
  // figcaption or an image-only link. Check exact media ownership, including
  // markup emitted inside <noscript>, without translating any unrelated text.
  for(const matched of html.matchAll(/<(figure|a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi)){
    const type=matched[1].toLowerCase(),body=matched[3];
    const images=[...body.matchAll(/<img\b[^>]*>/gi)].map(m=>attrs(m[0]));
    const sources=[...new Set(images.map(a=>mediaSourceKey(a.get('data-lazy-src')??a.get('src'))).filter(Boolean))];
    if(sources.length!==1||!mediaEnglishEntry(sources[0]))continue;
    const src=sources[0],entry=mediaEnglishEntry(src);
    if(type==='figure'){
      for(const cap of body.matchAll(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/gi))
        if(russian.test(cap[1].replace(/<[^>]*>/g,'')))recordKnownLeak(src,'figcaption');
    }else{
      const a=attrs('<'+type+matched[2]+'>');
      for(const field of ['title','aria-label']){
        const value=a.get(field),originals=[entry.sourceAlt,...images.map(image=>image.get('alt'))].filter(Boolean);
        if(russian.test(value??'')&&originals.some(original=>original.trim()===value.trim()))
          recordKnownLeak(src,type+'-'+field);
      }
    }
  }
  if(pageRussian)pagesWithRussian++;
}
const summary={
  schemaVersion:1,scope:'noindex-EN-media-read-only',pagesScanned:files.length,
  imageTags,describedImages:described,englishImageAlts:english,russianImageAlts:russianAlts,
  emptyOrDecorativeAlts:unlabelled,uniqueImagesWithRussianAlt:residual.size,
  russianImageHoverTitles:russianHovers,uniqueImagesWithRussianHover:hoverResidual.size,
  russianImageAriaLabels:russianAriaLabels,
  figuresWithRussianCaption:captionsRu,pagesWithRussianPhotoText:pagesWithRussian,
  translatedKnownMediaStillWithRussianAlt:knownLeaks.size,
  knownLeaks:[...knownLeaks.values()].slice(0,20),
  // Full keyed backlog for resuming stage six without repeating the HTML crawl.
  // Only user-visible observed alt values and exact media src; never technical registry notes.
  residualBySrc:[...residual.values()].sort((a,b)=>b.occurrences-a.occurrences||a.src.localeCompare(b.src))
    .map(row=>({src:row.src,occurrences:row.occurrences,alts:[...row.values],samplePages:row.samplePages})),
  residualHoverBySrc:[...hoverResidual.values()].sort((a,b)=>b.occurrences-a.occurrences||a.src.localeCompare(b.src))
    .map(row=>({src:row.src,occurrences:row.occurrences,titles:[...row.values]})),
  examples:samples,
};
fs.writeFileSync(output,JSON.stringify(summary,null,2)+'\n');
console.log('Stage 6 EN media inventory: '+JSON.stringify({...summary,examples:undefined,knownLeaks:undefined}));
if(knownLeaks.size){
  const message='Already-translated EN media alt/title/aria labels still Russian in '+knownLeaks.size+' exact image paths';
  // Preserve an exact Stage 6 backlog without blocking independent noindex
  // Schema.org publication. Strict audit remains the default.
  if(process.argv.includes('--report-only'))console.warn('Stage 6 pending: '+message);
  else throw Error(message);
}
