export interface TourRelationInput {
  countries: readonly string[];
  routeCountries?: readonly string[];
  destinations: readonly string[];
  routeDestinations?: readonly string[];
}

export const mainTourCountryIds = (tour: TourRelationInput): readonly string[] =>
  tour.routeCountries ?? tour.countries;

export const mainTourDestinationIds = (tour: TourRelationInput): readonly string[] =>
  tour.routeDestinations ?? tour.destinations;

export const optionalTourDestinationIds = (tour: TourRelationInput): string[] => {
  const main = new Set(mainTourDestinationIds(tour));
  return [...new Set(tour.destinations)].filter((id) => !main.has(id));
};

export const tourHasMainCountry = (tour: TourRelationInput, countryId: string): boolean =>
  mainTourCountryIds(tour).includes(countryId);

export const tourHasMainDestination = (tour: TourRelationInput, destinationId: string): boolean =>
  mainTourDestinationIds(tour).includes(destinationId);

export const tourHasOptionalDestination = (tour: TourRelationInput, destinationId: string): boolean =>
  optionalTourDestinationIds(tour).includes(destinationId);
