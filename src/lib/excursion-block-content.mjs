/** A tour may describe its confirmed variant of an existing canonical excursion.
 * Values remain plain text; UI consumers must use escaped text rendering.
 * Canonical HTML, prices and other product fields are never overridden here.
 */
export function excursionBlockContent(block = {}, excursion = {}) {
  const title = typeof block.title === 'string' && block.title.trim()
    ? block.title.trim() : excursion.title ?? '';
  const overrideText = typeof block.text === 'string' && block.text.trim()
    ? block.text : null;
  return { title, overrideText, summary: overrideText ?? excursion.lead ?? '' };
}
