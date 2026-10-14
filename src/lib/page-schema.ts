import { getCollection } from 'astro:content';
import { ORG } from '../data/organization/ada-tours';
import { SITE } from './site';
import { countryPath, destinationPath, tourPath, excursionPath, themePath } from './routes';
import { isActiveEntity, isArchivedEntity } from './archive.mjs';
import { buildStructuredData } from './structured-data.mjs';
import { inspectHtml } from './structured-data-html.mjs';
import { collectSeoPagePrices, enrichSeoPriceMetadata, formatSeoMoney } from './seo-price-meta.mjs';

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
    .map(({ data }) => ({ kind: kinds[i], data, path: paths[i](data as any), archived: isArchivedEntity(data) })));
}
export async function pageStructuredData(input: {
  root: string; html: string; path: string; url: string; title: string; description: string; lang: string; image?: string;
  breadcrumbs?: any[]; extra?: any;
}) {
  // In dev, avoid a stale graph after content edits. Production loads the content index once.
  const records = await (import.meta.env.DEV ? loadRecords() : (recordsPromise ??= loadRecords()));
  const inspected = inspectHtml(input.html, { root: input.root, pageUrl: input.url });
  const organization = {
    name: ORG.brand, url: SITE.url, legalName: ORG.legal.name, cnpj: ORG.legal.cnpj,
    description: SITE.defaultDescription,
    email: ORG.contacts.email, telephone: ORG.contacts.phoneHref.replace(/^tel:/, ''),
    logo: '/brand/adatours-logo-black.svg', languages: [...ORG.service.languages],
    // Only exact, verified identity URLs belong in sameAs. Evintra is a country directory.
    sameAs: [ORG.externalProfiles.officialInternationalSite, ORG.externalProfiles.abavRio],
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
      document: inspected.facts, breadcrumbs: input.breadcrumbs || [],
      extra: [...[input.extra || []].flat(), ...inspected.legacy] });
  const current = records.find((record) => record.path === input.path);
  const prices = collectSeoPagePrices({
    records, root: input.root, path: input.path,
    groups: inspected.facts.groups, priceVisible: inspected.facts.priceVisible,
  });
  const seo = enrichSeoPriceMetadata({
    title: input.title, description: input.description, prices,
    preferredKind: current?.kind === 'country' || current?.kind === 'destination' ? 'tour' : undefined,
  });
  const aggregates = graph['@graph'].filter((node: any) => node['@type'] === 'AggregateOffer');
  const priceSummaries = aggregates.map((offer: any) => {
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
