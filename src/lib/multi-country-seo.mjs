/** SEO text for all 2–4-country catalogues; values come from the live matching tours. */
import { seoCountLabel, seoYearRange } from './seo-meta.mjs';
import { seoCountryCase } from './seo-grammar.mjs';
import { formatSeoMoney } from './seo-price-meta.mjs';
import { formatMultiCountryNames } from './multi-country-combinations.mjs';

export function multiCountrySeoMetadata({ countries, tours, destinations = [], date = new Date() }) {
  const nameList = formatMultiCountryNames(countries.map((country) => country.name));
  const genitiveList = formatMultiCountryNames(countries.map((country) => seoCountryCase(country.id, 'genitive')));
  const prices = tours.map((entry) => entry.data ?? entry)
    .filter((tour) => typeof tour.priceFrom === 'number' && Number.isFinite(tour.priceFrom)
      && tour.priceFrom > 0 && /^[A-Z]{3}$/.test(tour.currency ?? ''));
  // Other currencies are not converted to USD. No amount is quoted if the
  // selection has priced tours in incomparable currencies.
  const minUsdPrice = prices.length > 0 && prices.every((tour) => tour.currency === 'USD')
    ? Math.min(...prices.map((tour) => Math.round(tour.priceFrom))) : null;
  const priceLabel = minUsdPrice !== null ? 'от ' + formatSeoMoney(minUsdPrice, 'USD') : '';
  const title = nameList + ': Каталог ' + seoYearRange(date) + ': '
    + seoCountLabel(tours.length, ['тур', 'тура', 'туров'])
    + (priceLabel ? ' и цены ' + priceLabel : '') + ' туроператора Ada Tours';

  // A geographical detail is included only if an actual matching tour links
  // that place in its route. Pick at most one factual place per selected country.
  const placeById = new Map(destinations.map((place) => [place.id, place]));
  const places = [];
  for (const country of countries) {
    let candidate;
    for (const entry of tours) {
      const tour = entry.data ?? entry;
      candidate = (tour.routeDestinations ?? tour.destinations ?? [])
        .map((id) => placeById.get(id))
        .find((place) => place?.countryId === country.id && place.name);
      if (candidate) break;
    }
    if (candidate && !places.includes(candidate.name)) places.push(candidate.name);
  }
  const placeText = places.length ? 'В программах: ' + formatMultiCountryNames(places.slice(0, 3)) + '. ' : '';
  const description = (priceLabel ? 'Цены туров: ' + priceLabel + '. ' : '')
    + 'Достопримечательности ' + genitiveList + '. '
    + placeText + seoCountLabel(tours.length, ['маршрут', 'маршрута', 'маршрутов'])
    + ' с выбранными странами. В отдельных поездках могут быть и другие страны. '
    + 'Даты и отели можно адаптировать.';
  return { title, description, minUsdPrice };
}
