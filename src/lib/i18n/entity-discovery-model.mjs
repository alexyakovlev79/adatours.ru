/** Country/Destination discovery from one canonical entity graph.
 * RU and source-verified EN pass records with the same stable IDs and facts.
 * No title matching, second catalogue, invented hrefs or RU text fallback.
 * Callers control ranking and URL rendering; this module only selects links.
 */
const CYRILLIC=/[\u0400-\u052f]/u;
const fail=message=>{throw new TypeError('Localized discovery: '+message);};
const value=record=>record?.data&&typeof record.data==='object'?record.data:record;
const ids=(list,name)=>{
 if(!Array.isArray(list)||list.some(x=>typeof x!=='string'||!x.trim()))
  fail('Expected stable ID array: '+name);
 return list;
};
const localeFor=(data,strict)=>{
 if(!data||!['ru','en'].includes(data.locale)||typeof data.id!=='string'||!data.id)
  fail('Canonical entity with supported locale required');
 if(strict&&data.locale!=='en')fail('English entity required: '+data.id);
 return data.locale;
};
const records=(list,kind,locale,strict)=>{
 if(!Array.isArray(list))fail('Expected record list: '+kind);
 const found=new Set();
 for(const record of list){
  const d=value(record);
  if(!d||typeof d.id!=='string'||!d.id||found.has(d.id))
   fail('Missing or duplicate '+kind+' ID');
  found.add(d.id);
  if(d.locale!==locale)fail('Mixed/unapproved locale for '+kind+': '+d.id);
  if(strict){
   const label=kind==='tours'?d.title:d.name;
   if(typeof label!=='string'||!label.trim()||CYRILLIC.test(label))
    fail('Untranslated '+kind+' label: '+d.id);
  }
 }
 return list;
};
const mainCountries=t=>ids(t.routeCountries??t.countries,'main countries');
const mainPlaces=t=>ids(t.routeDestinations??t.destinations,'main destinations');

/** Country previews must use main route countries, not optional geography.
 * Destinations are matched by their canonical countryId, never their name.
 */
export function buildCountryDiscoveryModel(country,{
 tours=[],destinations=[]
}={}, {strictLocalized=false}={}){
 const locale=localeFor(country,strictLocalized);
 const sourceTours=records(tours,'tours',locale,strictLocalized);
 const sourcePlaces=records(destinations,'destinations',locale,strictLocalized);
 return {
  tours:sourceTours.filter(record=>mainCountries(value(record)).includes(country.id)),
  destinations:sourcePlaces.filter(record=>value(record).countryId===country.id)
 };
}

/** Preserve the Russian main/optional distinction and recommendations.
 * An English caller may pass only translated source-verified entries;
 * unprovided Destination IDs never create English links.
 */
export function buildDestinationDiscoveryModel(destination,{
 tours=[],destinations=[]
}={}, {strictLocalized=false}={}){
 const locale=localeFor(destination,strictLocalized);
 const sourceTours=records(tours,'tours',locale,strictLocalized);
 const sourcePlaces=records(destinations,'destinations',locale,strictLocalized);
 const related=sourceTours.filter(record=>
  ids(value(record).destinations,'destinations').includes(destination.id)
 );
 const mainTours=related.filter(record=>mainPlaces(value(record)).includes(destination.id));
 const mainIds=new Set(mainTours.map(record=>value(record).id));
 const optionalTours=related.filter(record=>!mainIds.has(value(record).id));
 const overlap=new Map();
 for(const record of related){
  for(const id of new Set(ids(value(record).destinations,'destinations'))){
   if(id!==destination.id)overlap.set(id,(overlap.get(id)??0)+1);
  }
 }
 const relatedDestinations=sourcePlaces
  .filter(record=>value(record).id!==destination.id&&overlap.has(value(record).id))
  .sort((a,b)=>
   overlap.get(value(b).id)-overlap.get(value(a).id)||
   value(a).name.localeCompare(value(b).name,locale)
  ).slice(0,10);
 return {allRelatedTours:related,mainTours,optionalTours,relatedDestinations};
}
