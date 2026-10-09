/** Text provenance and explicitly recorded visual review are separate evidence. */
export function captionOverrideResult(item) {
  if (!item?.src || !item.alt || !item.hover || !item.evidence?.length
      || item.evidence.some((e) => !e.ref || !e.quote)) {
    throw new Error(`Caption override needs src, alt, hover and evidence: ${item?.src}`);
  }
  const visuallyReviewed = item.visuallyReviewed === true;
  if (visuallyReviewed && !item.evidence.some((e) => /^https?:\/\//.test(e.ref)
      && logicalImagePath(e.ref) === logicalImagePath(item.src))) {
    throw new Error(`Visual review needs evidence for the exact image URL: ${item.src}`);
  }
  return {
    alt: cleanCaption(item.alt), hover: cleanCaption(item.hover),
    status: visuallyReviewed ? 'visually_reviewed' : 'editorial_source_described',
    basis: visuallyReviewed ? 'visual_review' : 'editorial_override',
    visuallyReviewed, evidence: item.evidence,
  };
}

export function cleanCaption(value) {
  return String(value ?? '').replace(/<[^>]*>/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '').replace(/^\s*(?:на фото|на снимке|фото|изображение)\s*:\s*/i, '')
    .replace(/\s+/g, ' ').replace(/ё/g, 'е').trim().replace(/[.;]+$/, '');
}

export function captionKey(value) {
  return cleanCaption(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function isDescription(value, context = {}) {
  const text = cleanCaption(value);
  if (!text || text.length > 240 || /https?:\/\/|\/media\//i.test(text)) return false;
  if (/^(?:фото|фотография|изображение|галерея|кадр|обложка|hero|gallery|image)(?:\s+\d+)?$/i.test(text)) return false;
  if (/(?:галерея|фото|кадр|день|gallery)\s*[-:#]?\s*\d+\s*$/i.test(text)) return false;
  if (/по запросу|купить|стоимость|забронировать|\b(?:webp|jpg|png)\b/i.test(text)) return false;
  // Commercial program titles describe a product, not the subject of an image.
  if (['tours', 'tour', 'themes', 'theme', 'cases', 'case', 'articles', 'article'].includes(context.type)
      && captionKey(text) === captionKey(context.name)) return false;
  return true;
}

const countries = {
  'Бразилии': 'Бразилия', 'Боливии': 'Боливия', 'Аргентине': 'Аргентина', 'Аргентины': 'Аргентина',
  'Чили': 'Чили', 'Перу': 'Перу', 'Эквадоре': 'Эквадор', 'Эквадора': 'Эквадор',
  'Колумбии': 'Колумбия', 'Уругвае': 'Уругвай', 'Уругвая': 'Уругвай', 'Парагвае': 'Парагвай',
  'Венесуэле': 'Венесуэла', 'Венесуэлы': 'Венесуэла', 'Мексике': 'Мексика', 'Мексики': 'Мексика',
  'Гватемале': 'Гватемала', 'Гватемалы': 'Гватемала', 'Белизе': 'Белиз', 'Белиза': 'Белиз',
  'Панаме': 'Панама', 'Панамы': 'Панама', 'Никарагуа': 'Никарагуа', 'Коста-Рике': 'Коста-Рика',
  'Коста Рике': 'Коста-Рика', 'Коста Рики': 'Коста-Рика', 'Кубе': 'Куба', 'Кубы': 'Куба',
  'Гондурасе': 'Гондурас', 'Сальвадоре': 'Сальвадор', 'Антарктиде': 'Антарктида',
};
const upperFirst = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
const lowerCommon = (s) => /^(?:Город|Остров|Пляж|Панорама|Панорамный|Вид|Водопад|Водопады|Статуя|Каньон|Пустыня|Соленое|Солончак|Порт|Река|Курорт|Исторический|Тропический|Морской)(?=\s|$)/i.test(s)
  ? s[0].toLowerCase() + s.slice(1) : s;

/** Conservative Russian variants. Only restate facts already in this caption. */
export function captionVariants(value) {
  const text = upperFirst(cleanCaption(value));
  if (!text) return [];
  const variants = [text];
  const add = (s) => { s = upperFirst(cleanCaption(s)); if (s && !variants.includes(s)) variants.push(s); };
  const panorama = text.match(/^Панорама (.+)$/i);
  if (panorama) add(`Панорамный вид ${panorama[1]}`);
  const panoramic = text.match(/^Панорамный вид (?!на )(.+)$/i);
  if (panoramic) add(`Панорама ${panoramic[1]}`);
  const salt = text.match(/^Соленое озеро \(солончак\) (.+)$/i);
  if (salt) { add(`Солончак ${salt[1]}`); add(`Соленое озеро ${salt[1]}`); }
  const capital = text.match(/^Столица (\S+) (?:город )?(.+)$/i);
  if (capital && countries[capital[1]]) {
    add(`${capital[2]}, ${countries[capital[1]]}`);
    add(`${countries[capital[1]]}: ${capital[2]}`);
  }
  for (const [declined, country] of Object.entries(countries)) {
    for (const preposition of ['в', 'на']) {
      const tail = ` ${preposition} ${declined}`;
      if (text.toLowerCase().endsWith(tail.toLowerCase())) {
        const subject = text.slice(0, -tail.length);
        add(`${subject}, ${country}`); add(`${country}: ${lowerCommon(subject)}`);
        const city = subject.match(/^Город (?:порт )?(.+)$/i);
        if (city) add(`${city[1]}, ${country}`);
      }
    }
  }
  for (const country of new Set(Object.values(countries))) {
    const tail = `, ${country}`;
    if (text.toLowerCase().endsWith(tail.toLowerCase())) add(`${country}: ${lowerCommon(text.slice(0, -tail.length))}`);
  }
  return variants;
}

export function hoverFromAlt(value) {
  const variants = captionVariants(value);
  if (!variants.length) return '';
  return variants.find((s) => captionKey(s) !== captionKey(value)) ?? variants[0];
}

/** Shared file identity keeps its text, while different originals may use safe variants. */
export function diversifyCaptions(images) {
  const byPath = new Map(images.map((r) => [r.src, r]));
  const identity = (r, seen = new Set()) => {
    if (seen.has(r.src) || r.sourceImages.length !== 1 || r.generationRefs.some((g) => /different (?:scene|angle|frame)|alternative scene|not a reconstruction/i.test(g.prompt))) return r.src;
    seen.add(r.src);
    const original = byPath.get(r.sourceImages[0]);
    return original ? identity(original, seen) : r.sourceImages[0];
  };
  const groups = new Map();
  for (const r of images) {
    r.sourceDescription = r.alt;
    r.captionIdentity = identity(r);
    r.wordingChanged = false;
    r.reviewReasons = ['text_conflict', 'context_only', 'missing_description'].includes(r.status) ? [r.status] : [];
    if (r.alt && r.activeUses > 0 && r.basis !== 'interface_identity') {
      const key = captionKey(r.alt); const group = groups.get(key) ?? [];
      group.push(r); groups.set(key, group);
    }
    if (!r.alt || r.status !== 'source_described') continue;
    r.alt = captionVariants(r.alt)[0]; r.hover = hoverFromAlt(r.alt);
    r.wordingChanged = r.alt !== r.sourceDescription;
  }
  let sharedGroups = 0;
  const chosen = new Map();
  for (const group of groups.values()) {
    const identities = [...new Set(group.map((r) => r.captionIdentity))].sort();
    if (identities.length < 2) continue;
    sharedGroups++;
    const variants = captionVariants(group[0].sourceDescription);
    for (const r of group) {
      // Repeated text is an editorial observation, not evidence of missing scene data.
      r.sharedDescriptionIdentities = identities.length;
      if (r.status !== 'source_described' || !variants.length) continue;
      r.alt = variants[identities.indexOf(r.captionIdentity) % variants.length];
      r.hover = variants.find((v) => captionKey(v) !== captionKey(r.alt)) ?? r.alt;
      r.wordingChanged = r.alt !== r.sourceDescription;
      chosen.set(`${r.captionIdentity}\n${captionKey(r.sourceDescription)}`, { alt: r.alt, hover: r.hover });
    }
  }
  for (const r of images) {
    const matching = chosen.get(`${r.captionIdentity}\n${captionKey(r.sourceDescription)}`);
    if (r.status === 'source_described' && matching) {
      Object.assign(r, matching); r.wordingChanged = r.alt !== r.sourceDescription;
    }
  }
  return { sharedDescriptionGroups: sharedGroups, rewordedActiveImages: images.filter((r) => r.activeUses > 0 && captionKey(r.alt) !== captionKey(r.sourceDescription)).length };
}

export function logicalImagePath(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const src = value.trim();
  if (/^https?:\/\//.test(src)) {
    const url = new URL(src);
    if (url.hostname === 'img.adatours.ru' && url.pathname.startsWith('/media/')) return url.pathname;
    return src; // Raw URLs, including their parameters, retain exact identity.
  }
  if (src.startsWith('public/')) return `/${src.slice(7)}`;
  return src.startsWith('/') ? src : null;
}

export function selectCaption(candidates) {
  const eligible = candidates.filter((c) => isDescription(c.text, c.context));
  if (!eligible.length) return { alt: '', hover: '', status: 'missing_description', evidence: [] };
  const rank = Math.max(...eligible.map((c) => c.rank));
  const top = eligible.filter((c) => c.rank === rank);
  const keys = [...new Set(top.map((c) => captionKey(c.text)))];
  // Substrings are compatible general/specific forms; unrelated alternatives need a text review.
  const longest = keys.toSorted((a, b) => b.length - a.length)[0];
  const compatible = keys.every((key) => longest.includes(key));
  const selected = top.toSorted((a, b) => cleanCaption(b.text).length - cleanCaption(a.text).length || a.ref.localeCompare(b.ref))[0];
  const alt = cleanCaption(selected.text);
  return {
    alt, hover: hoverFromAlt(alt), status: compatible ? 'source_described' : 'text_conflict',
    basis: selected.kind, evidence: top.map((c) => ({ ref: c.ref, quote: c.text })),
  };
}
