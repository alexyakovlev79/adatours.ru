// Deliberately limited to the three pilot pages until real provider keys are configured.
export const GEO_MAP_PILOTS = new Set([
  'tour_brazil_argentina_peru_14d',
  'destination_brazil_rio',
  'excursion_source_salento_i_dolina_kokora',
]);
export const isGeoMapPilot = id => GEO_MAP_PILOTS.has(id);
