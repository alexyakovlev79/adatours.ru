import { absoluteUrl, logicalPath } from './structured-data.mjs';

const CURRENCY_PREFIX = { USD: '$', EUR: '€', BRL: 'R$', ARS: 'ARS ' };
const CURRENCY_ORDER = ['USD', 'EUR', 'RUB', 'BRL', 'ARS'];
const PRICE_CLAIM = /(?<!\p{L})(?:по\s+лучшей\s+цене|по\s+лучшим\s+ценам|по\s+выгодным\s+ценам|по\s+цене|цены|цена|стоимость)(?!\p{L})/iu;
const INLINE_AMOUNT = /^\s*(?:[:—–-]\s*)?(?:(?:от|до)\s+)?(?:R\$|\$|€|₽|ARS\s+\d|\d[\d\s\u00a0.,]*\s*(?:USD|EUR|RUB|BRL|ARS))/iu;

function priceOf(record) {
  const value = record?.data?.priceFrom;
  const currency = record?.data?.currency;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || !/^[A-Z]{3}$/.test(currency || '')) return null;
  const amount = Math.round(value);
  return amount > 0 ? { id: record.data.id, kind: record.kind, currency, amount } : null;
}

export function formatSeoMoney(amount, currency) {
  const number = Math.round(amount).toLocaleString('ru-RU', { maximumFractionDigits: 0 });
  if (currency === 'RUB') return number + ' ₽';
  return CURRENCY_PREFIX[currency] ? CURRENCY_PREFIX[currency] + number : number + ' ' + currency;
}

/** Only the real products linked by a rendered selection, or the visible price of a detail page. */
export function collectSeoPagePrices({ records, root, path, groups = [], priceVisible = false }) {
  const byPath = new Map(records.map((record) => [record.path, record]));
  const current = byPath.get(path);
  if (current?.archived || current?.data?.status === 'archived') return [];
  const active = (record) => record && !record.archived && !['archived', 'draft'].includes(record.data.status);
  if (current && (current.kind === 'tour' || current.kind === 'excursion')) {
    const own = active(current) && priceVisible ? priceOf(current) : null;
    return own ? [own] : [];
  }
  const prices = new Map();
  for (const group of groups) {
    for (const link of group.links || []) {
      const url = absoluteUrl(link.href, root);
      if (!url || new URL(url).origin !== new URL(root).origin) continue;
      const record = byPath.get(logicalPath(url, root));
      if (!active(record) || !['tour', 'excursion'].includes(record.kind)) continue;
      // Country overview pricing refers only to its tours, never its excursions.
      if (current?.kind === 'country' && record.kind !== 'tour') continue;
      const price = priceOf(record);
      if (price) prices.set(record.kind + ':' + price.id, price);
    }
  }
  return [...prices.values()];
}

export function seoPriceQuote(prices, title, preferredKind) {
  const tour = prices.some((row) => row.kind === 'tour');
  const excursion = prices.some((row) => row.kind === 'excursion');
  if (!tour && !excursion) return null;
  const lower = title.toLocaleLowerCase('ru');
  const tourAt = lower.indexOf('тур');
  const excursionAt = lower.indexOf('экскурс');
  const excursionFirst = excursionAt !== -1 && (tourAt === -1 || excursionAt < tourAt);
  const kind = preferredKind === 'tour' && tour ? 'tour'
    : preferredKind === 'excursion' && excursion ? 'excursion'
    : excursionFirst && excursion ? 'excursion'
    : tour ? 'tour' : 'excursion';
  const selection = prices.filter((row) => row.kind === kind);
  const currencies = new Map();
  for (const row of selection) {
    const value = currencies.get(row.currency);
    if (value === undefined || row.amount < value) currencies.set(row.currency, row.amount);
  }
  const order = (currency) => {
    const index = CURRENCY_ORDER.indexOf(currency);
    return index < 0 ? CURRENCY_ORDER.length : index;
  };
  const parts = [...currencies].sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0]))
    .map(([currency, amount]) => ({ currency, amount }));
  const multiple = selection.length > 1;
  const suffix = parts.map(({ currency, amount }) =>
    (multiple ? 'от ' : '') + formatSeoMoney(amount, currency)).join(' и ');
  return { kind, count: selection.length, multiple, parts, suffix };
}

function attachAmount(text, quote) {
  const match = PRICE_CLAIM.exec(text);
  if (!match) return text;
  const tail = text.slice(match.index + match[0].length);
  // Do not turn "по цене от $1000" into a duplicated price declaration.
  if (INLINE_AMOUNT.test(tail)) return text;
  const sameClause = tail.split(/[.!?]/, 1)[0].slice(0, 100);
  if (/(?:R\$|\$|€|₽)\s*\d|\d[\d\s\u00a0.,]*\s*(?:USD|EUR|RUB|BRL|ARS)(?!\p{L})/iu.test(sameClause)) return text;
  const punctuation = /^цены$/iu.test(match[0]) && !quote.multiple ? ': ' : ' ';
  return text.slice(0, match.index + match[0].length) + punctuation + quote.suffix + tail;
}

export function enrichSeoPriceMetadata({ title, description, prices, preferredKind }) {
  const quote = seoPriceQuote(prices, title, preferredKind);
  if (!quote) return { title, description, quote: null, changed: false };
  const updatedTitle = attachAmount(title, quote);
  const updatedDescription = attachAmount(description, quote);
  return {
    title: updatedTitle, description: updatedDescription, quote,
    changed: updatedTitle !== title || updatedDescription !== description,
  };
}
