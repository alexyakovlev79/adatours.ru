/** Stable-ID-first locale routing. A caller supplies the exact path of every
 * translated entity; this library does not guess paths from Russian text.
 * The private adapter below uses only sealed pilot manifests. Public EN
 * publishing remains governed by locale-site/build-context release gates.
 */
import {PILOT_TOURS,PILOT_ROOT_PATH} from './pilot-html.mjs';
import excursions from '../../../data/i18n/pilot-excursions/v1/manifest.json' with {type:'json'};
import geography from '../../../data/i18n/pilot-geography/v1/manifest.json' with {type:'json'};

const allowedKinds=new Set(['country','destination','tour','excursion']);
const validId=/^(?:country|destination|tour|excursion)_[a-z0-9_]+$/;
const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const fail=reason=>{throw Error('EN entity route index: '+reason);};

/** Portable RU/EN identity router: paths are explicit, never inferred from ID. */
export function createLocaleEntityRouteIndex(entries,{locale}={}) {
 if(!['ru','en'].includes(locale)||!Array.isArray(entries))fail('Unsupported locale or entries');
 const byId=new Map(),byPath=new Map();
 for(const entry of entries) {
  const {id,kind,path}=entry??{};
  if(typeof id!=='string'||!validId.test(id)||!allowedKinds.has(kind)||
     !id.startsWith(kind+'_'))fail('Bad identity/kind');
  if(typeof path!=='string'||!path.startsWith('/')||path==='/'||!path.endsWith('/')||
     path.includes('//')||/[?#%\\\s\u0000-\u001f\u007f]/.test(path)||
     path.split('/').some(x=>x==='.'||x==='..'))fail('Unsafe path for '+id);
  if(byId.has(id)||byPath.has(path))fail('Duplicate stable ID/path: '+id);
  const item=Object.freeze({id,kind,path,locale});
  byId.set(id,item);byPath.set(path,item);
 }
 return Object.freeze({
  locale,
  size:byId.size,
  pathForId(id){const e=byId.get(id);if(!e)fail('Untranslated or unknown stable ID: '+id);return e.path;},
  findById(id){return byId.get(id)??null;},
  findByPath(path){return byPath.get(path)??null;},
  entries(){return [...byId.values()];}
 });
}

const privatePath=(kind,slug)=>{
 if(!allowedKinds.has(kind)||typeof slug!=='string'||!slugPattern.test(slug))
  fail('Invalid private locale route');
 const segment=kind==='destination'?'place':kind;
 return PILOT_ROOT_PATH+segment+'/'+slug+'/';
};

export function createPrivatePilotRouteIndex({
 tourEntries=PILOT_TOURS,
 excursionManifest=excursions,
 geoManifest=geography
}={}) {
 if(excursionManifest?.publicationAuthorized!==false||
    excursionManifest?.status!=='prepared_for_private_preview'||
    geoManifest?.publicationAuthorized!==false||
    geoManifest?.status!=='prepared_for_private_visual_pilot')
   fail('Publication gate or source manifest missing');
 const enTours=(tourEntries??[]).map(x=>({id:x.id,kind:'tour',path:privatePath('tour',x.slug)}));
 const enExcursions=(excursionManifest.entries??[]).map(x=>({id:x.id,kind:'excursion',path:privatePath('excursion',x.slug)}));
 const enGeography=(geoManifest.items??[]).map(x=>({id:x.id,kind:x.kind,path:privatePath(x.kind,x.slug)}));
 if(enTours.length!==3||enExcursions.length!==11||enGeography.length!==7)
  fail('Expected complete private pilot entity manifests');
 return createLocaleEntityRouteIndex([...enTours,...enExcursions,...enGeography],{locale:'en'});
}

export const privatePilotRouteIndex=createPrivatePilotRouteIndex();
export const privateRouteForId=id=>privatePilotRouteIndex.pathForId(id);
export const privateRouteForRecord=record=>{
 if(record?.locale!=='en'||typeof record.id!=='string')
  fail('Only verified EN record may resolve its preview route');
 return privateRouteForId(record.id);
};
