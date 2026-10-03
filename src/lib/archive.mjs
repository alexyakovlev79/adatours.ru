import registry from '../../data/catalog-archive.json' with { type: 'json' };

/** Reversible business lifecycle, independent of media/rewrite QA status. */
export const archiveEntries = registry.entries;
export const archiveById = new Map(archiveEntries.map((entry) => [entry.id, entry]));
const dataOf = (value) => value?.data ?? value ?? {};
export const isArchivedEntity = (value) => {
  const data = dataOf(value);
  return data.status === 'archived' || archiveById.has(data.id);
};
export const isActiveEntity = (value) => {
  const data = dataOf(value);
  return data.status !== 'draft' && !isArchivedEntity(data);
};
export const archiveInfo = (value) => archiveById.get(typeof value === 'string' ? value : dataOf(value).id);

/** Never resolve an archived record to another archived record or follow a cycle. */
export function activeReplacementId(id) {
  const seen = new Set();
  while (archiveById.has(id)) {
    if (seen.has(id)) throw new Error(`Archive replacement cycle: ${id}`);
    seen.add(id);
    id = archiveById.get(id).duplicateOf;
    if (!id) return undefined;
  }
  return id;
}

export function logicalArchivePath(value, base = '/') {
  let pathname = new URL(value, 'https://adatours.ru').pathname;
  const prefix = `/${base.split('/').filter(Boolean).join('/')}`;
  if (prefix !== '/' && (pathname === prefix || pathname.startsWith(`${prefix}/`))) pathname = pathname.slice(prefix.length) || '/';
  return `/${pathname.split('/').filter(Boolean).join('/')}/`.replace(/^\/\/$/, '/');
}
const archivedPaths = new Set(archiveEntries.flatMap((entry) => [entry.url, ...(entry.legacyUrls ?? [])]).map((url) => logicalArchivePath(url)));
export const isArchivedPath = (pathname, base = '/') => archivedPaths.has(logicalArchivePath(pathname, base));

/** Mass photo jobs must check both the slot owner and its published content. */
export function isPhotoEligible(entry, content) {
  return Boolean(content) && isActiveEntity(entry) && isActiveEntity(content);
}
