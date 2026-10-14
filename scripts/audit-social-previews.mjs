// Weekly audit of every social preview referenced by the latest published Pages release.
// No Astro build, S3 write permissions or secrets required: all URLs are public.
import {
  readPublishedSocialManifest, verifySocialPreview,
} from './lib/social-preview-manifest.mjs';

const keys = [...await readPublishedSocialManifest()].sort();
let next = 0;
let checked = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < keys.length) {
    await verifySocialPreview(keys[next++]);
    if (++checked % 100 === 0 || checked === keys.length)
      console.log('Social-preview audit: ' + checked + '/' + keys.length);
  }
}));
console.log('Social-preview full audit passed: ' + checked + ' active images checked in S3.');
