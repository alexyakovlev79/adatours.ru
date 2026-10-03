import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_PAGE_SIZE, catalogPagePath, paginateCatalog, paginationNumbers } from '../src/lib/catalog-pagination.ts';

const root = '/brazil/place/rio-de-janeiro/tour/';

test('page one uses the existing root, following pages have distinct paths', () => {
  assert.equal(CATALOG_PAGE_SIZE, 10);
  assert.equal(catalogPagePath(root, 1), root);
  assert.equal(catalogPagePath(root, 2), `${root}page/2/`);
  for (const value of [0, -1, 1.5, NaN, Infinity, '2']) assert.throws(() => catalogPagePath(root, value));
  for (const value of ['https://example.org/', '//other/', '/tours/?page=2', '/tours/#2', '/tours/../', '/tours']) {
    assert.throws(() => catalogPagePath(value, 1));
  }
});

test('pagination preserves every item and its order, including exact boundaries', () => {
  for (const count of [0, 1, 5, 10, 11, 20, 21, 33, 60, 136, 342]) {
    const entries = Array.from({ length: count }, (_, index) => `item-${index}`);
    const original = [...entries];
    const pages = paginateCatalog(entries, root);
    assert.equal(pages.length, Math.ceil(count / 10));
    assert.deepEqual(pages.flatMap((page) => page.entries), original);
    assert.deepEqual(entries, original);
    for (const [index, { entries: chunk, pagination: p }] of pages.entries()) {
      assert.ok(chunk.length > 0 && chunk.length <= 10);
      assert.equal(p.currentPage, index + 1);
      assert.equal(p.canonical, catalogPagePath(root, index + 1));
      assert.equal(p.previousPath, index ? catalogPagePath(root, index) : undefined);
      assert.equal(p.nextPath, index + 1 < pages.length ? catalogPagePath(root, index + 2) : undefined);
      assert.equal(p.from, index * 10 + 1);
      assert.equal(p.to, Math.min((index + 1) * 10, count));
      assert.equal(p.totalItems, count);
    }
  }
});

test('numbered navigation always contains first, last and current without duplicates', () => {
  for (let total = 1; total <= 50; total++) {
    for (let current = 1; current <= total; current++) {
      const numbers = paginationNumbers(current, total).filter((value) => typeof value === 'number');
      assert.ok(numbers.includes(1) && numbers.includes(total) && numbers.includes(current));
      assert.equal(new Set(numbers).size, numbers.length);
      assert.ok(numbers.length <= 9);
      assert.ok(numbers.every((value) => value >= 1 && value <= total));
      assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b));
    }
  }
  assert.throws(() => paginationNumbers(0, 10));
  assert.throws(() => paginationNumbers(11, 10));
});
