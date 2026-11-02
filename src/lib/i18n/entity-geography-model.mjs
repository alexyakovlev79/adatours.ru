/** Locale-aware relation projection shared by the production layouts and the
 * closed EN pilot. Inputs are canonical stable IDs and already verified
 * locale records. No string matching, URL synthesis or RU-text fallback.
 */
const CYRILLIC=/[\u0400-\u052f]/u;
const fail=reason=>{throw new TypeError('Localized entity relations: '+reason)};
const value=entry=>entry?.data&&typeof entry.data==='object'?entry.data:entry;
const asIds=(items,name)=>{
 if(!Array.isArray(items)||items.some(id=>typeof id!=='string'||!id))
  fail(name+' must contain stable IDs');
 return items;
};
const createIndex=(entries,name)=>{
 if(!Array.isArray(entries))fail(name+' requires an array');
 const byId=new Map();
 for(const entry of entries){
  const data=value(entry);
  if(typeof data?.id!=='string'||!data.id||byId.has(data.id))fail(name+' duplicate or missing stable ID');
  byId.set(data.id,entry);
 }
 return byId;
};
const getName=(entry,strict)=>{
 const name=value(entry)?.name;
 if(typeof name!=='string'||!name.trim()||(strict&&CYRILLIC.test(name)))
  fail('Missing localized name for '+String(value(entry)?.id));
 if(strict&&value(entry).locale!=='en')
  fail('Unapproved locale record: '+String(value(entry).id));
 return name;
};
const withHref=(entry,makeHref)=>{
 const url=makeHref?.(entry)??value(entry)?.url;
 if(url===undefined||url===null)return undefined;
 if(typeof url!=='string'||!url.startsWith('/')||url.startsWith('//')||
    url.includes('..')||/[?#\\\s\u0000-\u001f]/.test(url))
   fail('Unsafe entity link: '+url);
 return url;
};

/** Keep all RU planned places as text; in EN only source-verified places
 * can become links or visible destination labels.
 */
export function buildTourGeographyModel(tour,{
 countries=[],destinations=[],plannedDestinations=new Map(),
 countryUrl,destinationUrl,strictLocalized=false
}={}){
 if(!tour||typeof tour!=='object')fail('Missing Tour');
 if(strictLocalized&&tour.locale!=='en')fail('English Tour model required');
 const allCountries=asIds(tour.countries,'countries');
 const allDestinations=asIds(tour.destinations,'destinations');
 const mainCountryIds=asIds(tour.routeCountries??allCountries,'routeCountries');
 const mainDestinationIds=asIds(tour.routeDestinations??allDestinations,'routeDestinations');
 const countriesById=createIndex(countries,'countries');
 const placesById=createIndex(destinations,'destinations');
 const countryNames=allCountries.map(id=>countriesById.get(id)).filter(Boolean)
   .map(entry=>getName(entry,strictLocalized));
 const mainCountries=mainCountryIds.map(id=>{
  const entry=countriesById.get(id);
  if(!entry){
   if(strictLocalized)fail('Untranslated main Country: '+id);
   return null;
  }
  return {id,name:getName(entry,strictLocalized),href:withHref(entry,countryUrl),entry};
 }).filter(Boolean);
 if(strictLocalized&&mainCountries.some(item=>!item.href))
  fail('English Country link missing');
 const planned=plannedDestinations instanceof Map?plannedDestinations:new Map();
 const routeDestinations=allDestinations.map(id=>{
  const entry=placesById.get(id);
  if(!entry){
   if(strictLocalized)return null;
   const name=planned.get(id)?.name??'';
   return name?{id,name,href:undefined}:null;
  }
  const data=value(entry);
  const name=getName(entry,strictLocalized);
  // Production RU URL needs an existing published Country, not only a
  // planned destination. Closed EN likewise needs an English Country.
  const hasCountry=countriesById.has(data.countryId);
  if(strictLocalized&&!hasCountry)fail('English Destination without English Country: '+id);
  return {id,name,href:hasCountry?withHref(entry,destinationUrl):undefined,entry};
 }).filter(Boolean);
 const main=new Set(mainDestinationIds);
 return {
  countryNames,
  mainCountries,
  routeDestinations,
  mainPlaces:routeDestinations.filter(item=>main.has(item.id)),
  optionalPlaces:routeDestinations.filter(item=>!main.has(item.id))
 };
}

/** Source-linked Excursion places; preserve exact RU catalogue fallback
 * for destinationName, but never use it when rendering English.
 */
export function buildExcursionGeographyModel(excursion,{
 destinations=[],plannedDestinations=new Map(),destinationUrl,strictLocalized=false
}={}){
 if(!excursion||typeof excursion!=='object')fail('Missing Excursion');
 if(strictLocalized&&excursion.locale!=='en')fail('English Excursion model required');
 const ids=[excursion.destination,...(excursion.relatedDestinations??[])]
   .filter(id=>id!==undefined&&id!==null);
 asIds(ids,'Excursion destination IDs');
 const uniqueIds=[...new Set(ids)];
 const byId=createIndex(destinations,'Excursion destinations');
 const linkedEntries=uniqueIds.map(id=>byId.get(id)).filter(Boolean);
 const linkedPlaces=linkedEntries.map(entry=>({
  id:value(entry).id,
  name:getName(entry,strictLocalized),
  href:withHref(entry,destinationUrl),
  entry
 }));
 const primary=excursion.destination?byId.get(excursion.destination):null;
 const planned=plannedDestinations instanceof Map?plannedDestinations:new Map();
 const name=primary?getName(primary,strictLocalized):
  strictLocalized?excursion.destinationName:
  planned.get(excursion.destination)?.name??excursion.destinationName;
 if(strictLocalized&&name!==undefined&&name!==null&&
   (typeof name!=='string'||CYRILLIC.test(name)))
  fail('Untranslated Excursion destination name');
 return {destinationName:name,linkedEntries,linkedPlaces};
}
