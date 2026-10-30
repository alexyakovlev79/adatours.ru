/** Stable, fail-closed IDs for per-language text slots. The public URL, order
 * and array index are never a block's identity. A changed owner requires remap.
 */
import {createHash} from 'node:crypto';
import {visibleLocalizationSlots} from './content-adapter.mjs';
const hash=x=>createHash('sha256').update(String(x),'utf8').digest('hex').slice(0,16);
const slug=x=>String(x).replace(/[^a-zA-Z0-9]+/g,'_').slice(0,40);
function ownerFor(entry,type,path,text){
 const p=path.split('/').slice(1),d=entry.data;
 const list=(key,index,identity)=> {
  const item=d[key]?.[Number(index)];
  if(item===undefined)throw new Error('Missing owner: '+path);
  return key+'/'+identity(item);
 };
 if(p[0]==='itinerary'){
  const item=d.itinerary?.[Number(p[1])];
  if(!item)throw new Error('Missing itinerary owner: '+path);
  let ident=item.day!=null?'day='+item.day:
    item.excursionRef?'excursion='+item.excursionRef:
    item.label?'label='+hash(item.label):
    item.title?'title='+hash(item.title):null;
  if(!ident)throw new Error('Ambiguous itinerary owner: '+path);
  let suffix=p.slice(2).join('/');
  if(p[2]==='places')suffix='places/'+hash(text);
  if(p[2]==='images') {
    const media=item.images?.[Number(p[3])];
    if(!media?.src)throw new Error('Missing image src: '+path);
    suffix='image/'+hash(media.src)+'/'+p.slice(4).join('/');
  }
  if(p[2]==='image')suffix='image/'+hash(item.image?.src||item.image||'')+'/'+p.slice(3).join('/');
  if(p[2]==='subsections')suffix='subsection/'+hash(item.subsections?.[Number(p[3])]?.title||'')+'/'+p.slice(4).join('/');
  if(p[2]==='contentBlocks'){
   const block=item.contentBlocks?.[Number(p[3])];
   const key=block?.excursionRef||block?.title||block?.text;
   if(!key)throw new Error('Missing content-block semantic owner: '+path);
   suffix='contentBlock/'+hash(block.type+':'+key)+'/'+p.slice(4).join('/');
  }
  return 'itinerary/'+ident+'/'+suffix;
 }
 if(p[0]==='gallery'){
  const image=d.gallery?.[Number(p[1])];
  if(!image?.src)throw new Error('Missing gallery image owner: '+path);
  return 'gallery/'+hash(image.src)+'/'+p.slice(2).join('/');
 }
 if(p[0]==='hero')return 'hero/'+p.slice(1).join('/');
 if(p[0]==='highlights')return list('highlights',p[1],x=>hash(x.title||x.text))+'/'+p.slice(2).join('/');
 if(p[0]==='featureBands')return list('featureBands',p[1],x=>hash(x.title||x.text))+'/'+p.slice(2).join('/');
 if(p[0]==='facts')return list('facts',p[1],x=>hash(x.label||x.value))+'/'+p.slice(2).join('/');
 if(p[0]==='faq')return list('faq',p[1],x=>hash(x.question))+'/'+p.slice(2).join('/');
 if(['route','notes','dates','included','notIncluded','regions','languages'].includes(p[0]))
  return p[0]+'/'+hash(text);
 return p.join('/');
}
function depends(entry,path,text){
 const d=entry.data,p=[];
 if((path==='/priceNote'||(typeof d.priceFrom==='number'&&
   /(?:^|[^0-9])(?:USD|\$|от|price|cost|стоим)/i.test(text)&&text.includes(String(d.priceFrom))))&&
   Object.hasOwn(d,'priceFrom')) {
  p.push('/facts/priceFrom');
  if(Object.hasOwn(d,'currency'))p.push('/facts/currency');
 }
 return p;
}
export function createStableBlockMap(entry,entityType){
 const slots=visibleLocalizationSlots(entry,entityType);
 const paths=[],ids=new Set(),owners=new Map();
 for(const s of slots){
  const semantic=ownerFor(entry,entityType,s.path,s.text);
  const id=entityType+':'+slug(s.field)+':'+hash(semantic);
  if(ids.has(id))throw new Error('Ambiguous repeated semantic block '+entityType+' '+semantic);
  ids.add(id);owners.set(id,semantic);
  paths.push({path:s.path,field:s.field,blockId:id,dependsOn:depends(entry,s.path,s.text)});
 }
 if(paths.length!==slots.length)throw new Error('Missing visible slots');
 return {schemaVersion:1,entityId:entry.data.id,entityType,paths};
}
