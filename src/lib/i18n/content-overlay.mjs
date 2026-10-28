/**
 * Build-time localisation foundation. This module is deliberately not connected
 * to Astro's loaders: current Markdown first needs an approved stable-block map.
 *
 * It never writes shared data, generates translations, or declares publication.
 * An approved overlay may be assembled only against its current source evidence.
 */
import { createHash } from 'node:crypto';

export const OVERLAY_SCHEMA_VERSION = 1;

const COMMON_FIELDS = ['body', 'seo.title', 'seo.description', 'searchAlias',
  'media.alt', 'media.hover', 'media.caption'];
const BANDS = ['featureBand.eyebrow', 'featureBand.title', 'featureBand.text'];
const TOUR_FIELDS = ['title', 'lead', 'priceNote', 'priceBasis', 'formatLabel',
  'highlight.title', 'highlight.text', 'itinerary.label', 'itinerary.title',
  'itinerary.text', 'contentBlock.title', 'contentBlock.text', 'subsection.title',
  'subsection.text', 'included', 'notIncluded', 'note', 'faq.question', 'faq.answer'];

/** Semantic field names, not mutable array indices or arbitrary property paths. */
export const TEXT_FIELD_POLICY = Object.freeze(Object.fromEntries(Object.entries({
  tour: [...COMMON_FIELDS, ...TOUR_FIELDS],
  excursion: [...COMMON_FIELDS, 'title', 'lead', 'destinationName', 'durationText',
    'formatLabel', 'languageLabel', 'priceNote', 'included', 'notIncluded', 'note'],
  country: [...COMMON_FIELDS, ...BANDS, 'name', 'summary', 'bestTime', 'entryNotes'],
  destination: [...COMMON_FIELDS, ...BANDS, 'name', 'summary', 'fact.label'],
  theme: [...COMMON_FIELDS, 'name', 'summary'],
  seoArticle: [...COMMON_FIELDS, 'title', 'lead', 'heading', 'paragraph',
    'table.label', 'table.text', 'faq.question', 'faq.answer'],
  page: [...COMMON_FIELDS, 'title', 'lead', 'heading', 'paragraph'],
}).map(([type, fields]) => [type, Object.freeze(fields)])));

const HASH = /^sha256:[a-f0-9]{64}$/;
const BLOCK_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/;
const LOCALES = new Set(['ru', 'en']);
const BAD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const SOURCE_KEYS = ['schemaVersion', 'entityId', 'entityType', 'locale', 'shared', 'blocks'];
const OVERLAY_KEYS = ['schemaVersion', 'entityId', 'entityType', 'locale', 'sourceLocale', 'blocks'];
const SOURCE_BLOCK_KEYS = ['blockId', 'field', 'text', 'dependsOn'];
const BLOCK_KEYS = ['blockId', 'field', 'text', 'state', 'sourceTextHash',
  'dependencyHashes', 'provenance', 'approval'];

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const clone = (value) => structuredClone(value);
const isObject = (value) => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const issue = (code, blockId, detail, category = 'invalid') => ({
  code, ...(blockId ? { blockId } : {}), detail, category,
});

function keys(value, allowed, label) {
  if (!isObject(value)) throw new TypeError(`${label} must be a plain object`);
  for (const key of Object.keys(value)) {
    if (BAD_KEYS.has(key) || !allowed.includes(key)) {
      throw new TypeError(`${label}: forbidden or unknown key ${key}`);
    }
  }
}

function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => {
      if (BAD_KEYS.has(key)) throw new TypeError(`Forbidden JSON key ${key}`);
      return `${JSON.stringify(key)}:${canonical(value[key])}`;
    }).join(',')}}`;
  }
  throw new TypeError('Fingerprints require finite JSON values; undefined and class instances are not accepted');
}

/** Stable key order, exact Unicode and whitespace; no editorial normalization. */
export function fingerprint(value) {
  return `sha256:${createHash('sha256').update(canonical(value), 'utf8').digest('hex')}`;
}

export function textFingerprint(text) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

/** Read an RFC 6901 pointer from shared facts/media, never through prototypes. */
function sharedValue(shared, pointer) {
  if (typeof pointer !== 'string' || !/^\/(facts|media)\//.test(pointer)) {
    throw new TypeError(`Dependency must address /facts/... or /media/...: ${pointer}`);
  }
  const tokens = pointer.slice(1).split('/').map((token) => {
    if (/~(?:[^01]|$)/.test(token)) throw new TypeError(`Invalid JSON pointer: ${pointer}`);
    return token.replace(/~1/g, '/').replace(/~0/g, '~');
  });
  let value = shared;
  for (const token of tokens) {
    if (BAD_KEYS.has(token) || value === null || typeof value !== 'object' || Array.isArray(value) || !own(value, token)) {
      throw new TypeError(`Missing or unsafe shared dependency: ${pointer}`);
    }
    value = value[token];
  }
  return value;
}

function validateIdentity(value, withSourceLocale = false) {
  if (value.schemaVersion !== OVERLAY_SCHEMA_VERSION) throw new TypeError('Unsupported schemaVersion');
  if (!nonempty(value.entityId)) throw new TypeError('entityId is required');
  if (!own(TEXT_FIELD_POLICY, value.entityType)) throw new TypeError(`Unsupported entityType: ${value.entityType}`);
  if (!LOCALES.has(value.locale)) throw new TypeError('locale must be ru or en');
  if (withSourceLocale && (!LOCALES.has(value.sourceLocale) || value.sourceLocale === value.locale)) {
    throw new TypeError('sourceLocale must be the other supported locale');
  }
  if (!Array.isArray(value.blocks)) throw new TypeError('blocks must be an array');
}

function checkBlockIdentity(block, entityType, seen) {
  if (typeof block.blockId !== 'string' || !BLOCK_ID.test(block.blockId)) throw new TypeError('A stable blockId is required');
  if (seen.has(block.blockId)) throw new TypeError(`Duplicate blockId: ${block.blockId}`);
  seen.add(block.blockId);
  if (!TEXT_FIELD_POLICY[entityType].includes(block.field)) {
    throw new TypeError(`Field is not localisable for ${entityType}: ${block.field}`);
  }
  if (typeof block.text !== 'string') throw new TypeError(`${block.blockId}: text must be a string`);
}

function validateSnapshot(source) {
  keys(source, SOURCE_KEYS, 'SourceSnapshot');
  validateIdentity(source);
  keys(source.shared, ['facts', 'media'], 'shared');
  if (!isObject(source.shared.facts) || !isObject(source.shared.media)) {
    throw new TypeError('shared.facts and shared.media must be plain JSON objects');
  }
  canonical(source.shared); // Reject unsafe/non-JSON nested values too.
  if (source.blocks.length === 0) throw new TypeError('SourceSnapshot must declare its text blocks');
  const seen = new Set();
  for (const block of source.blocks) {
    keys(block, SOURCE_BLOCK_KEYS, 'SourceBlock');
    checkBlockIdentity(block, source.entityType, seen);
    if (!Array.isArray(block.dependsOn) || new Set(block.dependsOn).size !== block.dependsOn.length) {
      throw new TypeError(`${block.blockId}: dependsOn must be a unique array of shared pointers`);
    }
    for (const pointer of block.dependsOn) sharedValue(source.shared, pointer);
  }
}

export function createSourceSnapshot(source) {
  validateSnapshot(source);
  return clone(source);
}

/** Separate fingerprints prevent an image improvement invalidating every text. */
export function sourceFingerprints(source) {
  validateSnapshot(source);
  const text = source.blocks.map(({ blockId, field, text, dependsOn }) => ({
    blockId, field, text, dependsOn: [...dependsOn].sort(),
  })).sort((a, b) => a.blockId < b.blockId ? -1 : a.blockId > b.blockId ? 1 : 0);
  return {
    text: fingerprint(text),
    facts: fingerprint(source.shared.facts),
    media: fingerprint(source.shared.media),
  };
}

export function sourceBlockEvidence(source, blockId) {
  validateSnapshot(source);
  const block = source.blocks.find((candidate) => candidate.blockId === blockId);
  if (!block) throw new TypeError(`Unknown source block: ${blockId}`);
  return {
    sourceTextHash: textFingerprint(block.text),
    dependencyHashes: Object.fromEntries(block.dependsOn.map((pointer) => [
      pointer, fingerprint(sharedValue(source.shared, pointer)),
    ])),
  };
}

/** Bind a review to the exact text, field, source dependencies and provenance. */
export function translationApprovalHash(block) {
  return fingerprint({ blockId: block.blockId, field: block.field, text: block.text,
    sourceTextHash: block.sourceTextHash, dependencyHashes: block.dependencyHashes,
    provenance: block.provenance });
}

function validateApproval(approval, block) {
  keys(approval, ['reviewerId', 'reviewedAt', 'checks', 'approvedContentHash'], 'approval');
  if (!nonempty(approval.reviewerId) || !/^\d{4}-\d{2}-\d{2}T/.test(approval.reviewedAt ?? '') ||
      !Number.isFinite(Date.parse(approval.reviewedAt))) throw new TypeError('Approval requires reviewerId and a real reviewedAt');
  keys(approval.checks, ['meaning', 'voice', 'facts'], 'approval.checks');
  if (!['meaning', 'voice', 'facts'].every((name) => approval.checks[name] === true)) {
    throw new TypeError('Approval requires meaning, voice and facts checks');
  }
  if (!HASH.test(approval.approvedContentHash) || approval.approvedContentHash !== translationApprovalHash(block)) {
    throw new TypeError('Approval is not bound to the current text and source evidence');
  }
}

function validateProvenance(provenance) {
  if (!isObject(provenance)) throw new TypeError('provenance is required');
  if (provenance.kind === 'word_exact') {
    keys(provenance, ['kind', 'fileId', 'revision', 'documentHash', 'locator', 'textHash'], 'Word provenance');
    if (!['fileId', 'revision', 'locator'].every((name) => nonempty(provenance[name])) ||
        !HASH.test(provenance.documentHash) || !HASH.test(provenance.textHash)) {
      throw new TypeError('Word provenance requires fileId, revision, locator and exact document/text hashes');
    }
  } else if (provenance.kind === 'ai_translation') {
    keys(provenance, ['kind', 'model', 'runId'], 'AI provenance');
    if (!nonempty(provenance.model) || !nonempty(provenance.runId)) throw new TypeError('AI provenance requires model and runId');
  } else if (provenance.kind === 'editorial') {
    keys(provenance, ['kind', 'editorId', 'reason'], 'Editorial provenance');
    if (!nonempty(provenance.editorId) || !nonempty(provenance.reason)) throw new TypeError('Editorial provenance requires editorId and reason');
  } else throw new TypeError(`Unknown provenance kind: ${provenance.kind}`);
}

function validateOverlay(overlay) {
  keys(overlay, OVERLAY_KEYS, 'LocaleOverlay');
  validateIdentity(overlay, true);
  const seen = new Set();
  for (const block of overlay.blocks) {
    keys(block, BLOCK_KEYS, 'TranslationBlock');
    checkBlockIdentity(block, overlay.entityType, seen);
    if (!['draft', 'review', 'approved'].includes(block.state)) throw new TypeError('Block state must be draft, review or approved; publication is external');
    if (!HASH.test(block.sourceTextHash) || !isObject(block.dependencyHashes)) throw new TypeError('Source text and dependency evidence is required');
    for (const [pointer, hash] of Object.entries(block.dependencyHashes)) {
      if (!/^\/(facts|media)\//.test(pointer) || !HASH.test(hash)) throw new TypeError(`Invalid dependency hash: ${pointer}`);
    }
    validateProvenance(block.provenance);
    if (block.approval !== undefined) validateApproval(block.approval, block);
    if (block.state === 'approved' && block.approval === undefined) throw new TypeError('approved requires recorded semantic QA');
  }
}

/**
 * Word registry is captured source evidence, not a URL to fetch during build:
 * { [fileId]: { revision, documentHash, blocks: { [locator]: exactText } } }
 */
export function assessOverlay(source, overlay, { wordSources = {} } = {}) {
  validateSnapshot(source);
  if (overlay === null || overlay === undefined) return {
    status: 'missing', readyForAssembly: false,
    issues: [issue('overlay_missing', undefined, 'No target locale overlay', 'incomplete')],
    blockCount: source.blocks.length, approvedCount: 0,
  };
  const issues = [];
  try { validateOverlay(overlay); } catch (error) {
    return { status: 'invalid', readyForAssembly: false,
      issues: [issue('invalid_overlay', undefined, error.message)],
      blockCount: source.blocks.length, approvedCount: 0 };
  }
  if (overlay.entityId !== source.entityId || overlay.entityType !== source.entityType ||
      overlay.sourceLocale !== source.locale) issues.push(issue('identity_mismatch', undefined, 'Overlay and source identity/locale must match'));
  const sourceMap = new Map(source.blocks.map((block) => [block.blockId, block]));
  const targetMap = new Map(overlay.blocks.map((block) => [block.blockId, block]));
  for (const target of overlay.blocks) {
    if (!sourceMap.has(target.blockId)) issues.push(issue('retired_block', target.blockId, 'Source no longer contains this block; retire it explicitly', 'stale'));
  }
  let approvedCount = 0;
  for (const original of source.blocks) {
    const target = targetMap.get(original.blockId);
    if (!target) {
      issues.push(issue('block_missing', original.blockId, 'No target text; source fallback is forbidden', 'incomplete'));
      continue;
    }
    const startIssueCount = issues.length;
    if (target.field !== original.field) issues.push(issue('field_mismatch', original.blockId, 'A block cannot move to another semantic field'));
    if (target.sourceTextHash !== textFingerprint(original.text)) issues.push(issue('source_text_changed', original.blockId, 'Source text changed; preserve target and review this block', 'stale'));
    const pointers = Object.keys(target.dependencyHashes).sort();
    if (JSON.stringify(pointers) !== JSON.stringify([...original.dependsOn].sort())) {
      issues.push(issue('dependency_set_changed', original.blockId, 'Exact shared dependency set changed', 'stale'));
    } else {
      for (const pointer of pointers) {
        if (target.dependencyHashes[pointer] !== fingerprint(sharedValue(source.shared, pointer))) {
          issues.push(issue('shared_dependency_changed', original.blockId, pointer, 'stale'));
        }
      }
    }
    if (target.provenance.kind === 'word_exact') {
      const ref = target.provenance;
      const current = own(wordSources, ref.fileId) ? wordSources[ref.fileId] : undefined;
      if (!current || !isObject(current.blocks) || !own(current.blocks, ref.locator) ||
          typeof current.blocks[ref.locator] !== 'string') {
        issues.push(issue('word_evidence_missing', original.blockId, `${ref.fileId}:${ref.locator}`, 'blocked'));
      } else {
        if (ref.revision !== current.revision || ref.documentHash !== current.documentHash ||
            ref.textHash !== textFingerprint(current.blocks[ref.locator])) {
          issues.push(issue('word_source_changed', original.blockId, `${ref.fileId}:${ref.locator}`, 'stale'));
        }
        if (textFingerprint(target.text) !== ref.textHash) {
          issues.push(issue('word_text_modified', original.blockId, 'word_exact must preserve the exact approved passage'));
        }
      }
    }
    if (target.state !== 'approved') issues.push(issue('approval_pending', original.blockId, target.state, 'review'));
    if (issues.length === startIssueCount) approvedCount += 1;
  }
  const categories = new Set(issues.map((item) => item.category));
  const status = ['invalid', 'blocked', 'stale', 'incomplete', 'review'].find((category) => categories.has(category)) ?? 'ready';
  return { status, readyForAssembly: status === 'ready', issues,
    blockCount: source.blocks.length, approvedCount };
}

export class TranslationNotReadyError extends Error {
  constructor(assessment) {
    super(`Locale overlay cannot be assembled: ${assessment.status}`);
    this.name = 'TranslationNotReadyError';
    this.assessment = assessment;
  }
}

/** Return only target text and authoritative shared data; no source-text leakage. */
export function assembleLocalizedContent(source, overlay, context = {}) {
  const assessment = assessOverlay(source, overlay, context);
  if (!assessment.readyForAssembly) throw new TranslationNotReadyError(assessment);
  const targetMap = new Map(overlay.blocks.map((block) => [block.blockId, block]));
  return {
    entityId: source.entityId, entityType: source.entityType, locale: overlay.locale,
    shared: clone(source.shared),
    blocks: source.blocks.map(({ blockId, field }) => ({ blockId, field, text: targetMap.get(blockId).text })),
  };
}

/** Pure reconciliation never rewrites even a stale, independently edited target. */
export function reconcileOverlay(previousSource, currentSource, overlay, context = {}) {
  validateSnapshot(previousSource);
  validateSnapshot(currentSource);
  if (previousSource.entityId !== currentSource.entityId || previousSource.entityType !== currentSource.entityType ||
      previousSource.locale !== currentSource.locale) throw new TypeError('Cannot reconcile different source identities');
  const before = sourceFingerprints(previousSource);
  const after = sourceFingerprints(currentSource);
  return {
    overlay: overlay == null ? null : clone(overlay),
    changed: Object.fromEntries(['text', 'facts', 'media'].map((kind) => [kind, before[kind] !== after[kind]])),
    assessment: assessOverlay(currentSource, overlay, context),
  };
}

export function translationBlockHash(block) {
  return fingerprint(block);
}

export class TranslationConflictError extends Error {
  constructor(blockId) {
    super(`Target block changed since it was read: ${blockId}`);
    this.name = 'TranslationConflictError';
    this.blockId = blockId;
  }
}

/**
 * In-memory compare-and-swap patch. The caller MUST also CAS its persistent
 * Git/DB version; this function alone does not provide a distributed lock.
 * Each change is { block, expectedBlockHash }, null expected hash for a new block.
 */
export function applyTranslationPatch(source, overlay, changes, context = {}) {
  validateSnapshot(source);
  validateOverlay(overlay);
  if (!Array.isArray(changes)) throw new TypeError('changes must be an array');
  const blocks = new Map(overlay.blocks.map((block) => [block.blockId, clone(block)]));
  const changedIds = new Set();
  for (const change of changes) {
    keys(change, ['block', 'expectedBlockHash'], 'TranslationPatch');
    const blockId = change.block?.blockId;
    if (changedIds.has(blockId)) throw new TypeError(`Duplicate patch blockId: ${blockId}`);
    changedIds.add(blockId);
    const current = blocks.get(blockId);
    const actualHash = current ? translationBlockHash(current) : null;
    if (change.expectedBlockHash !== actualHash) throw new TranslationConflictError(blockId);
    if (current?.provenance.kind === 'word_exact' && change.block.provenance?.kind !== 'word_exact') {
      throw new TranslationConflictError(`${blockId} (approved Word authority cannot be downgraded by a translation patch)`);
    }
    blocks.set(blockId, clone(change.block));
  }
  const next = { ...clone(overlay), blocks: [...blocks.values()] };
  const assessment = assessOverlay(source, next, context);
  const blocking = assessment.issues.filter((item) =>
    (!item.blockId || changedIds.has(item.blockId)) && ['invalid', 'stale', 'blocked'].includes(item.category));
  if (blocking.length) throw new TranslationNotReadyError({ ...assessment, issues: blocking });
  return next;
}
