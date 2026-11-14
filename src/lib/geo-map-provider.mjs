// Provider selection belongs to the rendered site language, never source locale.
// Do not silently switch Google to Yandex when the English provider fails.
export function geoMapProvider(locale) {
  return locale === 'en' ? 'google' : 'yandex';
}

export function geoMapProviderOrder(locale) {
  return [geoMapProvider(locale)];
}

function validCoordinates(point) {
  const pair = point?.coordinates;
  return Array.isArray(pair) && pair.length === 2 &&
    pair.every(Number.isFinite) && Math.abs(pair[0]) <= 180 &&
    Math.abs(pair[1]) <= 90;
}

// Classic Google Maps iframe URL: a limited, keyless location view.
// Full custom pins and itinerary lines require Maps JavaScript API credentials.
export function googleMapsIframeUrl(point, zoom = 9) {
  if (!validCoordinates(point)) return '';
  const [lng, lat] = point.coordinates;
  const params = new URLSearchParams({
    q: lat + ',' + lng, hl: 'en',
    z: String(Math.max(1, Math.min(18, Math.round(Number.isFinite(zoom) ? zoom : 9)))),
    output: 'embed',
  });
  return 'https://maps.google.com/maps?' + params.toString();
}

export function googleMapsPlaceUrl(point) {
  if (!validCoordinates(point)) return '';
  const [lng, lat] = point.coordinates;
  return 'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(lat + ',' + lng);
}
