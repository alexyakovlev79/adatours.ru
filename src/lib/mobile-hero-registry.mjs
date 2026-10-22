/** Build once per render process; an unrelated page or replaced source never matches. */
const selectors=new WeakMap();
export function createMobileHeroSelector(registry){
  if(registry&&selectors.has(registry))return selectors.get(registry);
  if(registry?.version!==1||registry.media!=='(max-width: 479px)'||!Array.isArray(registry.items))throw Error('Invalid mobile hero registry');
  const byKey=new Map();
  for(const row of registry.items){
    if(row.status!=='READY')continue;
    const key=JSON.stringify([row.pagePath,row.source,row.profile]);
    if(byKey.has(key))throw Error('Duplicate mobile hero mapping: '+row.pagePath);
    if(!Array.isArray(row.variants)||!row.variants.length)throw Error('Mobile hero without variants');
    byKey.set(key,row);
  }
  const select=({pagePath,source,profile,manualObjectPosition=null})=>{
    const row=byKey.get(JSON.stringify([pagePath,source,profile]));
    return row&&(row.manualObjectPosition??null)===manualObjectPosition?row:undefined;
  };
  selectors.set(registry,select);return select;
}
