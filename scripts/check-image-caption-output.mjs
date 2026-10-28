#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logicalImagePath } from './lib/image-captions.mjs';
import { inspectImageCaptions } from './lib/image-caption-output.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const overrides = JSON.parse(fs.readFileSync(path.join(root, 'src/data/media/image-caption-overrides.json'), 'utf8'));
const bySrc = new Map(overrides.images.map((r) => [logicalImagePath(r.src), r]));
const walkFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walkFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const errors = [];
let substantive = 0, decorative = 0;
const seen = new Set(), reviewed = new Set();
for (const file of walkFiles(path.join(root, 'dist')).filter((f) => f.endsWith('.html'))) {
  const result = inspectImageCaptions(fs.readFileSync(file, 'utf8'), bySrc);
  substantive += result.substantive;
  decorative += result.decorative;
  result.sources.forEach((src) => seen.add(src));
  result.reviewedSources.forEach((src) => reviewed.add(src));
  errors.push(...result.errors.map((error) => ({ file: path.relative(root, file), ...error })));
}
if (!substantive) errors.push({ reason: 'No substantive images found in built output' });
console.log(JSON.stringify({ substantiveUsagesChecked: substantive, distinctContentImages: seen.size, distinctReviewedContentImages: reviewed.size, decorativeUsagesChecked: decorative, errorCount: errors.length, errors: errors.slice(0, 100) }));
if (errors.length) process.exitCode = 1;
