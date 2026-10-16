// The single Markdown FAQ convention for SEO/GEO articles is H2 -> H3 -> answer.
const FAQ_HEADER = /^(?:частые\s+вопросы|часто\s+задаваемые\s+вопросы|вопросы\s+и\s+ответы|популярные\s+вопросы|faq\b|вопросы\s+по\s+теме\b)/iu;
const HEADING = /^(#{2,6})\s+(.+?)\s*$/;
const INLINE_QUESTION = /^\s*(?:(?:[-*+]|\d+[.)])\s+)?(?:\*\*|__|\*|_)[^\n]{4,210}\?(?:\*\*|__|\*|_)(?:\s|$)/u;
const plainTitle = (value) => value.replace(/\s+#+\s*$/, '').trim().replace(/^\d+[.)]\s+/, '').replace(/^\*{1,2}|\*{1,2}$/g, '').trim();

export function checkSeoGeoFaqFormat(markdown, file = 'article.md') {
  const errors = [];
  let faq = false, count = 0, began = 0, fence = null;
  const end = () => {
    if (faq && count === 0) errors.push(file + ':' + began + ' FAQ contains no H3 questions');
    faq = false; count = 0;
  };
  for (const [i, line] of String(markdown).split(/\r?\n/).entries()) {
    const boundary = /^\s{0,3}([\x60]{3,}|~{3,})/.exec(line);
    if (boundary) {
      const value = boundary[1];
      if (!fence) fence = { char: value[0], length: value.length };
      else if (fence.char === value[0] && value.length >= fence.length) fence = null;
      continue;
    }
    if (fence) continue;
    const h = HEADING.exec(line);
    if (h && FAQ_HEADER.test(plainTitle(h[2]))) {
      end(); faq = true; began = i + 1;
      if (h[1] !== '##') errors.push(file + ':' + (i + 1) + ' FAQ header must be H2');
      continue;
    }
    if (!faq) continue;
    if (h) {
      if (h[1] === '###' && plainTitle(h[2]).endsWith('?')) { count++; continue; }
      if (h[1].length <= 3) { end(); continue; }
      errors.push(file + ':' + (i + 1) + ' question must be H3');
      continue;
    }
    if (INLINE_QUESTION.test(line)) errors.push(file + ':' + (i + 1) + ' FAQ question must be H3, not bold/italic');
  }
  end();
  return errors;
}
