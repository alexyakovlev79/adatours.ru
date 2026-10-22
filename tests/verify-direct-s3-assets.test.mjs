import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyDirectS3Assets } from '../scripts/lib/verify-direct-s3-assets.mjs';

const bytes = Buffer.from('verified image fixture');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const entry = (name) => ({ key: `media/test/${name}-20261022.webp`, bytes: bytes.length,
  sha256, contentType: 'image/webp' });
const head = (metadata = true, overrides = {}) => new Response(null, { headers: {
  'content-length': String(bytes.length), 'content-type': 'image/webp',
  ...(metadata ? { 'x-amz-meta-sha256': sha256 } : {}), ...overrides,
} });
const socketError = () => new TypeError('fetch failed', { cause:
  Object.assign(new Error('other side closed'), { code: 'ECONNRESET' }) });
const brokenBody = () => ({ ok: true, arrayBuffer: async () => { throw new TypeError('terminated', {
  cause: Object.assign(new Error('socket closed during body'), { code: 'UND_ERR_SOCKET' }),
}); } });
const sleep = async () => {};

test('HEAD retains three bounded attempts before a verified success', async () => {
  let calls = 0;
  const delays = [];
  const result = await verifyDirectS3Assets([entry('head')], {
    sleep: async (ms) => delays.push(ms),
    fetchImpl: async (_url, { method }) => {
      assert.equal(method, 'HEAD');
      calls++;
      if (calls === 1) throw socketError();
      return calls === 2 ? new Response(null, { status: 503 }) : head();
    },
  });
  assert.equal(calls, 3);
  assert.deepEqual(delays, [750, 1500]);
  assert.deepEqual(result, { errors: [], retried: 0, recovered: 0 });
});

test('only transient GET/request and body failures recover sequentially after the batch; permanent failures remain', async () => {
  const assets = ['fetch', 'body', 'healthy', 'missing'].map(entry);
  const calls = new Map();
  const retryMessages = [];
  let initialBatchFinished = false;
  let activeRecovery = 0;
  let peakRecovery = 0;
  const result = await verifyDirectS3Assets(assets, {
    sleep,
    onRetry: ({ error }) => {
      assert.equal(initialBatchFinished, true);
      retryMessages.push(error.message);
    },
    fetchImpl: async (url, { method }) => {
      const name = url.match(/\/([^/]+)-20261022/)[1];
      const key = `${name}:${method}`;
      const count = (calls.get(key) || 0) + 1;
      calls.set(key, count);
      if (name === 'missing') return new Response(null, { status: 404 });
      if (name === 'healthy') {
        await new Promise(setImmediate);
        initialBatchFinished = true;
        return head();
      }
      if (method === 'HEAD') return head(false);
      if (count === 1) {
        if (name === 'fetch') throw socketError();
        return brokenBody();
      }
      activeRecovery++;
      peakRecovery = Math.max(peakRecovery, activeRecovery);
      await new Promise(setImmediate);
      activeRecovery--;
      return new Response(bytes);
    },
  });
  assert.equal(result.retried, 2);
  assert.equal(result.recovered, 2);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].entry.key, assets[3].key);
  assert.match(result.errors[0].error.message, /HEAD request: HTTP 404/);
  assert.equal(peakRecovery, 1);
  assert.match(retryMessages[0], /GET request:.*ECONNRESET/);
  assert.match(retryMessages[1], /GET body:.*UND_ERR_SOCKET/);
  for (const name of ['fetch', 'body']) {
    assert.equal(calls.get(`${name}:HEAD`), 2);
    assert.equal(calls.get(`${name}:GET`), 2);
  }
  assert.equal(calls.get('healthy:HEAD'), 1);
  assert.equal(calls.get('missing:HEAD'), 1);
});

test('exhausted network, timeout, HTTP 429/5xx and body failures remain errors after exactly one recovery pass', async () => {
  for (const mode of ['head-network', 'head-503', 'get-429', 'get-timeout', 'body']) {
    const calls = { HEAD: 0, GET: 0 };
    const result = await verifyDirectS3Assets([entry(mode)], {
      sleep,
      fetchImpl: async (_url, { method }) => {
        calls[method]++;
        if (mode === 'head-network') throw socketError();
        if (mode === 'head-503') return new Response(null, { status: 503 });
        if (method === 'HEAD') return head(false);
        if (mode === 'get-429') return new Response(null, { status: 429 });
        if (mode === 'get-timeout') throw new DOMException('deadline reached', 'TimeoutError');
        return brokenBody();
      },
    });
    assert.equal(result.errors.length, 1, mode);
    assert.equal(result.retried, 1, mode);
    assert.equal(result.recovered, 0, mode);
    assert.equal(result.errors[0].error.transient, true, mode);
    assert.deepEqual(calls, mode.startsWith('head-') ? { HEAD: 6, GET: 0 } : { HEAD: 2, GET: 2 }, mode);
    if (mode === 'get-timeout') assert.match(result.errors[0].error.message, /GET request: TimeoutError.*deadline reached/);
  }
});

test('404/403, size/type/metadata/body hash mismatches and permanent TLS errors cannot enter recovery', async () => {
  const corrupt = Buffer.from(bytes); corrupt[0] ^= 1;
  for (const mode of ['head-404', 'head-403', 'size', 'type', 'metadata', 'get-404', 'body-hash', 'tls']) {
    let calls = 0;
    const result = await verifyDirectS3Assets([entry(mode)], {
      sleep,
      fetchImpl: async (_url, { method }) => {
        calls++;
        if (mode === 'tls') throw new TypeError('fetch failed', { cause:
          Object.assign(new Error('certificate expired'), { code: 'CERT_HAS_EXPIRED' }) });
        if (mode === 'head-404' || mode === 'head-403') return new Response(null, { status: Number(mode.slice(-3)) });
        if (mode === 'size') return head(false, { 'content-length': String(bytes.length + 1) });
        if (mode === 'type') return head(false, { 'content-type': 'image/jpeg' });
        if (mode === 'metadata') return head(true, { 'x-amz-meta-sha256': '0'.repeat(64) });
        if (method === 'HEAD') return head(false);
        return mode === 'get-404' ? new Response(null, { status: 404 }) : new Response(corrupt);
      },
    });
    assert.equal(result.errors.length, 1, mode);
    assert.equal(result.errors[0].error.transient, false, mode);
    assert.equal(result.retried, 0, mode);
    assert.equal(calls, ['get-404', 'body-hash'].includes(mode) ? 2 : 1, mode);
  }
});

test('a recovery must pass the full receipt check; a new mismatch is fatal even after HTTP 200', async () => {
  let heads = 0;
  let gets = 0;
  const result = await verifyDirectS3Assets([entry('changed')], {
    sleep,
    fetchImpl: async (_url, { method }) => {
      if (method === 'HEAD') return ++heads === 1 ? head(false) : head(true, { 'x-amz-meta-sha256': '0'.repeat(64) });
      gets++;
      throw socketError();
    },
  });
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].error.message, /HEAD headers: Incorrect x-amz-meta-sha256/);
  assert.equal(result.errors[0].error.transient, false);
  assert.equal(result.retried, 1);
  assert.equal(result.recovered, 0);
  assert.equal(heads, 2);
  assert.equal(gets, 1);
});
