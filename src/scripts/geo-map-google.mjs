// Google Maps JavaScript API: custom HTML advanced markers when a Map ID is configured.
// Standard (legacy) vector pins remain a compatibility fallback without a Map ID.
export async function renderGoogleMap(canvas, data, key, mapId, onSelect, loadScript, createPin, locale='ru') {
  const url = 'https://maps.googleapis.com/maps/api/js?key=' +
    encodeURIComponent(key) + '&v=weekly&loading=async&libraries=maps,marker&language=' + (locale==='ru'?'ru':'en');
  await loadScript('google-maps-js', url);
  const google = window.google;
  if (!google?.maps?.importLibrary) throw new Error('Google Maps API did not initialize');
  const {Map} = await google.maps.importLibrary('maps');
  const map = new Map(canvas, {
    center: {lat:data.center[1], lng:data.center[0]}, zoom:data.zoom,
    ...(mapId ? {mapId} : {}),
    disableDefaultUI:true, zoomControl:true, gestureHandling:'greedy',
    clickableIcons:false,
    styles: mapId ? undefined : [{featureType:'poi.business',stylers:[{visibility:'off'}]}],
  });
  const b = data.bounds;
  const multi = data.points.length > 1 &&
    (Math.abs(b.east - b.west) > 0.00001 || Math.abs(b.north - b.south) > 0.00001);
  if (multi) map.fitBounds({west:b.west,south:b.south,east:b.east,north:b.north}, 55);
  if (data.route?.length > 1) new google.maps.Polyline({
    path: data.route.map(([lng,lat]) => ({lat,lng})), map,
    geodesic:true, strokeColor:'#C89A20', strokeWeight:4, strokeOpacity:0.95,
  });
  let AdvancedMarkerElement = null;
  if (mapId) {
    ({AdvancedMarkerElement} = await google.maps.importLibrary('marker'));
  }
  for (const point of data.points) {
    const position = {lat:point.coordinates[1],lng:point.coordinates[0]};
    if (AdvancedMarkerElement) {
      const pin = createPin(point, onSelect);
      new AdvancedMarkerElement({map, position, content:pin, title:point.name});
    } else {
      const marker = new google.maps.Marker({
        map, position, title:point.name,
        label: {text:String(point.position),color:'#1A1A1A',fontWeight:'700'},
        icon: {path:google.maps.SymbolPath.CIRCLE,scale:18,
          fillColor:'#F2CC67',fillOpacity:1,strokeColor:'#1A1A1A',strokeWeight:1.5},
      });
      marker.addListener('click', () => onSelect(point));
    }
  }
  return map;
}
