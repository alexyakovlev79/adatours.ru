import copy from '../data/interest-copy.json' with { type: 'json' };
import { countLabel, pluralIndex } from './interest-model.mjs';

/** Editorial phrases are keyed by stable ID. Counts always come from the current graph. */
export const INTEREST_COPY = Object.freeze(copy);
export function interestCopy(id) {
  if (!Object.hasOwn(copy, id)) throw new Error(`Missing visitor copy for interest: ${id}`);
  return copy[id];
}
export const interestTourCount = (id, count) => countLabel(count, interestCopy(id).tourForms);
export const relatedInterestCount = (count) => `${countLabel(count)} ${pluralIndex(count) === 0 ? 'объединяет' : 'объединяют'} эти интересы`;
export function interestCatalogDescription(id, count, countryName) {
  return `${countryName ? `${countryName}: ` : ''}${interestTourCount(id, count)}. ${interestCopy(id).catalogIntro}`;
}
