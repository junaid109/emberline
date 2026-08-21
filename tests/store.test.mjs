// tests/store.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RESOURCES, createStore, storeAdd, storeSpend } from '../src/core/store.js';

test('the four resources are wood, meat, water and stone', () => {
  assert.deepEqual(RESOURCES, ['wood', 'meat', 'water', 'stone']);
});

test('a new store has every resource at zero', () => {
  const s = createStore();
  for (const r of RESOURCES) assert.equal(s[r], 0);
});

test('adding increases the named resource only', () => {
  const s = createStore();
  storeAdd(s, 'wood', 3);
  assert.equal(s.wood, 3);
  assert.equal(s.stone, 0);
});

test('spending succeeds when affordable and deducts', () => {
  const s = createStore();
  storeAdd(s, 'wood', 5);
  assert.equal(storeSpend(s, 'wood', 3), true);
  assert.equal(s.wood, 2);
});

test('spending fails when unaffordable and does not deduct', () => {
  const s = createStore();
  storeAdd(s, 'wood', 2);
  assert.equal(storeSpend(s, 'wood', 3), false);
  assert.equal(s.wood, 2);
});
