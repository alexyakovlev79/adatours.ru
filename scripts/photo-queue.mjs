/** Read-only source/slot queue for chat photo jobs. No network and no generation. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { isActiveEntity, isPhotoEligible, activeReplacementId } from '../src/lib/archive.mjs';
const repoRoot = fileURLToPath(new URL('../', import.meta.url));
export function readPhotoInputs(root = repoRoot) {
  const entries = JSON.parse(fs.readFileSync(path.join(root, 'data/source-index/index.json'), 'utf8')).entries;
  const contents = new Map();
  for (const entry of entries) {
    const file = path.join(root, entry.contentPath);
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file, 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
    if (!match) throw new Error(`Invalid frontmatter: ${entry.contentPath}`);
    contents.set(entry.id, { ...yaml.load(match[1]), _body: match[2] });
  }
  const enhancements = JSON.parse(fs.readFileSync(path.join(root, 'src/data/media/photo-enhancements.json'), 'utf8')).enhancements;
  return { entries, contents, enhancements };
}
export function buildPhotoQueue({ entries, contents, enhancements = [], type, country, entityIds, after, limit = 10, all = false }) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('limit must be a positive integer');
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const enhancedURLs = new Set(enhancements.map((record) => record.enhanced));
  const bySource = new Map(enhancements.map((record) => [record.source, record]));
  const requested = entityIds ? new Set(entityIds) : undefined;
  let selected = entries.filter((entry) => isPhotoEligible(entry, contents.get(entry.id)))
    .filter((entry) => !type || entry.type === type)
    .filter((entry) => !country || (entry.routeCountryIds ?? entry.countryIds ?? []).includes(country))
    .filter((entry) => !requested || requested.has(entry.id));
  // Mirror /tours/ priority; otherwise preserve the prepared source-index order.
  if (type === 'tour') selected = selected.sort((a, b) => (contents.get(b.id).priority ?? 0) - (contents.get(a.id).priority ?? 0));
  if (after) {
    const cursor = selected.findIndex((entry) => entry.id === after);
    if (cursor < 0) throw new Error(`Cursor is outside the active scope: ${after}. Resolve the saved cursor explicitly; do not restart silently.`);
    selected = selected.slice(cursor + 1);
  }
  const groups = new Map(); const reuse = new Map(); const seenSlots = new Set();
  const addSlot = (ownerId, slot, current) => {
    const owner = entryById.get(ownerId), data = contents.get(ownerId);
    // Critical: the referenced owner must also be active, before de-duplication/limit.
    if (!owner || !isPhotoEligible(owner, data) || !current || typeof current !== 'string') return;
    if (current.includes('-enhanced-') || enhancedURLs.has(current)) return;
    const slotKey = `${ownerId}:${slot}`;
    if (seenSlots.has(slotKey)) return; seenSlots.add(slotKey);
    const known = bySource.get(current);
    const target = known ? reuse : groups;
    const group = target.get(current) ?? { source: current, ...(known ? { enhanced: known.enhanced, action: 'reuse' } : { action: 'enhance' }), slots: [] };
    group.slots.push({ entityId: ownerId, contentPath: owner.contentPath, slot, current });
    target.set(current, group);
  };
  const addExcursion = (id) => {
    const replacement = activeReplacementId(id);
    if (!replacement) return;
    const data = contents.get(replacement);
    if (!data || !isActiveEntity(data)) return;
    addSlot(replacement, 'hero.src', typeof data.hero === 'string' ? data.hero : data.hero?.src);
  };
  const walk = (value, ownerId, slot) => {
    if (Array.isArray(value)) { value.forEach((item, index) => walk(item, ownerId, `${slot}[${index}]`)); return; }
    if (!value || typeof value !== 'object') return;
    if (value.excursionRef) {
      addExcursion(value.excursionRef);
      // Excursion cards render their owner's hero, not stale local copies.
      for (const [key, nested] of Object.entries(value)) if (!['src', 'image', 'images', 'excursionRef'].includes(key)) walk(nested, ownerId, `${slot}.${key}`);
      return;
    }
    for (const [key, nested] of Object.entries(value)) {
      const location = slot ? `${slot}.${key}` : key;
      if (typeof nested === 'string' && ['src', 'image'].includes(key)) addSlot(ownerId, location, nested);
      else walk(nested, ownerId, location);
    }
  };
  for (const entry of selected) {
    const data = contents.get(entry.id);
    for (const key of ['hero', 'gallery', 'highlights', 'itinerary']) walk(data[key], entry.id, key);
    let i = 0;
    for (const match of (data._body ?? '').matchAll(/!\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)) addSlot(entry.id, `body.image[${i++}]`, match[1]);
  }
  return { policy: 'active-only; filter owners before de-duplication and limit', selectedEntityIds: selected.map((entry) => entry.id), totalPendingSources: groups.size, reuse: [...reuse.values()], photos: all ? [...groups.values()] : [...groups.values()].slice(0, limit) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = { ...readPhotoInputs() };
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--all') { options.all = true; continue; }
    if (!['--type', '--country', '--entity', '--after', '--limit'].includes(arg) || !args[i + 1]) throw new Error(`Unknown/incomplete option: ${arg}`);
    const value = args[++i];
    if (arg === '--entity') (options.entityIds ??= []).push(value);
    else options[arg.slice(2)] = arg === '--limit' ? Number(value) : value;
  }
  console.log(JSON.stringify(buildPhotoQueue(options), null, 2));
}
