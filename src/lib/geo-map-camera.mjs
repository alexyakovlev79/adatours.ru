// Fit the complete itinerary before creating either provider's map.
// Both Yandex and Google use Web Mercator and 256px world units at zoom 0.
// Bounding calculations are local, with no paid maps/geocoding requests.

const MAX_MERCATOR_LAT = 85.05112878;
const TILE_SIZE = 256;
const radians = Math.PI / 180;

// Matches approximately two mouse-wheel zoom increments in the Yandex pilot
// (~1.52x apparent scale), without mistaking them for two whole zoom levels.
// Applied by both Yandex and Google and at every responsive viewport size.
export const DEFAULT_INITIAL_ZOOM_BOOST = 0.6;

const clampedLat = lat => Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
const isCoordinate = c => Array.isArray(c) && c.length === 2 &&
  Number.isFinite(c[0]) && Number.isFinite(c[1]) &&
  Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;

export function geoToWorld([longitude, latitude]) {
  const phi = clampedLat(latitude) * radians;
  return [
    (longitude + 180) / 360,
    0.5 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / (2 * Math.PI),
  ];
}

export function worldToGeo([x, y]) {
  const wrappedX = ((x % 1) + 1) % 1;
  return [
    wrappedX * 360 - 180,
    Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) / radians,
  ];
}

// Smallest continuous longitude arc containing every point.
// Also works for itineraries crossing the antimeridian.
function unwrapWorldLongitudes(xs) {
  if (xs.length < 2) return xs;
  const sorted = [...xs].sort((a, b) => a - b);
  let biggestGap = -1, index = 0;
  for (let i = 0; i < sorted.length; i++) {
    const next = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + 1;
    const gap = next - sorted[i];
    if (gap > biggestGap) {biggestGap = gap; index = i;}
  }
  const arcStart = sorted[(index + 1) % sorted.length];
  return xs.map(x => x < arcStart ? x + 1 : x);
}

export function fitGeoCamera(route, {
  width, height, pointZoom = 9, minZoom = 1.2, maxZoom = 17,
  zoomBoost = DEFAULT_INITIAL_ZOOM_BOOST,
} = {}) {
  const coordinates = (route || []).filter(isCoordinate);
  if (!coordinates.length) return null;
  const viewportWidth = Number.isFinite(width) && width > 0 ? width : 960;
  const viewportHeight = Number.isFinite(height) && height > 0 ? height : 480;
  if (coordinates.length === 1 || coordinates.every(c =>
    Math.abs(c[0] - coordinates[0][0]) < 1e-9 && Math.abs(c[1] - coordinates[0][1]) < 1e-9)) {
    return {center:coordinates[0], zoom:Math.min(maxZoom, Math.max(minZoom, pointZoom + zoomBoost))};
  }

  const world = coordinates.map(geoToWorld);
  const xs = unwrapWorldLongitudes(world.map(p => p[0]));
  const ys = world.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const center = worldToGeo([(minX + maxX)/2, (minY + maxY)/2]);

  // In addition to the 38px markers, keep an editorial breathing space at every edge.
  const horizontalInset = viewportWidth < 650 ? 64 : 90;
  const verticalInset = viewportHeight < 500 ? 82 : 94;
  const availableWidth = Math.max(100, viewportWidth - 2*horizontalInset);
  const availableHeight = Math.max(110, viewportHeight - 2*verticalInset);
  const dx = Math.max(1e-9, maxX-minX), dy = Math.max(1e-9, maxY-minY);
  const xZoom = Math.log2(availableWidth / (TILE_SIZE * dx));
  const yZoom = Math.log2(availableHeight / (TILE_SIZE * dy));
  // First find the safe geographic overview, then apply the user-selected
  // closer default view. Deliberately closer framing may crop peripheral pins;
  // the markers, order, pan/zoom and textual point list remain available.
  const fitZoom = Math.min(xZoom,yZoom)-0.45;
  const zoom = Math.min(maxZoom, Math.max(minZoom, fitZoom + zoomBoost));
  return {center,zoom};
}
