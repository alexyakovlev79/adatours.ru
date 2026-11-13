/**
 * Stage 9: translate only two contextual UI headings assembled around canonical
 * entity names. The names are already resolved by the source-bound EN loader.
 * Original RU labels, pricing, routes and original entity records are unchanged.
 */
export function excursionEnquiryTitle(name, locale='ru') {
  return locale==='en' ? `Enquire about this excursion: ${name}` : `Заказать экскурсию: ${name}`;
}

export function destinationExcursionsHeading(name, locale='ru') {
  return locale==='en' ? `Excursions: ${name}` : `Экскурсии: ${name}`;
}
