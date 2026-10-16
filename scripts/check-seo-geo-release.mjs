#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { partitionSeoGeoReleaseCandidates } from '../src/lib/seo-geo-release-gate.mjs';

// One batch, explicit manifest only. No full article scan, network or build.
const args = process.argv.slice(2);
const arg = (flag, fallback) => { const i = args.indexOf(flag); return i < 0 ? fallback : args[i + 1]; };
const file = arg('--manifest', null);
if (!file) { console.error('Usage: --manifest <batch.json> [--source-root <staging>]'); process.exit(2); }
const root = resolve(arg('--source-root', '.'));
const manifest = JSON.parse(readFileSync(resolve(file), 'utf8'));
if (!Array.isArray(manifest)) throw TypeError('Expected array of {url,path}');
const validPath = /^data\/seo-geo\/articles\/(?:[a-z0-9_-]+\/)+index\.md$/;
const candidates = manifest.map((r) => {
  if (!r || !validPath.test(r.path)) return r || {};
  try { return { ...r, content: typeof r.content === 'string' ? r.content :
    readFileSync(resolve(root, r.path), 'utf8') }; }
  catch { return { ...r, content: null }; }
});
const { accepted, held } = partitionSeoGeoReleaseCandidates(candidates);
console.log(JSON.stringify({ checked: candidates.length,
  accepted: accepted.map(({ url, path }) => ({ url, path })),
  held: held.map(({ url, path, reason }) => ({ url, path, reason })) }, null, 2));
// Invalid articles are held, not published, while valid ones are not blocked.
