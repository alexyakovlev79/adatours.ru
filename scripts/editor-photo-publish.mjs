/**
 * Publish a photo improved with a REAL GPT Image edit by any authorized Ada Tours editor.
 * The original and GPT Image output must already exist as local files. The script never
 * performs image enhancement and never substitutes deterministic sharpening for GPT Image.
 * No media bytes, IAM credentials or private session keys are written to Git.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeSessionRequest } from './lib/media-token-envelope.mjs';
import { validateMediaKey } from './media-work-session.mjs';
import { mergeDirectAssetReceipts } from './lib/direct-media-ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'alexyakovlev79/adatours.ru';
const LEDGER = path.join(ROOT, 'src/data/media/direct-s3-uploads.json');
const HISTORY = path.join(ROOT, 'src/data/media/photo-enhancements.json');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function hasImageMagic(bytes, ext) {
  if (ext === 'jpg' || ext === 'jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (ext === 'png') return bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  if (ext === 'webp') return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  return false;
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const readJson = async p => JSON.parse(await fs.readFile(p, 'utf8'));

export function createEditorialPhotoPlan({ owner, slot, date, originalName, originalBytes, enhancedBytes }) {
  if (!/^[a-z0-9_-]+(?:\/[a-z0-9_-]+){1,4}$/.test(owner || ''))
    throw Error('Owner must be a relative media folder, e.g. people/geovani');
  if (!/^[a-z0-9][a-z0-9_-]{0,60}$/.test(slot || '')) throw Error('Invalid photo slot');
  if (!/^20\d{6}$/.test(date || '')) throw Error('Expected date YYYYMMDD');
  const ext = path.extname(originalName || '').toLowerCase().slice(1);
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) throw Error('Unsupported original image type');
  if (!Buffer.isBuffer(originalBytes) || !Buffer.isBuffer(enhancedBytes)) throw Error('Image buffers required');
  if (!originalBytes.length || !enhancedBytes.length || originalBytes.length > 15_000_000 || enhancedBytes.length > 15_000_000)
    throw Error('Empty or oversized photo (>15 MB)');
  if (!hasImageMagic(originalBytes, ext) || !hasImageMagic(enhancedBytes, 'webp'))
    throw Error('Invalid source image or GPT Image WebP output');
  const originalHash = sha(originalBytes), enhancedHash = sha(enhancedBytes);
  if (originalHash === enhancedHash) throw Error('GPT Image result must differ from the exact original image');
  const folder = 'media/' + owner + '/';
  const originalKey = folder + slot + '-original-' + date + '-' + originalHash.slice(0, 12) + '.' + ext;
  const enhancedKey = folder + slot + '-enhanced-' + date + '-' + enhancedHash.slice(0, 12) + '.webp';
  validateMediaKey(originalKey); validateMediaKey(enhancedKey);
  return { originalHash, enhancedHash, originalKey, enhancedKey,
    source: '/' + originalKey, enhanced: '/' + enhancedKey };
}

export function locatePriorGptEnhancement(originalHash, ledger, history) {
  if (!/^[a-f0-9]{64}$/.test(originalHash || '')) throw Error('Invalid source SHA-256');
  const candidate = (ledger.assets || []).filter(a => a.sha256 === originalHash)
    .map(a => '/' + a.key);
  const prior = (history.enhancements || []).find(e =>
    e.method === 'gpt-image' && candidate.includes(e.source) &&
    (ledger.assets || []).some(a => '/' + a.key === e.enhanced));
  return prior ? { status: 'already-enhanced', source: prior.source, enhanced: prior.enhanced } : null;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || !argv[i + 1]) throw Error('Use --name value arguments');
    out[argv[i].slice(2)] = argv[i + 1];
  }
  if (!out.original) throw Error('Missing --original (the exact uploaded photo)');
  return out;
}

function gh(args, input) {
  try {
    return execFileSync('gh', args, { cwd: ROOT, encoding: 'utf8', input,
      maxBuffer: 5 * 1024 * 1024, timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (error) {
    throw Error('Authenticated GitHub CLI is required: ' + (error.stderr?.toString().trim() || error.message));
  }
}

async function requestEncryptedToken(sessionDir) {
  const { request, privatePem } = makeSessionRequest();
  const requestFile = path.join(sessionDir, request.requestId + '.request.json');
  const privateFile = path.join(sessionDir, request.requestId + '.private.pem');
  await fs.writeFile(requestFile, JSON.stringify(request, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await fs.writeFile(privateFile, privatePem, { flag: 'wx', mode: 0o600 });
  const mailbox = 'data/media/upload-session-requests/' + request.requestId + '.json';
  const body = { message: 'media: request isolated editor session ' + request.requestId,
    branch: 'main', content: Buffer.from(await fs.readFile(requestFile)).toString('base64') };
  const written = JSON.parse(gh(['api', '--method', 'PUT',
    'repos/' + REPO + '/contents/' + mailbox, '--input', '-'], JSON.stringify(body)));
  const commitSha = written.commit?.sha;
  if (!/^[0-9a-f]{40}$/.test(commitSha || '')) throw Error('No confirmed GitHub session commit SHA');
  let run;
  for (let i = 0; i < 30; i++) {
    const result = JSON.parse(gh(['api', 'repos/' + REPO + '/actions/runs?head_sha=' + commitSha + '&per_page=25']));
    run = (result.workflow_runs || []).find(r => r.path?.endsWith('/issue-media-upload-token.yml'));
    if (run?.status === 'completed') break;
    await wait(6000);
  }
  if (!run || run.status !== 'completed' || run.conclusion !== 'success')
    throw Error('Short-lived token workflow failed or was not confirmed; GitHub request: ' + commitSha);
  const artifactName = 'encrypted-media-session-' + request.requestId + '-' + run.id;
  gh(['run', 'download', String(run.id), '--repo', REPO,
    '--name', artifactName, '--dir', sessionDir]);
  const envelopeFile = path.join(sessionDir, 'media-upload-session-envelope.json');
  const envelope = await readJson(envelopeFile);
  return { requestFile, privateFile, envelope: Buffer.from(JSON.stringify(envelope)).toString('base64'),
    requestId: request.requestId, tokenRun: run.html_url };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const originalFile = await fs.realpath(opts.original);
  const originalBytes = await fs.readFile(originalFile);
  if (!originalBytes.length) throw Error('Empty original image');
  if (!hasImageMagic(originalBytes, path.extname(originalFile).slice(1).toLowerCase()))
    throw Error('Input must be an actual JPG, PNG or WebP image');
  const ledger = await readJson(LEDGER), history = await readJson(HISTORY);
  const previous = locatePriorGptEnhancement(sha(originalBytes), ledger, history);
  if (previous) {
    console.log(JSON.stringify(previous, null, 2));
    return;
  }
  if (opts.check === 'true') {
    console.log(JSON.stringify({ status: 'needs-gpt-image', sourceSha256: sha(originalBytes) }, null, 2));
    return;
  }
  if (!opts.enhanced || !opts.owner || !opts.slot)
    throw Error('Missing --enhanced, --owner or --slot; run --check true before GPT Image');
  const enhancedFile = await fs.realpath(opts.enhanced);
  if (enhancedFile.startsWith(path.join(ROOT, 'public/media') + path.sep))
    throw Error('Enhanced images must stay outside public/media and Git history');
  const enhancedBytes = await fs.readFile(enhancedFile);
  if (path.extname(enhancedFile).toLowerCase() !== '.webp' ||
    enhancedBytes.toString('ascii', 0, 4) !== 'RIFF' || enhancedBytes.toString('ascii', 8, 12) !== 'WEBP')
    throw Error('After REAL GPT Image editing, export a valid WebP file');
  const date = (opts.date || new Date().toISOString().slice(0, 10).replaceAll('-', ''));
  const plan = createEditorialPhotoPlan({ owner: opts.owner, slot: opts.slot, date,
    originalName: originalFile, originalBytes, enhancedBytes });
  if ((history.enhancements || []).some(e => e.source === plan.source && e.enhanced !== plan.enhanced))
    throw Error('Source already has another enhanced version; explicitly resolve the existing chain');

  // Preflight authentication before writing a short-lived request to main.
  gh(['api', 'repos/' + REPO, '--jq', '.full_name']);
  const sessionDir = await fs.mkdtemp(path.join(os.tmpdir(), 'adatours-editor-media-'));
  await fs.chmod(sessionDir, 0o700);
  const batchFile = path.join(sessionDir, 'batch.json');
  const receiptFile = path.join(sessionDir, 'receipt.json');
  await fs.writeFile(batchFile, JSON.stringify([
    { file: originalFile, key: plan.originalKey },
    { file: enhancedFile, key: plan.enhancedKey },
  ], null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log('Preparing secure S3 transfer for 2 photos; no images are committed to Git.');
  try {
    const session = await requestEncryptedToken(sessionDir);
    // The underlying uploader verifies PUT and GET bytes against SHA-256 before issuing a receipt.
    execFileSync(process.execPath, [path.join(ROOT, 'scripts/media-work-session.mjs'), 'upload',
      '--request', session.requestFile, '--private', session.privateFile,
      '--envelope', session.envelope, '--batch', batchFile, '--receipt', receiptFile],
    { cwd: ROOT, stdio: 'inherit', timeout: 300000 });

    const receipt = await readJson(receiptFile);
    const merged = mergeDirectAssetReceipts(await readJson(LEDGER), receipt);
    const currentHistory = await readJson(HISTORY);
    const entries = currentHistory.enhancements || [];
    const prior = entries.find(e => e.source === plan.source);
    if (prior && (prior.method !== 'gpt-image' || prior.enhanced !== plan.enhanced))
      throw Error('Conflicting enhancement provenance, refusing to overwrite it');
    if (!prior) entries.push({ source: plan.source, enhanced: plan.enhanced,
      enhancedAt: date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6),
      method: 'gpt-image', revision: 1 });
    await fs.writeFile(LEDGER, JSON.stringify(merged, null, 2) + '\n');
    await fs.writeFile(HISTORY, JSON.stringify(currentHistory, null, 2) + '\n');
    console.log(JSON.stringify({ status: 'uploaded-and-verified', photoSrc: plan.enhanced,
      originalSrc: plan.source, sourceSha256: plan.originalHash, outputSha256: plan.enhancedHash,
      tokenRun: session.tokenRun, modifiedTextFiles: [path.relative(ROOT, LEDGER), path.relative(ROOT, HISTORY)],
      next: 'Update targeted content photo.src, remove new binary files from Git, open PR; publish only after successful Pages deploy.' }, null, 2));
  } finally {
    // The short-lived private X25519 key and encrypted packet must not persist after this run.
    await fs.rm(sessionDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch(error => { console.error(String(error.message || error)); process.exitCode = 1; });
}
