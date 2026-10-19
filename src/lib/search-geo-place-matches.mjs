// Join the existing Pagefind result order to published GEO destination points.
// No search-triggered geocoding, extra lookup APIs, or per-page JSON duplicates.
export function canonicalGeoSearchPath(value) {
  const bare = String(value || '').split(/[?#]/,1)[0]
    .replace(/^https?:\/\/[^/]+/i,'');
  if(!bare.startsWith('/'))return '';
  try{return decodeURIComponent(bare).replace(/\/+$/,'')+'/';}
  catch{return '';}
}

export function indexSearchGeoPlaces(rows) {
  const index=new Map();
  for(const row of rows||[]){
    const path=canonicalGeoSearchPath(row?.url);
    const coords=row?.coordinates;
    if(!path || !Array.isArray(coords) || coords.length!==2 ||
       !coords.every(Number.isFinite) || Math.abs(coords[0])>180 ||
       Math.abs(coords[1])>90)continue;
    index.set(path,coords);
  }
  return index;
}

export function searchGeoPoints(results,index) {
  const points=[],seen=new Set();
  for(const data of results||[]){
    const path=canonicalGeoSearchPath(data?.url);
    const coords=index?.get(path);
    if(!coords || seen.has(path))continue;
    seen.add(path);
    points.push({
      id:path,position:points.length+1,
      name:String(data.meta?.title||path),
      description:String(data.meta?.summary||''),
      image:String(data.meta?.image||''),
      coordinates:coords,href:data.url,isSearchResult:true,
    });
  }
  return points;
}
