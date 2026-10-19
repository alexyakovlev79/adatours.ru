// Yandex Maps JS API 3.0; no paid geocoding or routing requests.
// Stage codes are safe to show in pilot diagnostics: they never contain the API key.
function failure(stage, error) {
  const detail = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  const wrapped = new Error(detail);
  wrapped.mapCode = stage;
  wrapped.name = 'GeoMapProviderError';
  return wrapped;
}

function withDeadline(promise, milliseconds) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('API readiness timed out')), milliseconds);
    }),
  ]).finally(() => clearTimeout(timer));
}

export async function renderYandexMap(canvas, data, key, onSelect, loadScript, createPin, locale='ru') {
  const url = 'https://api-maps.yandex.ru/v3/?apikey=' +
    encodeURIComponent(key) + '&lang=' + (locale==='ru'?'ru_RU':'en_US');
  try {
    await loadScript('yandex-maps-v3', url);
  } catch (error) {
    throw failure('YANDEX_SCRIPT', error);
  }

  const ymaps = window.ymaps3;
  if (!ymaps) throw failure('YANDEX_GLOBAL', 'The JS API script did not define ymaps3');
  try {
    await withDeadline(ymaps.ready, 20000);
  } catch (error) {
    throw failure('YANDEX_READY', error);
  }

  const {YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapFeature, YMapMarker} = ymaps;
  if (![YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapFeature, YMapMarker]
    .every(x => typeof x === 'function')) {
    throw failure('YANDEX_EXPORTS', 'A required Yandex JS API component is unavailable');
  }

  const b = data.bounds;
  const multi = data.points.length > 1 &&
    (Math.abs(b.east - b.west) > 0.00001 || Math.abs(b.north - b.south) > 0.00001);
  const location = multi
    ? {bounds: [[b.west, b.south], [b.east, b.north]]}
    : {center: data.center, zoom: data.zoom};

  let map;
  try {
    // Theme belongs to YMap, not YMapDefaultSchemeLayer.
    map = new YMap(canvas, {location, margin:[60, 60, 60, 60], theme:'light'});
    map.addChild(new YMapDefaultSchemeLayer());
    map.addChild(new YMapDefaultFeaturesLayer());
  } catch (error) {
    throw failure('YANDEX_CREATE', error);
  }

  try {
    if (data.route?.length > 1) map.addChild(new YMapFeature({
      geometry: {type:'LineString', coordinates:data.route},
      style: {stroke:[{width:4, color:'#C89A20'}]},
    }));
  } catch (error) {
    throw failure('YANDEX_ROUTE', error);
  }

  try {
    for (const point of data.points) {
      const marker = createPin(point, onSelect);
      map.addChild(new YMapMarker({coordinates:point.coordinates}, marker));
    }
  } catch (error) {
    throw failure('YANDEX_MARKERS', error);
  }
  return map;
}
