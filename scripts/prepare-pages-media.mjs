import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const textExtensions = new Set(['.html', '.css', '.js', '.mjs', '.json', '.xml',
  '.txt', '.svg', '.webmanifest', '.map', '.md']);
const sameSite = /https?:\/\/(?:www\.)?adatours\.ru\/media\//g;
const bare = /(?<![A-Za-z0-9_./~:%\\-])\/media\//g;
const escapedSite = /https?:\\\/\\\/(?:www\.)?adatours\.ru\\\/media\\\//g;
const escapedBare = /(?<![A-Za-z0-9_./~:%\\-])\\\/media\\\//g;

export function rewriteMediaUrls(content, cdnOrigin) {
  const prefix = cdnOrigin + '/media/';
  const escaped = cdnOrigin.replaceAll('/', '\\/') + '\\/media\\/';
  return content.replace(sameSite, prefix).replace(escapedSite, escaped)
    .replace(escapedBare, escaped).replace(bare, prefix);
}
export function hasLocalMediaUrls(content) {
  sameSite.lastIndex = bare.lastIndex = escapedSite.lastIndex = escapedBare.lastIndex = 0;
  return sameSite.test(content) || escapedSite.test(content)
    || escapedBare.test(content) || bare.test(content);
}
async function textFiles(dir, files = []) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'media') await textFiles(file, files);
    else if (entry.isFile() && textExtensions.has(path.extname(entry.name).toLowerCase()))
      files.push(file);
  }
  return files;
}
async function fileStats(dir) {
  let count = 0, bytes = 0;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const v = await fileStats(file);
      count += v.count;
      bytes += v.bytes;
    } else if (entry.isFile()) {
      count++;
      bytes += (await fs.stat(file)).size;
    }
  }
  return { count, bytes };
}

async function main() {
  if (!process.env.MEDIA_CDN_ORIGIN) {
    console.log('MEDIA_CDN_ORIGIN not set: keeping local media in this build.');
    return;
  }
  const cdn = new URL(process.env.MEDIA_CDN_ORIGIN);
  if (cdn.origin !== 'https://img.adatours.ru' || cdn.pathname !== '/'
    || cdn.search || cdn.hash || cdn.username || cdn.password)
    throw new Error('MEDIA_CDN_ORIGIN must be https://img.adatours.ru');
  if ((process.env.SITE_BASE || '/') !== '/')
    throw new Error('External-media build requires SITE_BASE=/');

  const dist = path.resolve('dist');
  const media = path.join(dist, 'media');
  let changed = 0, updatedRefs = 0;
  const unresolved = [];
  for (const file of await textFiles(dist)) {
    const previous = await fs.readFile(file, 'utf8');
    const next = rewriteMediaUrls(previous, cdn.origin);
    if (next !== previous) {
      changed++;
      const count = (s) => (s.match(/https:\/\/img\.adatours\.ru\/media\//g) || []).length;
      updatedRefs += count(next) - count(previous);
      await fs.writeFile(file, next);
    }
    if (hasLocalMediaUrls(next)) unresolved.push(path.relative(dist, file));
  }
  if (unresolved.length) throw new Error('Local media URLs remain: ' + unresolved.slice(0, 12).join(', '));
  if (updatedRefs < 1) throw new Error('No media references rewritten: will not remove dist/media');
  if (!(await fs.stat(media)).isDirectory()) throw new Error('dist/media does not exist');
  const stats = await fileStats(media);
  if (stats.count < 100) throw new Error('Too few assets in dist/media');
  await fs.rm(media, { recursive: true });
  if (!(await fs.stat(path.resolve('public/media'))).isDirectory())
    throw new Error('Source public/media unexpectedly absent');
  const report = {
    sourceCommit: process.env.GITHUB_SHA || null, mediaOrigin: cdn.origin,
    modifiedTextFiles: changed, redirectedReferences: updatedRefs,
    excludedFiles: stats.count, excludedBytes: stats.bytes,
    sourceMediaRetained: true,
  };
  await fs.writeFile(path.join(dist, 'media-offload-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('External media deployment: ' + JSON.stringify(report));
  const output = await fileStats(dist);
  console.log('GitHub Pages artifact source size: ' + output.bytes + ' bytes');
  if (output.bytes > 950_000_000) throw new Error('Published site still too large');
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  await main();
