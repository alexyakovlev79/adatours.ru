/** Resolve a valid ISO-2 code from supported visitor-side GeoIP responses.
 * Do not store or use the IP, city, timezone, ASN or other response details.
 */
export function findCountryForGeoIp(payload, countries) {
  if (!payload || payload.success === false || payload.error ||
      !Array.isArray(countries)) return null;
  const code = payload.country_code ?? payload.countryCode ?? payload.country;
  if (typeof code !== 'string' || !/^[A-Za-z]{2}$/.test(code)) return null;
  return countries.find(country => country.iso2 === code.toLowerCase()) ?? null;
}
