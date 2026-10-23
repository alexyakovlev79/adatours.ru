import { selectVipTours } from './vip-tours.mjs';
import { mergeGeoPassport } from './geo-knowledge.mjs';
import { authoritySourceId, getAuthorityEntity, getAuthorityPageSources, getAuthorityExhibitionSources, getVisibleAuthoritySources, getVisibleAuthorityPartners } from './entity-authority.mjs';
import programmeExamples from '../data/commercial/mice-programme-examples.json' with { type: 'json' };

/** Schema.org graph builder. Pure, deterministic, no network and no browser JS.
 * Facts come from the content model and the rendered page, never SEO inventions.
 */
export const SCHEMA_VERSION = '2026-10-22.3';
export const types = (node) => [node?.['@type'] ?? []].flat();
export const hasType = (node, type) => types(node).includes(type);
export const ref = (id) => ({ '@id': id });
export const cleanText = (value = '') => String(value)
  .replace(/<[^>]+>/g, ' ').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`#]+/g, '')
  .replace(/\s+/g, ' ').trim();
// Testimonials are already plain text. Preserve punctuation and literal angle
// brackets; HTML/script escaping belongs to the template and safeJsonLd.
export const quotationText = (value = '') => String(value).replace(/\s+/g, ' ').trim();
const compact = (value) => {
  if (Array.isArray(value)) return value.map(compact).filter((x) => x !== undefined);
  if (value && typeof value === 'object') {
    const pairs = Object.entries(value).map(([k, v]) => [k, compact(v)])
      .filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length));
    return Object.fromEntries(pairs);
  }
  return value == null ? undefined : value;
};
export function safeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
export function absoluteUrl(value, root) {
  if (!value) return undefined;
  try {
    const base = new URL(root);
    const text = String(value);
    if (/^(?!https?:)[a-z][a-z0-9+.-]*:/i.test(text) || text.startsWith('//')) return undefined;
    // Public paths are logical site paths; already BASE-prefixed paths stay intact.
    const prefix = base.pathname.replace(/\/$/, '');
    const url = /^https?:\/\//i.test(text) ? new URL(text)
      : new URL(text.startsWith('/') && prefix && !text.startsWith(`${prefix}/`) && text !== prefix
        ? `${prefix}${text}` : text.startsWith('/') ? text : `${base.pathname}${text}`, base.origin);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}
export function logicalPath(value, root) {
  const url = new URL(value, root);
  const prefix = new URL(root).pathname.replace(/\/$/, '');
  let path = url.pathname;
  if (prefix && (path === prefix || path.startsWith(`${prefix}/`))) path = path.slice(prefix.length) || '/';
  return /\/[^/]+\.[a-z0-9]{1,10}$/i.test(path) ? path : `${path.replace(/\/$/, '')}/`;
}
const fragments = { country: 'country', destination: 'place', tour: 'tour', excursion: 'excursion', theme: 'topic', person: 'person', case: 'article', article: 'article' };
export const recordId = (record, root) => `${absoluteUrl(record.path, root)}#${fragments[record.kind]}`;
const servicePages = {
  '/dmc/': {
    serviceType: 'DMC и принимающее обслуживание в Бразилии и Латинской Америке',
    category: 'B2B DMC',
    keywords: ['DMC в Бразилии', 'DMC в Латинской Америке', 'принимающий туроператор Бразилия', 'DMC для туроператоров', 'DMC для турагентств', 'MICE Бразилия', 'multi-country Латинская Америка'],
  },
  '/dmc/travel-agencies/': {
    serviceType: 'Принимающее обслуживание для турагентств и туроператоров',
    category: 'B2B DMC для туристических компаний',
    keywords: ['DMC для турагентств', 'DMC для туроператоров', 'принимающая компания Бразилия', 'наземное обслуживание Бразилия', 'туры по Бразилии для агентств', 'multi-country DMC'],
  },
  '/dmc/terms/': {
    serviceType: 'Условия B2B-сотрудничества с DMC',
    category: 'B2B условия DMC',
    keywords: ['условия работы с DMC', 'договор с DMC', 'вознаграждение турагентствам', 'B2B условия туроператоров', 'DMC Бразилия условия'],
  },
  '/mice/': {
    serviceType: 'Организация MICE и корпоративных поездок',
  },
  '/mice/business-delegations/': {
    serviceType: 'Организация поездок деловых делегаций',
  },
};
const collectionPaths = new Set(['/country/', '/tours/', '/places/', '/excursions/', '/interests/', '/team/', '/cases/', '/reviews/', '/articles/', '/press/', '/webinars/', '/partners/', '/mice/programmes/']);
const dateValue = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};
const recordName = (record) => cleanText(record?.data.name || record?.data.title);
const languageCodes = new Map([
  ['русский', 'ru'], ['russian', 'ru'],
  ['английский', 'en'], ['english', 'en'],
  ['испанский', 'es'], ['spanish', 'es'],
  ['португальский', 'pt'], ['portuguese', 'pt'],
  ['китайский', 'zh'], ['chinese', 'zh'],
  ['японский', 'ja'], ['japanese', 'ja'],
  ['арабский', 'ar'], ['arabic', 'ar'],
  ['малайский', 'ms'], ['malay', 'ms'],
]);
const languageCode = (value) => {
  const text = cleanText(value);
  return languageCodes.get(text.toLocaleLowerCase('ru')) || text;
};
const publicType = (record) => {
  if (record.kind === 'country') {
    if (record.data.slug === 'antarctica') return ['Place', 'TouristDestination'];
    // French Guiana is an overseas French administrative territory, not a sovereign Country.
    if (record.data.id === 'country_french_guiana') return ['AdministrativeArea', 'Place', 'TouristDestination'];
    return ['Country', 'TouristDestination'];
  }
  if (record.kind === 'destination') return record.data.destinationType === 'city' ? ['City', 'TouristDestination'] : 'TouristDestination';
  return { tour: 'TouristTrip', excursion: 'TouristTrip', theme: 'DefinedTerm', person: 'Person', case: 'Article', article: 'Article' }[record.kind];
};
/** Create a new context per page; records/indexes can be shared by the caller. */
export function buildStructuredData({ root, organization, records, page, document = {}, breadcrumbs = [], extra = [], geoKnowledge = null, authority = null }) {
  const byPath = new Map(records.map((r) => [r.path, r]));
  const byId = new Map(records.map((r) => [r.data.id, r]));
  const current = byPath.get(page.path);
  const nodes = new Map();
  const add = (node) => {
    const n = compact(node);
    if (!n?.['@id']) throw new Error('Schema node requires an @id');
    const prior = nodes.get(n['@id']);
    nodes.set(n['@id'], prior ? { ...prior, ...n } : n);
    return ref(n['@id']);
  };
  const orgId = `${organization.url.replace(/\/$/, '')}/#organization`;
  const siteId = `${root}#website`;
  const pageId = `${page.url}#webpage`;
  const logoId = `${root}#logo`;
  const orgAuthority = getAuthorityEntity('organization', authority);
  add({ '@type': 'ImageObject', '@id': logoId, url: absoluteUrl(organization.logo, root), contentUrl: absoluteUrl(organization.logo, root), caption: organization.name, width: 553, height: 184 });
  add({ '@type': ['Organization', 'TravelAgency'], '@id': orgId, name: organization.name,
    legalName: organization.legalName, url: organization.url, logo: ref(logoId),
    description: cleanText(organization.description), email: organization.email, telephone: organization.telephone,
    identifier: organization.cnpj ? { '@type': 'PropertyValue', propertyID: 'CNPJ', value: organization.cnpj } : undefined,
    taxID: organization.cnpj, address: organization.address, areaServed: organization.areaServed,
    sameAs: [...new Set([...(organization.sameAs || []), ...orgAuthority.sameAs])].filter((url) => /^https?:\/\//.test(url)),
    alternateName: orgAuthority.alternateName, hasMap: orgAuthority.hasMap,
    memberOf: orgAuthority.memberOf, mainEntityOfPage: ref(`${absoluteUrl('/about/', root)}#webpage`),
    knowsLanguage: organization.languages?.map(languageCode),
    contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', email: organization.email,
      telephone: organization.telephone, availableLanguage: organization.languages?.map(languageCode),
      areaServed: organization.areaServed },
  });
  // Only exact, approved independent coverage is a subjectOf relation. A directory
  // profile is a sameAs identity, not an editorial article or a rating source.
  const visibleSourceUrls = new Set((document.groups || []).flatMap((group) => group.links || []).map((link) => link.href));
  const visibleLocalPaths = new Set([...visibleSourceUrls].map((href) => absoluteUrl(href, root))
    .filter((url) => url && new URL(url).origin === new URL(root).origin).map((url) => logicalPath(url, root)));
  const independentWorks = (organization.externalMentions || []).filter((item) =>
    /^https:\/\//.test(item.url || '') && item.name && visibleSourceUrls.has(item.url)).map((item) =>
    add({ '@type': 'Article', '@id': item.url + '#article', url: item.url,
      headline: cleanText(item.name), about: ref(orgId) }));
  if (independentWorks.length) add({ '@type': ['Organization', 'TravelAgency'], '@id': orgId,
    subjectOf: independentWorks });
  add({ '@type': 'WebSite', '@id': siteId, url: root, name: organization.name, inLanguage: page.lang, publisher: ref(orgId) });
  const imageUrl = absoluteUrl(page.image || current?.data.hero?.src || current?.data.photo?.src || document.primaryImage?.src, root);
  const visibleImage = imageUrl && document.images?.find((img) => absoluteUrl(img.src, root) === imageUrl);
  const imageRef = imageUrl ? add({ '@type': 'ImageObject', '@id': `${page.url}#primaryimage`, contentUrl: imageUrl, url: imageUrl,
    caption: cleanText(visibleImage?.alt || current?.data.hero?.alt || current?.data.photo?.alt) || undefined,
    width: visibleImage?.width, height: visibleImage?.height, inLanguage: page.lang }) : undefined;
  const pageType = current?.kind === 'person' ? 'ProfilePage'
    : current && ['country', 'destination', 'theme'].includes(current.kind) ? 'CollectionPage'
    : collectionPaths.has(page.path) || document.catalog ? 'CollectionPage'
    : page.path === '/about/' ? 'AboutPage' : page.path === '/contacts/' ? 'ContactPage' : 'WebPage';
  const serviceConfig = servicePages[page.path];
  const webPage = { '@type': pageType, '@id': pageId, url: page.url, name: cleanText(page.title),
    description: cleanText(page.description), inLanguage: page.lang,
    keywords: serviceConfig?.keywords,
    isPartOf: ref(siteId), publisher: ref(orgId), primaryImageOfPage: imageRef,
    dateModified: dateValue(current?.data.updatedAt), hasPart: [], mentions: [] };
  add(webPage);
  const publicRecord = (record) => record && !record.archived && record.data.status !== 'draft';
  function ensureService(path) {
    const config = servicePages[path];
    if (!config) return undefined;
    const url = absoluteUrl(path, root);
    const id = `${url}#service`;
    if (nodes.has(id)) return ref(id);
    return add({ '@type': 'Service', '@id': id, name: config.serviceType,
      serviceType: config.serviceType, category: config.category, url,
      provider: ref(orgId), areaServed: organization.areaServed,
      mainEntityOfPage: ref(`${url}#webpage`) });
  }
  function connectCaseService(article, service) {
    const node = nodes.get(service['@id']);
    const subjectOf = new Map((node.subjectOf || []).map((item) => [item['@id'], item]));
    subjectOf.set(article['@id'], article);
    add({ ...node, subjectOf: [...subjectOf.values()] });
  }
  function visibleCaseQuotation(record, about) {
    const quote = quotationText(record.data.testimonial?.quote);
    if (!quote || !(document.caseQuotations || []).some((item) => item.entityId === record.data.id && item.text === quote)) return undefined;
    return add({ '@type': 'Quotation', '@id': `${absoluteUrl(record.path, root)}#testimonial`,
      text: quote, inLanguage: page.lang, isPartOf: ref(recordId(record, root)),
      about: about.length ? about : [ref(orgId)] });
  }
  function ensureRecord(record, full = false) {
    const d = record.data;
    const id = recordId(record, root);
    if (nodes.has(id) && !full) return ref(id);
    const url = absoluteUrl(record.path, root);
    const node = { '@type': publicType(record), '@id': id, name: recordName(record), url,
      identifier: d.id, description: full ? cleanText(d.lead || d.summary || d.description) || undefined : undefined,
      sameAs: d.verifiedSameAs?.filter((source) => /^https:\/\/adatours\.com\//.test(source)),
      mainEntityOfPage: ref(`${url}#webpage`) };
    // Detailed images belong on their detail page, not on a card with a different cover.
    if (full && imageRef) node.image = imageRef;
    if (record.kind === 'destination') {
      const country = byId.get(d.countryId);
      if (publicRecord(country)) node.containedInPlace = ensureRecord(country);
      const touristTypes = (d.themes || []).map((key) => byId.get(key))
        .filter((theme) => publicRecord(theme) && theme.kind === 'theme').map(recordName);
      if (touristTypes.length) node.touristType = [...new Set(touristTypes)];
    }
    if (record.kind === 'theme') {
      const termSet = add({ '@type': 'DefinedTermSet', '@id': `${root}interests/#terms`, name: 'Интересы Ada Tours', url: absoluteUrl('/interests/', root) });
      node.termCode = d.id;
      node.inDefinedTermSet = termSet;
    }
    if (['tour', 'excursion'].includes(record.kind)) {
      node.provider = ref(orgId);
      const themeIds = record.kind === 'tour' ? [...(d.primaryThemes || []), ...(d.themes || [])] : (d.themes || []);
      const touristTypes = [
        ...themeIds.map((key) => byId.get(key)).filter((theme) => publicRecord(theme) && theme.kind === 'theme').map(recordName),
        ...(record.kind === 'tour' ? (d.audiences || []) : []),
      ].map(cleanText).filter(Boolean);
      if (touristTypes.length) node.touristType = [...new Set(touristTypes)];
      if (full) {
        // Trip has no schema.org duration property. Keep duration in its factual description
        // and express numbered programme days with subTrip, rather than invalid properties.
        const duration = record.kind === 'tour'
          ? [d.durationDays ? `${d.durationDays} дней` : '', d.durationNights !== undefined ? `${d.durationNights} ночей` : ''].filter(Boolean).join(', ')
          : cleanText(d.duration);
        node.description = [node.description, duration ? `Продолжительность: ${duration}.` : '', d.format ? `Формат: ${cleanText(d.format)}.` : ''].filter(Boolean).join(' ');
        const relatedIds = record.kind === 'tour' ? (d.routeDestinations || d.destinations || []) : [d.destination, ...(d.relatedDestinations || [])].filter(Boolean);
        const places = relatedIds.map((key) => byId.get(key)).filter(publicRecord);
        const route = (d.route?.length ? d.route : places.map(recordName)).map(cleanText).filter(Boolean);
        if (route.length) {
          const itinerary = { '@type': 'ItemList', '@id': `${url}#itinerary`, name: 'Маршрут', itemListOrder: 'https://schema.org/ItemListOrderAscending', numberOfItems: route.length,
            itemListElement: route.map((name, index) => {
              const place = places.find((p) => [recordName(p), ...(p.data.searchAliases || [])].some((v) => cleanText(v).toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru')));
              return { '@type': 'ListItem', position: index + 1, item: place ? ensureRecord(place) : { '@type': 'Place', name } };
            }) };
          node.itinerary = add(itinerary);
        }
        const days = (d.itinerary || []).filter((day) => Number.isInteger(day.day) && day.day > 0);
        if (days.length) node.subTrip = days.map((day, index) => {
          const texts = day.contentBlocks?.length ? day.contentBlocks.flatMap((block) => {
            if (block.type === 'excursion') { const ex = byId.get(block.excursionRef); return publicRecord(ex) ? [ex.data.title, ex.data.lead] : []; }
            return [block.title, block.text];
          }) : [day.text, ...(day.subsections || []).flatMap((part) => [part.title, part.text])];
          return add({ '@type': 'Trip', '@id': `${url}#day-${day.day}-${index + 1}`,
            name: cleanText(`День ${day.day}${day.title ? `: ${day.title}` : ''}`),
            description: texts.filter(Boolean).map(cleanText).join(' ').slice(0, 1800) || undefined,
            partOfTrip: ref(id), itinerary: day.places?.filter(Boolean).map((name) => {
              // Names in authored programme days are resolved only against the
              // tour's explicitly registered destinations. Ambiguous/unpublished
              // names remain ordinary Place labels, never guessed entity IDs.
              const term = cleanText(name).toLocaleLowerCase('ru').replace(/ё/g, 'е');
              const matches = (d.destinations || []).map((key) => byId.get(key))
                .filter((place) => publicRecord(place) && place.kind === 'destination')
                .filter((place) => [recordName(place), ...(place.data.searchAliases || [])]
                  .some((alias) => cleanText(alias).toLocaleLowerCase('ru').replace(/ё/g, 'е') === term));
              return matches.length === 1 ? ensureRecord(matches[0]) : { '@type': 'Place', name: cleanText(name) };
            }) });
        });
        const price = typeof d.priceFrom === 'number' && Number.isFinite(d.priceFrom) ? Math.round(d.priceFrom) : 0;
        // UI renders 0/null/missing as "По запросу"; never turn it into a free offer.
        if (!record.archived && price > 0 && /^[A-Z]{3}$/.test(d.currency || '') && document.priceVisible !== false) {
          node.offers = add({ '@type': 'Offer', '@id': `${url}#offer`, url, name: `Стоимость от ${price} ${d.currency}`,
            seller: ref(orgId), offeredBy: ref(orgId), itemOffered: ref(id), priceCurrency: d.currency,
            priceSpecification: { '@type': 'PriceSpecification', minPrice: price, priceCurrency: d.currency } });
        }
      }
    }
    if (record.kind === 'person') {
      const personAuthority = getAuthorityEntity(d.id, authority);
      node.jobTitle = cleanText(d.role);
      node.worksFor = ref(orgId);
      node.alternateName = personAuthority.alternateName;
      node.sameAs = [...new Set([...(node.sameAs || []), ...(d.externalProfiles || []), ...personAuthority.sameAs])]
        .filter((value) => /^https:\/\//.test(value));
      if (full) {
        node.description ||= cleanText(page.description);
        node.knowsAbout = d.expertise?.map((topic) => {
          const country = records.find((candidate) => candidate.kind === 'country' && publicRecord(candidate)
            && recordName(candidate) === cleanText(topic));
          return country ? ensureRecord(country) : topic;
        });
        node.knowsLanguage = d.languages?.map(languageCode);
      }
    }
    if (['case', 'article'].includes(record.kind)) {
      node.headline = recordName(record); node.publisher = ref(orgId); node.inLanguage = page.lang;
      if (full) {
        node.description ||= cleanText(page.description);
        node.articleSection = d.segment;
        node.datePublished = dateValue(d.publishedAt);
        node.dateModified = dateValue(d.updatedAt);
        const author = byId.get(d.authorId);
        if (publicRecord(author) && document.text?.includes(recordName(author))) node.author = ensureRecord(author);
      }
    }
    if (record.kind === 'case' && full && (d.projectStatus || 'completed') === 'completed') {
      const services = [...new Set(d.relatedServices || [])].filter((path) => visibleLocalPaths.has(path))
        .map(ensureService).filter(Boolean);
      node.about = [ref(orgId), ...services];
      node.spatialCoverage = [...new Set(d.countries || [])].map((key) => byId.get(key))
        .filter((country) => publicRecord(country) && country.kind === 'country').map((country) => ensureRecord(country));
      for (const service of services) connectCaseService(ref(id), service);
      // An anonymous customer's supplied words remain a quotation, without an
      // invented author or rating. Only an actual visible blockquote qualifies.
      const quote = visibleCaseQuotation(record, services);
      if (quote) node.hasPart = [quote];
    }
    return add(mergeGeoPassport(node, record, geoKnowledge));
  }
  // The company's existing service geography reuses canonical country nodes and
  // their checked GEO passports. No second Brazil/Argentina/Peru identity graph.
  if (organization.areaServedEntityIds?.length) {
    const coverage = organization.areaServedEntityIds.map((id) => byId.get(id))
      .filter((record) => publicRecord(record) && record.kind === 'country')
      .map((record) => ['/', '/about/'].includes(page.path) ? ensureRecord(record) : ref(recordId(record, root)));
    if (coverage.length === organization.areaServedEntityIds.length) {
      organization = { ...organization, areaServed: [...coverage,
        ...(organization.areaServed || []).filter((area) => !hasType(area, 'Country'))] };
      add({ ...nodes.get(orgId), areaServed: organization.areaServed,
        contactPoint: { ...nodes.get(orgId).contactPoint, areaServed: organization.areaServed } });
    }
  }
  const founder = byId.get('person_anna');
  if (publicRecord(founder) && founder.kind === 'person') {
    add({ '@type': ['Organization', 'TravelAgency'], '@id': orgId, founder: ensureRecord(founder) });
  }
  const isMultiCountryCatalog = page.path === '/multi-country/'
    || /^\/multi-country\/page\/(?:[2-9]|[1-9]\d+)\/$/.test(page.path);
  const isVipCatalog = page.path === '/vip/'
    || /^\/vip\/page\/(?:[2-9]|[1-9]\d+)\/$/.test(page.path);
  if (current) {
    webPage.mainEntity = ensureRecord(current, true);
    webPage.about = webPage.mainEntity;
    const countryIds = current.kind === 'tour' ? (current.data.routeCountries || current.data.countries || [])
      : current.kind === 'excursion' ? [current.data.country] : current.kind === 'destination' ? [current.data.countryId]
      : current.kind === 'country' ? [current.data.id] : [];
    webPage.spatialCoverage = [...new Set(countryIds)].map((id) => byId.get(id)).filter(publicRecord).map((r) => ensureRecord(r));
    if (current.archived) webPage.description = `${webPage.description} Архивная программа; не предлагается к бронированию.`;
  } else if (isMultiCountryCatalog) {
    const multiCountryTours = records.filter((record) => publicRecord(record) && record.kind === 'tour'
      && new Set(record.data.routeCountries || record.data.countries || []).size > 1);
    const multiCountryCountryIds = [...new Set(multiCountryTours.flatMap((record) => record.data.routeCountries || record.data.countries || []))];
    const coverage = multiCountryCountryIds.map((id) => byId.get(id)).filter(publicRecord).map((record) => ensureRecord(record));
    const serviceUrl = absoluteUrl('/multi-country/', root);
    const service = add({ '@type': 'Service', '@id': `${serviceUrl}#service`,
      name: 'Multi-country туры по Латинской Америке',
      description: 'Организация путешествий по нескольким странам Латинской Америки: единая программа, перелеты, трансферы, отели, гиды и экскурсии.',
      serviceType: 'Организация путешествий по нескольким странам',
      url: serviceUrl, provider: ref(orgId), areaServed: coverage.length ? coverage : organization.areaServed });
    webPage.about = service;
    if (coverage.length) webPage.spatialCoverage = coverage;
  } else if (isVipCatalog) {
    const vipTours = selectVipTours(records.filter((record) => publicRecord(record) && record.kind === 'tour')).entries;
    const vipCountryIds = [...new Set(vipTours.flatMap((record) => record.data.routeCountries || record.data.countries || []))];
    const coverage = vipCountryIds.map((id) => byId.get(id)).filter(publicRecord).map((record) => ensureRecord(record));
    const serviceUrl = absoluteUrl('/vip/', root);
    const service = add({ '@type': 'Service', '@id': `${serviceUrl}#service`,
      name: 'VIP и Luxury туры по Латинской Америке',
      description: 'Организация индивидуальных VIP и Luxury путешествий по Бразилии и Латинской Америке с персональной адаптацией маршрута.',
      serviceType: 'Организация индивидуальных VIP-путешествий',
      url: serviceUrl, provider: ref(orgId), areaServed: coverage.length ? coverage : organization.areaServed });
    webPage.about = service;
    if (coverage.length) webPage.spatialCoverage = coverage;
  } else if (/^\/multi-country\/[a-z0-9-]+(?:_[a-z0-9-]+)+(?:\/interests\/[a-z0-9-]+)?\/(?:page\/[2-9][0-9]*\/)?$/.test(page.path)) {
    // Exact combinations are independent, statically generated selection pages.
    // Derive their geography from their canonical slugs, not any unrelated tour.
    const selectionPath = page.path.replace(/page\/[2-9][0-9]*\/$/, '');
    const parts = selectionPath.split('/').filter(Boolean);
    const slugs = parts[1].split('_');
    const foundCountries = slugs.map((slug) => records.find((record) =>
      record.kind === 'country' && publicRecord(record) && record.data.slug === slug));
    if (foundCountries.length >= 2 && foundCountries.every(Boolean)) {
      const coverage = foundCountries.map((record) => ensureRecord(record));
      const interestSlug = parts[2] === 'interests' ? parts[3] : undefined;
      const theme = interestSlug ? records.find((record) =>
        record.kind === 'theme' && publicRecord(record) && record.data.slug === interestSlug) : undefined;
      const canonicalRoot = absoluteUrl(selectionPath, root);
      const service = add({ '@type': 'Service', '@id': canonicalRoot + '#service',
        url: canonicalRoot, name: cleanText(page.title).replace(/\s*[—-]\s*страница\s+\d+.*$/i, ''),
        serviceType: 'Организация путешествий по выбранным странам',
        category: theme ? recordName(theme) : 'Multi-country',
        provider: ref(orgId), areaServed: coverage, about: theme ? ensureRecord(theme) : undefined });
      webPage.about = service;
      webPage.spatialCoverage = coverage;
    }
  } else if (/^\/vip\/[a-z0-9-]+(?:\/interests\/[a-z0-9-]+)?\/(?:page\/[2-9][0-9]*\/)?$/.test(page.path)) {
    const selectionPath = page.path.replace(/page\/[2-9][0-9]*\/$/, '');
    const parts = selectionPath.split('/').filter(Boolean);
    const country = records.find((record) => record.kind === 'country'
      && publicRecord(record) && record.data.slug === parts[1]);
    const theme = parts[2] === 'interests' ? records.find((record) =>
      record.kind === 'theme' && publicRecord(record) && record.data.slug === parts[3]) : undefined;
    if (country) {
      const serviceUrl = absoluteUrl(selectionPath, root);
      const coverage = [ensureRecord(country)];
      const service = add({ '@type': 'Service', '@id': serviceUrl + '#service',
        url: serviceUrl, name: cleanText(page.title).replace(/\s*[—-]\s*страница\s+\d+.*$/i, ''),
        serviceType: 'Организация VIP и Luxury путешествий',
        category: theme ? recordName(theme) : 'VIP / Luxury',
        provider: ref(orgId), areaServed: coverage, about: theme ? ensureRecord(theme) : undefined });
      webPage.about = service; webPage.spatialCoverage = coverage;
    }
  } else if (serviceConfig) {
    const service = add({ '@type': 'Service', '@id': `${page.url}#service`, name: cleanText(document.h1 || page.title),
      description: cleanText(page.description), serviceType: serviceConfig.serviceType, category: serviceConfig.category,
      url: page.url, provider: ref(orgId), areaServed: organization.areaServed,
      mainEntityOfPage: ref(pageId), image: imageRef,
      termsOfService: page.path.startsWith('/dmc/') && visibleLocalPaths.has('/dmc/terms/')
        ? absoluteUrl('/dmc/terms/', root) : undefined });
    webPage.mainEntity = service; webPage.about = service;
  } else if (['/', '/about/', '/contacts/'].includes(page.path)) {
    webPage.mainEntity = ref(orgId); webPage.about = ref(orgId);
  } else if (['/team/', '/reviews/', '/privacy/', '/personal-data/'].includes(page.path)) {
    webPage.about = ref(orgId);
  }
  if (breadcrumbs.length) {
    const trails = breadcrumbs.filter((b) => b.itemListElement?.length >= 2);
    webPage.breadcrumb = trails.map((b, i) => add({ ...b, '@context': undefined, '@id': `${page.url}#breadcrumb${i ? `-${i + 1}` : ''}`,
      itemListElement: b.itemListElement.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: cleanText(item.name), item: absoluteUrl(item.item, root) })) }));
  }
  // Collections describe only rendered cards, in their rendered order, never the entire DB.
  const groupData = document.groups || [];
  const listedUrls = new Set();
  if (page.path === '/mice/programmes/') {
    webPage.citation = [...new Set(programmeExamples.filter((item) => item.status === 'published_programme_example')
      .map((item) => absoluteUrl(item.url, root))
      .filter((url) => url && /^https:\/\//.test(url) && visibleSourceUrls.has(url)))];
  }
  // This editorial programme index has one deliberate list of its cards. Links
  // repeated in explanations must not create competing or duplicate lists.
  if (page.path === '/mice/programmes/' && Array.isArray(document.programmeLinks)) {
    const programmeRecords = new Map();
    for (const link of document.programmeLinks) {
      const url = absoluteUrl(link.href, root);
      if (!url || new URL(url).origin !== new URL(root).origin) continue;
      const record = byPath.get(logicalPath(url, root));
      if (publicRecord(record) && record.kind === 'tour' && record.data.audiences?.includes('b2b')) {
        programmeRecords.set(recordId(record, root), record);
      }
    }
    if (programmeRecords.size) {
      webPage.mainEntity = add({ '@type': 'ItemList', '@id': `${page.url}#programmes`,
        name: cleanText(document.h1 || page.title), numberOfItems: programmeRecords.size,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        itemListElement: [...programmeRecords.values()].map((record, index) => ({
          '@type': 'ListItem', position: index + 1, name: recordName(record),
          url: absoluteUrl(record.path, root), item: ensureRecord(record),
        })) });
    }
  }
  for (const [index, group] of (page.path === '/mice/programmes/' ? [] : groupData).entries()) {
    const items = []; const seen = new Set();
    for (const link of group.links || []) {
      const url = absoluteUrl(link.href, root);
      if (!url || new URL(url).origin !== new URL(root).origin) continue;
      const path = logicalPath(url, root);
      const record = byPath.get(path) || byId.get(link.entityId);
      if (record && !publicRecord(record)) continue;
      if (!record && !link.catalog) continue;
      if (path === page.path || seen.has(url) || group.fallback && listedUrls.has(url)) continue;
      seen.add(url); listedUrls.add(url);
      const item = record && record.path === path ? ensureRecord(record)
        : add({ '@type': 'CollectionPage', '@id': `${url}#webpage`, name: cleanText(link.name) || recordName(record), url,
          isPartOf: ref(siteId), about: record ? ensureRecord(record) : undefined });
      items.push({ '@type': 'ListItem', position: (group.offset || 0) + items.length + 1,
        name: record && record.path === path ? recordName(record) : cleanText(link.name) || recordName(record), url, item });
    }
    if (!items.length && !group.catalog) continue;
    const list = add({ '@type': 'ItemList', '@id': `${page.url}#${group.catalog ? 'catalog' : `list-${index + 1}`}`,
      name: cleanText(group.name || document.h1 || page.title), numberOfItems: items.length,
      itemListOrder: 'https://schema.org/ItemListOrderAscending', itemListElement: items });
    // Preserve an explicitly empty catalog's itemListElement (valid, also checked in CI).
    if (!items.length) nodes.get(list['@id']).itemListElement = [];
    if (group.catalog || (!webPage.mainEntity && pageType === 'CollectionPage')) webPage.mainEntity = list;
    // ItemList is Intangible, not CreativeWork: hasPart is reserved for page content.
    else webPage.mentions.push(list);
  }
  if (serviceConfig) {
    const service = ref(`${page.url}#service`);
    for (const record of records.filter((item) => publicRecord(item) && item.kind === 'case'
      && (item.data.projectStatus || 'completed') === 'completed'
      && item.data.relatedServices?.includes(page.path) && visibleLocalPaths.has(item.path))) {
      const article = ensureRecord(record);
      const existing = nodes.get(article['@id']);
      const about = new Map((existing.about || []).map((item) => [item['@id'], item]));
      about.set(orgId, ref(orgId)); about.set(service['@id'], service);
      add({ ...existing, about: [...about.values()] });
      connectCaseService(article, service);
    }
  }
  // A quotation can also be displayed on a supporting page (for example the
  // partnership terms). Its real case/service relations do not change there.
  for (const displayed of document.caseQuotations || []) {
    const record = byId.get(displayed.entityId);
    if (!publicRecord(record) || record.kind !== 'case'
      || (record.data.projectStatus || 'completed') !== 'completed'
      || !visibleLocalPaths.has(record.path)
      || displayed.text !== quotationText(record.data.testimonial?.quote)) continue;
    const services = [...new Set(record.data.relatedServices || [])]
      .filter((path) => path === page.path || visibleLocalPaths.has(path)).map(ensureService).filter(Boolean);
    const article = ensureRecord(record);
    const existing = nodes.get(article['@id']);
    const about = new Map((existing.about || []).map((item) => [item['@id'], item]));
    for (const item of [ref(orgId), ...services]) about.set(item['@id'], item);
    const quote = visibleCaseQuotation(record, services);
    const parts = new Map((existing.hasPart || []).map((item) => [item['@id'], item]));
    if (quote) parts.set(quote['@id'], quote);
    add({ ...existing, about: [...about.values()], hasPart: [...parts.values()] });
    for (const service of services) connectCaseService(article, service);
  }
  // Only actually rendered links contribute. Prices are starting quotes, not maximum trip costs.
  // Tours and excursions and their currencies stay separate; countries advertise tours only.
  if (!current?.archived) {
    const pricedProducts = new Map();
    for (const group of groupData) {
      for (const link of group.links || []) {
        const url = absoluteUrl(link.href, root);
        if (!url || new URL(url).origin !== new URL(root).origin) continue;
        const record = byPath.get(logicalPath(url, root));
        if (!publicRecord(record) || !['tour', 'excursion'].includes(record.kind)) continue;
        if (current?.kind === 'country' && record.kind !== 'tour') continue;
        const { priceFrom, currency } = record.data;
        const price = typeof priceFrom === 'number' && Number.isFinite(priceFrom) ? Math.round(priceFrom) : 0;
        if (price <= 0 || !/^[A-Z]{3}$/.test(currency || '')) continue;
        const key = `${record.kind}:${currency}`;
        if (!pricedProducts.has(key)) pricedProducts.set(key, new Map());
        pricedProducts.get(key).set(record.data.id, price);
      }
    }
    for (const [key, uniqueProducts] of pricedProducts) {
      if (uniqueProducts.size < 2) continue; // One price is not a range.
      const [kind, currency] = key.split(':');
      const prices = [...uniqueProducts.values()];
      const plural = kind === 'tour' ? 'туров' : 'экскурсий';
      const aggregate = add({
        '@type': 'AggregateOffer',
        '@id': `${page.url}#${kind}-${currency}-price-range`,
        url: page.url,
        priceCurrency: currency,
        lowPrice: Math.min(...prices),
        highPrice: Math.max(...prices),
        offerCount: prices.length,
        seller: ref(orgId),
      });
      const selection = add({
        '@type': 'Service',
        '@id': `${page.url}#${kind}-${currency}-selection`,
        url: page.url,
        name: `Подборка ${plural} Ada Tours`,
        serviceType: `Организация ${plural}`,
        provider: ref(orgId),
        offers: aggregate,
      });
      webPage.mentions.push(selection);
    }
  }
  // Keep authored reviews only when their text and author are actually on this page.
  const authored = [extra].flat().flatMap((n) => n?.['@graph'] || [n]).filter(Boolean);
  const reviews = authored.filter((n) => hasType(n, 'Review') && cleanText(n.reviewBody) && cleanText(n.author?.name)
    && document.text?.includes(cleanText(n.reviewBody)) && document.text?.includes(cleanText(n.author?.name)));
  if (reviews.length) {
    const refs = reviews.map((n, i) => add({ '@type': 'Review', '@id': `${page.url}#review-${i + 1}`,
      itemReviewed: ref(orgId), author: { '@type': 'Person', name: cleanText(n.author.name) },
      reviewBody: cleanText(n.reviewBody), inLanguage: n.inLanguage || page.lang, citation: n.citation }));
    const list = add({ '@type': 'ItemList', '@id': `${page.url}#reviews`, name: 'Отзывы', numberOfItems: refs.length,
      itemListElement: refs.map((item, i) => ({ '@type': 'ListItem', position: i + 1, item })) });
    if (page.path === '/reviews/') webPage.mainEntity = list;
    else webPage.mentions.push(list);

    const authoredAggregate = authored.find((n) => hasType(n, 'AggregateRating'));
    if (authoredAggregate) {
      const aggregate = add({
        '@type': 'AggregateRating',
        '@id': `${organization.url.replace(/\/$/, '')}/#aggregate-rating`,
        // Nested in Organization.aggregateRating: the parent is already the rated entity.
        ratingValue: authoredAggregate.ratingValue,
        bestRating: authoredAggregate.bestRating,
        worstRating: authoredAggregate.worstRating,
        reviewCount: reviews.length,
      });
      add({ '@type': ['Organization', 'TravelAgency'], '@id': orgId, aggregateRating: aggregate });
    }
  }
  // Homepage sections and the actual linked collections/services share canonical IDs.
  if (page.path === '/') {
    const visiblePaths = new Set(groupData.flatMap((group) => group.links || [])
      .map((link) => absoluteUrl(link.href, root))
      .filter((url) => url && new URL(url).origin === new URL(root).origin)
      .map((url) => logicalPath(url, root)));
    const catalogRefs = new Map();
    for (const [path, name] of [
      ['/country/', 'Страны путешествий'],
      ['/interests/', 'Интересы путешественников'],
      ['/tours/', 'Туры Ada Tours'],
      ['/places/', 'Места Латинской Америки'],
      ['/excursions/', 'Экскурсии'],
    ]) {
      if (!visiblePaths.has(path)) continue;
      const url = absoluteUrl(path, root);
      const item = add({ '@type': 'CollectionPage', '@id': `${url}#webpage`,
        name, url, isPartOf: ref(siteId) });
      catalogRefs.set(path, item);
      webPage.mentions.push(item);
    }
    const serviceRefs = new Map();
    for (const [path, name, serviceType] of [
      ['/multi-country/', 'Multi-country туры по Латинской Америке', 'Организация путешествий по нескольким странам'],
      ['/vip/', 'VIP и Luxury туры по Латинской Америке', 'Организация индивидуальных VIP-путешествий'],
      ['/mice/', 'MICE и деловые поездки', 'Организация MICE и корпоративных поездок'],
      ['/dmc/', 'DMC / B2B', 'DMC и принимающее обслуживание в Бразилии и Латинской Америке'],
    ]) {
      if (!visiblePaths.has(path)) continue;
      const url = absoluteUrl(path, root);
      const service = add({ '@type': 'Service', '@id': `${url}#service`,
        name, serviceType, url, provider: ref(orgId), areaServed: organization.areaServed });
      serviceRefs.set(path, service);
      webPage.mentions.push(service);
    }
    const sectionTopics = {
      'home-start': [...catalogRefs.values(), ...serviceRefs.values()],
      'home-countries': [catalogRefs.get('/country/')],
      'home-interests': [catalogRefs.get('/interests/')],
      'home-tours': [catalogRefs.get('/tours/')],
      'home-discover': [catalogRefs.get('/places/'), catalogRefs.get('/excursions/')],
      'home-services': ['/vip/', '/mice/', '/dmc/'].map((path) => serviceRefs.get(path)),
      'home-team': publicRecord(founder) && document.text?.includes(recordName(founder)) ? [ensureRecord(founder)] : [],
      'home-reviews': [nodes.has(`${page.url}#reviews`) ? ref(`${page.url}#reviews`) : undefined],
      'home-final': [ref(orgId)],
    };
    for (const section of document.sections || []) {
      if (!/^home-[a-z0-9-]+$/.test(section.id) || !cleanText(section.name)) continue;
      const groupIndex = groupData.findIndex((group) => cleanText(group.name) === cleanText(section.name));
      const listId = `${page.url}#list-${groupIndex + 1}`;
      const topics = [...(sectionTopics[section.id] || []),
        groupIndex >= 0 && nodes.has(listId) ? ref(listId) : undefined].filter(Boolean);
      webPage.hasPart.push(add({ '@type': 'WebPageElement',
        '@id': `${page.url}#section-${section.id}`,
        name: cleanText(section.name), url: `${page.url}#${section.id}`,
        isPartOf: ref(pageId),
        mentions: [...new Map(topics.map((item) => [item['@id'], item])).values()],
      }));
    }
  }

  // The approved SEO/GEO article is visibly rendered in SeoGeoSection on THIS
  // canonical page. It is a contained Article, not another canonical page or
  // a duplicate mainEntity. References resolve to the site's stable entity IDs.
  const editorial = !current?.archived && !/\/page\/[2-9][0-9]*\/$/.test(page.path)
    ? document.editorial : null;
  const editorialFaq = [];
  if (editorial?.headline && editorial.sections?.length) {
    const normalizeLabel = (value) => cleanText(value).toLocaleLowerCase('ru')
      .replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/giu, ' ').trim();
    const editorialUrl = (value) => {
      const url = absoluteUrl(value, root);
      if (!url) return null;
      try {
        const uri = new URL(url);
        if (uri.origin !== new URL(root).origin || uri.search || uri.hash) return null;
        return uri.href;
      } catch { return null; }
    };
    const linkedRecord = (url) => {
      const linked = editorialUrl(url);
      if (!linked) return null;
      const record = byPath.get(logicalPath(linked, root));
      return publicRecord(record) && record?.path !== page.path ? record : null;
    };
    const linkedRef = (url) => {
      const linked = editorialUrl(url);
      if (!linked || linked === page.url) return undefined;
      const record = linkedRecord(linked);
      if (record) return ensureRecord(record);
      if (byPath.has(logicalPath(linked, root))) return undefined; // archived/draft direct object
      // A linked, canonical selection/catalogue is a WebPage, not a fabricated
      // Tour, Place or Product. Its existence is validated against built HTML.
      return add({ '@type': 'WebPage', '@id': linked + '#webpage',
        url: linked, isPartOf: ref(siteId) });
    };
    const refsFor = (urls, limit = 32) => [...new Map((urls || [])
      .slice(0, 160).map(linkedRef).filter(Boolean)
      .map((item) => [item['@id'], item])).values()].slice(0, limit);
    const topicRecords = (section) => {
      const title = ' ' + normalizeLabel(section.name) + ' ';
      return [...new Map((section.links || []).map(linkedRecord).filter(Boolean)
        .filter((record) => [recordName(record), ...(record.data.searchAliases || [])]
          .some((alias) => {
            const name = normalizeLabel(alias);
            return name.length >= 4 && title.includes(' ' + name + ' ');
          }))
        .map((record) => [record.data.id, record])).values()].slice(0, 5);
    };
    const addSubjectOf = (record, work) => {
      const id = recordId(record, root), entity = nodes.get(id);
      const previous = entity?.subjectOf || [];
      const subjects = [...new Map([...previous, work].map((item) => [item['@id'], item])).values()];
      add({ '@type': publicType(record), '@id': id, subjectOf: subjects.slice(0, 15) });
    };
    const articleId = page.url + '#seo-geo-article';
    const articleRef = ref(articleId);
    const sectionRefs = new Map();
    const childSections = new Map();
    const articleMentions = refsFor(editorial.links, 80);
    for (const section of editorial.sections.slice(0, 32)) {
      const id = page.url + '#seo-geo-' + section.key;
      const sectionRef = ref(id);
      sectionRefs.set(section.key, sectionRef);
      const parent = section.parentKey && sectionRefs.get(section.parentKey);
      if (parent) {
        if (!childSections.has(parent['@id'])) childSections.set(parent['@id'], []);
        childSections.get(parent['@id']).push(sectionRef);
      }
      const mainTopics = topicRecords(section);
      const about = mainTopics.length ? mainTopics.map((record) => ensureRecord(record))
        : webPage.about ? [webPage.about].flat() : [];
      add({ '@type': 'WebPageElement', '@id': id,
        name: cleanText(section.name),
        description: cleanText(section.description).slice(0, 360) || undefined,
        url: section.headingId ? page.url + '#' + encodeURIComponent(section.headingId) : undefined,
        isPartOf: parent || articleRef,
        about, mentions: refsFor(section.links, 28),
      });
      for (const record of mainTopics) addSubjectOf(record, sectionRef);
    }
    const roots = [];
    for (const section of editorial.sections.slice(0, 32)) {
      const item = sectionRefs.get(section.key);
      if (item && !section.parentKey) roots.push(item);
    }
    for (const [parentId, children] of childSections) {
      const parent = nodes.get(parentId);
      if (parent) add({ ...parent, hasPart: children });
    }
    for (const table of (editorial.tables || []).slice(0, 16)) {
      const id = page.url + '#seo-geo-' + table.key;
      const tableRef = add({ '@type': 'Table', '@id': id,
        name: cleanText(table.name), headline: table.columns?.join(' / ') || undefined,
        text: cleanText(table.text).slice(0, 900) || undefined,
        isPartOf: sectionRefs.get(table.sectionKey) || articleRef,
        mentions: refsFor(table.links, 28) });
      const parentId = sectionRefs.get(table.sectionKey)?.['@id'];
      if (parentId && nodes.has(parentId)) {
        const parent = nodes.get(parentId);
        add({ ...parent, hasPart: [...(parent.hasPart || []), tableRef] });
      } else roots.push(tableRef);
    }
    const article = add({ '@type': 'Article', '@id': articleId,
      url: page.url + '#seo-geo-content-' + (editorial.targetPath || page.path).split('/').filter(Boolean).join('-'),
      headline: cleanText(editorial.headline),
      description: cleanText(editorial.lead).slice(0, 1000) || undefined,
      inLanguage: page.lang, publisher: ref(orgId),
      isPartOf: ref(pageId),
      about: webPage.about,
      mentions: articleMentions, hasPart: roots });
    webPage.hasPart.push(article);
    // Linked URLs are already real HTML anchors; do not invent keyword links.
    const important = [...new Set((editorial.links || []).map(editorialUrl).filter((url) =>
      url && url !== page.url && (!byPath.has(logicalPath(url, root)) || linkedRecord(url))))];
    if (important.length) webPage.significantLink = important.slice(0, 36);
    if (current && publicRecord(current)) addSubjectOf(current, article);
    if (current?.kind === 'country' && publicRecord(current)) {
      const places = [...new Map((editorial.links || []).map(linkedRecord)
        .filter((record) => record?.kind === 'destination' && record.data.countryId === current.data.id)
        .map((record) => [record.data.id, record])).values()].slice(0, 40);
      if (places.length) {
        add({ '@type': publicType(current), '@id': recordId(current, root),
          containsPlace: places.map((place) => ensureRecord(place)) });
      }
    }
    for (const row of editorial.faq || []) editorialFaq.push(row);
  }
  // FAQ is extracted from actual readable questions/answers, not unused frontmatter fields.
  const extraFaq = authored.filter((n) => hasType(n, 'FAQPage')).flatMap((n) => n.mainEntity || [])
    .filter((n) => document.text?.includes(cleanText(n.name)) && cleanText(n.acceptedAnswer?.text) && document.text?.includes(cleanText(n.acceptedAnswer.text)))
    .map((n) => ({ question: cleanText(n.name), answer: cleanText(n.acceptedAnswer.text) }));
  const faq = [...new Map([...(document.faq || []), ...editorialFaq, ...extraFaq].map((q) => [q.question, q])).values()];
  if (faq.length) {
    const faqRef = add({ '@type': 'FAQPage', '@id': `${page.url}#faq`, url: page.url, name: 'Вопросы и ответы', inLanguage: page.lang,
      isPartOf: ref(pageId), mainEntity: faq.map((q, i) => ({ '@type': 'Question', '@id': `${page.url}#question-${i + 1}`,
        name: cleanText(q.question),
        url: q.headingId ? page.url + '#' + encodeURIComponent(q.headingId) : undefined,
        acceptedAnswer: { '@type': 'Answer', text: cleanText(q.answer),
          mentions: (q.links || []).map((url) => {
            const target = absoluteUrl(url, root);
            if (!target || new URL(target).origin !== new URL(root).origin) return undefined;
            const record = byPath.get(logicalPath(target, root));
            return publicRecord(record) ? ensureRecord(record) : undefined;
          }).filter(Boolean) } })) });
    webPage.hasPart.push(faqRef);
  }
  // External works are described only where their links are actually rendered.
  // The source decides whether it is about the entity or merely mentions it.
  const visibleAuthoritySources = getVisibleAuthoritySources(page.path, document, authority);
  const visiblePartners = getVisibleAuthorityPartners(page.path, document, authority);
  const partnerRefs = new Map(visiblePartners.map((partner) => [partner.id, add({
    '@type': 'Organization', '@id': partner.schemaId, name: cleanText(partner.name),
    url: partner.url, description: cleanText(partner.description),
  })]));
  if (partnerRefs.size) {
    const company = nodes.get(orgId);
    const partnerIds = new Set([...partnerRefs.values()].map((item) => item['@id']));
    // ABAV is the same organization here and in the established membership claim.
    // Commercial representatives are not members, owners or subsidiaries of Ada Tours.
    if (company.memberOf) add({ ...company, memberOf: company.memberOf.map((item) =>
      partnerIds.has(item['@id']) ? ref(item['@id']) : item) });
  }
  const authorityRef = (key) => key === 'organization' ? ref(orgId)
    : partnerRefs.get(key) || (publicRecord(byId.get(key)) ? ensureRecord(byId.get(key)) : undefined);
  const appendRelation = (key, property, item) => {
    const target = authorityRef(key);
    const entity = target && nodes.get(target['@id']);
    if (!entity) return;
    const values = [...new Map([...(entity[property] || []), item].map((value) => [value['@id'], value])).values()];
    add({ ...entity, [property]: values });
  };
  const citations = [];
  const authorityWorks = new Map();
  for (const source of visibleAuthoritySources) {
    const inProofCollection = ['/partners/', '/press/'].includes(page.path);
    const profile = inProofCollection && source.kind === 'profile';
    const directory = inProofCollection && source.kind === 'directory';
    const tradeEvent = page.path === '/press/' && source.kind === 'trade_event';
    const report = page.path === '/press/' && source.kind === 'report';
    if (!['article', 'event'].includes(source.kind) && !profile && !directory && !tradeEvent && !report) continue;
    const event = source.kind === 'event';
    const relationRefs = (property) => (source.relations?.[property] || []).map(authorityRef).filter(Boolean);
    const publisher = visiblePartners.find((partner) => partner.url === source.publisher?.url);
    const work = add({
      '@id': authoritySourceId(source, event || tradeEvent ? 'event' : profile || directory ? 'webpage' : 'article'),
      '@type': event ? 'EducationEvent' : tradeEvent ? 'Event' : report ? 'Report'
        : directory ? (source.schemaType === 'WebPage' ? 'WebPage' : 'CollectionPage')
        : profile ? 'ProfilePage' : source.schemaType === 'NewsArticle' ? 'NewsArticle' : 'Article',
      url: source.url, name: cleanText(source.name), headline: source.kind === 'article' || report ? cleanText(source.name) : undefined,
      description: cleanText(source.summary) || undefined, inLanguage: source.language,
      publisher: event ? undefined : publisher ? partnerRefs.get(publisher.id)
        : { '@type': 'Organization', name: source.publisher.name, url: source.publisher.url },
      datePublished: event ? undefined : source.datePublished,
      dateModified: event ? undefined : source.dateModified,
      about: relationRefs('subjectOf'), mentions: relationRefs('mentions'),
      // A dedicated Ada profile identifies Ada. A general partner directory only mentions it.
      mainEntity: profile ? relationRefs('sameAs')[0] : undefined,
      performer: event ? relationRefs('performer') : undefined,
      organizer: event ? relationRefs('organizer') : undefined,
      startDate: event || tradeEvent ? source.startDate : undefined,
      attendee: tradeEvent ? relationRefs('attendee') : undefined,
      eventAttendanceMode: event ? source.eventAttendanceMode : undefined,
      location: tradeEvent ? source.locationName : undefined,
      ...(event && source.eventAttendanceMode === 'https://schema.org/OnlineEventAttendanceMode'
        ? { location: { '@type': 'VirtualLocation', url: source.url } } : {}),
    });
    authorityWorks.set(source.id, work);
    for (const key of source.relations?.subjectOf || []) appendRelation(key, 'subjectOf', work);
    if (event || tradeEvent) {
      if (event) for (const key of source.relations?.performer || []) appendRelation(key, 'performerIn', work);
      webPage.mentions.push(work);
    } else citations.push(work);
  }
  if (citations.length) webPage.citation = citations;
  const authorityCollection = ['/press/', '/webinars/', '/partners/'].includes(page.path);
  if (authorityCollection) {
    webPage.about = [ref(orgId), ...(page.path === '/partners/' ? [...partnerRefs.values()]
      : [authorityRef('person_anna')].filter(Boolean))];
    const curated = new Set(getAuthorityPageSources(page.path, authority).map((source) => source.id));
    const listEntries = page.path === '/partners/'
      ? visiblePartners.map((partner) => ({ name: partner.name, url: partner.url, item: partnerRefs.get(partner.id) }))
      : visibleAuthoritySources.filter((source) => curated.has(source.id)
        && source.kind === (page.path === '/webinars/' ? 'event' : 'article'))
        .map((source) => ({ name: source.label || source.name, url: source.url, item: authorityWorks.get(source.id) }));
    if (listEntries.length) {
      if (webPage.mainEntity) webPage.mentions.push(webPage.mainEntity);
      webPage.mainEntity = add({ '@type': 'ItemList', '@id': `${page.url}#authority-list`,
        name: cleanText(document.h1 || page.title), numberOfItems: listEntries.length,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        itemListElement: listEntries.map((entry, index) => ({ '@type': 'ListItem', position: index + 1,
          name: cleanText(entry.name), url: entry.url, item: entry.item })),
      });
    }
  }
  // Cited trade-show listings form a separate visible evidence collection.
  if (page.path === '/press/') {
    const curated = new Set(getAuthorityExhibitionSources(page.path, authority).map((s) => s.id));
    const entries = visibleAuthoritySources.filter((s) => curated.has(s.id) && authorityWorks.has(s.id));
    if (entries.length) {
      const list = add({ '@type': 'ItemList', '@id': `${page.url}#exhibition-list`,
        name: 'Ada Tours на профессиональных выставках', numberOfItems: entries.length,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        itemListElement: entries.map((s, i) => ({ '@type': 'ListItem', position: i + 1,
          name: cleanText(s.label || s.name), url: s.url, item: authorityWorks.get(s.id) })) });
      webPage.hasPart.push(list);
    }
  }
  add(webPage);
  return { '@context': 'https://schema.org', '@graph': [...nodes.values()] };
}
