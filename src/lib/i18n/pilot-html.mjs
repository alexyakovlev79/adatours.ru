/** Private, opt-in HTML proof for the three approved Word-first Tour JSON models.
 * This module is deliberately NOT a public EN locale activation mechanism.
 */
const PILOT_ROOT='/en-pilot-private/';
const ids=[
 {id:'tour_brazil_rio_four_days',slug:'rio-de-janeiro-four-days',price:1255,days:4,pendingExcursions:4},
 {id:'tour_chile_easter_island_3_days_2027',slug:'easter-island-3-days',price:1492,days:3,pendingExcursions:3},
 {id:'tour_colombia_essential_5_days',slug:'colombia-essential-5-days',price:1863,days:5,pendingExcursions:4},
];
const forbidden=/[\u0400-\u052F]/u;
export const PILOT_TOURS=Object.freeze(ids.map(x=>Object.freeze({...x})));
export const PILOT_ROOT_PATH=PILOT_ROOT;
export function privatePilotEnabled(env={}){
 return env.EN_PILOT_PREVIEW==='1'&&env.SITE_LOCALE!=='en'&&
        env.PUBLIC_EN_RELEASE!=='1';
}
export function pilotTourUrl(slug){
 if(!PILOT_TOURS.some(x=>x.slug===slug))throw Error('Non-pilot Tour slug');
 return PILOT_ROOT+'tour/'+slug+'/';
}
export function pilotCatalogUrl(){return PILOT_ROOT+'tours/';}
/** Stable dependency IDs only; never load untranslated RU Excursion copy. */
export function pilotExcursionDependencies(itinerary) {
 if(!Array.isArray(itinerary))throw TypeError('Private pilot itinerary must be an array');
 const refs=new Set();
 const add=id=>{
  if(typeof id!=='string'||!/^excursion_[a-z0-9_]+$/.test(id))throw Error('Invalid pilot Excursion stable ID');
  refs.add(id);
 };
 for(const day of itinerary){
  if(day.excursionRef!==undefined)add(day.excursionRef);
  for(const block of day.contentBlocks??[])if(block.type==='excursion')add(block.excursionRef);
 }
 return [...refs];
}
export function escapePilotHtml(value){
 return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function inline(source){
 // Static source text only; no inline links/scripts allowed in the pilot.
 return escapePilotHtml(source).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
}
/** Safe minimal Markdown subset used by the pilot Tour-body data: headings,
 * paragraphs, lists and Word tariff tables. No raw HTML is interpreted.
 */
export function renderPilotMarkdown(markdown){
 if(typeof markdown!=='string')throw TypeError('Pilot Markdown must be a string');
 const lines=markdown.replace(/\r\n?/g,'\n').split('\n');
 const out=[],table=[],paragraph=[],list=[];
 const flushText=()=>{if(paragraph.length){out.push('<p>'+inline(paragraph.join(' '))+'</p>');paragraph.length=0;}};
 const flushList=()=>{if(list.length){out.push('<ul>'+list.map(s=>'<li>'+inline(s)+'</li>').join('')+'</ul>');list.length=0;}};
 const flushTable=()=>{
  if(!table.length)return;
  const rows=table.map(s=>s.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim()))
   .filter(cells=>!cells.every(v=>/^:?-{3,}:?$/.test(v)));
  if(rows.length<2)throw Error('Tour price table malformed');
  const cols=rows[0].length;
  if(rows.some(c=>c.length!==cols))throw Error('Tour price table has irregular columns');
  const head='<thead><tr>'+rows[0].map(x=>'<th scope="col">'+inline(x)+'</th>').join('')+'</tr></thead>';
  const body='<tbody>'+rows.slice(1).map(cells=>'<tr>'+cells.map(x=>'<td>'+inline(x)+'</td>').join('')+'</tr>').join('')+'</tbody>';
  out.push('<div class="pilot-table-scroll"><table>'+head+body+'</table></div>');
  table.length=0;
 };
 for(const raw of lines){
  const s=raw.trim();
  if(s.startsWith('|')){flushText();flushList();table.push(s);continue;}
  flushTable();
  if(!s){flushText();flushList();continue;}
  const h=s.match(/^(#{2,4})\s+(.+)$/);
  if(h){flushText();flushList();const level=h[1].length;out.push('<h'+level+'>'+inline(h[2])+'</h'+level+'>');continue;}
  if(/^[-*]\s+/.test(s)){flushText();list.push(s.replace(/^[-*]\s+/,''));continue;}
  flushList();paragraph.push(s);
 }
 flushTable();flushText();flushList();
 return out.join('\n');
}
export function pilotMediaUrl(path){
 if(typeof path!=='string'||!/^\/media\/[a-zA-Z0-9/_.,+%() -]+\.(?:webp|avif|jpe?g|png)$/i.test(path)||
    path.includes('..')||path.includes('//'))throw Error('Unsafe pilot media path');
 return 'https://img.adatours.ru'+path;
}
export function formatPilotPrice(price,currency='USD'){
 if(currency!=='USD'||!Number.isSafeInteger(price)||price<=0)throw Error('Unsupported pilot price');
 return '$'+new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(price);
}
export function assertPilotRenderSource(records,summary){
 if(summary?.phase!=='approved_nonpublishing_pilot'||summary.publicationAuthorized!==false||
   summary.totalSourceSlots!==172||summary.totalReadyPrevious!==30||
   summary.totalAdditional!==142||summary.failures?.length!==0||
   !Array.isArray(summary.reports)||summary.reports.length!==3)throw Error('Source pilot approval receipt is incomplete');
 if(!Array.isArray(records)||records.length!==3)throw Error('Exactly three Tour previews are required');
 const byId=new Map(records.map(x=>[x?.id,x]));
 if(byId.size!==3)throw Error('Duplicate preview stable IDs');
 for(const spec of PILOT_TOURS){
  const r=byId.get(spec.id),report=summary.reports.find(x=>x.entityId===spec.id),d=r?.data;
  if(!r||r.locale!=='en'||d?.locale!=='en'||d?.id!==spec.id||
    d?.slug!==spec.slug||d?.durationDays!==spec.days||
    d?.priceFrom!==spec.price||d?.currency!=='USD'||!d?.hero?.src||
    typeof d?.title!=='string'||!d.title.trim()||!d.lead?.trim()||
    !Array.isArray(d.itinerary)||d.itinerary.filter(x=>Number.isInteger(x.day)).length!==spec.days||
    !Array.isArray(d.included)||!Array.isArray(d.notIncluded)||
    !r.body?.trim()||!report||report.state!=='ready'||report.issues!==0||
    report.fullCoverage!==true||report.approved!==true||
    (report.alreadyApprovedWordBlocks+report.alreadyApprovedAiBlocks+report.proposedAdditionalBlocks)!==report.sourceVisibleBlocks||
    forbidden.test(JSON.stringify(r)))throw Error('Pilot Tour source or locale text not ready: '+spec.id);
  pilotMediaUrl(d.hero.src);
  if(pilotExcursionDependencies(d.itinerary).length !== spec.pendingExcursions) {
   throw Error('Canonical Excursion dependencies changed for private EN pilot: '+spec.id);
  }
 }
 return true;
}
