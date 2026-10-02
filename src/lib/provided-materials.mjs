/** Small offline checks for supplied sources; no filesystem, network, or image I/O. */
const nonempty = (value) => typeof value === 'string' && Boolean(value.trim());
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const legacyKinds = new Set(['original_snapshot', 'cleaned_snapshot', 'rewrite_v2', 'tour_excerpt']);
const cachePath = /\/image\/cache\//i;

function driveFileId(url) {
  if (!nonempty(url) || url !== url.trim()) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) return undefined;
    const pattern = parsed.hostname === 'drive.google.com'
      ? /^\/file\/d\/([A-Za-z0-9_-]+)(?:\/(?:view|edit|preview))?\/?$/
      : parsed.hostname === 'docs.google.com'
        ? /^\/(?:document|spreadsheets|presentation|drawings)\/d\/([A-Za-z0-9_-]+)(?:\/(?:view|edit|preview|export))?\/?$/
        : undefined;
    return pattern?.exec(parsed.pathname)?.[1];
  } catch { return undefined; }
}

/** Also accepts a real legacy Drive original when completing a reservation. */
export function validateSourceTextPointer(pointer, entryId) {
  if (!object(pointer)) return ['не задан точный указатель текста.'];
  const errors = [];
  if (!/^(country|destination|tour|excursion)_[a-z0-9_]+$/.test(entryId)) errors.push('недопустимый ID сущности для предоставленных материалов.');
  const provided = pointer.kind === 'provided_materials';
  if (!provided && !legacyKinds.has(pointer.kind)) errors.push('неизвестный вид текстового источника.');
  if (!nonempty(pointer.name) || !nonempty(pointer.mimeType)) errors.push('нужны непустые name и mimeType текстового файла.');
  const repository = own(pointer, 'repositoryPath');
  const drive = own(pointer, 'driveId') || own(pointer, 'url');
  if (repository === drive) return [...errors, 'укажи только repositoryPath либо точные driveId и url, не оба варианта и не пустой указатель.'];
  if (repository) {
    if (!provided || pointer.repositoryPath !== `data/source-index/materials/${entryId}.md`) errors.push('repositoryPath должен указывать на materials/<ID этой сущности>.md с kind: provided_materials.');
    if (pointer.mimeType !== 'text/markdown') errors.push('предоставленный текст в репозитории должен иметь mimeType: text/markdown.');
  } else {
    const fileId = driveFileId(pointer.url);
    if (!nonempty(pointer.driveId) || !fileId || fileId !== pointer.driveId || pointer.mimeType === 'application/vnd.google-apps.folder') errors.push('нужен конкретный Drive-файл с совпадающими driveId и URL; папка не является текстовым источником.');
  }
  return errors;
}

export function isNonemptyUtf8(bytes) {
  try { return Boolean(new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim()); }
  catch { return false; }
}

export function isProvidedImageSource(value) {
  if (!nonempty(value) || value !== value.trim() || cachePath.test(value)) return false;
  try {
    if (value.startsWith('/media/')) {
      const path = decodeURIComponent(new URL(value, 'https://adatours.ru').pathname);
      return path.startsWith('/media/') && path.length > 7 && !path.split('/').some((part) => ['.', '..'].includes(part)) && !path.includes('\\');
    }
    if (!value.startsWith('https://')) return false;
    const url = new URL(value);
    return url.protocol === 'https:' && !['drive.google.com', 'docs.google.com'].includes(url.hostname);
  } catch { return false; }
}

export function validateProvidedMedia(media) {
  if (!object(media) || media.status !== 'provided_originals') return ['для предоставленных фотографий нужен media.status: provided_originals.'];
  const errors = [];
  if (media.provenance?.kind !== 'user_provided') errors.push('предоставленные фотографии требуют provenance.kind: user_provided.');
  if (!Array.isArray(media.images) || !media.images.length) return [...errors, 'нужна хотя бы одна предоставленная hero-фотография.'];
  if (!media.images.some((image) => object(image) && image.role === 'hero')) errors.push('нужна хотя бы одна предоставленная hero-фотография.');
  for (const [index, image] of media.images.entries()) {
    if (!object(image) || !isProvidedImageSource(image.url)) errors.push(`фотография ${index + 1}: нужен точный HTTPS image-src либо /media/...; cache и Drive viewer запрещены.`);
    if (!object(image) || !['hero', 'gallery'].includes(image.role) || !Number.isInteger(image.order) || image.order < 1 || typeof image.alt !== 'string') errors.push(`фотография ${index + 1}: нужны role, положительный order и строка alt.`);
  }
  return errors;
}
