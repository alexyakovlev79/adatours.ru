// Provider selection belongs to the rendered site language, never source locale.
// Do not silently switch Google to Yandex when the English provider fails.
export function geoMapProvider(locale) {
  return locale === 'en' ? 'google' : 'yandex';
}

export function geoMapProviderOrder(locale) {
  return [geoMapProvider(locale)];
}
