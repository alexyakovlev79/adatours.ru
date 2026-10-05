import { getCollection } from 'astro:content';
import { ORG } from '../data/organization/ada-tours';
import { SITE } from './site';
import { countryPath, destinationPath, tourPath, excursionPath, themePath } from './routes';
import { isActiveEntity, isArchivedEntity } from './archive.mjs';
import { buildStructuredData } from './structured-data.mjs';
import { inspectHtml } from './structured-data-html.mjs';

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
  return {
    html: inspected.html,
    graph: buildStructuredData({ root: input.root, organization, records,
      page: { path: input.path, url: input.url, title: input.title, description: input.description, lang: input.lang, image: input.image },
      document: inspected.facts, breadcrumbs: input.breadcrumbs || [],
      extra: [...[input.extra || []].flat(), ...inspected.legacy] }),
  };
}
