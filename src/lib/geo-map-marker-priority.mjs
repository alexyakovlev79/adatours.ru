import {coordinateKey} from './geo-map-screen-route.mjs';

// Shared Yandex/Google stacking contract. Higher zIndex is always above lower.
export const MAP_MARKER_Z_INDEX = Object.freeze({
  normal: 100,
  finish: 900,
  start: 1000,
});

// Destinations use the numbered recommendation order: position 1 wins,
// and every earlier recommendation is above every later recommendation.
// Tours/excursions keep their different itinerary rule: departure wins,
// actual final visit is second, all intermediate stops remain beneath.
export function orderedGeoMapMarkers(data) {
  const points = Array.isArray(data?.points) ? data.points : [];
  if (!points.length) return [];

  const primary = points.some(point => point.isPrimary);
  // Search matches, like recommendations, keep earlier numbers above later ones.
  const ranked = primary || points.some(point => point.isSearchResult);
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

  return points.map((point, index) => {
    // On Destination maps the positions are assigned by the already-ranked
    // "Куда поехать дальше" list. Larger zIndex and later paint order win.
    // № 7 (994) must cover № 8 (993), never the reverse. There are at most
    // ten recommendations, so these distinct values remain below № 1 (1000).
    const position = Number.isInteger(point.position) && point.position >= 1
      ? point.position : index + 1;
    const zIndex = point.isPrimary || point === departure
      ? MAP_MARKER_Z_INDEX.start
      : ranked
        ? MAP_MARKER_Z_INDEX.start - position + 1
        : point === arrival
          ? MAP_MARKER_Z_INDEX.finish
          : MAP_MARKER_Z_INDEX.normal;
    return {point, index, zIndex};
  }).sort((a, b) => a.zIndex - b.zIndex || a.index - b.index)
    .map(({point, zIndex}) => ({point, zIndex}));
}
