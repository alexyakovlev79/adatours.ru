import {routeDirectionArrows} from '../lib/geo-map-direction.mjs';
import {fitGeoCamera} from '../lib/geo-map-camera.mjs';

// One static sequence is shared by Google and Yandex; no Directions API requests.
export async function renderGoogleMap(
  canvas, data, key, mapId, onSelect, loadScript, createPin, locale='ru', createArrow,
) {
  const url = 'https://maps.googleapis.com/maps/api/js?key=' +
    encodeURIComponent(key) + '&v=weekly&loading=async&libraries=maps,marker&language=' +
    (locale === 'ru' ? 'ru' : 'en');
  await loadScript('google-maps-js', url);
  const google = window.google;
  if (!google?.maps?.importLibrary) throw new Error('Google Maps API did not initialize');

  const {Map} = await google.maps.importLibrary('maps');
  const routeCoordinates = data.route?.length ? data.route : data.points.map(p=>p.coordinates);
  const camera = fitGeoCamera(routeCoordinates, {
    width:canvas.clientWidth, height:canvas.clientHeight, pointZoom:data.zoom,
  }) || {center:data.center,zoom:data.zoom};
  const map = new Map(canvas, {
    center: {lat:camera.center[1],lng:camera.center[0]}, zoom:camera.zoom,
    ...(mapId ? {mapId} : {}),
    disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy',
    clickableIcons: false,
    styles: mapId ? undefined : [{featureType:'poi.business',stylers:[{visibility:'off'}]}],
  });

  if (data.route?.length > 1) {
    const path = data.route.map(([lng,lat]) => ({lat,lng}));
    for (const stroke of [
      {color:'#FFFCF8', weight:9}, {color:'#A87518', weight:4.5},
    ]) {
      new google.maps.Polyline({
        path, map, geodesic:false, strokeColor:stroke.color,
        strokeWeight:stroke.weight, strokeOpacity:1, clickable:false,
      });
    }
  }

  let AdvancedMarkerElement = null;
  if (mapId) ({AdvancedMarkerElement} = await google.maps.importLibrary('marker'));

  if (data.route?.length > 1) {
    const arrows = routeDirectionArrows(data.route, {zoom:camera.zoom});
    for (const arrow of arrows) {
      const position = {lat:arrow.coordinates[1],lng:arrow.coordinates[0]};
      if (AdvancedMarkerElement && typeof createArrow === 'function') {
        new AdvancedMarkerElement({
          map, position, content:createArrow(arrow.angle), zIndex:40,
        });
      } else {
        new google.maps.Marker({
          map, position, zIndex:40, clickable:false,
          icon:{
            path:'M -12,-4 L 7,0 L -12,4 L -8,0 Z',
            rotation:arrow.angle, scale:1.2,
            fillColor:'#A87518', fillOpacity:1,
            strokeColor:'#FFFCF8', strokeWeight:2,
          },
        });
      }
    }
  }

  for (const point of data.points) {
    const position = {lat:point.coordinates[1],lng:point.coordinates[0]};
    if (AdvancedMarkerElement) {
      const pin = createPin(point, onSelect);
      new AdvancedMarkerElement({map, position, content:pin, title:point.name, zIndex:100});
    } else {
      const marker = new google.maps.Marker({
        map, position, title:point.name, zIndex:100,
        label: {text:String(point.position),color:'#1A1A1A',fontWeight:'700'},
        icon: {path:google.maps.SymbolPath.CIRCLE,scale:18,
          fillColor:'#F2CC67',fillOpacity:1,strokeColor:'#1A1A1A',strokeWeight:1.5},
      });
      marker.addListener('click', () => onSelect(point));
    }
  }
  return map;
}
