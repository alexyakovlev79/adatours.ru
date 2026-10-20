/** User-approved SEO title formulas, independent from visible page copy. */
import {seoCountLabel,seoPluralIndex,seoYearRange} from './seo-meta.mjs';
import {seoCountryCase,seoCountryName,seoCountryDirection,seoPlacePhrase,seoPlaceDirectionPhrase} from './seo-grammar.mjs';
const F={tour:['тур','тура','туров'],excursion:['экскурсия','экскурсии','экскурсий'],
 attraction:['локация','локации','локаций']};
/** Compact only SEO titles; names, headings, URLs and editorial copy keep their wording. */
export function seoCompactTitle(title) {
 const endings={ь:'я',и:'и',ей:'й',ям:'ям',ями:'ями',ях:'ях',ью:'ей'};
 return title.replace(/достопримечательност(ями|ям|ях|ей|ью|ь|и)(?!\p{L})/giu, (word,ending)=>
  (word[0]==='Д'?'Локаци':'локаци')+endings[ending.toLowerCase()]);
}
/** Count only the published places in the corresponding country, catalogue or route. */
export function seoAttractionsDescription(description,count,context='') {
 const copy=(description||'').trim();
 if(!(count>0))return copy;
 const label=seoCountLabel(count,['достопримечательность','достопримечательности','достопримечательностей']);
 return label+(context?' '+context:'')+'.'+(copy?' '+copy:'');
}
const quantity=(n,type)=>Number(n)>0?seoCountLabel(n,F[type]):'';
const year=()=>seoYearRange();
const merchant='купить по лучшей цене напрямую у принимающего туроператора';
const combine=(items)=>{const list=items.filter(Boolean);return list.length>1?
 list.slice(0,-1).join(', ')+' и '+list.at(-1):(list[0]||'');};
export function seoCountryTitle(name,attractions,excursions,tours) {
 const visible=combine([quantity(attractions,'attraction'),quantity(excursions,'excursion')])||'путешествия';
 const toursText=tours>0?'Каталог '+year()+': '+quantity(tours,'tour')+' и цены':'Путешествия '+year();
 return name+': '+visible+'. '+toursText+' туроператора Ada Tours';
}
export function seoDestinationTitle(name,countryId,excursions,tours) {
 const inCountry=seoCountryCase(countryId,'prepositional');
 const visible=combine(['локации',quantity(excursions,'excursion'),quantity(tours,'tour')]);
 const availability=tours===0?' Пока нет туров в это место.':'';
 const catalogue=tours>0?'Каталог '+year()+': цены':'Путешествия '+year();
 return name+(inCountry?' в '+inCountry:'')+': '+visible+'.'+availability+' '+catalogue+' принимающего туроператора Ada Tours';
}
function priceFrom(price,currency) {
 const n=Number(price);
 if(!Number.isFinite(n)||n<=0||currency!=='USD')return '';
 const formatted=Math.round(n).toLocaleString('ru-RU',{maximumFractionDigits:0});
 return 'от ' + String.fromCharCode(36) + formatted;
}
export function seoTourTitle(d) {
 const compact=seoCompactTitle(d.title);
 const named=/^тур(?:\s|$)/iu.test(compact)?compact:'Тур '+compact;
 const price=priceFrom(d.priceFrom,d.currency);
 return named+(price?' по цене '+price:'')+' в '+year()+
  ' от туроператора с русскоговорящими гидами | Ada Tours';
}
export function seoExcursionTitle(d,countryId,destinationId,destinationName,tours) {
 const where=destinationId&&destinationName?seoPlacePhrase(destinationId,destinationName):'';
 const country=seoCountryName(countryId);
 const price=priceFrom(d.priceFrom,d.currency);
 return seoCompactTitle(d.title)+(where?' '+where:'')+(country?', '+country:'')+(price?', цена '+price:'')+
  (tours===0?'. Пока нет туров с этой экскурсией':'')+' | Ada Tours';
}
/** Only active related tours determine availability; page copy remains independent. */
export function seoRelatedToursDescription(description,tours,kind) {
 if(tours!==0)return description;
 const copy=(description||'').trim();
 const status=kind==='excursion'?'Пока нет туров с этой экскурсией.':'Пока нет туров в это место.';
 return copy?copy+(/[.!?…]$/u.test(copy)?' ':'. ')+status:status;
}
export function seoThemeHubTitle(name,tourCount) {
 if(!(tourCount>0))return name+' — впечатления | Ada Tours';
 const endings=['впечатление','впечатления','впечатлений'];
 return name+' — '+quantity(tourCount,'tour')+' и '+endings[seoPluralIndex(tourCount)]+' | Ada Tours';
}
export function seoThemeCatalogTitle(name,count,countryName='') {
 const title=countryName?countryName+', '+name:name;
 return (countryName?title+': ':title+' — ')+(count>0?quantity(count,'tour')+' ':'')+(countryName?'':'на ')+year()+' - '+merchant+' | Ada Tours';
}
export function seoCountryTourCatalogTitle(countryId) {
 return 'Каталог туров '+year()+' по '+seoCountryCase(countryId,'dative')+' - '+merchant+' | Ada Tours';
}
export function seoCountryPlacesCatalogTitle(countryId,total) {
 const phrase=quantity(total,'attraction')||'Локации';
 return phrase+' '+seoCountryCase(countryId,'genitive')+' | Ada Tours';
}
export function seoCountryExcursionsCatalogTitle(countryId,total) {
 return (quantity(total,'excursion')||'Экскурсии')+' '+seoCountryDirection(countryId)+' | Ada Tours';
}
export function seoDestinationTourCatalogTitle(destination,total,optional=false) {
 const n=quantity(total,'tour')||'Туры';
 const where=optional?seoPlaceDirectionPhrase(destination.id,destination.name):seoPlacePhrase(destination.id,destination.name);
 const country=seoCountryCase(destination.countryId,'prepositional');
 return n+' '+year()+(optional?' с возможностью заехать ':' ')+where+
  (country?' ('+country+')':'')+' - '+merchant+' | Ada Tours';
}
export function seoExcursionTourCatalogTitle(excursion,total,countryName,destinationName) {
 const n=quantity(total,'tour')||'Туры';
 const inCountry=[destinationName,countryName].filter(Boolean).join(', ');
 return n+' '+year()+' с экскурсией «'+excursion.title+'»'+
  (inCountry?' ('+inCountry+')':'')+' - '+merchant+' | Ada Tours';
}
export function seoDestinationExcursionsCatalogTitle(destination,country,total) {
 return (quantity(total,'excursion')||'Экскурсии')+' '+
  seoPlacePhrase(destination.id,destination.name)+(country?', '+country:'')+
  ' - '+merchant+' | Ada Tours';
}
export function seoPaginatedTitle(title,page) {
 if(page<=1)return title;
 if(title.endsWith(' | Ada Tours'))return title.slice(0,-' | Ada Tours'.length)+' — страница '+page+' | Ada Tours';
 return title+' — страница '+page;
}
