/** Collection storage keys must not depend on a public slug or translated name. */
export function contentIdentity({ data, entry = '' }) {
  if (typeof data?.id !== 'string' || !data.id.trim()) throw new Error(`Missing stable content ID: ${entry}`);
  if (typeof data?.locale !== 'string' || !data.locale.trim()) throw new Error(`Missing content locale: ${entry}`);
  return `${data.locale}:${data.id}`;
}
