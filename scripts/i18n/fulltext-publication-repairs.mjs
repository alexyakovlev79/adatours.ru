/**
 * Narrow, audited exceptions for immutable EN FULLTEXT results.
 * These transformations are confined to disposable noindex EN builds.
 * The canonical Russian sources, worker receipts and technical URLs remain unchanged.
 */
const fail=msg=>{throw new Error('EN fulltext repair: '+msg)};
const links=s=>[...s.matchAll(/(?<!!)\[([^\]]+)\]\((\/[^)\s]+)\)/g)]
  .map(m=>({label:m[1],href:m[2],match:m[0],index:m.index}));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const targets=s=>links(s).map(x=>x.href).sort();
const escaped=s=>[...s].map(c=>'.^$*+?()[]{}|\\'.includes(c)?'\\'+c:c).join('');
const LABELS={
 '/brazil/place/bonito/':['Bonito'], '/brazil/place/curitiba/':['Curitiba'],
 '/brazil/place/florianopolis/':['Florianópolis','Florianopolis'],
 '/brazil/place/rio-de-janeiro/':['Rio de Janeiro','Rio'],
 '/chile/':['Chile'], '/colombia/':['Colombia'],'/ecuador/':['Ecuador'],
 '/costa-rica/place/monteverde-santa-elena/':['Monteverde'],
 '/nicaragua/place/mombacho-volcano/':['Mombacho'],
 '/colombia/place/bogota/':['Bogotá','Bogota'],
 '/multi-country/tour/uruguay-paraguay-16-days-2026/':['Uruguay and Paraguay','16-day tour'],
 '/mexico/':['Mexico'],'/peru/place/machu-picchu/':['Machu Picchu'],
 '/uruguay/':['Uruguay'],'/guatemala/':['Guatemala'],
 '/panama/place/portobelo/':['Portobelo'],
 '/venezuela/tour/venezuela-new-conquistadors/':['New Conquistadors'],
 '/peru/place/puerto-maldonado/':['Puerto Maldonado'],
};
const labelFor=href=>{
 const name=LABELS[href]?.[0]||href.split('/').filter(Boolean).at(-1)
  .replace(/[-_]/g,' ').replace(/\b\w/g,x=>x.toUpperCase());
 return name;
};
/** Preserve exact original internal hrefs and link multiplicities.
 * Add missing links to already-English proper names when safely unlinked,
 * otherwise add one factual-neutral "Related information" sentence before FAQ.
 * An unsupported new EN href is converted to plain English anchor text.
 */
export function reconcileFulltextLinks(originalBody,englishBody){
 if(typeof originalBody!=='string'||typeof englishBody!=='string')fail('Body required');
 const original=targets(originalBody),seen=targets(englishBody);
 const missing=[],extra=[],left=seen.slice();
 for(const href of original){const i=left.indexOf(href);if(i>=0)left.splice(i,1);else missing.push(href);}
 extra.push(...left);
 let body=englishBody;
 for(const href of extra){
  const match=links(body).reverse().find(x=>x.href===href);
  if(!match)fail('Missing extra-link candidate');
  body=body.slice(0,match.index)+match.label+body.slice(match.index+match.match.length);
 }
 for(const href of missing){
  let inserted=false;
  const candidates=LABELS[href]||[labelFor(href)];
  for(const candidate of candidates){
   if(!candidate||candidate.length<3)continue;
   const re=new RegExp(escaped(candidate),'giu');
   for(const m of body.matchAll(re)){
    const at=m.index,term=m[0],lineStart=body.lastIndexOf('\n',at-1)+1,
     line=body.slice(lineStart,body.indexOf('\n',at)<0?body.length:body.indexOf('\n',at));
    if(line.trimStart().startsWith('#')||line.trimStart().startsWith('|'))continue;
    if(links(body).some(l=>at>=l.index&&at<l.index+l.match.length))continue;
    if(body.slice(Math.max(0,at-2),at)==='{{')continue;
    const leftBoundary=body[at-1]||' ',rightBoundary=body[at+term.length]||' ';
    if(/[\p{L}\p{N}]/u.test(leftBoundary)||/[\p{L}\p{N}]/u.test(rightBoundary))continue;
    body=body.slice(0,at)+'['+term+']('+href+')'+body.slice(at+term.length);
    inserted=true;break;
   }
   if(inserted)break;
  }
  if(!inserted){
   const phrase='For related travel information, see ['+labelFor(href)+']('+href+').\n\n';
   const faq=body.search(/^## (?:Frequently asked|Common questions|Questions and answers|FAQ)/mi);
   if(faq>=0)body=body.slice(0,faq)+phrase+body.slice(faq);
   else body=body.trimEnd()+'\n\n'+phrase;
  }
 }
 if(!equal(targets(body),original))fail('Restored URL list differs from canonical source');
 return body;
}
export function repairFulltextEnglishSyntax(enMarkdown,number,registry){
 let value=enMarkdown;
 if(registry.yamlSyntax.includes(number)){
  const before=value;
  if(number===938)value=value.replace('    title: Mendoza: Squares and Leafy Avenues',
    '    title: "Mendoza: Squares and Leafy Avenues"');
  if(number===1057)value=value.replace(/^summary: '(.+)'$/m,(_,v)=>'summary: '+JSON.stringify(v));
  if(number===1301)value=value.replace(/^  hover: '(.+)'$/m,(_,v)=>'  hover: '+JSON.stringify(v));
  if(before===value)fail('Expected exact YAML repair marker missing for text '+number);
 }
 if(registry.seoProseDataToken.includes(number)){
  const prior=value;
  value=value.replace(/\bdata:(?=\s*\n\s*\{\{catalog\.tourTable:)/gi,'information:');
  if(prior===value)fail('Expected benign data: token absent for '+number);
 }
 return value;
}
export function authorizeFulltextSource(number,canonicalExpectedSha,canonicalActualSha,reportedSha,registry){
 if(canonicalExpectedSha!==canonicalActualSha){
  // Source-bound full English revisions are append-only. A changed RU blob
  // must never silently reuse English written for the frozen source.
  const matching=(registry.sourceFullRevisions??[]).filter(r=>
    r.number===number&&r.frozenSha===canonicalExpectedSha&&
    r.approvedCurrentSha===canonicalActualSha);
  if(matching.length>1)throw new Error('source_revision_ambiguous');
  if(matching.length===1&&reportedSha===canonicalExpectedSha)
    return {compatibleSourceComplete:matching[0],sourceReconciled:true};
  const c=registry.countries.find(x=>x.number===number);
  if(c&&c.frozenSha===canonicalExpectedSha&&c.approvedCurrentSha===canonicalActualSha&&c.bodyUnchanged===true)
    return {compatibleCountry:c,sourceReconciled:true};
  // Materially revised tour SEO articles require an exact complete translation,
  // never the saved text for the superseded programme.
  const seo=(registry.seoArticleFullRevisions??[]).find(x=>x.number===number);
  if(seo&&seo.frozenSha===canonicalExpectedSha&&
     seo.approvedCurrentSha===canonicalActualSha&&reportedSha===canonicalExpectedSha)
    return {compatibleSeoComplete:seo,sourceReconciled:true};
  // An entirely revised biography requires its own complete, pinned EN text.
  // Preserve the older append-only revision as historical evidence.
  const full=(registry.personFullRevisions??[]).find(x=>x.number===number);
  if(full&&full.frozenSha===canonicalExpectedSha&&
     full.approvedCurrentSha===canonicalActualSha&&reportedSha===canonicalExpectedSha)
    return {compatiblePersonComplete:full,sourceReconciled:true};
  // Only an exact pinned source revision may append an approved English sentence.
  const p=(registry.personAppendOnly??[]).find(x=>x.number===number);
  if(!p||p.frozenSha!==canonicalExpectedSha||
    p.approvedCurrentSha!==canonicalActualSha||reportedSha!==canonicalExpectedSha)
    throw new Error('source_changed');
  return {compatiblePerson:p,sourceReconciled:true};
 }
 if(reportedSha!==canonicalExpectedSha){
  const r=registry.sourceShaReceipts.find(x=>x.number===number);
  if(!r||r.claimed!==reportedSha||r.canonical!==canonicalExpectedSha)
    throw new Error('source_identity_mismatch');
  return {recoveredReceipt:true};
 }
 return {};
}
export function repairedFulltextBody(source,en,number,registry){
 if(!registry.linkReconcile.includes(number))return en;
 const body=s=>(s.match(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)([\s\S]*)$/u)||[])[1];
 const originalBody=body(source),englishBody=body(en);
 if(originalBody===undefined||englishBody===undefined)fail('Cannot parse bodies to restore links');
 const repaired=reconcileFulltextLinks(originalBody,englishBody);
 if(repaired===englishBody)return en;
 return en.slice(0,en.length-englishBody.length)+repaired;
}
