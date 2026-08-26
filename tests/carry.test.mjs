// tests/carry.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCarry, carryAdd, carryPop, carryTotal, carryCountOf, carryIsFull } from '../src/core/carry.js';

test('a new carry is empty', () => {
  assert.equal(carryTotal(createCarry(8)), 0);
});

test('adding returns true and increases the total', () => {
  const c = createCarry(2);
  assert.equal(carryAdd(c, 'wood'), true);
  assert.equal(carryTotal(c), 1);
});

test('adding beyond capacity returns false and does not grow', () => {
  const c = createCarry(1);
  carryAdd(c, 'wood');
  assert.equal(carryAdd(c, 'wood'), false);
  assert.equal(carryTotal(c), 1);
});

test('reports full at capacity', () => {
  const c = createCarry(1);
  carryAdd(c, 'wood');
  assert.equal(carryIsFull(c), true);
});

test('pop returns items last-in-first-out', () => {
  const c = createCarry(4);
  carryAdd(c, 'wood');
  carryAdd(c, 'coal');
  assert.equal(carryPop(c), 'coal');
  assert.equal(carryPop(c), 'wood');
});

test('pop on an empty carry returns null', () => {
  assert.equal(carryPop(createCarry(4)), null);
});

test('counts by kind', () => {
  const c = createCarry(8);
  carryAdd(c, 'wood');
  carryAdd(c, 'wood');
  carryAdd(c, 'coal');
  assert.equal(carryCountOf(c, 'wood'), 2);
  assert.equal(carryCountOf(c, 'meat'), 0);
});
