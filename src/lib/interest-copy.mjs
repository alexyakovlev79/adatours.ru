import copy from '../data/interest-copy.json' with { type: 'json' };
import enCopy from '../data/i18n/interest-copy.en.json' with { type: 'json' };
import { countInEnglish } from './i18n/messages.mjs';
import { countLabel, pluralIndex } from './interest-model.mjs';

/** Editorial phrases are keyed by stable ID. Counts always come from the current graph. */
export const INTEREST_COPY = Object.freeze(copy);
export function interestCopy(id, locale = 'ru') {
  if (!Object.hasOwn(copy, id)) throw new Error(`Missing visitor copy for interest: ${id}`);
  if (locale === 'en') {
    if (!Object.hasOwn(enCopy.entries, id)) throw new Error(`Missing English visitor copy for interest: ${id}`);
    return enCopy.entries[id];
  }
  return copy[id];
}
export const interestTourCount = (id, count, locale = 'ru') => locale === 'en'
  ? countInEnglish(count, interestCopy(id, 'en').tourForms[0], interestCopy(id, 'en').tourForms[1])
  : countLabel(count, interestCopy(id).tourForms);
export const relatedInterestCount = (count, locale = 'ru') => locale === 'en'
  ? `${countInEnglish(count, 'tour', 'tours')} connect these interests`
  : `${countLabel(count)} ${pluralIndex(count) === 0 ? 'объединяет' : 'объединяют'} эти интересы`;
export function interestCatalogDescription(id, count, countryName, locale = 'ru') {
  return `${countryName ? `${countryName}: ` : ''}${interestTourCount(id, count, locale)}. ${interestCopy(id, locale).catalogIntro}`;
}
