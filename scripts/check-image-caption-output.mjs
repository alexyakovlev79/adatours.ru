#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'parse5';
import { fileURLToPath } from 'node:url';
import { logicalImagePath } from './lib/image-captions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const overrides = JSON.parse(fs.readFileSync(path.join(root, 'src/data/media/image-caption-overrides.json'), 'utf8'));
const bySrc = new Map(overrides.images.map((r) => [logicalImagePath(r.src), r]));
const contentMedia = new Set(['media-gallery__item', 'day__media', 'day__embedded-excursion__media', 'highlight__media', 'team-hero__visual', 'person__media']);
const walkFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walkFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const errors = [];
let substantive = 0, decorative = 0;
const seen = new Set();
for (const file of walkFiles(path.join(root, 'dist')).filter((f) => f.endsWith('.html'))) {
  const visit = (node, content = false) => {
    const attrs = Object.fromEntries((node.attrs ?? []).map((a) => [a.name, a.value]));
    const classes = new Set((attrs.class ?? '').split(/\s+/));
    const meaningful = content || [...classes].some((c) => contentMedia.has(c));
    if (node.tagName === 'img') {
      const row = bySrc.get(logicalImagePath(attrs.src));
      if (row && meaningful) {
        substantive++; seen.add(row.src);
        if (attrs.alt !== row.alt || attrs.title !== row.hover) errors.push({ file: path.relative(root, file), src: row.src, alt: attrs.alt, title: attrs.title });
      }
      if (classes.has('hero__media') || classes.has('band-card__media') || attrs['aria-hidden'] === 'true') {
        decorative++;
        if (attrs.alt !== '' || attrs.title !== undefined) errors.push({ file: path.relative(root, file), src: attrs.src, reason: 'decorative image must retain empty alt and no title' });
      }
    }
    for (const child of node.childNodes ?? []) visit(child, meaningful);
  };
  visit(parse(fs.readFileSync(file, 'utf8')));
}
if (!substantive) errors.push({ reason: 'No reviewed substantive images found in built output' });
console.log(JSON.stringify({ substantiveUsagesChecked: substantive, distinctReviewedContentImages: seen.size, decorativeUsagesChecked: decorative, errors }));
if (errors.length) process.exitCode = 1;
