#!/usr/bin/env node
/** One EN translation owner per canonical reusable excursion. Tour-specific
 * overrides stay in the respective Tour block map. Does not modify production.
 */
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import yaml from 'js-yaml';
const base=resolve(process.argv[2]||'.');
const dest=process.argv.includes('--output')?resolve(process.argv[process.argv.indexOf('--output')+1]):null;
const read=async path=>readFile(join(base,path),'utf8');
const front=raw=>{
 const m=/^---\r?\n([\s\S]*?)\r?\n---\r?\n/u.exec(raw);
 if(!m)throw Error('Missing frontmatter');
 return yaml.load(m[1]);
};
const registry=JSON.parse(await read('data/i18n/tour-word-matches.json'));
const sources=registry.matches.filter(x=>x.ruStatus!=='archived');
const exFiles=await readdir(join(base,'src/content/excursions'),{recursive:true});
const canonical=new Map(),dupes=[],readErrors=[];
for(const name of exFiles.filter(x=>/\.mdx?$/i.test(x))){
 const path='src/content/excursions/'+name;
 try {
  const v=front(await read(path));
  if(!v.id)throw Error('missing id');
  if(v.locale!=='ru')continue;
  if(canonical.has(v.id))dupes.push({id:v.id,first:canonical.get(v.id).contentPath,second:path});
  canonical.set(v.id,{id:v.id,contentPath:path,status:v.status,slug:v.slug,title:v.title||''});
 }catch(e){readErrors.push({path,error:String(e)});}
}
const referenced=new Map(),invalidTours=[];
for(const row of sources) {
 try{
  const d=front(await read(row.ruContentPath));
  if(d.id!==row.entityId||d.locale!=='ru')throw Error('Tour identity mismatch');
  const id=d.id,refs=[];
  for(let i=0;i<(d.itinerary||[]).length;i++){
   const day=d.itinerary[i],key=day.day??'item'+i;
   if(day.excursionRef)refs.push({id:day.excursionRef,where:'itinerary/'+key+'/excursionRef'});
   for(const [j,b] of (day.contentBlocks||[]).entries()){
     if(b.excursionRef)refs.push({id:b.excursionRef,where:'itinerary/'+key+'/contentBlocks/'+j});
   }
  }
  for(const item of refs) {
   if(typeof item.id!=='string'||!item.id.startsWith('excursion_'))throw Error('Invalid excursion reference: '+item.id);
   if(!referenced.has(item.id))referenced.set(item.id,[]);
   referenced.get(item.id).push({tourId:id,slot:item.where});
  }
 }catch(e){invalidTours.push({id:row.entityId,error:String(e)});}
}
const shared=[...referenced].sort((a,b)=>a[0].localeCompare(b[0],'en')).map(([id,usedBy])=>{
 const own=canonical.get(id);
 const tourIds=[...new Set(usedBy.map(x=>x.tourId))].sort();
 return {excursionId:id,ownerJobId:'en:excursion:'+id,
  contentPath:own?.contentPath||null,sourceStatus:own?.status||null,
  reuseTourCount:tourIds.length,uses:usedBy.length,tourIds,
  tourOverridesRemainInTour:true,missingRuContent:!own};
});
const issues=[
 ...invalidTours.map(x=>({type:'invalid_tour',...x})),
 ...dupes.map(x=>({type:'duplicate_excursion_id',...x})),
 ...readErrors.map(x=>({type:'excursion_read_error',...x})),
 ...shared.filter(x=>x.missingRuContent).map(x=>({type:'unresolved_excursion_ref',excursionId:x.excursionId,tourIds:x.tourIds}))
];
const manifest={schemaVersion:1,source:'current_ru_content_358_active_tours',
 scannedTours:sources.length,sourceExcursionMdCount:canonical.size,
 uniqueReferencedExcursions:shared.length,
 sharedAcrossSeveralTours:shared.filter(x=>x.reuseTourCount>1).length,
 unresolved:shared.filter(x=>x.missingRuContent).length,
 invalid:invalidTours.length+dupes.length+readErrors.length,
 ownerPolicy:'One translation job per canonical stable Excursion ID; reused by all Tour pages. Local excursion text overrides remain in Tour translated blocks.',
 entries:shared,issues};
if(dest){await mkdir(dest,{recursive:true});await writeFile(join(dest,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');}
console.log(JSON.stringify({scannedTours:manifest.scannedTours,sourceExcursionMdCount:manifest.sourceExcursionMdCount,
 uniqueReferencedExcursions:manifest.uniqueReferencedExcursions,
 sharedAcrossSeveralTours:manifest.sharedAcrossSeveralTours,unresolved:manifest.unresolved,invalid:manifest.invalid,
 issuePreview:issues.slice(0,15)},null,2));
if(manifest.invalid>0)process.exitCode=1;