import { createHash } from 'node:crypto';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const transientCodes = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN',
  'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH', 'ENETRESET', 'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET', 'UND_ERR_RES_CONTENT_LENGTH_MISMATCH']);

function transientNetwork(error) {
  if (!error) return false;
  if (['TimeoutError', 'AbortError'].includes(error.name)) return true;
  if (typeof error.code === 'string') return transientCodes.has(error.code);
  if (error.cause) return transientNetwork(error.cause);
  if (Array.isArray(error.errors)) return error.errors.some(transientNetwork);
  return error.name === 'TypeError' && /^(?:fetch failed|terminated)$/i.test(error.message);
}

function describeCause(error, seen = new Set()) {
  if (!error || seen.has(error)) return '';
  seen.add(error);
  const own = `${error.name || 'Error'}${error.code ? ' [' + error.code + ']' : ''}: ${error.message || error}`;
  const nested = [error.cause, ...(error.errors || [])].filter(Boolean)
    .map((item) => describeCause(item, seen)).filter(Boolean);
  return own + (nested.length ? ' <- ' + nested.join('; ') : '');
}

function failure(method, phase, message, { transient = false, cause } = {}) {
  return Object.assign(new Error(`${method} ${phase}: ${message}`, { cause }), { transient });
}

async function request(url, method, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, { method, cache: 'no-store',
      signal: AbortSignal.timeout(method === 'HEAD' ? 25000 : 45000) });
  } catch (cause) {
    throw failure(method, 'request', describeCause(cause), { cause, transient: transientNetwork(cause) });
  }
  if (!response.ok) {
    // Release an error response body without replacing its original HTTP status.
    await response.body?.cancel().catch(() => {});
    throw failure(method, 'request', 'HTTP ' + response.status,
      { transient: response.status === 429 || response.status >= 500 && response.status <= 599 });
  }
  return response;
}

/** A retry always repeats the complete verification, including all integrity checks. */
export async function verifyDirectS3Asset(entry, { fetchImpl = globalThis.fetch, sleep = pause } = {}) {
  const url = 'https://img.adatours.ru/' + entry.key.split('/').map(encodeURIComponent).join('/');
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await request(url, 'HEAD', fetchImpl);
      break;
    } catch (error) {
      if (!error.transient || attempt === 2) throw error;
      await sleep((attempt + 1) * 750);
    }
  }
  if (Number(response.headers.get('content-length')) !== entry.bytes)
    throw failure('HEAD', 'headers', 'Incorrect Content-Length');
  const headerHash = response.headers.get('x-amz-meta-sha256');
  if (headerHash && headerHash !== entry.sha256)
    throw failure('HEAD', 'headers', 'Incorrect x-amz-meta-sha256');
  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim();
  if (contentType !== entry.contentType.split(';')[0].trim())
    throw failure('HEAD', 'headers', 'Unexpected Content-Type ' + contentType);
  if (!headerHash) {
    const body = await request(url, 'GET', fetchImpl);
    let bytes;
    try { bytes = Buffer.from(await body.arrayBuffer()); }
    catch (cause) {
      throw failure('GET', 'body', describeCause(cause), { cause, transient: transientNetwork(cause) });
    }
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (actual !== entry.sha256)
      throw failure('GET', 'body', 'Incorrect SHA-256 for object without metadata');
  }
}

export async function verifyDirectS3Assets(assets, options = {}) {
  let next = 0;
  const failed = [];
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (true) {
      const index = next++;
      if (index >= assets.length) return;
      try { await verifyDirectS3Asset(assets[index], options); }
      catch (error) { failed.push({ index, entry: assets[index], error }); }
    }
  }));
  const errors = [];
  let retried = 0;
  let recovered = 0;
  // One sequential recovery pass after the concurrent batch has finished.
  // Missing objects and integrity mismatches are never retry candidates.
  for (const item of failed.sort((a, b) => a.index - b.index)) {
    if (!item.error.transient) { errors.push(item); continue; }
    retried++;
    options.onRetry?.(item);
    try {
      await verifyDirectS3Asset(item.entry, options);
      recovered++;
    } catch (error) { errors.push({ ...item, error }); }
  }
  return { errors, retried, recovered };
}
