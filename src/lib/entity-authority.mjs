import registry from '../../data/external-identity/entity-authority-20261022.json' with { type: 'json' };

// One local evidence register feeds both readable sources and the static graph.
// It is separate from the geographic passport queue and has no runtime requests.
export const authorityRegistry = registry;
export const AUTHORITY_MIN_PROBABILITY = 70;
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

export function getVisibleAuthoritySources(path, document = {}, data = registry) {
  const visibleUrls = new Set([
    ...(document.links || []), ...(document.groups || []).flatMap((group) => group.links || []),
  ].map((link) => typeof link === 'string' ? link : link.href));
  return acceptedAuthoritySources(data).filter((source) => source.displayOn?.includes(path)
    && visibleUrls.has(source.url));
}
