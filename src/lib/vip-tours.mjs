import { compareToursBySalesFit } from './tour-sales-fit.mjs';

export const VIP_TARGET_SHARE = 0.25;

const dataOf = (value) => value?.data ?? value ?? {};
const idOf = (value) => dataOf(value).id ?? dataOf(value).slug ?? dataOf(value).title ?? '';

export function hasVipInTitle(value) {
  return /\bVIP\b/i.test(dataOf(value).title ?? '');
}

const priceOf = (value) => {
  const price = dataOf(value).priceFrom;
  return typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : undefined;
};

const dailyPriceOf = (value) => {
  const price = priceOf(value);
  const days = dataOf(value).durationDays;
  return price !== undefined && typeof days === 'number' && Number.isFinite(days) && days > 0
    ? price / days
    : undefined;
};

function percentileRanks(entries, metric) {
  const ranked = entries
    .map((entry) => ({ entry, value: metric(entry) }))
    .filter((row) => typeof row.value === 'number' && Number.isFinite(row.value))
    .sort((a, b) => b.value - a.value || compareToursBySalesFit(a.entry, b.entry));
  const scores = new Map();
  if (!ranked.length) return scores;
  const denominator = Math.max(1, ranked.length - 1);
  for (let index = 0; index < ranked.length;) {
    let end = index + 1;
    while (end < ranked.length && ranked[end].value === ranked[index].value) end++;
    const score = ranked.length === 1 ? 1 : 1 - index / denominator;
    for (let cursor = index; cursor < end; cursor++) scores.set(idOf(ranked[cursor].entry), score);
    index = end;
  }
  return scores;
}

function financialScore(entry, priceRanks, dailyRanks) {
  const price = priceRanks.get(idOf(entry));
  const daily = dailyRanks.get(idOf(entry));
  if (price === undefined && daily === undefined) return undefined;
  const high = Math.max(price ?? 0, daily ?? 0);
  const low = Math.min(price ?? 0, daily ?? 0);
  return high + 0.35 * low;
}

export function selectVipTours(entries, options = {}) {
  const all = [...entries];
  const share = typeof options.targetShare === 'number' ? options.targetShare : VIP_TARGET_SHARE;
  if (!(share > 0 && share <= 1)) throw new Error(`Invalid VIP target share: ${share}`);
  if (!all.length) return { entries: [], targetCount: 0, namedCount: 0, actualShare: 0 };

  const named = all.filter(hasVipInTitle);
  const namedIds = new Set(named.map(idOf));
  const priceRanks = percentileRanks(all, priceOf);
  const dailyRanks = percentileRanks(all, dailyPriceOf);
  const scoreById = new Map(all.map((entry) => [idOf(entry), financialScore(entry, priceRanks, dailyRanks)]));
  const targetCount = Math.min(all.length, Math.max(named.length, Math.round(all.length * share)));

  const rankedCandidates = all
    .filter((entry) => namedIds.has(idOf(entry)) || scoreById.get(idOf(entry)) !== undefined)
    .sort((a, b) => {
      const namedDelta = Number(hasVipInTitle(b)) - Number(hasVipInTitle(a));
      if (namedDelta) return namedDelta;
      const scoreDelta = (scoreById.get(idOf(b)) ?? Number.NEGATIVE_INFINITY)
        - (scoreById.get(idOf(a)) ?? Number.NEGATIVE_INFINITY);
      if (scoreDelta) return scoreDelta;
      const priceDelta = (priceOf(b) ?? Number.NEGATIVE_INFINITY) - (priceOf(a) ?? Number.NEGATIVE_INFINITY);
      if (priceDelta) return priceDelta;
      const dailyDelta = (dailyPriceOf(b) ?? Number.NEGATIVE_INFINITY) - (dailyPriceOf(a) ?? Number.NEGATIVE_INFINITY);
      if (dailyDelta) return dailyDelta;
      return compareToursBySalesFit(a, b);
    });

  const selectedIds = new Set(namedIds);
  for (const entry of rankedCandidates) {
    if (selectedIds.size >= targetCount) break;
    selectedIds.add(idOf(entry));
  }
  const selected = rankedCandidates.filter((entry) => selectedIds.has(idOf(entry)));
  return { entries: selected, targetCount, namedCount: named.length, actualShare: selected.length / all.length };
}

export function vipTourPriceLabel(value) {
  const data = dataOf(value);
  const price = priceOf(data);
  if (price === undefined) return '';
  const amount = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(price);
  const currency = (data.currency ?? '').trim().toUpperCase();
  if (currency === 'USD') return `от $${amount}`;
  if (currency === 'EUR') return `от €${amount}`;
  if (currency === 'BRL') return `от R$${amount}`;
  return `от ${amount}${currency ? ` ${currency}` : ''}`;
}
