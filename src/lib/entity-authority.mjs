import registry from '../../data/external-identity/entity-authority-20261022.json' with { type: 'json' };

// One local evidence register feeds both readable sources and the static graph.
// It is separate from the geographic passport queue and has no runtime requests.
export const authorityRegistry = registry;
export const AUTHORITY_MIN_PROBABILITY = 70;
// Fragment routes and section anchors must retain a single IRI fragment delimiter.
export const authoritySourceId = (source, suffix) => `${source.url}${source.url.includes('#') ? '-' : '#'}${suffix}`;
const https = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
};
const accepted = (entry) => entry?.status === 'verified'
  && Number.isFinite(entry.probability) && entry.probability >= AUTHORITY_MIN_PROBABILITY
  && entry.probability <= 100 && typeof entry.evidence === 'string' && entry.evidence.trim();
export const acceptedAuthoritySources = (data = registry) => (data?.sources || [])
  .filter((source) => accepted(source) && https(source.url));
const concerns = (source, entityKey) => Object.values(source.relations || {})
  .some((keys) => Array.isArray(keys) && keys.includes(entityKey));

export function getAuthoritySources(entityKey, { path, groups } = {}, data = registry) {
  return acceptedAuthoritySources(data).filter((source) => concerns(source, entityKey)
    && (!path || source.displayOn?.includes(path))
    && (!groups?.length || groups.includes(source.displayGroup)));
}

// Curated collections share their order and membership with the page template.
// The renderer still independently requires every source URL to be visible.
export function getAuthorityPageSources(path, data = registry) {
  const page = data?.futurePages?.find((entry) => entry.path === path);
  const sources = new Map(acceptedAuthoritySources(data).map((source) => [source.id, source]));
  return [...new Set(page?.sourceIds || [])].map((id) => sources.get(id))
    .filter((source) => source?.displayOn?.includes(path));
}

// Exhibition profiles, official rosters and dated reports are curated separately from press articles.
export function getAuthorityExhibitionSources(path, data = registry) {
  const page = data?.futurePages?.find((entry) => entry.path === path);
  const byId = new Map(acceptedAuthoritySources(data).map((source) => [source.id, source]));
  return [...new Set(page?.exhibitionSourceIds || [])].map((id) => byId.get(id))
    .filter((source) => source?.displayOn?.includes(path));
}

export function getAuthorityPartners(data = registry) {
  const sources = new Map(acceptedAuthoritySources(data).map((source) => [source.id, source]));
  return (data?.partners || []).filter((partner) => accepted(partner)
    && partner.sourceIds?.length && partner.sourceIds.every((id) => sources.has(id)))
    .map((partner) => {
      const entity = data.entities?.[partner.entity];
      if (!entity?.name || !https(entity.url) || !https(entity.schemaId)) return undefined;
      return { id: partner.entity, name: entity.name, url: entity.url, schemaId: entity.schemaId,
        role: partner.role, description: partner.description,
        sourceIds: [...partner.sourceIds], sources: partner.sourceIds.map((id) => sources.get(id)) };
    }).filter(Boolean);
}

export function getAuthorityEntity(entityKey, data = registry) {
  const sources = acceptedAuthoritySources(data);
  const ids = new Set(sources.map((source) => source.id));
  const urlsFor = (property) => [...new Set(sources.filter((source) =>
    source.relations?.[property]?.includes(entityKey)).map((source) => source.url))];
  const fields = { sameAs: urlsFor('sameAs'), hasMap: urlsFor('hasMap') };
  for (const claim of data?.claims || []) {
    if (claim.entity !== entityKey || !accepted(claim)
      || !claim.evidenceSourceIds?.length || !claim.evidenceSourceIds.every((id) => ids.has(id))) continue;
    // No arbitrary schema fields can be injected by an unreviewed research row.
    if (claim.property === 'alternateName' && Array.isArray(claim.value)) {
      fields.alternateName = claim.value.filter((value) => typeof value === 'string' && value.trim());
    }
    if (claim.property === 'memberOf' && https(claim.value?.url) && claim.value?.name) {
      fields.memberOf = [...(fields.memberOf || []), {
        '@type': 'Organization', '@id': claim.value.url.replace(/\/$/, '') + '/#organization',
        name: claim.value.name, url: claim.value.url,
      }];
    }
  }
  return fields;
}

export function visibleAuthorityUrls(document = {}) {
  return [...new Set([
    ...(document.links || []), ...(document.groups || []).flatMap((group) => group.links || []),
  ].map((link) => typeof link === 'string' ? link : link.href).filter(Boolean))];
}

export function getVisibleAuthoritySources(path, document = {}, data = registry) {
  const sources = new Map(acceptedAuthoritySources(data)
    .filter((source) => source.displayOn?.includes(path)).map((source) => [source.url, source]));
  return visibleAuthorityUrls(document).map((url) => sources.get(url)).filter(Boolean);
}

export function getVisibleAuthorityPartners(path, document = {}, data = registry) {
  if (path !== '/partners/') return [];
  const visibleUrls = visibleAuthorityUrls(document);
  const sources = new Set(getVisibleAuthoritySources(path, document, data).map((source) => source.id));
  return getAuthorityPartners(data).filter((partner) => visibleUrls.includes(partner.url)
    && partner.sourceIds.some((id) => sources.has(id)))
    .sort((a, b) => visibleUrls.indexOf(a.url) - visibleUrls.indexOf(b.url));
}
