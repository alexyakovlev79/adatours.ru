#!/usr/bin/env node
/**
 * Inventory photographs from actual Astro output, never the caption registry.
 * --build renders current routes first; an externally built directory requires
 * an explicit --source-commit so that its provenance is not silently invented.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseFragment } from 'parse5';
import { isArchivedPath } from '../src/lib/archive.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const attrs = (node) => Object.fromEntries((node?.attrs ?? []).map(({ name, value }) => [name, value]));
const classes = (node) => (attrs(node).class ?? '').split(/\s+/).filter(Boolean);
const hasClass = (node, name) => classes(node).includes(name);
const children = (node) => [...(node.childNodes ?? []), ...(node.content?.childNodes ?? [])];
const textOf = (node) => node?.nodeName === '#text' ? node.value : children(node ?? {}).map(textOf).join('');
function* walk(node) { yield node; for (const child of children(node)) yield* walk(child); }
const find = (node, test) => [...walk(node)].find(test);
const styleValue = (value, property) => String(value ?? '').split(';').map((part) => part.split(/:(.*)/s)).find(([name]) => name.trim() === property)?.[1]?.trim();

/** Keep legacy and production CDN spellings of a logical image one job. */
export function logicalHeroSource(value, { base = '/' } = {}) {
  if (!value) return undefined;
  const url = new URL(value, 'https://adatours.ru');
  if (!['http:', 'https:'].includes(url.protocol)) return undefined;
  const prefix = `/${base.split('/').filter(Boolean).join('/')}`;
  let path = url.pathname;
  if (prefix !== '/' && path.startsWith(`${prefix}/`)) path = path.slice(prefix.length);
  if (['adatours.ru', 'www.adatours.ru', 'img.adatours.ru'].includes(url.hostname) && path.startsWith('/media/')) return path;
  return /^https?:\/\//.test(value) ? url.href : path;
}

export function heroAssetId(source) { return `hero-${hash(source).slice(0, 24)}`; }

/** A small section fragment avoids parsing megabytes of unrelated page content. */
function heroFragments(html) {
  const sections = [];
  const opening = /<section\b[^>]*>/gi;
  let match;
  while ((match = opening.exec(html))) {
    const tag = parseFragment(match[0]).childNodes?.[0];
    if (!hasClass(tag, 'hero') && !hasClass(tag, 'team-hero')) continue;
    const nested = /<\/?section\b[^>]*>/gi;
    nested.lastIndex = opening.lastIndex;
    let depth = 1, close;
    while ((close = nested.exec(html))) {
      depth += /^<\//.test(close[0]) ? -1 : 1;
      if (!depth) break;
    }
    if (depth) throw new Error('Unclosed hero section in rendered HTML');
    sections.push(parseFragment(html.slice(match.index, nested.lastIndex)).childNodes[0]);
    opening.lastIndex = nested.lastIndex;
  }
  return sections;
}

function profileFor(section) {
  if (hasClass(section, 'team-hero')) return 'preserve-full-image';
  if (hasClass(section, 'hero--photo-lead')) return 'photo-lead';
  if (hasClass(section, 'hero--home')) return 'home';
  if (hasClass(section, 'hero--tour') || hasClass(section, 'hero--content-sized')) return 'content-sized';
  if (hasClass(section, 'hero--compact')) return 'compact';
  return 'standard';
}

export const HERO_GEOMETRY = Object.freeze({
  standard: { fit: 'cover', widthCss: '100%', heightCss: 'clamp(460px, 125vw, 560px)', minimumHeightOnly: true },
  compact: { fit: 'cover', widthCss: '100%', heightCss: 'clamp(400px, 110vw, 500px)', minimumHeightOnly: true },
  home: { fit: 'cover', widthCss: '100%', heightCss: 'clamp(500px, 135vw, 600px)', minimumHeightOnly: true },
  'content-sized': { fit: 'cover', widthCss: '100%', heightCss: 'clamp(460px, 125vw, 560px)', minimumHeightOnly: true },
  'photo-lead': { fit: 'cover', widthCss: '100%', heightCss: 'clamp(270px, 90vw, 420px)', minimumHeightOnly: false },
  'preserve-full-image': { fit: 'natural', widthCss: 'min(100%, var(--container-max))', heightCss: 'auto', minimumHeightOnly: false },
});

/** Pure extraction also covers inert video templates; posters never become jobs. */
export function extractHeroUsages(html, { pagePath, htmlPath, base = '/', archived = isArchivedPath(pagePath, base) } = {}) {
  if (!pagePath?.startsWith('/')) throw new Error('A logical pagePath is required');
  const usages = [], excluded = [], videoPosters = [];
  const head = parseFragment(html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '');
  const canonical = find(head, (node) => node.tagName === 'link' && attrs(node).rel?.split(/\s+/).includes('canonical'));
  const canonicalUrl = attrs(canonical).href;
  const redirect = find(head, (node) => node.tagName === 'meta' && attrs(node)['http-equiv']?.toLowerCase() === 'refresh');
  if (redirect) return { usages, videoPosters, excluded: [{ pagePath, reason: 'redirect' }] };
  const sections = heroFragments(html);
  for (const [index, section] of sections.entries()) {
    const profile = profileFor(section);
    const images = [...walk(section)].filter((node) => node.tagName === 'img' && (hasClass(node, 'hero__media') || hasClass(node, 'team-hero__photo')));
    // <noscript> repeats the same editorial image; templates and fallbacks count once.
    const originals = [...new Map(images.map((node) => [logicalHeroSource(attrs(node).src, { base }), node])).entries()].filter(([source]) => source);
    for (const video of [...walk(section)].filter((node) => node.tagName === 'video')) {
      for (const key of ['data-poster', 'data-mobile-poster', 'poster']) {
        const source = logicalHeroSource(attrs(video)[key], { base });
        if (source) videoPosters.push({ pagePath, source, reason: 'video-first-frame-independent', attribute: key });
      }
    }
    if (!originals.length) excluded.push({ pagePath, sectionIndex: index, reason: 'hero-without-editorial-photograph' });
    for (const [source, image] of originals) {
      if (archived) { excluded.push({ pagePath, source, reason: 'archived-page' }); continue; }
      const sectionAttrs = attrs(section), imageAttrs = attrs(image);
      const manual = styleValue(sectionAttrs.style, '--hero-image-position-mobile');
      const preparedPosition = styleValue(imageAttrs.style, '--hero-mobile-crop-position');
      const video = find(section, (node) => node.tagName === 'video');
      const usage = {
        id: `usage-${hash(`${pagePath}\n${index}\n${source}`).slice(0, 24)}`,
        pagePath, source, profile,
        objectPosition: profile === 'photo-lead' ? manual ?? 'center' : 'center',
        geometry: { ...HERO_GEOMETRY[profile], mobileCssMaxWidth: 720, cropSourceMaxWidth: 479 },
        context: {
          htmlPath, sectionIndex: index, title: textOf(find(section, (node) => node.tagName === 'h1')).trim(),
          heroClasses: classes(section), canonicalUrl,
          imageTextAlign: sectionAttrs['data-image-text-align'] ?? null,
          manualObjectPosition: manual ?? null,
          preparedCrop: imageAttrs['data-mobile-hero'] ? { experiment: imageAttrs['data-mobile-hero'], objectPosition: preparedPosition ?? 'center' } : null,
          videoAlternative: video ? { src: attrs(video)['data-src'] ?? null, mobileSrc: attrs(video)['data-mobile-src'] ?? null } : null,
        },
      };
      usages.push(usage);
    }
  }
  return { usages, excluded, videoPosters };
}

async function htmlFiles(dir) {
  const result = [];
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (entry.name.startsWith('.') || ['_astro', 'media', 'pagefind'].includes(entry.name)) continue;
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) result.push(...await htmlFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.html')) result.push(path);
  }
  return result;
}

async function optionalJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

/** Groups a source once while retaining every distinct actual page/block usage. */
export function groupHeroAssets(usages, { manifests = [], receipts = [] } = {}) {
  const bySource = new Map();
  for (const usage of usages) {
    if (!bySource.has(usage.source)) bySource.set(usage.source, []);
    bySource.get(usage.source).push(usage);
  }
  const existing = manifests.flatMap(({ path, data }) => (data.items ?? []).filter((item) => item.status === 'READY').map((item) => ({ manifest: path, ...item })));
  const receiptsBySource = new Map(receipts.map((entry) => [`/${entry.key.replace(/^\/+/, '')}`, entry]));
  return [...bySource].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([source, rows]) => {
    const existingCrops = existing.filter((entry) => entry.source === source);
    const sourceRecord = existingCrops.find((entry) => entry.sourceSha256);
    const receipt = receiptsBySource.get(source);
    const allPrepared = rows.every((usage) => usage.context.preparedCrop && existingCrops.some((crop) => crop.pagePath === usage.pagePath));
    const preserve = rows.every((usage) => usage.profile === 'preserve-full-image');
    return {
      id: heroAssetId(source), source, usages: rows,
      profiles: [...new Set(rows.map((usage) => usage.profile))].sort(),
      status: preserve ? 'PRESERVE_ORIGINAL' : allPrepared ? 'PREPARED' : 'PENDING',
      existingCrops,
      ...(sourceRecord?.sourceSha256 || receipt?.sha256 ? { sourceSha256: sourceRecord?.sourceSha256 ?? receipt.sha256 } : {}),
      ...(sourceRecord?.sourceWidth ? { sourceWidth: sourceRecord.sourceWidth, sourceHeight: sourceRecord.sourceHeight } : {}),
      ...(sourceRecord?.sourceBytes || receipt?.bytes ? { sourceBytes: sourceRecord?.sourceBytes ?? receipt.bytes } : {}),
    };
  });
}

export async function buildHeroInventory({ rootDir = ROOT, distDir = resolve(rootDir, 'dist'), sourceCommit, base = '/', provenance = 'external-build-declaration', artifact } = {}) {
  if (!/^[a-f0-9]{40}$/i.test(sourceCommit ?? '')) throw new Error('sourceCommit must be the full 40-character commit of the rendered source');
  const files = await htmlFiles(distDir);
  if (!files.length) throw new Error(`No rendered HTML in ${distDir}; run with --build or supply a fresh --dist`);
  const usages = [], excluded = [], videoPosters = [];
  let pagesWithoutHero = 0;
  for (const path of files) {
    const htmlPath = relative(distDir, path).split(sep).join('/');
    const pagePath = htmlPath === 'index.html' ? '/' : htmlPath.endsWith('/index.html') ? `/${htmlPath.slice(0, -10)}` : `/${htmlPath.replace(/\.html$/, '')}/`;
    const result = extractHeroUsages(await readFile(path, 'utf8'), { pagePath, htmlPath, base });
    usages.push(...result.usages); excluded.push(...result.excluded); videoPosters.push(...result.videoPosters);
    if (!result.usages.length && !result.excluded.length) pagesWithoutHero++;
  }
  const manifestPaths = ['src/data/media/mobile-hero-pilot-20261021.json', 'src/data/media/mobile-hero-p06-20261022.json'];
  const manifests = await Promise.all(manifestPaths.map(async (path) => ({ path, data: await optionalJson(resolve(rootDir, path), { items: [] }) })));
  const receipts = (await optionalJson(resolve(rootDir, 'src/data/media/direct-s3-uploads.json'), { assets: [] })).assets;
  const assets = groupHeroAssets(usages, { manifests, receipts });
  const evidenceFiles = ['src/components/editorial/Hero.astro', 'src/pages/team/index.astro'];
  const cssEvidence = evidenceFiles.map((path) => ({ path, sha256: hash(execFileSync('git', ['show', sourceCommit+':'+path], {cwd:rootDir,maxBuffer:4*1024*1024})) }));
  return {
    schemaVersion: 1, sourceCommit,
    provenance: { method: 'rendered-astro-html', verification: artifact ? 'github-pages-artifact' : provenance, ...(artifact ? { artifact } : {}), base, htmlFiles: files.length, cssEvidence, cssEvidenceBasis: 'rendered-source-commit' },
    usages, assets, excluded, videoPosters,
    counts: {
      htmlPages: files.length, heroPages: new Set(usages.map((row) => row.pagePath)).size,
      usages: usages.length, assets: assets.length,
      pendingAssets: assets.filter((row) => row.status === 'PENDING').length,
      preparedAssets: assets.filter((row) => row.status === 'PREPARED').length,
      preservedAssets: assets.filter((row) => row.status === 'PRESERVE_ORIGINAL').length,
      archivedUsages: excluded.filter((row) => row.reason === 'archived-page').length,
      archivedOnlyAssets: new Set(excluded.filter((row) => row.reason === 'archived-page' && !assets.some((asset) => asset.source === row.source)).map((row) => row.source)).size,
      pagesWithoutHero, videoPosterUsages: videoPosters.length,
      uniqueVideoPosters: new Set(videoPosters.map((row) => row.source)).size,
    },
  };
}

async function main(argv) {
  const options = { rootDir: ROOT };
  let output, build = false;
  for (let i = 0; i < argv.length; i++) {
    const option = argv[i];
    if (option === '--build') build = true;
    else if (option === '--write') output = argv[++i];
    else if (option === '--root') options.rootDir = resolve(argv[++i]);
    else if (option === '--dist') options.distDir = resolve(argv[++i]);
    else if (option === '--source-commit') options.sourceCommit = argv[++i];
    else if (option === '--base') options.base = argv[++i];
    else if (option === '--artifact-run') options.artifact = { ...options.artifact, runId: argv[++i] };
    else if (option === '--artifact-sha256') options.artifact = { ...options.artifact, sha256: argv[++i] };
    else if (option === '--help') {
      console.log('node scripts/mobile-hero-inventory.mjs --build --write data/media/mobile-hero-swarm/inventory.json\nOr: --dist <Astro output> --source-commit <full SHA> [--artifact-run <Pages run ID> --artifact-sha256 <artifact SHA-256>] [--write <path>] [--root <repository>] [--base /]');
      return;
    } else throw new Error(`Unknown option: ${option}`);
  }
  options.distDir ??= resolve(options.rootDir, 'dist');
  if (options.artifact && (!/^\d+$/.test(options.artifact.runId ?? '') || (options.artifact.sha256 && !/^[a-f0-9]{64}$/i.test(options.artifact.sha256)))) throw new Error('Artifact metadata requires a numeric --artifact-run and, when given, a 64-character --artifact-sha256');
  if (build && options.artifact) throw new Error('--build and --artifact-run describe different render provenance');
  if (build) {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: options.rootDir, encoding: 'utf8' }).trim();
    if (options.sourceCommit && options.sourceCommit !== commit) throw new Error('--source-commit does not match the source being built');
    // New untracked content can generate routes too, so inspect all render inputs.
    const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal', '--', 'src', 'public', 'data', 'astro.config.mjs', 'package.json', 'package-lock.json'], { cwd: options.rootDir, encoding: 'utf8' }).trim();
    if (dirty) throw new Error('Commit source/data changes before creating a commit-pinned inventory');
    const astroDirectory = resolve(options.rootDir, 'node_modules/astro');
    const astroPackage = JSON.parse(await readFile(resolve(astroDirectory, 'package.json'), 'utf8'));
    const astroBin = typeof astroPackage.bin === 'string' ? astroPackage.bin : astroPackage.bin?.astro;
    if (!astroBin) throw new Error('Installed Astro package does not declare its CLI');
    execFileSync(process.execPath, [resolve(astroDirectory, astroBin), 'build', '--outDir', options.distDir], { cwd: options.rootDir, stdio: 'inherit' });
    options.sourceCommit = commit;
    options.provenance = 'fresh-build-in-this-process';
  }
  const inventory = await buildHeroInventory(options);
  if (output) {
    const path = resolve(options.rootDir, output);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(inventory, null, 2) + '\n');
    console.log(JSON.stringify({ output: relative(options.rootDir, path), ...inventory.counts }, null, 2));
  } else console.log(JSON.stringify(inventory, null, 2));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
