import { selectVipTours } from './vip-tours.mjs';

/** Schema.org graph builder. Pure, deterministic, no network and no browser JS.
 * Facts come from the content model and the rendered page, never SEO inventions.
 */
export const SCHEMA_VERSION = '2026-10-08.1';
export const types = (node) => [node?.['@type'] ?? []].flat();
export const hasType = (node, type) => types(node).includes(type);
export const ref = (id) => ({ '@id': id });
export const cleanText = (value = '') => String(value)
  .replace(/<[^>]+>/g, ' ').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`#]+/g, '')
  .replace(/\s+/g, ' ').trim();
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
const collectionPaths = new Set(['/country/', '/tours/', '/places/', '/excursions/', '/interests/', '/team/', '/cases/', '/reviews/', '/articles/']);
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
  if (record.kind === 'country') return record.data.slug === 'antarctica' ? ['Place', 'TouristDestination'] : ['Country', 'TouristDestination'];
  if (record.kind === 'destination') return record.data.destinationType === 'city' ? ['City', 'TouristDestination'] : 'TouristDestination';
  return { tour: 'TouristTrip', excursion: 'TouristTrip', theme: 'DefinedTerm', person: 'Person', case: 'Article', article: 'Article' }[record.kind];
};
/** Create a new context per page; records/indexes can be shared by the caller. */
export function buildStructuredData({ root, organization, records, page, document = {}, breadcrumbs = [], extra = [] }) {
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
  add({ '@type': 'ImageObject', '@id': logoId, url: absoluteUrl(organization.logo, root), contentUrl: absoluteUrl(organization.logo, root), caption: organization.name, width: 553, height: 184 });
  add({ '@type': ['Organization', 'TravelAgency'], '@id': orgId, name: organization.name,
    legalName: organization.legalName, url: organization.url, logo: ref(logoId),
    description: cleanText(organization.description), email: organization.email, telephone: organization.telephone,
    identifier: organization.cnpj ? { '@type': 'PropertyValue', propertyID: 'CNPJ', value: organization.cnpj } : undefined,
    taxID: organization.cnpj, address: organization.address, areaServed: organization.areaServed,
    sameAs: organization.sameAs?.filter((url) => /^https?:\/\//.test(url)),
    knowsLanguage: organization.languages?.map(languageCode),
    contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', email: organization.email,
      telephone: organization.telephone, availableLanguage: organization.languages?.map(languageCode),
      areaServed: organization.areaServed },
  });
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
  function ensureRecord(record, full = false) {
    const d = record.data;
    const id = recordId(record, root);
    if (nodes.has(id) && !full) return ref(id);
    const url = absoluteUrl(record.path, root);
    const node = { '@type': publicType(record), '@id': id, name: recordName(record), url,
      identifier: d.id, description: full ? cleanText(d.lead || d.summary || d.description) || undefined : undefined,
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
            partOfTrip: ref(id), itinerary: day.places?.filter(Boolean).map((name) => ({ '@type': 'Place', name: cleanText(name) })) });
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
      node.jobTitle = cleanText(d.role);
      node.worksFor = ref(orgId);
      if (full) {
        node.description ||= cleanText(page.description);
        node.knowsAbout = d.expertise;
        node.knowsLanguage = d.languages?.map(languageCode);
        node.sameAs = d.externalProfiles?.filter((v) => /^https?:\/\//.test(v));
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
    return add(node);
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
      : current.kind === 'excursion' ? [current.data.country] : current.kind === 'destination' ? [current.data.countryId] : [];
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
  } else if (serviceConfig) {
    const service = add({ '@type': 'Service', '@id': `${page.url}#service`, name: cleanText(document.h1 || page.title),
      description: cleanText(page.description), serviceType: serviceConfig.serviceType, category: serviceConfig.category,
      url: page.url, provider: ref(orgId), areaServed: organization.areaServed,
      mainEntityOfPage: ref(pageId), image: imageRef });
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
  for (const [index, group] of groupData.entries()) {
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
  // Keep authored reviews only when their text and author are actually on this page.
  const authored = [extra].flat().flatMap((n) => n?.['@graph'] || [n]).filter(Boolean);
  const reviews = authored.filter((n) => hasType(n, 'Review') && cleanText(n.reviewBody)
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
        itemReviewed: ref(orgId),
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
  // FAQ is extracted from actual readable questions/answers, not unused frontmatter fields.
  const extraFaq = authored.filter((n) => hasType(n, 'FAQPage')).flatMap((n) => n.mainEntity || [])
    .filter((n) => document.text?.includes(cleanText(n.name)) && cleanText(n.acceptedAnswer?.text) && document.text?.includes(cleanText(n.acceptedAnswer.text)))
    .map((n) => ({ question: cleanText(n.name), answer: cleanText(n.acceptedAnswer.text) }));
  const faq = [...new Map([...(document.faq || []), ...extraFaq].map((q) => [q.question, q])).values()];
  if (faq.length) {
    const faqRef = add({ '@type': 'FAQPage', '@id': `${page.url}#faq`, url: page.url, name: 'Вопросы и ответы', inLanguage: page.lang,
      isPartOf: ref(pageId), mainEntity: faq.map((q, i) => ({ '@type': 'Question', '@id': `${page.url}#question-${i + 1}`,
        name: cleanText(q.question), acceptedAnswer: { '@type': 'Answer', text: cleanText(q.answer) } })) });
    webPage.hasPart.push(faqRef);
  }
  add(webPage);
  return { '@context': 'https://schema.org', '@graph': [...nodes.values()] };
}
