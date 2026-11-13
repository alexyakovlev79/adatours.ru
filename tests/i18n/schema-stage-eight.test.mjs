import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildStructuredData, hasType, safeJsonLd } from '../../src/lib/structured-data.mjs';
import { buildEnglishStructuredData } from '../../src/lib/i18n/schema-projection.mjs';

const root='https://adatours.ru/';
const organization={
  url:root,name:'Ada Tours',legalName:'Ada Tours 2007 - Operadora de Turismo LTDA',
  description:'Принимающий туроператор и DMC',languages:['Английский','Русский'],
  areaServed:[{'@type':'Country',name:'Бразилия'},{'@type':'Place',name:'Латинская Америка'}],
  logo:'/brand/adatours-logo-black.svg',email:'info@adatours.ru',
  cnpj:'08.537.782/0001-04',telephone:'+552134356408',
  sameAs:['https://adatours.com/']
};
const row=(kind,id,path,data)=>({kind,path,archived:false,
  data:{id,status:'approved',slug:path.split('/').filter(Boolean).at(-1),...data}});
const brazil=row('country','country_brazil','/brazil/',{name:'Бразилия'});
const rio=row('destination','destination_rio','/brazil/place/rio-de-janeiro/',{
  name:'Rio de Janeiro',countryId:'country_brazil',destinationType:'city',
  verifiedSameAs:['https://adatours.com/rio-de-janeiro']
});
const tour=row('tour','tour_rio','/brazil/tour/rio/',{
  title:'Rio de Janeiro highlights',lead:'Discover Rio de Janeiro with Ada Tours.',
  durationDays:3,durationNights:2,priceFrom:1200.6,currency:'USD',
  countries:['country_brazil'],destinations:['destination_rio'],
  routeDestinations:['destination_rio'],route:['Рио-де-Жанейро'],
  itinerary:[{day:1,title:'Arrival in Rio',text:'Airport transfer to your hotel.',
    places:['Рио-де-Жанейро']}]
});
const person=row('person','person_anna','/team/anna-avanesova/',{
  name:'Анна Аванесова',role:'Основатель',expertise:['Бразилия'],
  externalProfiles:['https://example.com/verified-anna']
});
const records=[brazil,rio,tour,person];
const page=(path,title='Ada Tours in English')=>({
  path,url:new URL(path,root).href,title,description:'Travel across Latin America with Ada Tours.',lang:'en'
});
const graph=(path,opts={})=>buildEnglishStructuredData({
  root,organization,records,page:page(path),document:{text:''},...opts
});
const find=(g,type)=>g['@graph'].filter(node=>hasType(node,type));
const byId=(g,id)=>g['@graph'].find(node=>node['@id']===id);

test('English TouristTrip, Place, itinerary and Offer use approved text and keep identical identity, tariff and geography',()=>{
  const before=JSON.stringify({organization,records});
  const english=graph(tour.path);
  const russian=buildStructuredData({root,organization,records,page:{...page(tour.path),lang:'ru'}});
  const product=find(english,'TouristTrip')[0],offer=find(english,'Offer')[0];
  assert.equal(product.name,'Rio de Janeiro highlights');
  assert.equal(product.description,'Discover Rio de Janeiro with Ada Tours. Duration: 3 days, 2 nights.');
  assert.equal(product['@id'],find(russian,'TouristTrip')[0]['@id']);
  assert.equal(offer.name,'From 1201 USD');
  assert.deepEqual(offer.priceSpecification,find(russian,'Offer')[0].priceSpecification);
  assert.equal(product.itinerary['@id'],root+'brazil/tour/rio/#itinerary');
  assert.equal(byId(english,product.itinerary['@id']).name,'Itinerary');
  assert.equal(find(english,'Trip')[0].name,'Day 1: Arrival in Rio');
  assert.equal(find(english,'Country')[0].name,'Brazil');
  assert.equal(find(english,'Place').length,0);
  assert.equal(byId(english,root+'brazil/place/rio-de-janeiro/#place').name,'Rio de Janeiro');
  assert.equal(byId(english,root+'brazil/#country')['@id'],root+'brazil/#country');
  assert.equal(find(english,'WebPage')[0].inLanguage,'en');
  assert.equal(find(english,'Organization')[0].description.includes('DMC'),true);
  assert.equal(JSON.stringify({organization,records}),before);
  assert.deepEqual(JSON.parse(safeJsonLd(english)),english);
});

test('English Service, CollectionPage and pagination preserve page-local ItemList positions',()=>{
  const g=graph('/tours/page/2/',{document:{
    catalog:true,groups:[{catalog:true,offset:30,links:[{href:tour.path},{href:rio.path}]}]
  }});
  const list=find(g,'ItemList')[0],collection=byId(g,root+'tours/page/2/#webpage');
  assert.equal(collection['@type'],'CollectionPage');
  assert.equal(collection.inLanguage,'en');
  assert.deepEqual(list.itemListElement.map(item=>item.position),[31,32]);
  assert.equal(list.itemListElement[0].item['@id'],root+'brazil/tour/rio/#tour');
  assert.equal(list.itemListElement[0].name,'Rio de Janeiro highlights');
  const service=graph('/dmc/',{page:page('/dmc/','DMC in Latin America')});
  const dmc=find(service,'Service')[0];
  assert.equal(dmc.serviceType,'Inbound destination management in Brazil and Latin America');
  assert.equal(dmc.name,'DMC in Brazil and Latin America');
  assert.ok(dmc.keywords.every(term=>!/[\u0400-\u052f]/u.test(term)));
  assert.equal(dmc.provider['@id'],root+'#organization');
});

test('English FAQ, breadcrumbs and visible review keep source relations and language without inventing a rating',()=>{
  const answer='We tailor every itinerary to the traveller.';
  const quote='Our journey was wonderful.';
  const g=graph('/reviews/',{
    document:{text:'Sana '+quote,faq:[{question:'Can you adapt my itinerary?',answer}]},
    breadcrumbs:[{'@type':'BreadcrumbList',itemListElement:[
      {'@type':'ListItem',position:1,name:'Главная',item:root},
      {'@type':'ListItem',position:2,name:'Отзывы',item:root+'reviews/'}
    ]}],
    extra:[{'@type':'Review',author:{'@type':'Person',name:'Sana'},reviewBody:quote,inLanguage:'en'}]
  });
  const faq=find(g,'FAQPage')[0];
  assert.equal(faq.name,'Questions and answers');
  assert.equal(faq.mainEntity[0].name,'Can you adapt my itinerary?');
  assert.equal(faq.mainEntity[0].acceptedAnswer.text,answer);
  assert.equal(find(g,'Review')[0].reviewBody,quote);
  assert.equal(find(g,'AggregateRating').length,0);
  const crumbs=find(g,'BreadcrumbList')[0];
  assert.deepEqual(crumbs.itemListElement.map(item=>item.name),['Home','Reviews']);
});

test('English person uses verified overlays, while original source identifiers and addresses are preserved',()=>{
  const g=graph(person.path);
  const founder=byId(g,root+'team/anna-avanesova/#person');
  assert.equal(founder.name,'Anna Avanesova');
  assert.equal(founder.jobTitle,'Founder and CEO');
  assert.ok(founder.sameAs.includes('https://example.com/verified-anna'));
  assert.equal(find(g,'Organization')[0].taxID,organization.cnpj);
  assert.equal(find(g,'Organization')[0].url,root);
});

test('Unapproved Russian descriptive fields are omitted, never mechanically transliterated',()=>{
  const unresolved=row('destination','destination_unknown','/brazil/place/unknown/',{
    name:'Неизвестное место',summary:'Нет утвержденного английского описания',countryId:'country_brazil'
  });
  const g=graph(unresolved.path,{records:[brazil,unresolved]});
  const place=byId(g,root+'brazil/place/unknown/#place');
  assert.ok(place);
  assert.equal(place.name,undefined);
  assert.equal(place.description,undefined);
  assert.equal(place.identifier,'destination_unknown');
  assert.equal(place.containedInPlace['@id'],root+'brazil/#country');
});
test('Noindex EN renders its Schema graph; the closed private pilot still suppresses JSON-LD',()=>{
  const layout=readFileSync(new URL('../../src/layouts/BaseLayout.astro',import.meta.url),'utf8');
  assert.match(layout,/const schema = privatePreview\s*\?/u);
  assert.match(layout,/graph:\s*null/u);
  assert.match(layout,/lang: sharedEnglishContent \? 'en' : lang/u);
  assert.match(layout,/!privatePreview\s*&&\s*schema\.graph\s*&&\s*<script type="application\/ld\+json"/u);
  assert.match(layout,/\(isPreview \|\| noindex\)/u);
});
