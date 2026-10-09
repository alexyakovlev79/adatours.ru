/** User-approved SEO title formulas, independent from visible page copy. */
import {seoCountLabel,seoPluralIndex,seoYearRange} from './seo-meta.mjs';
import {seoCountryCase,seoCountryName,seoPlacePhrase,seoPlaceDirectionPhrase} from './seo-grammar.mjs';
const F={tour:['тур','тура','туров'],excursion:['экскурсия','экскурсии','экскурсий'],
 attraction:['достопримечательность','достопримечательности','достопримечательностей']};
const quantity=(n,type)=>Number(n)>0?seoCountLabel(n,F[type]):'';
const year=()=>seoYearRange();
const merchant='купить по лучшей цене напрямую у принимающего туроператора';
const combine=(items)=>{const list=items.filter(Boolean);return list.length>1?
 list.slice(0,-1).join(', ')+' и '+list.at(-1):(list[0]||'');};
export function seoCountryTitle(name,attractions,excursions,tours) {
 const visible=combine([quantity(attractions,'attraction'),quantity(excursions,'excursion')])||'путешествия';
 const toursText=tours>0?'Каталог '+quantity(tours,'tour')+' и цены':'Цены';
 return name+': '+visible+'. '+toursText+' '+year()+' туроператора Ada Tours';
}
export function seoDestinationTitle(name,countryId,excursions,tours) {
 const inCountry=seoCountryCase(countryId,'prepositional');
 const visible=combine(['достопримечательности',quantity(excursions,'excursion'),quantity(tours,'tour')]);
 return name+(inCountry?' в '+inCountry:'')+': '+visible+'. Цены '+year()+' принимающего туроператора Ada Tours';
}
function priceFrom(price,currency) {
 const n=Number(price);
 if(!Number.isFinite(n)||n<=0||!currency)return '';
 const formatted=Math.round(n).toLocaleString('ru-RU',{maximumFractionDigits:0});
 const currencySymbol={USD:'$',EUR:'€',RUB:'₽',BRL:'R$',ARS:'ARS '};
 return 'от '+(currencySymbol[currency]||'')+formatted+(currencySymbol[currency]?'':' '+currency);
}
export function seoTourTitle(d) {
 const named=/^тур(?:\s|$)/iu.test(d.title)?d.title:'Тур '+d.title;
 const price=priceFrom(d.priceFrom,d.currency);
 return named+(price?' по цене '+price:'')+' в '+year()+
  ' от туроператора с русскоговорящими гидами | Ada Tours';
}
export function seoExcursionTitle(d,countryId,destinationId,destinationName) {
 const where=destinationId&&destinationName?seoPlacePhrase(destinationId,destinationName):'';
 const country=seoCountryName(countryId);
 const price=priceFrom(d.priceFrom,d.currency);
 return d.title+(where?' '+where:'')+(country?', '+country:'')+(price?', цена '+price:'')+' | Ada Tours';
}
export function seoThemeHubTitle(name,tourCount) {
 if(!(tourCount>0))return name+' — впечатления | Ada Tours';
 const endings=['впечатление','впечатления','впечатлений'];
 return name+' — '+quantity(tourCount,'tour')+' и '+endings[seoPluralIndex(tourCount)]+' | Ada Tours';
}
export function seoThemeCatalogTitle(name,count,countryName='') {
 const title=countryName?countryName+', '+name:name;
 return title+': '+(count>0?quantity(count,'tour')+' ':'')+year()+' - '+merchant+' | Ada Tours';
}
export function seoCountryTourCatalogTitle(countryId) {
 return 'Каталог туров '+year()+' по '+seoCountryCase(countryId,'dative')+' - '+merchant+' | Ada Tours';
}
export function seoCountryPlacesCatalogTitle(countryId,total) {
 const phrase=quantity(total,'attraction')||'Достопримечательности';
 return phrase+' '+seoCountryCase(countryId,'genitive')+' | Ada Tours';
}
export function seoCountryExcursionsCatalogTitle(countryId,total) {
 return (quantity(total,'excursion')||'Экскурсии')+' в '+seoCountryCase(countryId,'prepositional')+' | Ada Tours';
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
