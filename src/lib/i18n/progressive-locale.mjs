/** A staged, all-or-nothing page promotion planner.
 *
 * Russian HTML fallback remains the owner of every incomplete page. An English
 * route is eligible only when each visible text block is source-bound and
 * approved. Shared prices, locations and media are always read from the
 * current canonical RU entry, never copied from a translation snapshot.
 *
 * This module plans content only. It does not emit routes, authorize indexing,
 * publish a domain, or start translation workers.
 */
import { sourceFromContentEntry, localizeContentEntry } from './content-adapter.mjs';
import { assessOverlay } from './content-overlay.mjs';

const KINDS=Object.freeze({countries:'country',destinations:'destination',
 tours:'tour',excursions:'excursion',themes:'theme'});
const ACTIVE=new Set(['approved','published']);
const fail=message=>{throw new TypeError('Progressive EN planner: '+message)};

export async function planProgressiveEnglishCollection(collection, readRecords, resolveApprovedEnglish,
 {dependsOnEnglish=()=>[],readyExternalIds=[]}={}) {
 const kind=KINDS[collection];
 if(!kind)fail('Unsupported collection '+String(collection));
 if(typeof readRecords!=='function'||typeof resolveApprovedEnglish!=='function')
  fail('A canonical collection reader and an approved-English resolver are required');
 if(typeof dependsOnEnglish!=='function')fail('dependsOnEnglish must be a function');
 const rows=await readRecords(collection);
 if(!Array.isArray(rows))fail('Content collection must be an array');
 const sources=rows.filter(entry=>entry?.data?.locale==='ru'&&ACTIVE.has(entry.data.status));
 const decisions=new Map(),eligible=new Map();
 for(const entry of sources){
  const id=entry.data.id;
  if(typeof id!=='string'||!id.trim()||decisions.has(id))fail('Missing or duplicate stable ID');
  const rejected=(status,issueCodes=[])=>decisions.set(id,{id,status,issueCodes});
  const resolved=await resolveApprovedEnglish(id,kind);
  if(resolved==null){rejected('missing');continue}
  if(!resolved.blockMap){rejected('missing_map');continue}
  let source;
  try {source=sourceFromContentEntry(entry,kind,resolved.blockMap)}
  catch(error){
   if(!(error instanceof TypeError))throw error;
   rejected('stale_map',['source_alignment_changed']);continue;
  }
  const assessment=assessOverlay(source,resolved.overlay,{wordSources:resolved.wordSources??{}});
  if(!assessment.readyForAssembly){
   rejected(assessment.status,assessment.issues.map(issue=>issue.code));continue;
  }
  let english;
  try {english=localizeContentEntry(entry,kind,resolved.blockMap,
   resolved.overlay,resolved.wordSources??{})}
  catch(error){
   if(!(error instanceof TypeError))throw error;
   rejected('invalid_translation',['unsafe_english_text']);continue;
  }
  eligible.set(id,english);
  decisions.set(id,{id,status:'ready',issueCodes:[]});
 }
 // Embedded Excursion/other content may only appear in an English page if its
 // owner has also been translated. Re-evaluate until transitive gaps settle.
 const external=new Set(readyExternalIds);
 if([...external].some(id=>typeof id!=='string'||!id.trim()))fail('Invalid approved external ID');
 let changed=true;
 while(changed){
  changed=false;
  const ready=new Set([...external,...eligible.keys()]);
  for(const [id,english] of eligible){
   const deps=dependsOnEnglish(id,english);
   if(!Array.isArray(deps)||deps.some(dep=>typeof dep!=='string'||!dep.trim()))
    fail('Invalid English dependency list for '+id);
   const missing=[...new Set(deps)].filter(dep=>!ready.has(dep));
   if(missing.length){
    eligible.delete(id);
    decisions.set(id,{id,status:'untranslated_dependency',issueCodes:[],
     missingIds:missing});
    changed=true;
   }
  }
 }
 return {
  english:sources.filter(entry=>eligible.has(entry.data.id))
   .map(entry=>eligible.get(entry.data.id)),
  russianFallback:sources.filter(entry=>!eligible.has(entry.data.id)),
  decisions:sources.map(entry=>decisions.get(entry.data.id)),
 };
}
