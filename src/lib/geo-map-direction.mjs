import {geoToWorld, worldToGeo} from './geo-map-camera.mjs';

// Draw each visit-to-visit leg independently; never connect opposite sides
// of the 180th meridian with a line through an unrelated hemisphere.
function valid(value) {
  return Array.isArray(value) && value.length === 2 &&
    Number.isFinite(value[0]) && Number.isFinite(value[1]) &&
    Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
}

function projectedLeg(from, to) {
  const a = geoToWorld(from);
  const b = geoToWorld(to);
  if (b[0] - a[0] > 0.5) b[0] -= 1;
  if (b[0] - a[0] < -0.5) b[0] += 1;
  return {a, dx:b[0]-a[0], dy:b[1]-a[1]};
}

// The split uses the same Web Mercator interpolation as the camera/arrows.
// Each returned two-point line is geographically local and cannot wrap
// across the map through the long side of the world.
export function routeLegs(route) {
  if (!Array.isArray(route) || route.length < 2) return [];
  const legs = [];
  for (let i=1; i<route.length; i++) {
    const from = route[i-1], to = route[i];
    if (!valid(from) || !valid(to)) continue;
    const {a, dx, dy} = projectedLeg(from, to);
    if (Math.hypot(dx, dy) < 1e-9) continue;
    if (Math.abs(to[0]-from[0]) <= 180) {
      legs.push({segment:i, coordinates:[from, to]});
      continue;
    }
    const crossing = dx > 0 ? 180 : -180;
    const fraction = (crossing-from[0]) / (dx*360);
    const lat = worldToGeo([0.5, a[1]+dy*fraction])[1];
    legs.push({segment:i, coordinates:[from, [crossing,lat]]});
    legs.push({segment:i, coordinates:[[-crossing,lat], to]});
  }
  return legs;
}

// Small direction heads sit on the line. Short hops are intentionally blank,
// so clustered cities or neighboring landmarks do not fill with arrows.
export function routeDirectionArrows(route, {zoom, minPixels=80} = {}) {
  if (!Array.isArray(route) || route.length < 2) return [];
  const result = [];
  for (let i=1; i<route.length; i++) {
    if (!valid(route[i-1]) || !valid(route[i])) continue;
    const {a, dx, dy} = projectedLeg(route[i-1], route[i]);
    if (Math.hypot(dx,dy) < 1e-9) continue;
    if (Number.isFinite(zoom) && Math.hypot(dx,dy)*256*2**zoom < minPixels)
      continue;
    result.push({
      segment:i,
      coordinates:worldToGeo([a[0]+dx*.58,a[1]+dy*.58]),
      angle:Math.atan2(dy,dx)*180/Math.PI,
    });
  }
  return result;
}
