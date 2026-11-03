/** Shared interface copy for the complete EN staging site.
 * Unknown text stays in Russian; layout, links and data remain canonical.
 */
import catalog from '../../data/i18n/ui-copy.json' with { type: 'json' };
import { uiText } from './messages.mjs';
import { enStagingSiteEnabled } from './en-staging-site.mjs';

export function sharedUiLocale(env = globalThis.process?.env ?? {}) {
  return env.EN_SHARED_CONTENT === '1' && enStagingSiteEnabled(env) ? 'en' : 'ru';
}

// The existing UI dictionary owns all shared catalogue and interface copy.
const normalize = value => value.replace(/\s+/gu, ' ').trim();
const literals = new Map();
const patterns = [];
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const row of Object.values(catalog.messages)) {
  const names = [...row.ru.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)].map(match => match[1]);
  if (!names.length) {
    // Named uiText() callers decide between e.g. navigation Back/Previous.
    // The exact shared renderer keeps the first already-approved equivalent.
    if (!literals.has(normalize(row.ru))) literals.set(normalize(row.ru), row.en);
    continue;
  }
  let offset = 0, expression = '';
  for (const match of row.ru.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)) {
    expression += escape(row.ru.slice(offset, match.index));
    expression += ['count','max','from','to','total','page','position'].includes(match[1])
      ? '([0-9][0-9 ,.–-]*)' : match[1] === 'days'
        ? '(\\d+\\s+(?:день|дня|дней))' : match[1] === 'price'
        ? '([0-9$€£¥₽][0-9\\s.,$€£¥₽A-Z]*)' : '([^<>\\n]+?)';
    offset = match.index + match[0].length;
  }
  expression += escape(row.ru.slice(offset));
  patterns.push({ pattern: new RegExp('^' + expression + '$', 'u'), names, target: row.en });
}

/** Exact known text only; safe for text nodes and labels, never markup/scripts. */
export function translateUiText(text, locale = sharedUiLocale()) {
  if (locale !== 'en' || typeof text !== 'string' || !text.trim()) return text;
  const core = normalize(text);
  let translated = literals.get(core);
  if (translated === undefined) {
    for (const item of patterns) {
      const match = core.match(item.pattern);
      if (!match) continue;
      const values = Object.fromEntries(item.names.map((key, index) => {
        const value = match[index + 1];
        const days = key === 'days' ? value.match(/^(\d+)\s+(?:день|дня|дней)$/u) : null;
        return [key, days ? `${days[1]} ${Number(days[1]) === 1 ? 'day' : 'days'}` : value];
      }));
      translated = item.target.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (_, key) => values[key]);
      break;
    }
  }
  if (translated === undefined) return text;
  return (text.match(/^\s*/u)?.[0] ?? '') + translated + (text.match(/\s*$/u)?.[0] ?? '');
}

export function sharedInterestName(id, fallback, locale = sharedUiLocale()) {
  const key = 'interest.' + id;
  return locale === 'en' && Object.hasOwn(catalog.messages, key) ? uiText(locale, key) : fallback;
}
