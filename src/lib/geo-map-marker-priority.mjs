import {coordinateKey} from './geo-map-screen-route.mjs';

// Shared Yandex/Google stacking contract. Higher zIndex is always above lower.
export const MAP_MARKER_Z_INDEX = Object.freeze({
  normal: 100,
  finish: 900,
  start: 1000,
});

// Destinations use their existing featured-place priority.
// Tours/excursions use the actual ordered route, including return visits:
// departure marker 1 always wins, final visit is second, others are below.
export function orderedGeoMapMarkers(data) {
  const points = Array.isArray(data?.points) ? data.points : [];
  if (!points.length) return [];

  const primary = points.some(point => point.isPrimary);
  const visits = Array.isArray(data?.route) ? data.route : [];
  const isRoute = !primary && visits.length > 0;
  const departure = isRoute
    ? points.find(point => point.position === 1) ||
      points.find(point => coordinateKey(point.coordinates) === coordinateKey(visits[0])) ||
      points[0]
    : null;
  const arrivalKey = isRoute ? coordinateKey(visits[visits.length - 1]) : null;
  const arrival = isRoute
    ? [...points].reverse().find(point => coordinateKey(point.coordinates) === arrivalKey) ||
      points[points.length - 1]
    : null;

  return points.map((point, index) => ({
    point, index,
    zIndex: point.isPrimary || point === departure
      ? MAP_MARKER_Z_INDEX.start
      : point === arrival
        ? MAP_MARKER_Z_INDEX.finish
        : MAP_MARKER_Z_INDEX.normal,
  })).sort((a, b) => a.zIndex - b.zIndex || a.index - b.index)
    .map(({point, zIndex}) => ({point, zIndex}));
}
