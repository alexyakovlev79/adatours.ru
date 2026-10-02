/** Primary place determines the excursion URL; all visited places form links. */
export function excursionDestinationIds(excursion) {
  return [...new Set([excursion.destination, ...(excursion.relatedDestinations ?? [])].filter(Boolean))];
}

export function excursionHasDestination(excursion, destinationId) {
  return excursionDestinationIds(excursion).includes(destinationId);
}
