/** Stage 9 exact-source EN fields that did not enter the closed translation swarm.
 * Existing approved/immutable fields always win. Only active Tour records apply.
 */
import {createHash} from 'node:crypto';
import repairs from '../../data/i18n/tour-field-repairs.en.json' with {type:'json'};

const has=(o,k)=>Object.prototype.hasOwnProperty.call(o??{},k);
const Cyrillic=/[\u0400-\u052f]/u;
const hash=text=>createHash('sha256').update(text,'utf8').digest('hex');
const allowed=path=>/^\/(?:lead|priceNote|format|(?:route|included|notIncluded|notes)\/(?:0|[1-9]\d*))$/.test(path);
const at=(source,path)=>path.slice(1).split('/').reduce((node,key)=>node?.[key],source);

/** Read-only candidate finder; malformed or stale source rows never apply. */
export function eligibleTourFieldRepairs({sourceId,source,alreadyTranslated=new Set()}={}){
 if(typeof sourceId!=='string'||!source||source.locale!=='ru'||
   !['published','approved'].includes(source.status)||repairs.schemaVersion!==1||
   !has(repairs.entries,sourceId))return [];
 const row=repairs.entries[sourceId];
 if(!row||!row.fields||typeof row.fields!=='object')return [];
 const reserved=alreadyTranslated instanceof Set?alreadyTranslated:new Set(alreadyTranslated);
 const eligible=[];
 for(const [path,v] of Object.entries(row.fields)){
  if(!allowed(path)||reserved.has(path)||!v||
    typeof v.sourceText!=='string'||!v.sourceText.trim()||
    typeof v.englishText!=='string'||!v.englishText.trim()||Cyrillic.test(v.englishText)||
    at(source,path)!==v.sourceText)continue;
  eligible.push({path,text:v.englishText,sourceTextSha256:hash(v.sourceText)});
 }
 return eligible;
}
