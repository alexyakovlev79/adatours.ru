/**
 * The opening Markdown H2 can be a section title, not the tour's intro title.
 * Keep commercial section headings with the text/table they describe.
 */
const serviceOpeningPattern = /^(?:стоимост|цен(?:а|ы|у|е|ой)(?:\s|$|[,.:;–—(])|тариф|прайс|оплат|расход|дополнительн(?:ые|ая)\s+(?:расходы|услуги|опции|экскурсии)|размещени|варианты\s+размещения|проживани|отел|услови|бронирова|порядок\s+(?:оплаты|бронирования)|включен|не\s+включен|что\s+(?:включено|входит)|дат(?:а|ы)\s+(?:заездов|тура|путешествия|и\s+цены|вылетов|проведения)|расписани|важно(?:\s|$|!|:)|примечани|полезная\s+информация|практическая\s+информация|документы\s+(?:для|на)|виз(?:а|ы|у|е)(?:\s|$)|перелет|авиаперелет)/iu;

export function isMisplacedTourIntroHeading(title) {
  const clean = String(title ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:nbsp|#160);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return serviceOpeningPattern.test(clean);
}

export function splitTourIntroHtml(html) {
  const source = String(html ?? '');
  const match = source.match(/^(\s*(?:<!--[\s\S]*?-->\s*)*)(<h2\b[^>]*>[\s\S]*?<\/h2>)/i);
  if (!match) {
    return { introHeadingHtml: '<h2>О путешествии</h2>', descriptionHtml: source, relocatedHeading: null };
  }
  const heading = match[2];
  const rawTitle = heading.replace(/^<h2\b[^>]*>/i, '').replace(/<\/h2>$/i, '');
  const rest = source.slice(match[0].length);
  if (!isMisplacedTourIntroHeading(rawTitle)) {
    return { introHeadingHtml: heading, descriptionHtml: match[1] + rest, relocatedHeading: null };
  }
  const demotedHeading = heading.replace(/^<h2(?=\s|>)/i, '<h3').replace(/<\/h2>$/i, '</h3>');
  return {
    introHeadingHtml: '<h2>О путешествии</h2>',
    descriptionHtml: match[1] + demotedHeading + rest,
    relocatedHeading: rawTitle.replace(/<[^>]*>/g, '').trim(),
  };
}
