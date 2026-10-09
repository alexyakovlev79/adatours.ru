import {
  createCipheriv, createDecipheriv, createPrivateKey, createPublicKey,
  diffieHellman, generateKeyPairSync, hkdfSync, randomBytes, timingSafeEqual,
} from 'node:crypto';

export const UPLOAD_BUCKET = 'img.adatours.ru';
const CONTEXT = Buffer.from('adatours-s3-work-upload-v1');
const TOKEN_LIFETIME_MS = 10 * 60 * 1000;
const REQUEST_MAX_AGE_MS = 20 * 60 * 1000;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const b64 = (buffer) => Buffer.from(buffer).toString('base64');
const unb64 = (text, field) => {
  assert(typeof text === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(text), 'Invalid ' + field);
  return Buffer.from(text, 'base64');
};

export function validateSessionRequest(request, now = Date.now()) {
  assert(request && request.version === 1, 'Unsupported upload session version');
  assert(request.bucket === UPLOAD_BUCKET, 'Unexpected bucket in request');
  assert(typeof request.requestId === 'string' && /^[0-9a-f]{32}$/.test(request.requestId), 'Invalid requestId');
  const created = Date.parse(request.createdAt);
  assert(Number.isFinite(created) && created <= now + 120000 && now - created < REQUEST_MAX_AGE_MS,
    'Upload session request is expired or has an invalid timestamp');
  const publicKey = createPublicKey({
    key: unb64(request.recipientPublicKey, 'recipientPublicKey'),
    format: 'der', type: 'spki',
  });
  assert(publicKey.asymmetricKeyType === 'x25519', 'Only X25519 session keys are allowed');
  return publicKey;
}

export function makeSessionRequest(now = Date.now()) {
  const { publicKey, privateKey } = generateKeyPairSync('x25519');
  const request = {
    version: 1,
    requestId: randomBytes(16).toString('hex'),
    createdAt: new Date(now).toISOString(),
    bucket: UPLOAD_BUCKET,
    recipientPublicKey: b64(publicKey.export({ format: 'der', type: 'spki' })),
  };
  return {
    request,
    privatePem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
  };
}

export function sealUploadToken(token, request, now = Date.now()) {
  assert(typeof token === 'string' && token.length > 20, 'Token is missing');
  const recipient = validateSessionRequest(request, now);
  const { publicKey: ephPublic, privateKey: ephPrivate } = generateKeyPairSync('x25519');
  const salt = randomBytes(32);
  const iv = randomBytes(12);
  const derived = hkdfSync('sha256', diffieHellman({ privateKey: ephPrivate, publicKey: recipient }),
    salt, CONTEXT, 32);
  const metadata = {
    version: 1,
    requestId: request.requestId,
    bucket: UPLOAD_BUCKET,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TOKEN_LIFETIME_MS).toISOString(),
  };
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(derived), iv);
  cipher.setAAD(Buffer.from(JSON.stringify(metadata)));
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return {
    ...metadata,
    ephemeralPublicKey: b64(ephPublic.export({ format: 'der', type: 'spki' })),
    salt: b64(salt),
    iv: b64(iv),
    tag: b64(cipher.getAuthTag()),
    ciphertext: b64(ciphertext),
  };
}

export function openUploadToken(envelope, request, privatePem, now = Date.now()) {
  const publicKey = validateSessionRequest(request, now);
  assert(envelope && envelope.version === 1
    && envelope.requestId === request.requestId && envelope.bucket === UPLOAD_BUCKET,
    'Envelope does not match this request');
  const issuedAt = Date.parse(envelope.issuedAt);
  const expiresAt = Date.parse(envelope.expiresAt);
  assert(Number.isFinite(issuedAt) && Number.isFinite(expiresAt)
    && issuedAt <= now + 120000 && now < expiresAt && expiresAt - issuedAt <= TOKEN_LIFETIME_MS,
    'Encrypted media token expired or has invalid validity window');
  const privateKey = createPrivateKey(privatePem);
  assert(privateKey.asymmetricKeyType === 'x25519', 'Wrong private key type');
  const expected = publicKey.export({ format: 'der', type: 'spki' });
  const actual = createPublicKey(privateKey).export({ format: 'der', type: 'spki' });
  assert(expected.length === actual.length && timingSafeEqual(expected, actual),
    'Private key does not match upload request');

  const ephPublic = createPublicKey({
    key: unb64(envelope.ephemeralPublicKey, 'ephemeral public key'),
    format: 'der', type: 'spki',
  });
  assert(ephPublic.asymmetricKeyType === 'x25519', 'Wrong ephemeral key type');
  const salt = unb64(envelope.salt, 'salt');
  const iv = unb64(envelope.iv, 'iv');
  const tag = unb64(envelope.tag, 'tag');
  assert(salt.length === 32 && iv.length === 12 && tag.length === 16, 'Bad encryption parameters');
  const derived = hkdfSync('sha256', diffieHellman({ privateKey, publicKey: ephPublic }),
    salt, CONTEXT, 32);
  const metadata = {
    version: envelope.version,
    requestId: envelope.requestId,
    bucket: envelope.bucket,
    issuedAt: envelope.issuedAt,
    expiresAt: envelope.expiresAt,
  };
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(derived), iv);
  decipher.setAAD(Buffer.from(JSON.stringify(metadata)));
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(unb64(envelope.ciphertext, 'ciphertext')),
    decipher.final(),
  ]).toString('utf8');
}
