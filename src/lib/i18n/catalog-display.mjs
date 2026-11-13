/** English text presentation for derived catalogue pages.
 * No per-URL translation artifacts: all generated catalogue pages reuse
 * source-bound entity names and one language-specific SEO model.
 */
const cyrillic=/[\u0400-\u052f]/u;
const year=/\s*\(\d{4}[-–]\d{4}\)/gu;
const price=/\s*—\s*(?:prices?\s+)?from\s+(?:US)?\$\s*[\d,. ]+/giu;
const page=/\s*—\s*Page\s+\d+\s*$/iu;
const brand=/\s*\|\s*Ada Tours\s*$/iu;

export function englishCatalogueHeading(seoTitle) {
  return String(seoTitle??'').replace(brand,'').replace(page,'')
    .replace(year,'').replace(price,'').replace(/\s{2,}/gu,' ').trim();
}

export function englishCataloguePresentation({seo,source,variant,introOverride}={}) {
  if (!seo || typeof seo.title!=='string'||typeof seo.description!=='string')
    throw Error('English catalogue requires verified SEO projection');
  const global=variant==='global-tours'||variant==='global-places'||variant==='global-excursions';
  const intro=typeof introOverride==='string'&&introOverride.trim()&&!cyrillic.test(introOverride)
    ?introOverride : global&&!cyrillic.test(source?.intro??'')?source.intro:seo.description;
  const title=global && !cyrillic.test(source?.title??'')
    ?source.title:englishCatalogueHeading(seo.title);
  if(!title||!intro||cyrillic.test(title)||cyrillic.test(intro))
    throw Error('Cyrillic or blank English catalogue presentation');
  return {title,intro,editorial:source?.editorial};
}

/** Stable taxonomy keys only: never infer a destination type from the name. */
const typeNames=Object.freeze({
  city:'City',town:'Town',village:'Village',district:'District',region:'Region',
  island:'Island',national_park:'National park',resort:'Resort',
  natural_area:'Natural area',route_cluster:'Route and surrounding area',
  mountain:'Mountain',volcano:'Volcano',glacier:'Glacier',waterfall:'Waterfall',
  lake:'Lake',river:'River',beach:'Beach',canyon:'Canyon',cave:'Cave',
  desert:'Desert',valley:'Valley',forest:'Forest',wetland:'Wetland',
  archaeological_site:'Archaeological site',historic_site:'Historic site',
  museum:'Museum',monument:'Monument',religious_site:'Religious site',
  viewpoint:'Viewpoint',square:'Square',building:'Building',
  garden:'Garden and park',peninsula:'Peninsula',bay:'Bay',
  attraction:'Attraction',other_landmark:'Landmark',
});
export function catalogueDestinationType(type,locale='ru',russianLabel='') {
  return locale==='en' ? typeNames[type]??'Destination' : russianLabel;
}
export const englishDestinationTypeCount=Object.keys(typeNames).length;

/** Use only verified original-name -> EN-name overlays or curated country UI. */
export function catalogueEntityNames(records=[],countryName=()=>null) {
  const exact=new Map(),conflicts=new Set();
  for(const data of records){
    const original=data?._i18n?.sourceName;
    const translated=data?.name??data?.title;
    if(typeof original!=='string'||typeof translated!=='string'||!original||!translated||
      original===translated||cyrillic.test(translated))continue;
    if(exact.has(original)&&exact.get(original)!==translated)conflicts.add(original);
    else exact.set(original,translated);
  }
  for(const original of conflicts)exact.delete(original);
  return value=>exact.get(value)??countryName(value)??value;
}
