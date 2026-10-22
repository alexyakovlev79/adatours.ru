import { getCollection } from 'astro:content';
import { ORG } from '../data/organization/ada-tours';
import { SITE } from './site';
import { countryPath, destinationPath, tourPath, excursionPath, themePath } from './routes';
import { isActiveEntity, isArchivedEntity } from './archive.mjs';
import { buildStructuredData, recordId } from './structured-data.mjs';
import { authoritativeEnglishTarget, attachExternalPageSameAs } from './external-page-sameas.mjs';
import { inspectHtml } from './structured-data-html.mjs';
import { inspectSeoGeoArticle } from './seo-geo-schema.mjs';
import externalProfiles from '../../data/external-identity/external-profiles.json';
import confirmedEnglishPairs from '../../data/external-identity/adatours-com-correspondences.json';
import { collectSeoPagePrices, enrichSeoPriceMetadata, formatSeoMoney } from './seo-price-meta.mjs';
const geoModules = import.meta.glob('../../data/geo-knowledge/entities/*.json', { eager: true, import: 'default' });
const geoKnowledge = new Map<string, any>(Object.values(geoModules).map((v: any) => [v.stableId, v]));

// The external audit distinguishes confirmed identity from similar offers,
// theme catalogues, near-duplicates and candidates. Only the exact pair may
// become sameAs; never make assumptions from matching names or country.
const confirmedById = new Map<string, Array<{ kind: string; ru: string; en: string }>>();
for (const row of confirmedEnglishPairs.rows) {
  const [entityId, kind, , ru, en, status] = row;
  if (status !== 'confirmed' || !['country', 'destination', 'tour', 'excursion'].includes(kind)) continue;
  try {
    if (new URL(ru).origin !== new URL(SITE.url).origin || new URL(en).origin !== 'https://adatours.com') continue;
    // The 22.10 adjudication overrides older, conflicting EN-to-RU mappings.
    const newerCanonical = authoritativeEnglishTarget(en);
    if (newerCanonical && newerCanonical !== new URL(ru).pathname) continue;
    const pairs = confirmedById.get(entityId) || [];
    pairs.push({ kind, ru, en });
    confirmedById.set(entityId, pairs);
  } catch { /* Malformed registry rows never create identity assertions. */ }
}
let recordsPromise: Promise<any[]> | undefined;
async function loadRecords() {
  const groups = await Promise.all([
    getCollection('countries'), getCollection('destinations'), getCollection('tours'), getCollection('excursions'),
    getCollection('themes'), getCollection('people'), getCollection('cases'), getCollection('articles'),
  ]);
  const kinds = ['country', 'destination', 'tour', 'excursion', 'theme', 'person', 'case', 'article'];
  const paths = [countryPath, destinationPath, tourPath, excursionPath, themePath,
    (d: any) => `/team/${d.slug}/`, (d: any) => `/cases/${d.slug}/`, (d: any) => `/articles/${d.slug}/`];
  return groups.flatMap((group, i) => group.filter(({ data }) => data.locale === 'ru'
    && (isActiveEntity(data) || ['tour', 'excursion'].includes(kinds[i]) && isArchivedEntity(data)))
    .map(({ data }) => {
      const path = paths[i](data as any);
      const url = new URL(path, SITE.url).href;
      const verifiedSameAs = [...new Set((confirmedById.get(data.id) || [])
        .filter((pair) => pair.kind === kinds[i] && pair.ru === url)
        .map((pair) => pair.en))];
      return { kind: kinds[i], path, archived: isArchivedEntity(data),
        data: verifiedSameAs.length ? { ...data, verifiedSameAs } : data };
    }));
}
export async function pageStructuredData(input: {
  root: string; html: string; path: string; url: string; title: string; description: string; lang: string; image?: string;
  breadcrumbs?: any[]; extra?: any;
  seoGeoArticle?: { targetPath: string; headingHtml: string; bodyHtml: string; lead: string } | null;
}) {
  // In dev, avoid a stale graph after content edits. Production loads the content index once.
  const records = await (import.meta.env.DEV ? loadRecords() : (recordsPromise ??= loadRecords()));
  const inspected = inspectHtml(input.html, { root: input.root, pageUrl: input.url });
  const editorial = input.seoGeoArticle
    ? inspectSeoGeoArticle(input.seoGeoArticle, { root: input.root, pageUrl: input.url })
    : null;
  // Identity requires explicit confirmation and an exact organization-profile match.
  // Historical, candidate, directory-analogue and unrelated Ada Tours names never qualify.
  const confirmedProfiles = externalProfiles.rows.filter((row: string[]) =>
    row[0] === 'https://adatours.ru/#organization' && row[5] === 'ПОДТВЕРЖДЕНО'
    && (row[6] === 'sameAs' || row[6].startsWith('sameAs; memberOf'))
    && row[7] === 'Высокая' && /^https:\/\//.test(row[3] || ''));
  const verifiedSameAs = [...new Set(confirmedProfiles.map((row: string[]) => row[3]))];
  const confirmedMentions = externalProfiles.rows.filter((row: string[]) =>
    row[0] === 'https://adatours.ru/#organization' && row[5] === 'ПОДТВЕРЖДЕНО'
    && row[6] === 'subjectOf' && row[7] === 'Высокая'
    && /^https:\/\//.test(row[3] || ''))
    .map((row: string[]) => ({ name: row[2], url: row[3] }));
  const organization = {
    name: ORG.brand, url: SITE.url, legalName: ORG.legal.name, cnpj: ORG.legal.cnpj,
    description: SITE.defaultDescription,
    email: ORG.contacts.email, telephone: ORG.contacts.phoneHref.replace(/^tel:/, ''),
    logo: '/brand/adatours-logo-black.svg', languages: [...ORG.service.languages],
    // Only exact, verified identity URLs belong in sameAs. Evintra is a country directory.
    sameAs: [...new Set([ORG.externalProfiles.officialInternationalSite, ORG.externalProfiles.abavRio,
      ...verifiedSameAs].filter(Boolean))],
    externalMentions: confirmedMentions,
    areaServed: [
      { '@type': 'Country', name: 'Бразилия' },
      { '@type': 'Country', name: 'Аргентина' },
      { '@type': 'Country', name: 'Перу' },
      { '@type': 'Place', name: 'Латинская Америка' },
    ],
    address: { '@type': 'PostalAddress', streetAddress: ORG.legal.streetAddress,
      addressLocality: ORG.legal.addressLocality, addressRegion: ORG.legal.addressRegion,
      postalCode: ORG.legal.postalCode, addressCountry: ORG.legal.addressCountry },
  };
  const graph = buildStructuredData({ root: input.root, organization, records,
      page: { path: input.path, url: input.url, title: input.title, description: input.description, lang: input.lang, image: input.image },
      document: { ...inspected.facts, editorial }, breadcrumbs: input.breadcrumbs || [],
      extra: [...[input.extra || []].flat(), ...inspected.legacy], geoKnowledge });
  const current = records.find((record) => record.path === input.path);
  // One static, local lookup per page; no Sheets/API calls and no browser JS.
  attachExternalPageSameAs(graph, {
    path: input.path,
    pageUrl: input.url,
    entityId: current ? recordId(current, input.root) : undefined,
  });
  const prices = collectSeoPagePrices({
    records, root: input.root, path: input.path,
    groups: inspected.facts.groups, priceVisible: inspected.facts.priceVisible,
  });
  const seo = enrichSeoPriceMetadata({
    title: input.title, description: input.description, prices,
    preferredKind: current?.kind === 'country' || current?.kind === 'destination' ? 'tour' : undefined,
  });
  const aggregates = graph['@graph'].filter((node: any) => node['@type'] === 'AggregateOffer');
  // SEO copy is USD-only. Other currencies remain factual in JSON-LD but
  // must not introduce EUR/BRL price claims into title or description.
  // Do not add a new price claim when no amount was attached to authored metadata.
  const priceSummaries = (seo.changed && seo.quote
    ? aggregates.filter((offer: any) =>
        offer.priceCurrency === 'USD' && offer['@id'].includes('#' + seo.quote.kind + '-'))
    : []).map((offer: any) => {
    const kind = offer['@id'].includes('#tour-') ? 'туров' : 'экскурсий';
    const range = offer.lowPrice === offer.highPrice
      ? 'от ' + formatSeoMoney(offer.lowPrice, offer.priceCurrency)
      : 'от ' + formatSeoMoney(offer.lowPrice, offer.priceCurrency) +
        ' до ' + formatSeoMoney(offer.highPrice, offer.priceCurrency);
    return 'Стартовые цены ' + kind + ': ' + range + '.';
  });
  // The priced card of a singleton selection was not visible before; display its
  // factual starting price beside the catalogue when SEO now cites that price.
  // Keep the existing AggregateOffer summaries unchanged for multi-item groups.
  if (seo.changed && seo.quote && !['tour', 'excursion'].includes(current?.kind)) {
    for (const { currency, amount } of seo.quote.parts) {
      if (aggregates.some((node: any) => node['@id'] === input.url + '#' + seo.quote.kind + '-' + currency + '-price-range')) continue;
      const count = prices.filter((item) => item.kind === seo.quote.kind && item.currency === currency).length;
      const noun = seo.quote.kind === 'tour' ? (count === 1 ? 'тура' : 'туров')
        : count === 1 ? 'экскурсии' : 'экскурсий';
      const prefix = count === 1 ? 'Стартовая цена ' : 'Стартовые цены ';
      priceSummaries.push(prefix + noun + ': ' + (seo.quote.multiple ? 'от ' : '') + formatSeoMoney(amount, currency) + '.');
    }
  }
  // Metadata must quote the minimum of the entire logical selection, not
  // whichever ten products happened to be rendered on this catalogue page.
  // JSON-LD AggregateOffer itself remains scoped to the actually rendered links.
  if (seo.changed && seo.quote && seo.quote.parts.length === 1) {
    const { currency, amount } = seo.quote.parts[0];
    const kind = seo.quote.kind;
    const noun = kind === 'tour' ? (seo.quote.count === 1 ? 'тура' : 'туров')
      : (seo.quote.count === 1 ? 'экскурсии' : 'экскурсий');
    const text = (seo.quote.count === 1 ? 'Стартовая цена ' : 'Стартовые цены ') +
      noun + ': ' + (seo.quote.multiple ? 'от ' : '') + formatSeoMoney(amount, currency) + '.';
    const pattern = kind === 'tour' ? /^(Стартовые цены туров|Стартовая цена тура):/
      : /^(Стартовые цены экскурсий|Стартовая цена экскурсии):/;
    const existing = priceSummaries.findIndex((summary) => pattern.test(summary));
    if (existing >= 0) priceSummaries[existing] = text;
    else if (seo.changed) priceSummaries.push(text);
  }
  const priceSummary = priceSummaries.join(' ');
  const metaDescription = priceSummary ? priceSummary + ' ' + seo.description : seo.description;
  const currentPage = graph['@graph'].find((node: any) => node['@id'] === input.url + '#webpage');
  if (currentPage) {
    currentPage.name = seo.title;
    currentPage.description = metaDescription;
  }
  return {
    html: inspected.html, graph, priceSummaries, priceSummary,
    metaTitle: seo.title, metaDescription,
  };
}
