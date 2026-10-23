/** Build once per render process; an unrelated page or replaced source never matches. */
const selectors=new WeakMap();
export function createMobileHeroSelector(registry){
  if(registry&&selectors.has(registry))return selectors.get(registry);
  if(registry?.version!==1||registry.media!=='(max-width: 479px)'||!Array.isArray(registry.items))throw Error('Invalid mobile hero registry');
  const byKey=new Map(), bySource=new Map();
  for(const row of registry.items){
    if(row.status!=='READY')continue;
    const key=JSON.stringify([row.pagePath,row.source,row.profile]);
    if(byKey.has(key))throw Error('Duplicate mobile hero mapping: '+row.pagePath);
    if(!Array.isArray(row.variants)||!row.variants.length)throw Error('Mobile hero without variants');
    byKey.set(key,row);
    if(row.source && row.sourceSha256){const candidates=bySource.get(row.source)??[];candidates.push(row);bySource.set(row.source,candidates);}
  }
  const select=({pagePath,source,profile,manualObjectPosition=null})=>{
    const row=byKey.get(JSON.stringify([pagePath,source,profile]));
    return row&&(row.manualObjectPosition??null)===manualObjectPosition?row:undefined;
  };
  /** Borrowed tiles can use an existing hero crop for the same unchanged original.
   * Reject source revisions and conflicting focal choices instead of guessing. */
  select.borrowed=({source,preferredProfile='compact'}={})=>{
    const rows=bySource.get(source);
    if(!rows?.length || new Set(rows.map(row=>row.sourceSha256)).size!==1)return undefined;
    for(const profile of [...new Set([preferredProfile,'compact','content-sized','standard','home','photo-lead'])]){
      const candidates=rows.filter(row=>row.profile===profile);
      if(!candidates.length)continue;
      if(new Set(candidates.map(row=>JSON.stringify([row.sourceSha256,row.crop,row.objectPosition,row.manualObjectPosition??null]))).size!==1)continue;
      const chosen=candidates[0];
      const variants=[...chosen.variants].sort((a,b)=>a.width-b.width);
      const preferred=variants.find(v=>v.width>=640)??variants.at(-1);
      if(!preferred?.key || !/^media\/[a-z0-9/_-]+\.webp$/.test(preferred.key) || preferred.key.includes('..'))continue;
      return {src:'/'+preferred.key,position:chosen.objectPosition??'center',narrow:true,profile:chosen.profile,sourceSha256:chosen.sourceSha256};
    }
    return undefined;
  };
  selectors.set(registry,select);return select;
}
