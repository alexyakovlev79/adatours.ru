/** English-only Schema.org projection for the shared Ada Tours source graph.
 * Deliberately independent of the EN noindex rendering gate: this module builds
 * a testable future graph but NEVER injects JSON-LD into preview HTML.
 * Source IDs, prices, URL identity, verified external links and geographic
 * relations are owned by the canonical site.
 */
import { buildStructuredData, hasType, logicalPath, recordId } from '../structured-data.mjs';
import { uiText } from './messages.mjs';
import { translateUiText, sharedCountryName, sharedInterestName } from './shared-ui-locale.mjs';
import { translateAuthoredPageText } from './page-copy.mjs';
import team from '../../data/i18n/team.en.json' with { type: 'json' };

const CYRILLIC = /[\u0400-\u052f]/u;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const clean = (value) => typeof value === 'string' ? value.trim() : '';
const acceptable = (value) => clean(value) && !CYRILLIC.test(value);
const approved = (value) => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  if (acceptable(value)) return value;
  for (const candidate of [translateAuthoredPageText(value, 'en'), translateUiText(value, 'en')]) {
    if (acceptable(candidate)) return candidate;
  }
  return undefined;
};
const normalize = value => clean(value).toLocaleLowerCase('ru').replace(/ё/g, 'е');
const same = (left, right) => normalize(left) === normalize(right);

const PAGE_LABELS = Object.freeze({
  '/': 'Home', '/country/': 'Countries', '/tours/': 'Tours',
  '/places/': 'Places', '/excursions/': 'Excursions',
  '/interests/': 'Travel interests', '/team/': 'The Ada Tours team',
  '/cases/': 'Case studies', '/reviews/': 'Reviews',
  '/press/': 'Ada Tours in the media', '/webinars/': 'Webinars',
  '/partners/': 'Partners', '/articles/': 'Articles',
  '/vip/': 'VIP and Luxury travel', '/multi-country/': 'Multi-country travel',
  '/mice/': 'MICE and corporate travel', '/dmc/': 'DMC services',
  '/dmc/travel-agencies/': 'DMC services for travel agencies',
  '/dmc/terms/': 'Working with Ada Tours',
  '/mice/business-delegations/': 'Business delegations'
});
const SERVICES = Object.freeze({
  '/dmc/': {
    name: 'DMC in Brazil and Latin America',
    serviceType: 'Inbound destination management in Brazil and Latin America',
    category: 'B2B destination management',
    keywords: ['DMC Brazil', 'DMC Latin America', 'inbound tour operator', 'travel agency ground services', 'MICE Brazil', 'multi-country travel']
  },
  '/dmc/travel-agencies/': {
    name: 'DMC services for travel agencies and tour operators',
    serviceType: 'Destination management for travel agencies and tour operators',
    category: 'B2B travel agency services',
    keywords: ['DMC for travel agencies', 'DMC for tour operators', 'Brazil ground handling', 'Brazil travel programmes', 'multi-country DMC']
  },
  '/dmc/terms/': {
    name: 'Working with Ada Tours: B2B terms',
    serviceType: 'B2B cooperation terms for destination management',
    category: 'B2B cooperation terms',
    keywords: ['DMC cooperation terms', 'DMC agency agreement', 'travel agency commissions', 'Brazil DMC terms']
  },
  '/mice/': { name: 'MICE and corporate travel', serviceType: 'MICE and corporate travel arrangements' },
  '/mice/business-delegations/': { name: 'Business delegations', serviceType: 'Business delegation travel arrangements' },
  '/multi-country/': {
    name: 'Multi-country travel in Latin America',
    serviceType: 'Multi-country travel arrangements',
    description: 'Travel arrangements across several Latin American countries, including itineraries, transport, accommodation and excursions.'
  },
  '/vip/': {
    name: 'VIP and Luxury travel in Latin America',
    serviceType: 'Tailor-made VIP journeys',
    description: 'Private VIP and Luxury travel in Brazil and Latin America with tailor-made itineraries.'
  }
});

function knownName(record) {
  const data = record.data;
  const original = data.name || data.title;
  if (record.kind === 'country') {
    const value = sharedCountryName(data.slug, original, 'en');
    return acceptable(value) ? value : undefined;
  }
  if (record.kind === 'theme') {
    const value = sharedInterestName(data.id, original, 'en');
    return acceptable(value) ? value : undefined;
  }
  if (record.kind === 'person') {
    const colleague = team.members[data.id];
    if (colleague) return colleague.name;
    if (data.id === 'person_anna') return 'Anna Avanesova';
  }
  return approved(original);
}

function englishRecords(records) {
  const names = new Map(), ambiguous = new Set();
  for (const record of records) {
    const from = record.data.name || record.data.title;
    const target = knownName(record);
    if (!from || !target || !CYRILLIC.test(from)) continue;
    const key = normalize(from);
    if (names.has(key) && names.get(key) !== target) ambiguous.add(key);
    else names.set(key, target);
  }
  for (const key of ambiguous) names.delete(key);
  const phrase = (value) => names.get(normalize(value)) || approved(value);
  const list = (values) => Array.isArray(values) ? values.map(phrase).filter(Boolean) : values;
  const projected = records.map(record => {
    const data = structuredClone(record.data);
    const name = knownName(record);
    if (own(data, 'name')) data.name = name;
    if (own(data, 'title')) data.title = record.kind === 'person' ? name : (approved(data.title) || name);
    for (const field of ['lead','summary','description','role','format','duration','priceNote','destinationName','bestTime','entryNotes']) {
      if (own(data, field)) data[field] = approved(data[field]);
    }
    if (record.kind === 'person') {
      if (team.members[data.id]) data.role = team.members[data.id].role;
      if (data.id === 'person_anna') data.role = 'Founder and CEO';
    }
    for (const field of ['audiences','expertise','regions','languages','included','notIncluded','notes','route']) {
      if (Array.isArray(data[field])) {
        const translated = list(data[field]);
        // An incomplete authored route must not misrepresent order or places:
        // the shared builder will fall back to registered routeDestinations.
        data[field] = field === 'route' && translated.length !== data[field].length ? [] : translated;
      }
    }
    if (Array.isArray(data.faq)) data.faq = data.faq.map(row => ({
      ...row, question: approved(row.question), answer: approved(row.answer)
    })).filter(row => row.question && row.answer);
    if (Array.isArray(data.facts)) data.facts = data.facts.map(row => ({
      ...row, label: approved(row.label)
    }));
    if (Array.isArray(data.itinerary)) data.itinerary = data.itinerary.map(day => {
      const result = { ...day,
        title: approved(day.title),
        text: approved(day.text),
        places: list(day.places),
      };
      if (Array.isArray(day.subsections)) result.subsections = day.subsections.map(part => ({
        ...part, title: approved(part.title), text: approved(part.text)
      }));
      if (Array.isArray(day.contentBlocks)) result.contentBlocks = day.contentBlocks.map(block => ({
        ...block, title: approved(block.title), text: approved(block.text)
      }));
      return result;
    });
    return { ...record, data };
  });
  return projected;
}

function localizedOrganization(organization) {
  const copy = uiText('en','site.defaultDescription');
  return {
    ...organization,
    description: copy,
    areaServed: (organization.areaServed || []).map(place => {
      const name = same(place.name,'Латинская Америка') ? 'Latin America'
        : approved(place.name) || (same(place.name,'Бразилия') ? 'Brazil'
          : same(place.name,'Аргентина') ? 'Argentina'
          : same(place.name,'Перу') ? 'Peru' : undefined);
      return { ...place, name };
    })
  };
}

const DISPLAY_FIELDS = new Set([
  'name','description','headline','text','caption','serviceType','category',
  'keywords','touristType','jobTitle','articleSection','reviewBody','alternateName'
]);
function removeUntranslated(value, key, originalLanguage = false) {
  if (Array.isArray(value)) return value.map(part => removeUntranslated(part,key,originalLanguage))
    .filter(part => part !== undefined && part !== '');
  if (value && typeof value === 'object') {
    // Registered external articles and their genuine titles keep their source
    // language, rather than masquerading as translated English publications.
    const sourceLanguage = originalLanguage || (value.inLanguage && value.inLanguage !== 'en');
    return Object.fromEntries(Object.entries(value).map(([field,part]) => [
      field, removeUntranslated(part,field,sourceLanguage)
    ]).filter(([,part]) => part !== undefined && part !== ''));
  }
  if (typeof value === 'string' && DISPLAY_FIELDS.has(key) && CYRILLIC.test(value) && !originalLanguage) {
    return approved(value);
  }
  return value;
}

function englishGraph(graph, input, projected) {
  const recordsById = new Map(projected.map(row => [row.data.id,row]));
  const namesById = new Map(projected.map(row => [recordId(row,input.root),
    clean(row.data.name || row.data.title)]));
  const pagePath = input.page.path;
  for (const node of graph['@graph']) {
    const type = node['@type'];
    if (hasType(node, 'TouristTrip') && node.identifier) {
      const record = recordsById.get(node.identifier);
      const data = record?.data;
      if (data && ['tour','excursion'].includes(record.kind)) {
        const parts = [data.lead || data.summary || data.description].filter(Boolean);
        if (record.kind === 'tour') {
          const duration = [Number.isSafeInteger(data.durationDays) && data.durationDays > 0
            ? data.durationDays + (data.durationDays === 1 ? ' day' : ' days') : '',
          Number.isSafeInteger(data.durationNights) && data.durationNights >= 0
            ? data.durationNights + (data.durationNights === 1 ? ' night' : ' nights') : ''].filter(Boolean);
          if (duration.length) parts.push('Duration: ' + duration.join(', ') + '.');
        } else if (data.duration) parts.push('Duration: ' + data.duration + '.');
        if (data.format) parts.push('Format: ' + data.format + '.');
        node.description = parts.join(' ') || undefined;
      }
    }
    if (hasType(node,'Trip') && /#day-\d+-\d+$/.test(node['@id'])) {
      const match = /#day-(\d+)-\d+$/.exec(node['@id']);
      const title = clean(node.name).replace(/^День\s+\d+\s*:?\s*/u,'');
      node.name = 'Day ' + match[1] + (acceptable(title) ? ': ' + title : '');
    }
    if (hasType(node,'Offer') && node.priceSpecification?.minPrice > 0) {
      node.name = 'From ' + node.priceSpecification.minPrice + ' ' + node.priceCurrency;
    }
    if (hasType(node,'ItemList')) {
      if (node['@id'].endsWith('#itinerary')) node.name = 'Itinerary';
      if (node['@id'].endsWith('#reviews')) node.name = 'Reviews';
      if (node['@id'].endsWith('#exhibition-list')) node.name = 'Ada Tours at travel industry exhibitions';
      for (const item of node.itemListElement || []) {
        const identity = item.item?.['@id'];
        const sourceName = identity && namesById.get(identity);
        if (sourceName && !CYRILLIC.test(sourceName)) item.name = sourceName;
        else if (item.name) item.name = approved(item.name);
      }
    }
    if (hasType(node,'DefinedTermSet')) node.name = 'Ada Tours travel interests';
    if (hasType(node,'FAQPage')) node.name = 'Questions and answers';
    if (hasType(node,'Service')) {
      const path = node.url ? logicalPath(node.url,input.root) : '';
      const exact = SERVICES[path];
      const group = path.startsWith('/multi-country/') ? SERVICES['/multi-country/']
        : path.startsWith('/vip/') ? SERVICES['/vip/'] : undefined;
      if (exact) {
        node.name = exact.name;
        node.serviceType = exact.serviceType;
        node.category = exact.category;
        if (exact.description) node.description = exact.description;
      } else if (group) {
        node.name = path === pagePath ? input.page.title : group.name;
        node.serviceType = group.serviceType;
        if (node.description) node.description = approved(node.description) || group.description;
      } else {
        node.name = approved(node.name);
        node.serviceType = approved(node.serviceType);
        node.category = approved(node.category);
      }
      if (exact?.keywords) node.keywords = exact.keywords;
    }
    if (hasType(node,'CollectionPage') && node.url) {
      const path = logicalPath(node.url,input.root);
      if (PAGE_LABELS[path] && path !== pagePath) node.name = PAGE_LABELS[path];
    }
    if (hasType(node,'BreadcrumbList')) {
      for (const item of node.itemListElement || []) {
        const path = item.item ? logicalPath(item.item,input.root) : '';
        const record = projected.find(row => row.path === path);
        item.name = record ? (record.data.name || record.data.title)
          : PAGE_LABELS[path] || approved(item.name);
      }
    }
    if (hasType(node,'Person') && node.identifier === 'person_anna') {
      node.name = 'Anna Avanesova';
      node.jobTitle = 'Founder and CEO';
    }
    if (hasType(node,'WebPage') && node['@id'] === input.page.url + '#webpage') {
      node.name = input.page.title;
      node.description = input.page.description;
      node.inLanguage = 'en';
    }
    // English presentation may coexist with genuine original-language source
    // articles. Their titles and language codes are intentionally preserved.
    const sourceLanguage = node.inLanguage && node.inLanguage !== 'en';
    const cleaned = removeUntranslated(node,undefined,sourceLanguage);
    Object.keys(node).forEach(key => delete node[key]);
    Object.assign(node,cleaned);
  }
  return graph;
}

/** Build the future English graph from the same factual records and renderer.
 * This is invoked in a unit-testable code path; BaseLayout keeps EN noindex
 * JSON-LD suppressed until the separate indexable release is authorised.
 */
export function buildEnglishStructuredData(input) {
  if (input?.page?.lang !== 'en') throw new TypeError('English Schema projection requires page.lang=en');
  const projected = englishRecords(input.records);
  const organization = localizedOrganization(input.organization);
  const graph = buildStructuredData({ ...input, organization, records: projected });
  return englishGraph(graph, input, projected);
}
