/** Source-bound repairs for individual missing EN Tour titles after saved translations.
 * Match stable ID + the actual canonical title's SHA-256. Do not rewrite a
 * translated field, archivals, shared facts, prices, media or source files.
 */
import {createHash} from 'node:crypto';
import repairs from '../../data/i18n/tour-title-repairs.en.json' with {type:'json'};

const CYRILLIC=/[\u0400-\u052f]/u;
const has=(object,key)=>Object.prototype.hasOwnProperty.call(object??{},key);
const sha256=text=>createHash('sha256').update(text,'utf8').digest('hex');

/** Returns only a literal EN text patch for a still-missing field.
 * Never mutates the caller's source, output or applied-path set.
 */
export function eligibleTourTitleRepair({sourceId,source,alreadyTranslated=false}={}) {
  if(alreadyTranslated||typeof sourceId!=='string'||!source||typeof source!=='object'||
    !['approved','published'].includes(source.status) || source.locale!=='ru')return null;
  if(repairs.schemaVersion!==1 || !has(repairs.entries,sourceId))return null;
  const row=repairs.entries[sourceId];
  if(typeof source.title!=='string'||typeof row.englishTitle!=='string'||
    CYRILLIC.test(row.englishTitle)||!row.englishTitle.trim()||
    !/^[0-9a-f]{64}$/.test(row.sourceTextSha256)||
    sha256(source.title)!==row.sourceTextSha256)return null;
  return {path:'/title',text:row.englishTitle,sourceTextSha256:row.sourceTextSha256};
}
