import registry from '../../data/i18n/sites.json' with { type: 'json' };

export function validateOrigin(value) {
  if (typeof value !== 'string' || /[\s\u0000-\u001f\u007f]/.test(value)) {
    throw new Error('Site origin must be an absolute HTTPS origin without whitespace');
  }
  let url;
  try { url = new URL(value); } catch { throw new Error('Site origin must be an absolute HTTPS origin'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Site origin must contain only HTTPS scheme and host');
  }
  return url.origin;
}

export function validateBase(base) {
  if (typeof base !== 'string' || !base.startsWith('/') || base.startsWith('//') ||
      /[?#%\\\s\u0000-\u001f\u007f]/.test(base) || base.includes('//') ||
      /(?:^|\/)\.(?:\/|$)|\.{2}|%2e|%2f|%5c|%0[0-9a-f]|%1[0-9a-f]|%7f/i.test(base)) {
    throw new Error('Site base must be a safe absolute path');
  }
  return base === '/' ? '/' : `${base.replace(/\/+$/, '')}/`;
}

/** Pure configuration: changing a host cannot enable a language or publish content. */
export function localeSite(locale, overrides = {}) {
  if (!Object.hasOwn(registry.sites, locale)) throw new Error(`Unsupported site locale: ${locale}`);
  const original = registry.sites[locale];
  const allowed = new Set(['origin', 'base', 'preview']);
  if (overrides === null || typeof overrides !== 'object' || Array.isArray(overrides) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(overrides))) throw new Error('Site overrides must be a plain object');
  if (Object.keys(overrides).some((key) => !allowed.has(key))) throw new Error('Unsupported site override');
  if (overrides.preview !== undefined && typeof overrides.preview !== 'boolean') throw new Error('preview must be a boolean');
  const origin = validateOrigin(overrides.origin ?? original.origin);
  const base = validateBase(overrides.base ?? original.base);
  const alternateDeployment = origin !== validateOrigin(original.origin) || base !== validateBase(original.base);
  if (alternateDeployment && overrides.preview === false) throw new Error('Approve a new public origin/base in the site registry before publication');
  const preview = overrides.preview ?? alternateDeployment;
  return Object.freeze({
    ...original, locale,
    origin, base,
    entityOrigin: registry.entityOrigin,
    mediaOrigin: registry.mediaOrigin,
    preview,
    indexable: original.releaseState === 'published' && !preview,
  });
}

export function localeUrl(logicalPath, site) {
  if (typeof logicalPath !== 'string' || !logicalPath.startsWith('/') || logicalPath.startsWith('//') ||
      /[?#%\\\s\u0000-\u001f\u007f]/.test(logicalPath) || logicalPath.includes('//') ||
      /(?:^|\/)\.(?:\/|$)|\.{2}|%2e|%2f|%5c|%0[0-9a-f]|%1[0-9a-f]|%7f/i.test(logicalPath)) {
    throw new Error('Canonical route must be an absolute unencoded logical path without query or fragment');
  }
  const base = validateBase(site.base);
  const path = logicalPath === '/' ? base : `${base}${logicalPath.slice(1)}`;
  const origin = validateOrigin(site.origin);
  const result = new URL(path, origin);
  if (result.origin !== origin) throw new Error('Canonical route cannot change site origin');
  return result.href;
}

/** Publication gates are deliberately explicit; the foundation cannot enable EN. */
export function assertPublicLocaleRelease(site, gates) {
  if (site.preview !== false || site.indexable !== true || site.releaseState !== 'published') throw new Error(`Locale is not enabled for publication: ${site.locale}`);
  for (const key of ['content', 'ui', 'metadata', 'schema', 'links', 'search', 'forms']) {
    if (gates?.[key] !== true) throw new Error(`Incomplete locale release gate: ${key}`);
  }
  return true;
}

/** Counterparts come from an exact entity publication ledger, never path guessing. */
export function languageAlternates(entityId, variants, sites = {}) {
  const result = [];
  const seen = new Set();
  for (const variant of variants) {
    if (variant.entityId !== entityId || !hasPublicationEvidence(variant)) continue;
    const site = sites[variant.locale] ?? localeSite(variant.locale);
    if (site.locale !== variant.locale) throw new Error(`Publication locale mismatch: ${variant.locale}`);
    if (site.indexable !== true || site.preview !== false || site.releaseState !== 'published') continue;
    if (seen.has(variant.locale)) throw new Error(`Duplicate locale publication: ${entityId}:${variant.locale}`);
    const url = localeUrl(variant.path, site);
    if (variant.url !== url) throw new Error(`Publication URL mismatch: ${entityId}:${variant.locale}`);
    seen.add(variant.locale);
    result.push({ hreflang: site.hreflang, href: url });
  }
  return result;
}

function hasPublicationEvidence(variant) {
  return variant.state === 'published' && typeof variant.deployReceipt === 'string' && variant.deployReceipt.trim().length > 0;
}

/**
 * Apply to CreativeWork/WebPage nodes from the same verified publication ledger.
 * Equivalent page scope/hreflang does not prove a translation: an independent
 * English Word programme needs an explicit approvedTranslationOfWorkId decision.
 */
export function translationRelations(locale, counterparts, sourceLocale = 'ru') {
  const published = counterparts.filter(hasPublicationEvidence);
  const entityIds = new Set(published.map((item) => item.entityId));
  if (entityIds.size > 1 || (published.length && ![...entityIds].every((id) => typeof id === 'string' && id.length > 0))) {
    throw new Error('Translation counterparts must belong to one explicit entity');
  }
  const seen = new Set();
  for (const item of published) {
    if (seen.has(item.locale)) throw new Error(`Duplicate translation locale: ${item.locale}`);
    seen.add(item.locale);
    let url;
    try { url = new URL(item.webPageId); } catch { throw new Error('Published translation requires an absolute WebPage ID'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Published translation requires an HTTPS WebPage ID');
  }
  const source = published.find((item) => item.locale === sourceLocale);
  const target = published.find((item) => item.locale === locale);
  if (!target || !source) return {};
  if (locale !== sourceLocale) return target.approvedTranslationOfWorkId === source.webPageId
    ? { translationOfWork: { '@id': source.webPageId } } : {};
  const translated = published.filter((item) => item.locale !== sourceLocale &&
    item.approvedTranslationOfWorkId === source.webPageId);
  return translated.length ? { workTranslation: translated.map((item) => ({ '@id': item.webPageId })) } : {};
}

/** One real organization, distinct localized websites. Legacy profile evidence is retained. */
export function localizedOrganizationIdentity(locale, existingSameAs = [], overrides = {}) {
  if (!Array.isArray(existingSameAs)) throw new Error('Organization sameAs must be an array');
  const site = localeSite(locale, overrides);
  const otherOfficial = locale === 'en' ? localeUrl('/', localeSite('ru')) : null;
  const sameAs = [...new Set([...existingSameAs, otherOfficial].filter(Boolean).flatMap((value) => {
    try {
      if (typeof value !== 'string' || /[\s\u0000-\u001f\u007f]/.test(value)) return [];
      const u = new URL(value);
      return u.protocol === 'https:' && !u.username && !u.password && u.href !== localeUrl('/', site) ? [u.href] : [];
    } catch { return []; }
  }))];
  return { '@id': `${registry.entityOrigin}/#organization`, url: localeUrl('/', site), sameAs };
}
