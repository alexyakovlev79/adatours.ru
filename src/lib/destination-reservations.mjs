/** Offline destination identity and preparation queue; no content or network I/O. */
const nonempty = (value) => typeof value === 'string' && Boolean(value.trim());
const cachePath = /\/image\/cache\//i;
const statuses = new Set(['needs_content', 'added']);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const transliteration = Object.fromEntries([
  ...'абвгдеёжзийклмнопрстуфхцчшщъыьэюя',
].map((letter, i) => [letter, [
  'a', 'b', 'v', 'g', 'd', 'e', 'e', 'zh', 'z', 'i', 'j', 'k', 'l', 'm', 'n',
  'o', 'p', 'r', 's', 't', 'u', 'f', 'h', 'c', 'ch', 'sh', 'sch', '', 'y', '', 'e', 'yu', 'ya',
][i]]));

/** Punctuation, whitespace, letter case and accents do not create new identities. */
export function normalizeDestinationName(value) {
  return String(value).toLocaleLowerCase('ru').replaceAll('ё', 'е').normalize('NFKD')
    .replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Only for a new record; an existing record's ID, slug and URL never change. */
export function destinationSlug(name) {
  return [...String(name).toLocaleLowerCase('ru')].map((letter) => transliteration[letter] ?? letter).join('')
    .normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const nameKeys = (item) => new Set([item.name, ...(item.aliases ?? []), item.slug].filter(nonempty).map(normalizeDestinationName));
const coreName = (name) => normalizeDestinationName(name.replace(/\([^)]*\)/g, ' '));
const evidenceKey = (item) => JSON.stringify([item.entityType, item.entityId, typeof item.evidence === 'string' ? item.evidence.trim().replace(/\s+/g, ' ') : null]);
const isWebUrl = (value) => {
  try { return nonempty(value) && ['http:', 'https:'].includes(new URL(value).protocol) && !cachePath.test(value); }
  catch { return false; }
};
const isOriginalImageReference = (value) => {
  if (isWebUrl(value)) return true;
  try {
    return typeof value === 'string' && value.startsWith('/media/') && !/[\\?#]/.test(value)
      && !decodeURIComponent(value).split('/').some((part) => part === '..' || part === '.');
  } catch { return false; }
};

function discoveryErrors(item, label) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return [`${label}: discoveredIn must be an object.`];
  const errors = [];
  if (!['tour', 'excursion', 'user_request'].includes(item.entityType)) errors.push(`${label}: entityType must be tour, excursion or user_request.`);
  if (item.entityType === 'user_request') {
    if (item.entityId != null && !nonempty(item.entityId)) errors.push(`${label}: entityId, when supplied, must be a nonempty string.`);
  } else if (!nonempty(item.entityId) || !item.entityId.startsWith(`${item.entityType}_`)) errors.push(`${label}: invalid entityId.`);
  if (!nonempty(item.evidence)) errors.push(`${label}: exact source evidence is required.`);
  if (item.sourceUrl != null && !isWebUrl(item.sourceUrl)) errors.push(`${label}: sourceUrl must be an exact web URL or null.`);
  return errors;
}

/**
 * Build guard contract. countries is [{id, slug}], publishedDestinationIds is an
 * iterable of IDs already parsed and schema-checked by Astro. Returns errors.
 */
export function validateDestinationReservations(catalog, queue, options = {}) {
  const errors = [];
  if (!Array.isArray(catalog)) return ['Destination catalog must be an array.'];
  if (queue?.version !== 1 || !Array.isArray(queue.entries)) return ['Destination reservations must have version:1 and entries:[].'];
  const countryMap = options.countries ? new Map(options.countries.map((item) => [item.id, item])) : null;
  const published = options.publishedDestinationIds == null ? null : new Set(options.publishedDestinationIds);
  const ids = new Set();
  const urls = new Set();
  const identities = new Map();
  for (const item of catalog) {
    if (!item || typeof item !== 'object') { errors.push('Invalid destination catalog record.'); continue; }
    const label = item.id ?? 'destination';
    for (const field of ['id', 'name', 'slug', 'countryId', 'countrySlug', 'url']) {
      if (!nonempty(item[field])) errors.push(`${label}: missing ${field}.`);
    }
    if (!/^destination_[a-z0-9_]+$/.test(item.id)) errors.push(`${label}: invalid ID.`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)) errors.push(`${label}: invalid slug.`);
    if (ids.has(item.id)) errors.push(`${label}: duplicate canonical ID.`);
    if (urls.has(item.url)) errors.push(`${label}: duplicate canonical URL.`);
    ids.add(item.id); urls.add(item.url);
    if (item.url !== `/${item.countrySlug}/place/${item.slug}/`) errors.push(`${label}: URL must follow its canonical country and slug.`);
    if (countryMap && countryMap.get(item.countryId)?.slug !== item.countrySlug) errors.push(`${label}: unknown country or countrySlug mismatch.`);
    if (item.sourceUrl != null && !isWebUrl(item.sourceUrl)) errors.push(`${label}: invalid sourceUrl.`);
    if (item.aliases != null && (!Array.isArray(item.aliases) || item.aliases.some((alias) => !nonempty(alias) || !normalizeDestinationName(alias)))) {
      errors.push(`${label}: aliases must be nonempty strings.`);
      continue;
    }
    for (const alias of nameKeys(item)) {
      const key = `${item.countryId}\0${alias}`;
      const previous = identities.get(key);
      if (previous && previous !== item.id) errors.push(`${label}: name/alias '${alias}' already belongs to ${previous} in this country.`);
      identities.set(key, item.id);
    }
  }
  const queued = new Set();
  for (const item of queue.entries) {
    if (!item || typeof item !== 'object') { errors.push('Invalid destination reservation record.'); continue; }
    const label = `reservation ${item.id}`;
    if (!ids.has(item.id)) errors.push(`${label}: ID is absent from the canonical catalog.`);
    if (queued.has(item.id)) errors.push(`${label}: duplicate queue entry.`);
    queued.add(item.id);
    for (const field of ['name', 'countryId', 'countrySlug', 'slug', 'url', 'aliases']) {
      if (own(item, field)) errors.push(`${label}: ${field} belongs only in the canonical catalog.`);
    }
    if (!statuses.has(item.status)) errors.push(`${label}: status must be needs_content or added.`);
    if (published && item.status !== (published.has(item.id) ? 'added' : 'needs_content')) {
      errors.push(`${label}: status must match the published Destination MD; update it in the same commit.`);
    }
    if (!Array.isArray(item.discoveredIn) || !item.discoveredIn.length) {
      errors.push(`${label}: discovery evidence is required.`);
    } else {
      const seen = new Set();
      for (const discovery of item.discoveredIn) {
        errors.push(...discoveryErrors(discovery, label));
        const key = evidenceKey(discovery ?? {});
        if (seen.has(key)) errors.push(`${label}: duplicate discovery evidence.`);
        seen.add(key);
      }
    }
    if (item.notes != null && typeof item.notes !== 'string') errors.push(`${label}: notes must be a string.`);
    if (item.materials != null) {
      if (typeof item.materials !== 'object' || Array.isArray(item.materials)) { errors.push(`${label}: materials must be an object.`); continue; }
      if (item.materials.textUrl != null && !isWebUrl(item.materials.textUrl)) errors.push(`${label}: invalid materials.textUrl.`);
      if (item.materials.repositoryPath != null && (!nonempty(item.materials.repositoryPath) || /(^\/|(^|\/)\.\.($|\/))/.test(item.materials.repositoryPath))) errors.push(`${label}: materials.repositoryPath must remain in the repository.`);
      if (item.materials.imageUrls != null && (!Array.isArray(item.materials.imageUrls) || item.materials.imageUrls.some((url) => !isOriginalImageReference(url)))) errors.push(`${label}: imageUrls must contain exact raw URLs or saved /media/ originals.`);
    }
    if (cachePath.test(JSON.stringify(item))) errors.push(`${label}: /image/cache/ is forbidden.`);
  }
  if (published) {
    for (const item of catalog) {
      if (item && !item.sourceUrl && !published.has(item.id) && !queued.has(item.id)) errors.push(`${item.id}: an unpublished place without a prepared source needs a reservation queue entry.`);
    }
  }
  return [...new Set(errors)];
}

/** Synchronize only queue state. The published set must come from real content. */
export function syncReservationStatuses(queue, publishedDestinationIds) {
  const published = new Set(publishedDestinationIds);
  return { ...queue, entries: queue.entries.map((item) => ({ ...item, status: published.has(item.id) ? 'added' : 'needs_content' })) };
}

/**
 * Pure, all-or-nothing JSON API used by the CLI and fixtures. Explicit aliases
 * supply cross-script names; this does not pretend to recognize all synonyms.
 */
export function reserveDestinations({ catalog, reservations, countries, publishedDestinationIds = [] }, input) {
  const fail = (result) => ({ ok: false, changed: false, results: [result], catalog, reservations });
  if (!Array.isArray(countries)) return fail({ outcome: 'invalid', errors: ['Known countries are required.'] });
  const initialErrors = validateDestinationReservations(catalog, reservations, { countries });
  if (initialErrors.length) return fail({ outcome: 'invalid', errors: initialErrors });
  const requests = Array.isArray(input) ? input : [input];
  if (!requests.length) return fail({ outcome: 'invalid', errors: ['At least one request is required.'] });
  const nextCatalog = structuredClone(catalog);
  const nextQueue = syncReservationStatuses(structuredClone(reservations), publishedDestinationIds);
  const countryMap = new Map(countries.map((item) => [item.id, item]));
  const published = new Set(publishedDestinationIds);
  const results = [];
  for (let requestIndex = 0; requestIndex < requests.length; requestIndex++) {
    const request = requests[requestIndex];
    const errors = [];
    if (!request || typeof request !== 'object' || Array.isArray(request)) return fail({ outcome: 'invalid', requestIndex, errors: ['Request must be an object.'] });
    const country = countryMap.get(request.countryId);
    if (!country) errors.push('countryId must identify one known country.');
    if (!nonempty(request.name) || !normalizeDestinationName(request.name)) errors.push('A real, explicitly named place is required.');
    if (request.aliases != null && (!Array.isArray(request.aliases) || request.aliases.some((alias) => !nonempty(alias) || !normalizeDestinationName(alias)))) errors.push('aliases must be nonempty strings.');
    if (request.destinationId != null && !nonempty(request.destinationId)) errors.push('destinationId must be a known canonical ID.');
    errors.push(...discoveryErrors(request.discoveredIn, `request ${requestIndex}`));
    if (cachePath.test(JSON.stringify(request))) errors.push('/image/cache/ is forbidden.');
    if (errors.length) return fail({ outcome: 'invalid', requestIndex, errors });
    const variants = [request.name.trim(), ...(request.aliases ?? []).map((alias) => alias.trim())];
    const wanted = new Set(variants.map(normalizeDestinationName));
    const inCountry = nextCatalog.filter((item) => item.countryId === country.id);
    const matches = inCountry.filter((item) => [...nameKeys(item)].some((alias) => wanted.has(alias)));
    let destination;
    if (request.destinationId) {
      destination = nextCatalog.find((item) => item.id === request.destinationId);
      if (!destination || destination.countryId !== country.id) return fail({ outcome: 'invalid', requestIndex, errors: ['destinationId does not belong to the requested country.'] });
      const conflicts = matches.filter((item) => item.id !== destination.id);
      if (conflicts.length) return fail({ outcome: 'ambiguous', requestIndex, candidates: [destination, ...conflicts], reason: 'The supplied name/alias also identifies another destination.' });
    } else if (matches.length > 1) {
      return fail({ outcome: 'ambiguous', requestIndex, candidates: matches, reason: 'Names/aliases identify multiple destinations; choose the exact existing ID.' });
    } else destination = matches[0];

    let outcome = 'existing';
    if (!destination) {
      // A short unqualified name may denote an existing qualified object. Do
      // not create a second object merely because its qualifier was omitted.
      const partials = inCountry.filter((item) => [item.name, ...(item.aliases ?? [])].map(coreName).some((alias) => variants.map(coreName).some((name) =>
        name.length > 3 && alias.length > 3 && (` ${alias} `.includes(` ${name} `) || ` ${name} `.includes(` ${alias} `)))));
      if (partials.length) return fail({ outcome: 'ambiguous', requestIndex, candidates: partials, reason: 'A qualified or overlapping existing name needs explicit ID resolution.' });
      const slug = destinationSlug(request.name);
      if (!slug) return fail({ outcome: 'invalid', requestIndex, errors: ['Name cannot produce a nonempty Latin slug; provide an explicit Latin name and original-script alias.'] });
      const id = `destination_${country.id.replace(/^country_/, '')}_${slug.replaceAll('-', '_')}`;
      const url = `/${country.slug}/place/${slug}/`;
      const collisions = nextCatalog.filter((item) => item.id === id || item.url === url);
      if (collisions.length) return fail({ outcome: 'ambiguous', requestIndex, candidates: collisions, reason: 'The derived ID/URL is already reserved; arbitrary suffixes are forbidden.' });
      destination = { id, name: request.name.trim(), slug, countryId: country.id, countrySlug: country.slug, url, sourceUrl: null };
      nextCatalog.push(destination);
      outcome = 'reserved';
    }
    const existingKeys = new Set([destination.name, ...(destination.aliases ?? [])].map(normalizeDestinationName));
    const aliases = [...(destination.aliases ?? [])];
    for (const variant of variants) {
      const normalized = normalizeDestinationName(variant);
      if (!existingKeys.has(normalized)) { aliases.push(variant); existingKeys.add(normalized); }
    }
    if (aliases.length) destination.aliases = aliases;
    let reservation = nextQueue.entries.find((item) => item.id === destination.id);
    if (!reservation && (outcome === 'reserved' || (!destination.sourceUrl && !published.has(destination.id)))) {
      reservation = { id: destination.id, status: published.has(destination.id) ? 'added' : 'needs_content', discoveredIn: [] };
      nextQueue.entries.push(reservation);
    }
    if (reservation) {
      const discovery = { entityType: request.discoveredIn.entityType, ...(request.discoveredIn.entityId ? { entityId: request.discoveredIn.entityId } : {}),
        sourceUrl: request.discoveredIn.sourceUrl ?? null, evidence: request.discoveredIn.evidence.trim() };
      const previous = reservation.discoveredIn.find((item) => evidenceKey(item) === evidenceKey(discovery));
      if (!previous) reservation.discoveredIn.push(discovery);
      else if (!previous.sourceUrl && discovery.sourceUrl) previous.sourceUrl = discovery.sourceUrl;
    }
    results.push({ outcome, destination: structuredClone(destination), status: reservation?.status ?? (published.has(destination.id) ? 'added' : 'prepared') });
  }
  const finalErrors = validateDestinationReservations(nextCatalog, nextQueue, { countries, publishedDestinationIds });
  if (finalErrors.length) return fail({ outcome: 'invalid', errors: finalErrors });
  const changed = JSON.stringify(catalog) !== JSON.stringify(nextCatalog) || JSON.stringify(reservations) !== JSON.stringify(nextQueue);
  return { ok: true, changed, results, catalog: nextCatalog, reservations: nextQueue };
}
