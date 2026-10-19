import {geoToWorld, worldToGeo} from './geo-map-camera.mjs';

// The itinerary remains a schematic: arrow placement never queries roads.
// The chosen bearing matches the north-up Web Mercator screen geometry.
function projectedLeg(from, to) {
  const a = geoToWorld(from);
  const b = geoToWorld(to);
  if (b[0] - a[0] > 0.5) b[0] -= 1;
  if (b[0] - a[0] < -0.5) b[0] += 1;
  return {a, dx:b[0]-a[0], dy:b[1]-a[1]};
}

function valid(value) {
  return Array.isArray(value) && value.length === 2 &&
    Number.isFinite(value[0]) && Number.isFinite(value[1]) &&
    Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
}

export function routeDirectionArrows(route, {zoom, minPixels=50} = {}) {
  if (!Array.isArray(route) || route.length < 2) return [];
  const result=[];
  for (let i=1;i<route.length;i++) {
    if (!valid(route[i-1]) || !valid(route[i])) continue;
    const {a,dx,dy}=projectedLeg(route[i-1],route[i]);
    if (Math.hypot(dx,dy) < 1e-9) continue;
    if (Number.isFinite(zoom) && Math.hypot(dx,dy)*256*2**zoom < minPixels)
      continue;
    result.push({
      segment:i,
      coordinates:worldToGeo([a[0]+dx*.55,a[1]+dy*.55]),
      angle:Math.atan2(dy,dx)*180/Math.PI,
    });
  }
  return result;
}
