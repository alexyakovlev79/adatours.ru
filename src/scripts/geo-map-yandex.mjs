import {routeDirectionArrows} from '../lib/geo-map-direction.mjs';
import {fitGeoCamera} from '../lib/geo-map-camera.mjs';

// Routes are static schematics: no paid routing/geocoding requests.
const ROUTE_SOURCE = 'adatours-route-lines';
const ROUTE_STYLE = {
  simplificationRate: 0,
  stroke: [
    {width: 9, color: '#FFFCF8'},
    {width: 4.5, color: '#A87518'},
  ],
};

// Never display API keys in an error message or console diagnostics.
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

/**
 * Bind features to the same source as their dedicated YMapDefaultFeaturesLayer.
 * The default marker layer remains separate, so numbered pins continue to work.
 */
export async function renderYandexMap(
  canvas, data, key, onSelect, loadScript, createPin, locale = 'ru', createArrow,
) {
  const url = 'https://api-maps.yandex.ru/v3/?apikey=' +
    encodeURIComponent(key) + '&lang=' + (locale === 'ru' ? 'ru_RU' : 'en_US');
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

  // Compute the initial camera from every geographic point and the actual viewport.
  // Do not rely on provider bounds fitting: it clipped Peru/Argentina on short maps.
  const routeCoordinates = data.route?.length ? data.route : data.points.map(p=>p.coordinates);
  const camera = fitGeoCamera(routeCoordinates, {
    width:canvas.clientWidth, height:canvas.clientHeight, pointZoom:data.zoom,
  });
  const location = camera || {center:data.center,zoom:data.zoom};

  let map;
  try {
    map = new YMap(canvas, {location, theme: 'light'});
    map.addChild(new YMapDefaultSchemeLayer());
    // Ensure our feature source matches the route layer; do not rely on API defaults.
    if (data.route?.length > 1) {
      map.addChild(new YMapDefaultFeaturesLayer({
        source: ROUTE_SOURCE, zIndex: 1650,
      }));
    }
    map.addChild(new YMapDefaultFeaturesLayer({zIndex: 1800}));
  } catch (error) {
    throw failure('YANDEX_CREATE', error);
  }

  try {
    if (data.route?.length > 1) {
      map.addChild(new YMapFeature({
        id: 'adatours-itinerary-route',
        source: ROUTE_SOURCE,
        geometry: {type: 'LineString', coordinates: data.route},
        style: ROUTE_STYLE,
      }));
    }
  } catch (error) {
    throw failure('YANDEX_ROUTE', error);
  }

  try {
    if (typeof createArrow === 'function' && data.route?.length > 1) {
      const arrowPositions = routeDirectionArrows(data.route, {
        zoom:location.zoom,
      });
      for (const {coordinates, angle} of arrowPositions) {
        map.addChild(new YMapMarker({
          coordinates, zIndex: 40, blockEvents: false,
        }, createArrow(angle)));
      }
    }
    for (const point of data.points) {
      const marker = createPin(point, onSelect);
      map.addChild(new YMapMarker({
        coordinates: point.coordinates, zIndex: 100,
      }, marker));
    }
  } catch (error) {
    throw failure('YANDEX_MARKERS', error);
  }
  return map;
}
