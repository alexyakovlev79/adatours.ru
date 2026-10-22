import source from '../../data/external-identity/site-sameas-20261022.json' with { type: 'json' };

// This is a checked-in migration snapshot, not a live Google Sheets feed.
// The map is initialized once by the static site build, never shipped as client JS.
const ROOT = 'https://adatours.ru';
const DOMAINS = ['vipdeluxetravel.ru', 'adatours.com', 'brasiltours.ru'];
const byPath = new Map();
const englishTargets = new Map();
const sourceCounts = Object.create(null);

for (const domain of DOMAINS) {
  const pairs = source.pairs?.[domain] || [];
  const enabled = domain !== 'vipdeluxetravel.ru' || source.temporaryLegacyVip === true;
  const distinct = new Set();
  sourceCounts[domain] = pairs.length;

  for (const [externalUrl, targetPath] of pairs) {
    const external = new URL(externalUrl);
    if (external.protocol !== 'https:' || external.hostname !== domain ||
        external.username || external.password || distinct.has(externalUrl)) {
      throw new Error('Invalid or duplicate external sameAs source: ' + externalUrl);
    }
    distinct.add(externalUrl);
    if (typeof targetPath !== 'string' || !targetPath.startsWith('/') ||
        targetPath.startsWith('//') || !targetPath.endsWith('/') ||
        targetPath.includes('?') || targetPath.includes('#') ||
        targetPath.includes('\\')) {
      throw new Error('Invalid canonical sameAs target: ' + targetPath);
    }
    if (domain === 'adatours.com') {
      const existing = englishTargets.get(externalUrl);
      if (existing && existing !== targetPath) {
        throw new Error('EN source has conflicting RU targets: ' + externalUrl);
      }
      englishTargets.set(externalUrl, targetPath);
    }
    if (!enabled) continue;
    const list = byPath.get(targetPath) || new Set();
    list.add(externalUrl);
    byPath.set(targetPath, list);
  }
}

export function authoritativeEnglishTarget(externalUrl) {
  return englishTargets.get(externalUrl);
}

export function externalPageSameAs(path) {
  return [...(byPath.get(path) || [])];
}

export function externalSameAsCounts() {
  return { ...sourceCounts };
}

export function attachExternalPageSameAs(graph, { path, pageUrl, entityId } = {}) {
  const sources = byPath.get(path);
  if (!sources?.size || !Array.isArray(graph?.['@graph'])) return graph;

  // Product/Country/Place identity belongs to its primary schema entity.
  // Editorial hubs and generated catalogues have no dedicated entity, so use WebPage.
  const nodes = graph['@graph'];
  const entity = entityId && nodes.find((node) => node['@id'] === entityId);
  const target = entity || nodes.find((node) => node['@id'] === pageUrl + '#webpage');
  if (!target) return graph;

  const earlier = Array.isArray(target.sameAs)
    ? target.sameAs : target.sameAs ? [target.sameAs] : [];
  const validEarlier = earlier.filter((externalUrl) => {
    const winner = englishTargets.get(externalUrl);
    return !winner || winner === path;
  });
  target.sameAs = [...new Set([...validEarlier, ...sources])];
  return graph;
}
