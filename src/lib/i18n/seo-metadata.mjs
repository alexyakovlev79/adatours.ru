/** English SEO projection for the shared, noindex Ada Tours site.
 * RU SEO grammar, canonical entity IDs, commercial facts and media are immutable.
 * This module never translates arbitrary text or derives Russian case forms.
 */
import { seoYearRange } from '../seo-meta.mjs';
import { formatSeoMoney } from '../seo-price-meta.mjs';
import { selectVipTours } from '../vip-tours.mjs';
import { sharedCountryName, sharedInterestName } from './shared-ui-locale.mjs';

const cyrillic = /[\u0400-\u052f]/u;
const dataOf = value => value?.data ?? value;
const valid = row => row && (!row.locale || row.locale === 'ru') && row.status !== 'draft';
const active = row => valid(row) && row.status !== 'archived';
const clean = text => String(text ?? '').replace(/\s+/gu, ' ').trim();
const english = text => !!clean(text) && !cyrillic.test(text);
const titledSlug = slug => String(slug ?? '').replace(/[-_]+/gu, ' ')
  .replace(/\b[a-z]/g, letter => letter.toUpperCase()).trim();
const plural = (count, singular, multiple) => count + ' ' + (count === 1 ? singular : multiple);
const unique = items => [...new Set(items.filter(Boolean))];
const withBrand = value => clean(value).replace(/\s*\|\s*Ada Tours\s*$/iu, '') + ' | Ada Tours';
const pathWithoutPage = path => {
  const match = /^(.*\/)page\/([2-9]\d*)\/$/.exec(path);
  return match ? { root: match[1], page: Number(match[2]) } : { root: path, page: 1 };
};
function safeName(value, fallback='Latin America') {
  const name = clean(value);
  return english(name) ? name : (clean(fallback) || 'Latin America');
}
function shortEnglish(value, fallback, max=200) {
  const copy = clean(value);
  if (!english(copy)) return fallback;
  if (copy.length <= max) return copy;
  const cut = copy.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\s]+$/u, '') + '…';
}
function quotedUsdPrice(data) {
  return Number.isFinite(data?.priceFrom) && data.priceFrom > 0 && data.currency === 'USD'
    ? 'from ' + formatSeoMoney(data.priceFrom, 'USD', 'en') : '';
}
function minimumUsdPrice(rows) {
  const priced = rows.map(dataOf).filter(row => Number.isFinite(row?.priceFrom)
    && row.priceFrom > 0 && /^[A-Z]{3}$/.test(row.currency ?? ''));
  if (!priced.length || priced.some(row => row.currency !== 'USD')) return '';
  return 'from ' + formatSeoMoney(Math.min(...priced.map(row => row.priceFrom)), 'USD', 'en');
}
const mainCountries = data => unique(data.routeCountries ?? data.countries ?? []);
const mainPlaces = data => unique(data.routeDestinations ?? data.destinations ?? []);
const themesOf = data => unique([...(data.primaryThemes ?? []), ...(data.themes ?? [])]);
const referencesExcursion = (tour, id) =>
  (tour.itinerary ?? []).some(day => day.excursionRef === id ||
    (day.contentBlocks ?? []).some(block => block.excursionRef === id))
  || (tour.contentBlocks ?? []).some(block => block.excursionRef === id);

const staticRoutes = {
  '/about/': ['About Ada Tours', 'Meet Ada Tours and learn about our travel services and experience in Latin America.'],
  '/team/': ['The Ada Tours team', 'Meet the people behind Ada Tours journeys and travel planning.'],
  '/cases/': ['Ada Tours travel case studies', 'Explore case studies and travel programmes organised by Ada Tours.'],
  '/reviews/': ['Traveller reviews of Ada Tours', 'Read traveller reviews and experiences with Ada Tours.'],
  '/contacts/': ['Contact Ada Tours', 'Contact Ada Tours about private journeys, group travel and travel planning.'],
  '/dmc/': ['DMC services in Latin America', 'Explore ground handling and destination management services from Ada Tours.'],
  '/dmc/travel-agencies/': ['Ada Tours for travel agencies', 'Ground handling and destination services for travel agency partners in Latin America.'],
  '/dmc/terms/': ['DMC partnership terms', 'Learn about Ada Tours terms for travel agency and tour operator partners.'],
  '/mice/': ['MICE and corporate travel in Latin America', 'Meetings, incentives and business travel programmes from Ada Tours.'],
  '/mice/business-delegations/': ['Business delegations in Latin America', 'Travel and ground arrangements for business delegations with Ada Tours.'],
  '/mice/programmes/': ['MICE programme examples', 'Explore examples of corporate travel programmes in Latin America.'],
  '/press/': ['Ada Tours in the press', 'News, media coverage and publications featuring Ada Tours.'],
  '/webinars/': ['Ada Tours webinars', 'Webinars and educational events from Ada Tours.'],
  '/partners/': ['Ada Tours partners', 'Partnerships and professional connections of Ada Tours.'],
  '/privacy/': ['Privacy policy | Ada Tours', 'Read the Ada Tours privacy policy and information on personal data.'],
  '/personal-data/': ['Personal data processing | Ada Tours', 'Information about personal data processing at Ada Tours.'],
  '/404/': ['Page not found', 'The requested Ada Tours page could not be found. Explore our travel catalogue.'],
};

export function createEnglishSeoContext({ countries=[], destinations=[], tours=[], excursions=[], themes=[], pageSize=30 } = {}) {
  const allCountries = countries.map(dataOf).filter(valid);
  const allDestinations = destinations.map(dataOf).filter(valid);
  const allTours = tours.map(dataOf).filter(valid);
  const allExcursions = excursions.map(dataOf).filter(valid);
  const allThemes = themes.map(dataOf).filter(valid);
  const activeCountries = allCountries.filter(active);
  const activeDestinations = allDestinations.filter(active);
  const activeTours = allTours.filter(active);
  const activeExcursions = allExcursions.filter(active);
  const activeThemes = allThemes.filter(active);
  const countryById = new Map(allCountries.map(country => [country.id, country]));
  const countryBySlug = new Map(allCountries.map(country => [country.slug, country]));
  const destinationById = new Map(allDestinations.map(place => [place.id, place]));
  const themeBySlug = new Map(allThemes.map(theme => [theme.slug, theme]));
  const detailsByPath = new Map();
  const countryName = id => {
    const country = countryById.get(id);
    return country ? sharedCountryName(country.slug, country.name, 'en') : '';
  };
  const nameOf = data => safeName(data.title ?? data.name, titledSlug(data.slug));
  for (const country of allCountries) detailsByPath.set('/'+country.slug+'/', { kind:'country', data:country });
  for (const place of allDestinations) {
    const country = countryById.get(place.countryId);
    if(country) detailsByPath.set('/'+country.slug+'/place/'+place.slug+'/', { kind:'destination', data:place });
  }
  for (const tour of allTours) {
    const ids = mainCountries(tour);
    const country = ids.length === 1 ? countryById.get(ids[0]) : null;
    const prefix = country ? '/'+country.slug+'/tour/' : '/multi-country/tour/';
    detailsByPath.set(prefix+tour.slug+'/', { kind:'tour', data:tour });
  }
  for (const ex of allExcursions) {
    const place = destinationById.get(ex.destination);
    const country = countryById.get(place?.countryId ?? ex.country);
    if(country)detailsByPath.set(place
      ? '/'+country.slug+'/'+place.slug+'/'+ex.slug+'/'
      : '/'+country.slug+'/excursion/'+ex.slug+'/', { kind:'excursion', data:ex });
  }
  for (const theme of allThemes)detailsByPath.set('/interests/'+theme.slug+'/', {kind:'theme',data:theme});
  const vipTours = selectVipTours(tours.filter(entry => active(dataOf(entry)))).entries.map(dataOf);
  return { allCountries,activeCountries,allDestinations,activeDestinations,allTours,activeTours,
    allExcursions,activeExcursions,allThemes,activeThemes, countryById,countryBySlug,
    destinationById,themeBySlug,detailsByPath,vipTours,countryName,nameOf,pageSize };
}

function selectionForPath(path, ctx) {
  const {activeTours:tours,activeDestinations:places,activeExcursions:excursions,
    activeCountries:countries,activeThemes:themes,vipTours,countryBySlug,themeBySlug,
    destinationById,nameOf,countryName} = ctx;
  if(path === '/')return {kind:'home',label:'Latin America',items:tours};
  if(path === '/country/')return {kind:'countries',label:'Latin America',items:countries};
  if(path === '/tours/')return {kind:'tours',label:'Latin America',items:tours};
  if(path === '/places/')return {kind:'places',label:'Latin America',items:places};
  if(path === '/excursions/')return {kind:'excursions',label:'Latin America',items:excursions};
  if(path === '/interests/')return {kind:'interests',label:'Latin America',items:themes};
  if(path === '/vip/')return {kind:'vip',label:'Latin America',items:vipTours};
  if(path === '/multi-country/')return {kind:'multi',label:'Latin America',
    items:tours.filter(tour => mainCountries(tour).length > 1)};
  let m;
  if((m=/^\/interests\/([^/]+)\/(tours|places|excursions|related)(?:\/([^/]+))?\/$/.exec(path))) {
    const theme=themeBySlug.get(m[1]),country=m[3]&&countryBySlug.get(m[3]);
    if(theme && (!m[3]||country)) {
      const matches = tours.filter(tour => themesOf(tour).includes(theme.id) &&
        (!country || (tour.countries??[]).includes(country.id)));
      const label=sharedInterestName(theme.id,theme.name,'en')+
        (country?' in '+countryName(country.id):'');
      if(m[2]==='tours')return {kind:'tours',label,items:matches};
      if(m[2]==='places') {
        const ids=new Set(matches.flatMap(tour=>tour.destinations??[]));
        return {kind:'places',label,items:places.filter(place=>ids.has(place.id)&&
          (place.themes??[]).includes(theme.id))};
      }
      if(m[2]==='excursions') {
        const ids=new Set(matches.flatMap(tour=>(tour.itinerary??[]).flatMap(day=>[
          day.excursionRef,...(day.contentBlocks??[]).map(block=>block.excursionRef)])));
        return {kind:'excursions',label,items:excursions.filter(ex=>ids.has(ex.id)&&
          (ex.themes??[]).includes(theme.id))};
      }
      return {kind:'related',label,items:themes.filter(other=>other.id!==theme.id &&
        matches.some(tour=>themesOf(tour).includes(other.id)))};
    }
  }
  if((m=/^\/vip\/(?:([^/]+)\/)?interests\/([^/]+)\/$/.exec(path))) {
    const country=m[1]?countryBySlug.get(m[1]):null;
    const theme=themeBySlug.get(m[2]);
    if(theme&&(!m[1]||country)){
      return {kind:'vip',
        label:sharedInterestName(theme.id,theme.name,'en')+
          (country?' in '+countryName(country.id):' in Latin America'),
        items:vipTours.filter(tour=>themesOf(tour).includes(theme.id)&&
          (!country||mainCountries(tour).includes(country.id)))};
    }
  }
  if((m=/^\/vip\/([^/]+)\/$/.exec(path))) {
    const country=countryBySlug.get(m[1]);
    if(country)return {kind:'vip',label:countryName(country.id),
      items:vipTours.filter(tour=>mainCountries(tour).includes(country.id))};
  }
  if((m=/^\/multi-country\/interests\/([^/]+)\/$/.exec(path))) {
    const theme=themeBySlug.get(m[1]);
    if(theme)return {kind:'multi',label:sharedInterestName(theme.id,theme.name,'en'),
      items:tours.filter(tour=>mainCountries(tour).length>1&&themesOf(tour).includes(theme.id))};
  }
  if((m=/^\/multi-country\/([a-z0-9_-]+)(?:\/interests\/([^/]+))?\/$/.exec(path))) {
    const slugs=m[1].split('_'),selected=slugs.map(slug=>countryBySlug.get(slug));
    const theme=m[2]?themeBySlug.get(m[2]):null;
    if(slugs.length>=2&&slugs.length<=4&&selected.every(Boolean)&&(!m[2]||theme)) {
      const ids=selected.map(country=>country.id),label=selected.map(country=>countryName(country.id)).join(' + ')
        +(theme?' · '+sharedInterestName(theme.id,theme.name,'en'):'');
      return {kind:'multi',label,items:tours.filter(tour=>ids.every(id=>mainCountries(tour).includes(id)) &&
        (!theme||themesOf(tour).includes(theme.id)))};
    }
  }
  if((m=/^\/([^/]+)\/place\/([^/]+)\/(tour|optional-tours)\/$/.exec(path))) {
    const country=countryBySlug.get(m[1]),place=places.find(p=>p.slug===m[2]&&p.countryId===country?.id);
    if(place)return {kind:'tours',label:nameOf(place)+', '+countryName(country.id),
      items:tours.filter(tour=>m[3]==='tour'
        ? mainPlaces(tour).includes(place.id)
        : !mainPlaces(tour).includes(place.id)&&(tour.destinations??[]).includes(place.id))};
  }
  if((m=/^\/([^/]+)\/(tour|place|excursion)\/$/.exec(path))) {
    const country=countryBySlug.get(m[1]);
    if(country) {
      const items=m[2]==='tour'?tours.filter(tour=>mainCountries(tour).includes(country.id))
        :m[2]==='place'?places.filter(place=>place.countryId===country.id)
        :excursions.filter(ex=>(destinationById.get(ex.destination)?.countryId??ex.country)===country.id);
      return {kind:m[2]==='tour'?'tours':m[2]==='place'?'places':'excursions',
        label:countryName(country.id),items};
    }
  }
  if((m=/^\/([^/]+)\/([^/]+)\/$/.exec(path))) {
    const country=countryBySlug.get(m[1]),place=places.find(p=>p.slug===m[2]&&p.countryId===country?.id);
    if(place)return {kind:'excursions',label:nameOf(place)+', '+countryName(country.id),
      items:excursions.filter(ex=>ex.destination===place.id||(ex.relatedDestinations??[]).includes(place.id))};
  }
  if(path.endsWith('/tour/')) {
    const candidate=ctx.detailsByPath.get(path.slice(0,-'tour/'.length));
    if(candidate?.kind==='excursion')return {kind:'tours',label:nameOf(candidate.data),
      items:tours.filter(tour=>referencesExcursion(tour,candidate.data.id))};
  }
  return null;
}

function detailMetadata(detail,ctx,years) {
  const {kind,data}=detail,name=ctx.nameOf(data);
  if(kind==='country') {
    const placeCount=ctx.activeDestinations.filter(place=>place.countryId===data.id).length;
    const tourCount=ctx.activeTours.filter(tour=>mainCountries(tour).includes(data.id)).length;
    const exCount=ctx.activeExcursions.filter(ex=>(ctx.destinationById.get(ex.destination)?.countryId??ex.country)===data.id).length;
    const country=ctx.countryName(data.id);
    return {title:country+' — '+plural(tourCount,'tour','tours')+' and '+plural(placeCount,'place','places')+' ('+years+')',
      description:'Explore '+country+' with Ada Tours: '+plural(tourCount,'tour','tours')+', '+
        plural(placeCount,'destination','destinations')+' and '+plural(exCount,'excursion','excursions')+'.'};
  }
  if(kind==='destination') {
    const country=ctx.countryName(data.countryId);
    return {title:name+' in '+country+' — tours and experiences ('+years+')',
      description:shortEnglish(data.summary, 'Discover '+name+' in '+country+' and explore travel options with Ada Tours.')};
  }
  if(kind==='tour') {
    const countries=mainCountries(data).map(ctx.countryName).filter(Boolean).join(' + ');
    const duration=Number.isInteger(data.durationDays)&&data.durationDays>0
      ? String(data.durationDays)+'-day ' : '';
    const price=quotedUsdPrice(data);
    return {title:name+' — '+duration+'journey'+(countries?' in '+countries:' in Latin America')+
        (price?' '+price:'')+' ('+years+')',
      description:shortEnglish(data.lead, 'Explore this Ada Tours journey'+(countries?' through '+countries:' in Latin America')+
        (price?', with published prices '+price:'')+'.')};
  }
  if(kind==='excursion') {
    const country=ctx.countryName(ctx.destinationById.get(data.destination)?.countryId??data.country);
    const price=quotedUsdPrice(data);
    return {title:name+' — excursion'+(country?' in '+country:' in Latin America')+(price?' '+price:''),
      description:shortEnglish(data.lead, 'Explore this Ada Tours excursion'+
        (country?' in '+country:' in Latin America')+'.')};
  }
  const theme=sharedInterestName(data.id,data.name,'en');
  const count=ctx.activeTours.filter(tour=>themesOf(tour).includes(data.id)).length;
  return {title:theme+' — '+plural(count,'tour','tours')+' in Latin America ('+years+')',
    description:shortEnglish(data.summary,'Explore '+theme.toLowerCase()+
      ' through '+plural(count,'Ada Tours journey','Ada Tours journeys')+' in Latin America.')};
}

function catalogMetadata(selection,years) {
  const {kind,label,items}=selection,n=items.length,price=
    ['home','tours','vip','multi'].includes(kind)?minimumUsdPrice(items):'';
  switch(kind) {
    case 'home':return {title:'Latin America tours ('+years+') — '+plural(n,'journey','journeys'),
      description:'Explore '+plural(n,'Ada Tours journey','Ada Tours journeys')+
        ' through Latin America. Discover private, group and multi-country itineraries.'};
    case 'countries':return {title:plural(n,'country','countries')+' in Latin America — tours and travel',
      description:'Discover '+plural(n,'Latin American destination','Latin American destinations')+' and plan a trip with Ada Tours.'};
    case 'interests':return {title:'Travel interests in Latin America — '+plural(n,'theme','themes'),
      description:'Explore Latin America by travel interest, from nature and culture to private journeys.'};
    case 'related':return {title:'Related travel interests — '+label,
      description:'Explore travel interests related to '+label+' with Ada Tours.'};
    case 'tours':return {title:plural(n,'tour','tours')+' in '+label+' ('+years+')'+(price?' — prices '+price:''),
      description:'Browse '+plural(n,'Ada Tours itinerary','Ada Tours itineraries')+' in '+label+
        (price?'. Published USD tour prices start '+price:'')+'.'};
    case 'vip':return {title:plural(n,'VIP and luxury tour','VIP and luxury tours')+' in '+label+' ('+years+')'+(price?' — '+price:''),
      description:'Browse '+plural(n,'VIP itinerary','VIP itineraries')+' in '+label+
        '. Compare travel routes and discuss private arrangements with Ada Tours.'};
    case 'multi':return {title:plural(n,'multi-country tour','multi-country tours')+' — '+label+' ('+years+')'+(price?' — '+price:''),
      description:plural(n,'Ada Tours itinerary','Ada Tours itineraries')+' for travelling through '+label+
        '. Compare routes and plan your journey.'};
    case 'places':return {title:plural(n,'place','places')+' to discover — '+label,
      description:'Explore '+plural(n,'destination','destinations')+' in '+label+' with Ada Tours.'};
    case 'excursions':return {title:plural(n,'excursion','excursions')+' in '+label,
      description:'Explore '+plural(n,'Ada Tours excursion','Ada Tours excursions')+' in '+label+'.'};
    default:return null;
  }
}

/** Build exact English metadata, never Russian phrase replacement or source mutation. */
export function englishSeoMetadata({path='/', title='', description='', date=new Date()}={},context) {
  if(!context)throw Error('English SEO context required');
  const cleanPath=path.endsWith('/')?path:path+'/';
  const {root,page}=pathWithoutPage(cleanPath);
  const years=seoYearRange(date);
  const detail=context.detailsByPath.get(root);
  let meta=detail?detailMetadata(detail,context,years):null;
  const selection=detail?null:selectionForPath(root,context);
  if(!meta&&selection)meta=catalogMetadata(selection,years);
  if(!meta) {
    const staticCopy=staticRoutes[root];
    if(staticCopy)meta={title:staticCopy[0],description:staticCopy[1]};
    else {
      const source=safeName(title.replace(/\s*\|\s*Ada Tours.*$/iu,''), '');
      const slug=root.split('/').filter(Boolean).at(-1)??'travel';
      meta={title:source||'Explore '+titledSlug(slug)+' in Latin America',
        description:shortEnglish(description,'Explore Ada Tours travel experiences and services in Latin America.')};
    }
  }
  if(page>1) {
    const total=selection?.items.length;
    const first=(page-1)*context.pageSize+1;
    const last=Number.isInteger(total)?Math.min(page*context.pageSize,total):page*context.pageSize;
    meta.title+=' — Page '+page;
    meta.description+=' Page '+page+(Number.isInteger(total)?
      ': items '+first+'–'+last+' of '+total+'.':'.');
  }
  return {title:withBrand(meta.title),description:clean(meta.description),
    page,sourcePath:cleanPath,canonicalPath:cleanPath};
}

let cachedContext;
/** One content snapshot per EN build; avoid reloading collections on 6,000+ pages. */
export function cachedEnglishSeoContext(load) {
  if (!cachedContext) cachedContext=Promise.resolve().then(load).then(createEnglishSeoContext);
  return cachedContext;
}
