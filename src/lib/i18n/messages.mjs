import catalog from '../../data/i18n/ui-copy.json' with { type: 'json' };

const locales = new Set(['ru', 'en']);
const parameters = (text) => [...text.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)].map((m) => m[1]).sort();

/** Text only. Astro/DOM renderers own escaping; this function never returns HTML. */
export function uiText(locale, key, values = {}) {
  if (!locales.has(locale)) throw new Error(`Unsupported UI locale: ${locale}`);
  const row = Object.hasOwn(catalog.messages, key) ? catalog.messages[key] : undefined;
  if (!row || typeof row[locale] !== 'string') throw new Error(`Missing UI message: ${locale}:${key}`);
  const required = new Set(parameters(row[locale]));
  for (const name of required) {
    if (!Object.hasOwn(values, name) || !['string', 'number'].includes(typeof values[name]) ||
        (typeof values[name] === 'number' && !Number.isFinite(values[name]))) {
      throw new Error(`Missing UI parameter: ${key}:${name}`);
    }
  }
  for (const name of Object.keys(values)) {
    if (!required.has(name)) throw new Error(`Unknown UI parameter: ${key}:${name}`);
  }
  return row[locale].replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (_, name) => String(values[name]));
}

export function validateUiCatalog(input = catalog) {
  const errors = [];
  if (!input || typeof input !== 'object' || !input.messages || typeof input.messages !== 'object' ||
      Array.isArray(input.messages) || Object.keys(input.messages).length === 0) return ['UI catalog requires a non-empty messages object'];
  for (const [key, row] of Object.entries(input.messages)) {
    if (!row || typeof row.ru !== 'string' || typeof row.en !== 'string' || !row.ru.trim() || !row.en.trim()) errors.push(`${key}: missing locale text`);
    else if (JSON.stringify(parameters(row.ru)) !== JSON.stringify(parameters(row.en))) {
      errors.push(`${key}: placeholder mismatch`);
    }
  }
  return errors;
}

export function localizedNavigation(locale) {
  const link = (href, key, id) => ({ ...(id ? { id } : {}), href, label: uiText(locale, key) });
  const primary = [
    ['/tours/', 'nav.tours'], ['/country/', 'nav.countries'], ['/multi-country/', 'nav.multiCountry'],
    ['/interests/', 'nav.interests'], ['/vip/', 'nav.vip'], ['/mice/', 'nav.mice'],
    ['/dmc/', 'nav.agencies'], ['/about/', 'nav.about'], ['/contacts/', 'nav.contacts'],
  ].map(([href, key]) => link(href, key));
  const dmc = [
    ['/dmc/', 'nav.dmc', 'overview'], ['/dmc/travel-agencies/', 'nav.travelAgencies', 'agencies'],
    ['/dmc/terms/', 'nav.terms', 'terms'], ['/mice/programmes/', 'nav.b2bProgrammes', 'programmes'],
  ].map(([href, key, id]) => link(href, key, id));
  const mice = [
    ['/mice/', 'nav.corporateTravel', 'overview'],
    ['/mice/business-delegations/', 'nav.delegations', 'delegations'],
    ['/mice/programmes/', 'nav.b2bProgrammes', 'programmes'],
  ].map(([href, key, id]) => link(href, key, id));
  const about = [
    ['/about/', 'nav.company', 'overview'], ['/team/anna-avanesova/', 'nav.anna', 'anna'],
    ['/team/', 'nav.team', 'team'], ['/reviews/', 'nav.reviews', 'reviews'],
    ['/cases/', 'nav.cases', 'cases'], ['/press/', 'nav.press', 'press'],
    ['/webinars/', 'nav.webinars', 'webinars'], ['/partners/', 'nav.partners', 'partners'],
  ].map(([href, key, id]) => link(href, key, id));
  return { primary, dmc, mice, about };
}

/** Explicit forms also support countries and multiword phrases such as tours with a beach stay. */
export function countInEnglish(count, singular, plural) {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Count must be a non-negative safe integer');
  if (typeof singular !== 'string' || !singular.trim() || typeof plural !== 'string' || !plural.trim()) {
    throw new Error('English count labels require explicit singular and plural forms');
  }
  return `${count} ${count === 1 ? singular : plural}`;
}
