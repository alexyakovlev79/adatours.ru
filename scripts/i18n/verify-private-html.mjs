#!/usr/bin/env node
/** Verify working offline-only EN Astro pages; fail on Russian leakage, bad links or accidental publication. */
import fs from 'node:fs';
import path from 'node:path';
import {parse} from 'parse5';
import {PILOT_TOURS,pilotCatalogUrl,pilotTourUrl,formatPilotPrice} from '../../src/lib/i18n/pilot-html.mjs';
import {privatePilotRouteIndex,privateRouteForId} from '../../src/lib/i18n/locale-entity-routes.mjs';
const root=path.resolve(process.argv[2]||'dist');
const fail=s=>{throw Error('EN HTML pilot: '+s)};
const get=p=>fs.readFileSync(path.join(root,p),'utf8');
const find=(n,p)=>{const out=[];const walk=x=>{if(p(x))out.push(x);for(const c of x.childNodes||[])walk(c)};walk(n);return out};
const tags=(doc,name)=>find(doc,x=>x.tagName===name);
const attr=(node,key)=>node?.attrs?.find(x=>x.name===key)?.value??null;
const textOf=n=>{const walk=x=>x.nodeName==='#text'?x.value:(['script','style','template'].includes(x.tagName))?'':(x.childNodes||[]).map(walk).join(' ');
return walk(n).replace(/\s+/g,' ').trim()};
const forbidden=/[\u0400-\u052f]/u;
const manifest=JSON.parse(fs.readFileSync('data/i18n/pilot-excursions/v1/manifest.json','utf8'));
if(manifest.count!==11||manifest.entries?.length!==11||manifest.publicationAuthorized!==false)
  fail('Missing private eleven-Excursion source manifest');
const excursionPath=slug=>'/en-pilot-private/excursion/'+slug+'/';
const geoManifest=JSON.parse(fs.readFileSync('data/i18n/pilot-geography/v1/manifest.json','utf8'));
if(geoManifest.items?.length!==7||geoManifest.publicationAuthorized!==false)
 fail('Missing seven-record source-bound geography manifest');
const geoUrl=item=>'/en-pilot-private/'+(item.kind==='country'?'country':'place')+'/'+item.slug+'/';
const geoRoutes=geoManifest.items.map(geoUrl);
if(privatePilotRouteIndex.size!==21||
   geoManifest.items.some(x=>privateRouteForId(x.id)!==geoUrl(x))||
   manifest.entries.some(x=>privateRouteForId(x.id)!==excursionPath(x.slug))||
   PILOT_TOURS.some(x=>privateRouteForId(x.id)!==pilotTourUrl(x.slug)))
 fail('English route index disagrees with source manifests');
const countryIdByTour={tour_brazil_rio_four_days:'country_brazil',
 tour_chile_easter_island_3_days_2027:'country_chile',
 tour_colombia_essential_5_days:'country_colombia'};
const geoTourById={country_brazil:'rio-de-janeiro-four-days',
 country_chile:'easter-island-3-days',country_colombia:'colombia-essential-5-days',
 destination_brazil_rio:'rio-de-janeiro-four-days',
 destination_chile_ostrov_pashi:'easter-island-3-days',
 destination_colombia_bogota:'colombia-essential-5-days',
 destination_colombia_kartahena:'colombia-essential-5-days'};
// Representative verified Excursion→Destination references, derived from
// the exact canonical MDs, must be genuine links in the EN body.
const sourceBoundExcursionPlaces={
 excursion_rio_sugarloaf_urca_four_hours:'destination_brazil_rio',
 excursion_easter_island_orongo_rano_kau:'destination_chile_ostrov_pashi',
 excursion_source_siti_tur_v_bogote:'destination_colombia_bogota',
 excursion_source_colombia_bogota_zipaquira_con_guatavita:'destination_colombia_bogota',
 excursion_source_siti_tur_po_kartakhene:'destination_colombia_kartahena'
};
const geoPlacesByTour={
 tour_brazil_rio_four_days:['destination_brazil_rio'],
 tour_chile_easter_island_3_days_2027:['destination_chile_ostrov_pashi'],
 tour_colombia_essential_5_days:['destination_colombia_bogota','destination_colombia_kartahena']
};
const allRoutes=new Set([pilotCatalogUrl(),...PILOT_TOURS.map(x=>pilotTourUrl(x.slug)),
 ...manifest.entries.map(x=>excursionPath(x.slug)),...geoRoutes]);
const cases=[{file:'en-pilot-private/tours/index.html',kind:'catalog'},
 ...PILOT_TOURS.map(x=>({file:'en-pilot-private/tour/'+x.slug+'/index.html',kind:'tour',spec:x})),
 ...manifest.entries.map(x=>({file:'en-pilot-private/excursion/'+x.slug+'/index.html',
  kind:'excursion',spec:x})),
 ...geoManifest.items.map(item=>({file:geoUrl(item).slice(1)+'index.html',kind:'geography',id:item.id}))];
const report=[];
for(const c of cases){
 if(!fs.existsSync(path.join(root,c.file)))fail('Missing page '+c.file);
 const html=get(c.file),dom=parse(html),h=tags(dom,'html')[0],head=tags(dom,'head')[0],main=tags(dom,'main')[0];
 const metas=tags(head,'meta'),links=tags(dom,'a'),imgs=tags(dom,'img'),stylesheets=tags(head,'link').filter(x=>attr(x,'rel')==='stylesheet');
 const robots=metas.find(x=>attr(x,'name')==='robots'),title=textOf(tags(head,'title')[0]);
 if(attr(h,'lang')!=='en'||attr(h,'data-ada-en-pilot')!=='true'||
   attr(h,'data-ada-shell')!=='BaseLayout'||
  attr(h,'data-public-release')!=='false'||!main||!title.includes('Ada Tours')||
  attr(robots,'content')!=='noindex,nofollow,noarchive,nosnippet')
   fail('Missing HTML language/noindex/private gate '+c.file);
 if(tags(head,'link').some(x=>['canonical','alternate'].includes(attr(x,'rel'))))
   fail('Premature public canonical/hreflang '+c.file);
 if(tags(dom,'main').length!==1||tags(dom,'header').length!==1||tags(dom,'footer').length!==1||
   find(main,x=>attr(x,'data-ada-preview-form')==='true').length!==1||
   tags(main,'input').some(x=>attr(x,'disabled')===null)||
   tags(main,'textarea').some(x=>attr(x,'disabled')===null)||
   attr(tags(dom,'header')[0],'data-ada-preview-header')!=='true'||
   attr(tags(dom,'footer')[0],'data-ada-preview-footer')!=='true'||
   tags(dom,'form').length||tags(dom,'script').some(x=>attr(x,'type')==='application/ld+json')||
   /googletagmanager|site-analytics\.js|form-config\.js/.test(html))
   fail('Live lead submission/analytics leaked '+c.file);
 if(forbidden.test(textOf(dom)))fail('Cyrillic visible in English HTML '+c.file);
 for(const a of links){
  const href=attr(a,'href');
  if(href?.startsWith('/en-pilot-private/')&&!allRoutes.has(href))fail('Broken private link '+href);
  if(href?.startsWith('https://adatours.com'))fail('Unapproved public EN URL '+href);
 }
 const tourLinks=links.filter(x=>allRoutes.has(attr(x,'href')));
 if(tourLinks.length<3)fail('Missing internal Tour navigation '+c.file);
 for(const img of imgs){
  const src=attr(img,'src'),alt=attr(img,'alt');
  const decorative=(src==='/brand/adatours-logo-black.svg'||src==='/brand/adatours-logo-white.svg')&&alt===''&&attr(img,'aria-hidden')==='true';
  if((!alt&&!decorative)||forbidden.test(alt))fail('Missing/untranslated image alt '+c.file+' src='+src+' alt='+JSON.stringify(alt));
  if(!decorative&&src!=='/brand/adatours-logo-black.svg'&&!src?.startsWith('https://img.adatours.ru/media/'))
   fail('Image is not a shared CDN asset or official logo: '+src);
 }
 if(!stylesheets.length)fail('Astro stylesheet missing '+c.file);
 for(const css of stylesheets){
  const href=attr(css,'href');
  if(!href?.startsWith('/_astro/')||!fs.existsSync(path.join(root,href.slice(1))))
   fail('Missing local Astro stylesheet '+href);
 }
 const text=textOf(main),mainLinks=tags(main,'a');
 if(c.kind==='tour'){
  const t=c.spec;
  const expectedCountry=geoManifest.items.find(x=>x.id===countryIdByTour[t.id]);
  if(!expectedCountry||!mainLinks.some(x=>attr(x,'href')===geoUrl(expectedCountry)))
   fail('Tour lacks its source-bound country link '+c.file);
  const expectedPlaces=geoPlacesByTour[t.id]??[];
  if(expectedPlaces.length===0||expectedPlaces.some(id=>!mainLinks.some(x=>attr(x,'href')===privateRouteForId(id)))||
     Number(attr(find(main,x=>attr(x,'data-pilot-tour-destinations')!==null)[0],'data-pilot-tour-destinations'))!==expectedPlaces.length)
   fail('Tour lacks its source-bound Destination links '+c.file);
  if(!text.includes(formatPilotPrice(t.price))||!tags(main,'h1').length||!tags(main,'h2').length||
   !tags(main,'table').length||
   !find(main,x=>attr(x,'data-ada-i18n-pricing')==='en').length||
   !find(main,x=>attr(x,'data-ada-i18n-itinerary')==='en').length||
   !find(main,x=>(attr(x,'class')||'').split(' ').includes('hero')).length||
   !tags(main,'h2').some(x=>textOf(x)==='Included')||
    !find(main,x=>attr(x,'data-ada-i18n-services')==='en').length||
   !text.includes('Not included')||
   !links.some(x=>attr(x,'href')?.startsWith('mailto:adatours@adatours.com?subject=')))
    fail('Tour HTML missing required semantic/price/services/contact elements: '+c.file);
  const dependencies=find(main,x=>attr(x,'data-pilot-linked-excursions')!==null)[0];
  if(Number(attr(dependencies,'data-pilot-linked-excursions'))!==t.pendingExcursions)
   fail('Unaccounted EN Excursion dependencies '+c.file);
  const linked=links.filter(x=>attr(x,'data-private-excursion-link')!==null);
  if(new Set(linked.map(x=>attr(x,'data-private-excursion-link'))).size!==t.pendingExcursions||
     linked.some(x=>!allRoutes.has(attr(x,'href'))))
   fail('Missing or duplicate source-bound EN excursion link '+c.file);
  const days=find(main,x=>attr(x,'data-pilot-day')!==null).map(x=>Number(attr(x,'data-pilot-day')));
  if(JSON.stringify(days)!==JSON.stringify(Array.from({length:t.days},(_,i)=>i+1)))
   fail('Day sequence wrong '+c.file+': '+days.join(','));
  if(imgs.filter(x=>attr(x,'src')?.includes('/media/')).length<t.days+1)
   fail('Hero or itinerary image missing '+c.file);
 }else if(c.kind==='excursion'){
  const t=c.spec,source=find(main,x=>attr(x,'data-pilot-excursion')!==null);
  const placeId=sourceBoundExcursionPlaces[t.id];
  if(placeId){
    const found=find(main,x=>attr(x,'data-pilot-excursion-destinations')!==null)[0];
    if(!found||!tags(found,'a').some(x=>attr(x,'href')===privateRouteForId(placeId)))
     fail('Missing source-bound EN Excursion→Destination link '+c.file);
  }
  if(source.length!==1||attr(source[0],'data-pilot-excursion')!==t.id||
    tags(main,'h1').length!==1||!tags(main,'h2').length||
    !find(main,x=>(attr(x,'class')||'').split(' ').includes('hero')).length||
    (t.id!=='excursion_easter_island_orongo_rano_kau'&&
       !find(main,x=>attr(x,'data-ada-i18n-services')==='en').length)||
    !links.some(x=>attr(x,'href')===pilotCatalogUrl())||
    !PILOT_TOURS.some(tour=>links.some(x=>attr(x,'href')===pilotTourUrl(tour.slug)))||
    text.length<160)
   fail('Standalone EN Excursion incomplete '+c.file);
 }else if(c.kind==='geography'){
  const geo=find(main,x=>attr(x,'data-pilot-geography')!==null);
  if(geo.length!==1||attr(geo[0],'data-pilot-geography')!==c.id||
     !find(main,x=>(attr(x,'class')||'').split(' ').includes('hero')).length||
     !tags(main,'h1').length||!tags(main,'h2').length||
     !mainLinks.some(x=>attr(x,'href')===pilotTourUrl(geoTourById[c.id]))||
     !geoRoutes.some(url=>mainLinks.some(x=>attr(x,'href')===url))) {
    fail('Missing connected private geography layout '+c.file);
  }
 }else{
  if(!text.includes('Discover the programmes')||
   attr(find(main,x=>attr(x,'data-pilot-geography-count')!==null)[0],'data-pilot-geography-count')!=='7'||
   !geoRoutes.every(url=>links.some(x=>attr(x,'href')===url))||
   attr(find(main,x=>attr(x,'data-pilot-tour-count')!==null)[0],'data-pilot-tour-count')!=='3'||
   attr(find(main,x=>attr(x,'data-pilot-excursion-count')!==null)[0],'data-pilot-excursion-count')!=='11'||
   !manifest.entries.every(e=>links.some(x=>attr(x,'href')===excursionPath(e.slug))))
   fail('Expected three Tours plus eleven Excursions in EN catalogue '+c.file);
 }
 report.push({file:c.file,title,kind:c.kind,images:imgs.length,stylesheets:stylesheets.length,bytes:Buffer.byteLength(html)});
}
for(const f of fs.readdirSync(root).filter(x=>/^sitemap.*\.xml$/i.test(x))){
 if(get(f).includes('en-pilot-private'))fail('Private preview is in sitemap '+f);
}
if(!fs.existsSync(path.join(root,'brand/adatours-logo-black.svg')))fail('Brand logo missing');
console.log(JSON.stringify({status:'passed',htmlPages:22,tourPages:3,excursionPages:11,geographyPages:7,noindex:true,
 noPublicHost:true,noPublicEnRelease:true,report}));
