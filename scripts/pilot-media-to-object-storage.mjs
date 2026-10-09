import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const bucket = 'img.adatours.ru';
const imageHost = 'https://img.adatours.ru';
const storageHost = 'https://storage.yandexcloud.net/' + bucket;
const mediaRoot = path.resolve('public/media');
const scope = process.argv[2] || 'countries';
const maxFiles = Number(process.argv[3] || '10');
const iamToken = process.env.YC_IAM_TOKEN;

if (!['countries', 'destinations', 'tours', 'excursions', 'themes'].includes(scope)) {
  throw new Error('Unsupported media scope: ' + scope);
}
if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 10) {
  throw new Error('Pilot accepts between 1 and 10 files');
}
if (!iamToken) throw new Error('Temporary Yandex IAM token is required');

async function collect(dir) {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collect(absolute));
    else if (entry.isFile() && /\.(webp|jpe?g|png)$/i.test(entry.name)) files.push(absolute);
  }
  return files;
}

const selected = (await collect(path.join(mediaRoot, scope)))
  .sort((a, b) => a.localeCompare(b, 'en'))
  .slice(0, maxFiles);

if (!selected.length) throw new Error('No image files found in ' + scope);

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const mimeType = (filename) => /\.webp$/i.test(filename) ? 'image/webp'
  : /\.png$/i.test(filename) ? 'image/png' : 'image/jpeg';

let created = 0;
let unchanged = 0;
let verifiedBytes = 0;

for (const [index, absolute] of selected.entries()) {
  const key = 'media/' + path.relative(mediaRoot, absolute).split(path.sep).join('/');
  const publicUrl = imageHost + '/' + key.split('/').map(encodeURIComponent).join('/');
  const storageUrl = storageHost + '/' + key.split('/').map(encodeURIComponent).join('/');
  const bytes = await fs.readFile(absolute);
  const localHash = hash(bytes);

  // Do not overwrite objects. An existing key must contain exactly the same bytes.
  let response = await fetch(publicUrl, { method: 'GET', cache: 'no-store' });
  if (response.ok) {
    const remoteHash = hash(Buffer.from(await response.arrayBuffer()));
    if (remoteHash !== localHash) throw new Error('Existing S3 object differs: ' + key);
    unchanged += 1;
  } else if ([403, 404].includes(response.status)) {
    response = await fetch(storageUrl, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + iamToken,
        'Content-Type': mimeType(absolute),
        'Cache-Control': /-(?:enhanced|generated)-\d{8}/.test(key)
          ? 'public, max-age=31536000, immutable' : 'public, max-age=604800',
        'x-amz-meta-sha256': localHash,
      },
      body: bytes,
    });
    if (!response.ok) throw new Error('S3 PUT for ' + key + ': HTTP ' + response.status);
    const check = await fetch(publicUrl, { cache: 'no-store' });
    if (!check.ok) throw new Error('Cannot read uploaded object ' + key + ': HTTP ' + check.status);
    if (hash(Buffer.from(await check.arrayBuffer())) !== localHash) {
      throw new Error('SHA-256 differs after upload: ' + key);
    }
    created += 1;
  } else {
    throw new Error('Unexpected public GET status ' + response.status + ': ' + key);
  }

  verifiedBytes += bytes.byteLength;
  console.log(String(index + 1) + '/' + selected.length + ' verified: ' + key);
}

console.log('Pilot finished: uploaded=' + created + ', already-matching=' + unchanged
  + ', total=' + selected.length + ', verified bytes=' + verifiedBytes);
