/** Exact-match English projection for curated public page copy only.
 * It never edits canonical RU content, media identifiers, URLs, scripts,
 * original quotations or source metadata. No substring replacements.
 */
import authored from '../../data/i18n/page-copy.en.json' with { type: 'json' };
import stageFive from '../../data/i18n/stage-five-page-copy.en.json' with { type: 'json' };
import ruInterests from '../../data/interest-copy.json' with { type: 'json' };
import enInterests from '../../data/i18n/interest-copy.en.json' with { type: 'json' };

const canonical = text => text.replace(/\s+/gu,' ').trim();
const sourceMap = new Map();
function add(ru,en,group) {
  if(typeof ru!=='string'||typeof en!=='string'||!ru.trim()||!en.trim())
    throw Error('Invalid EN page copy: '+group);
  if(/[<>]/.test(ru)||/[<>]/.test(en))throw Error('Markup is not a page copy value: '+group);
  const key=canonical(ru);
  if(sourceMap.has(key)) {
    if(sourceMap.get(key)!==en)throw Error('Conflicting page copy: '+group);
    return;
  }
  sourceMap.set(key,en);
}
for(const row of authored.messages) add(row.ru,row.en,'page');
for(const row of stageFive.messages) add(row.ru,row.en,'stage-five');
const interestFields=['toursTitle','tourIntro','geographyIntro','catalogIntro'];
for(const [id,ru] of Object.entries(ruInterests)){
  const en=enInterests.entries[id];
  if(!en)throw Error('Untranslated interest copy: '+id);
  for(const field of interestFields)add(ru[field],en[field],id+'.'+field);
}
export const authoredPageCopyCount=sourceMap.size;
export function translateAuthoredPageText(value, locale='en') {
  if(locale!=='en'||typeof value!=='string'||!value.trim())return value;
  const translated=sourceMap.get(canonical(value));
  if(translated===undefined)return value;
  return (value.match(/^\s*/u)?.[0]??'')+translated+(value.match(/\s*$/u)?.[0]??'');
}
const blockedTags=new Set(['head','script','style','code','pre','textarea','svg','math','blockquote']);
const localizableAttributes=new Set(['aria-label','title','placeholder']);
export function localizeAuthoredPageDocument(document,{locale='en'}={}){
  if(locale!=='en')return 0;
  let changed=0;
  const visit=node=>{
    if(!node||blockedTags.has(node.tagName))return;
    if(node.nodeName==='#text'){
      const next=translateAuthoredPageText(node.value,locale);
      if(next!==node.value){node.value=next;changed++;}
    }
    for(const attr of node.attrs??[]){
      if(!localizableAttributes.has(attr.name))continue;
      const next=translateAuthoredPageText(attr.value,locale);
      if(next!==attr.value){attr.value=next;changed++;}
    }
    for(const child of node.childNodes??[])visit(child);
    if(node.content)visit(node.content);
  };
  visit(document);
  return changed;
}
