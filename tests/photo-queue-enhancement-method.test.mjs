import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPhotoQueue } from '../scripts/photo-queue.mjs';

const source = 'https://example.invalid/original.jpg';
const transformed = '/media/destinations/example/gallery-enhanced-20261005.webp';
function queue(current, enhancements) {
  return buildPhotoQueue({
    entries: [{ id: 'photo_policy_test', type: 'destination', contentPath: 'test.md' }],
    contents: new Map([['photo_policy_test', { status: 'approved', hero: { src: current } }]]),
    enhancements,
  });
}
test('deterministic restoration and enhanced filenames leave current assets queued', () => {
  const records = [{ source, enhanced: transformed, method: 'deterministic-restoration' }];
  assert.equal(queue(transformed, records).photos[0].source, transformed);
  assert.equal(queue(source, records).photos[0].source, source);
  assert.equal(queue(transformed, []).photos.length, 1);
});
test('only a confirmed GPT Image record permits completion or reuse', () => {
  for (const method of [undefined, 'user-provided', 'webp-conversion']) {
    assert.equal(queue(transformed, [{ source, enhanced: transformed, method }]).photos.length, 1);
    assert.equal(queue(source, [{ source, enhanced: transformed, method }]).reuse.length, 0);
  }
  const records = [{ source, enhanced: transformed, method: 'gpt-image' }];
  assert.equal(queue(transformed, records).photos.length, 0);
  assert.equal(queue(source, records).reuse[0].enhanced, transformed);
});
