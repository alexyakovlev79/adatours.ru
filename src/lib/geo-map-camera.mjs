// Fit the complete itinerary before creating either provider's map.
// Both Yandex and Google use Web Mercator and 256px world units at zoom 0.
// Bounding calculations are local, with no paid maps/geocoding requests.

const MAX_MERCATOR_LAT = 85.05112878;
const TILE_SIZE = 256;
const radians = Math.PI / 180;

// The same pin dimensions are used by GeoRouteMap.astro on all viewports.
export const MAP_MARKER_DIAMETER = 38;
export const MAP_PRIMARY_MARKER_DIAMETER = 44;
// Leave slightly less than one marker diameter between the closest pin edge
// and the restricting viewport border (room for floating-point rounding).
const EDGE_GAP_RATIO = 0.9;

// Default view moves the geography upward by half a circle on desktop,
// one circle on mobile. The shift never cuts the topmost marker.
export const DESKTOP_UPWARD_SHIFT_PX = MAP_MARKER_DIAMETER / 2;
export const MOBILE_UPWARD_SHIFT_PX = MAP_MARKER_DIAMETER;
const MOBILE_MAP_MAX_WIDTH = 720;
const MIN_TOP_CLEARANCE_PX = 3;

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

// Move the projected points upward while retaining the computed fit/zoom.
// World Y increases southward, so moving the camera center south moves pins up.
// Clamp by the topmost marker's visible edge; do not clip extreme pins.
function shiftCameraUp(centerWorld, pointYs, zoom, width, height, radius) {
  const pixelsPerWorld = TILE_SIZE * 2 ** zoom;
  const target = width <= MOBILE_MAP_MAX_WIDTH
    ? MOBILE_UPWARD_SHIFT_PX : DESKTOP_UPWARD_SHIFT_PX;
  const northernmostGap = height / 2 +
    (Math.min(...pointYs) - centerWorld[1]) * pixelsPerWorld - radius;
  const offsetPixels = Math.min(target, Math.max(0,
    northernmostGap - MIN_TOP_CLEARANCE_PX));
  return worldToGeo([centerWorld[0],
    centerWorld[1] + offsetPixels / pixelsPerWorld]);
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
  width, height, pointZoom = 9, minZoom = 0, maxZoom = 17,
  points = [],
} = {}) {
  const coordinates = (route || []).filter(isCoordinate);
  if (!coordinates.length) return null;
  const viewportWidth = Number.isFinite(width) && width > 0 ? width : 960;
  const viewportHeight = Number.isFinite(height) && height > 0 ? height : 480;
  const radius = (points || []).some(p => p?.isPrimary)
    ? MAP_PRIMARY_MARKER_DIAMETER/2 : MAP_MARKER_DIAMETER/2;
  if (coordinates.length === 1 || coordinates.every(c =>
    Math.abs(c[0] - coordinates[0][0]) < 1e-9 && Math.abs(c[1] - coordinates[0][1]) < 1e-9)) {
    // A single pin has no geographic extent to fit; center it at its
    // destination-type zoom without applying an arbitrary zoom offset.
    const zoom = Math.min(maxZoom, Math.max(minZoom, pointZoom));
    const pointWorld = geoToWorld(coordinates[0]);
    return {center:shiftCameraUp(pointWorld, [pointWorld[1]], zoom,
      viewportWidth, viewportHeight, radius), zoom};
  }

  const world = coordinates.map(geoToWorld);
  const xs = unwrapWorldLongitudes(world.map(p => p[0]));
  const ys = world.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const centerWorld = [(minX + maxX)/2, (minY + maxY)/2];

  // Fit actual circles, not just their point coordinates. The largest marker
  // radius protects the featured destination (44px); every other pin is 38px.
  // For a 38px boundary pin the resulting gap is <= its 38px diameter.
  // The *restricting axis* (height on wide maps, width on narrow ones) gets
  // a gap of roughly one circle on BOTH opposite edges.
  const inset = radius + MAP_MARKER_DIAMETER * EDGE_GAP_RATIO;
  const availableWidth = Math.max(1, viewportWidth - 2*inset);
  const availableHeight = Math.max(1, viewportHeight - 2*inset);
  const dx = Math.max(1e-9, maxX-minX), dy = Math.max(1e-9, maxY-minY);
  const xZoom = Math.log2(availableWidth / (TILE_SIZE * dx));
  const yZoom = Math.log2(availableHeight / (TILE_SIZE * dy));
  // No generic zoom boost or extra arbitrary safety factor: these could
  // respectively clip pins or leave needlessly large empty margins.
  const zoom = Math.min(maxZoom, Math.max(minZoom, Math.min(xZoom,yZoom)));
  return {center:shiftCameraUp(centerWorld,ys,zoom,
    viewportWidth,viewportHeight,radius),zoom};
}
