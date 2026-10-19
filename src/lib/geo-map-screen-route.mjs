// Browser-independent route geometry using actual screen positions of pins.
export const coordinateKey = coordinate => JSON.stringify(coordinate);

function validCoordinate(c) {
  return Array.isArray(c) && c.length === 2 &&
    Number.isFinite(c[0]) && Number.isFinite(c[1]) &&
    Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;
}
function center(rect, viewport) {
  if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top) ||
      !Number.isFinite(rect.width) || !Number.isFinite(rect.height) ||
      rect.width <= 0 || rect.height <= 0) return null;
  return {x:rect.left + rect.width/2 - viewport.left,
          y:rect.top + rect.height/2 - viewport.top};
}
export function screenRouteGeometry(route, markerRects, viewport,
                                    {markerRadius=20, minArrowPixels=80}={}) {
  const segments=[], arrows=[];
  if (!Array.isArray(route) || route.length < 2 || !markerRects || !viewport ||
      !Number.isFinite(viewport.left) || !Number.isFinite(viewport.top))
    return {segments,arrows};
  for(let i=1;i<route.length;i++) {
    const from=route[i-1], to=route[i];
    if (!validCoordinate(from) || !validCoordinate(to)) continue;
    const a=center(markerRects.get(coordinateKey(from)),viewport);
    const b=center(markerRects.get(coordinateKey(to)),viewport);
    if (!a || !b) continue;
    const dx=b.x-a.x, dy=b.y-a.y, length=Math.hypot(dx,dy);
    if (length <= markerRadius*2+2) continue;
    // Avoid connecting repeated world copies across the map.
    if (Math.abs(to[0]-from[0])>180 &&
        Number.isFinite(viewport.width) && length>viewport.width/2) continue;
    const ux=dx/length,uy=dy/length;
    segments.push({
      segment:i,
      x1:a.x+ux*markerRadius,y1:a.y+uy*markerRadius,
      x2:b.x-ux*markerRadius,y2:b.y-uy*markerRadius,
    });
    if (length>=minArrowPixels) arrows.push({
      segment:i,x:a.x+dx*.58,y:a.y+dy*.58,angle:Math.atan2(dy,dx),
    });
  }
  return {segments,arrows};
}
