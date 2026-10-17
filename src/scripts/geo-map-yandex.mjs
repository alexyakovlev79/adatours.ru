// Yandex Maps JS API 3.0; no geocoder/routing/extra billable API calls.
export async function renderYandexMap(canvas, data, key, onSelect, loadScript, createPin, locale='ru') {
  const url = 'https://api-maps.yandex.ru/v3/?apikey=' +
    encodeURIComponent(key) + '&lang=' + (locale==='ru'?'ru_RU':'en_US');
  await loadScript('yandex-maps-v3', url);
  const ymaps = window.ymaps3;
  if (!ymaps) throw new Error('Yandex API did not initialize');
  await ymaps.ready;
  const {YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapFeature, YMapMarker} = ymaps;
  const b = data.bounds;
  const multi = data.points.length > 1 &&
    (Math.abs(b.east - b.west) > 0.00001 || Math.abs(b.north - b.south) > 0.00001);
  const location = multi
    ? {bounds: [[b.west, b.south], [b.east, b.north]]}
    : {center: data.center, zoom: data.zoom};
  const map = new YMap(canvas, {location, margin: [60,60,60,60]}, [
    new YMapDefaultSchemeLayer({theme:'light'}),
    new YMapDefaultFeaturesLayer({}),
  ]);
  if (data.route?.length > 1) map.addChild(new YMapFeature({
    geometry: {type:'LineString', coordinates:data.route},
    style: {stroke:[{width:4, color:'#C89A20'}]},
  }));
  for (const point of data.points) {
    const marker = createPin(point, onSelect);
    map.addChild(new YMapMarker({coordinates:point.coordinates}, marker));
  }
  return map;
}
