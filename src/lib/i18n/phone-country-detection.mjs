/** Resolve only a valid ISO-2 country code against the shared telephone list.
 * Never retain the caller's IP from the GeoIP response.
 */
export function findCountryForGeoIp(payload, countries) {
  if (!payload || typeof payload.country !== 'string' ||
      !/^[A-Za-z]{2}$/.test(payload.country) || !Array.isArray(countries)) return null;
  const iso2 = payload.country.toLowerCase();
  return countries.find(country => country.iso2 === iso2) ?? null;
}
