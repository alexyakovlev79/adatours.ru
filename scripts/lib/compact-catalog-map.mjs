// Only entries are source records. Nested destinations are references to records.
export function compactCatalogById(catalog) {
  if (!Array.isArray(catalog?.entries)) {
    throw new TypeError('Compact catalog must contain an entries array');
  }
  const records = new Map();
  for (const entry of catalog.entries) {
    if (typeof entry?.id !== 'string' || !entry.id) {
      throw new TypeError('Compact catalog entry must have an id');
    }
    if (records.has(entry.id)) {
      throw new Error(`Duplicate compact catalog entry: ${entry.id}`);
    }
    records.set(entry.id, entry);
  }
  return records;
}
