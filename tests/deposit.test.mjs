// tests/deposit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOnPad, createDeposit, tickDeposit } from '../src/core/deposit.js';
import { createCarry, carryAdd, carryTotal } from '../src/core/carry.js';
import { createStore } from '../src/core/store.js';
import { DEPOSIT_INTERVAL } from '../src/core/constants.js';

test('isOnPad is true well inside the pad', () => {
  assert.equal(isOnPad(0, 0, 0, 0, 5), true);
});

test('isOnPad is false well outside the pad', () => {
  assert.equal(isOnPad(100, 100, 0, 0, 5), false);
});

test('isOnPad on the exact boundary resolves to true (<=, inclusive)', () => {
  // point exactly padRadius away from the pad center
  assert.equal(isOnPad(5, 0, 0, 0, 5), true);
  // one unit further out must be false
  assert.equal(isOnPad(5.000001, 0, 0, 0, 5), false);
});

test('one deposit occurs after enough accumulated time, not before', () => {
  const dep = createDeposit();
  const carry = createCarry(8);
  carryAdd(carry, 'wood');
  carryAdd(carry, 'wood');
  const store = createStore();

  // just under the interval: nothing deposited yet
  let kinds = tickDeposit(dep, DEPOSIT_INTERVAL - 0.01, true, carry, store);
  assert.equal(kinds, null);
  assert.equal(store.wood, 0);
  assert.equal(carryTotal(carry), 2);

  // crossing the interval: exactly one item deposited
  kinds = tickDeposit(dep, 0.02, true, carry, store);
  assert.deepEqual(kinds, ['wood']);
  assert.equal(store.wood, 1);
  assert.equal(carryTotal(carry), 1);
});

test('drain is bounded: dt clamped to 0.05s cannot deposit more than one item at DEPOSIT_INTERVAL 0.09s', () => {
  assert.ok(0.05 < DEPOSIT_INTERVAL, 'test assumption: clamped dt must be smaller than the deposit interval');

  const dep = createDeposit();
  const carry = createCarry(8);
  for (let i = 0; i < 8; i++) carryAdd(carry, 'wood');
  const store = createStore();

  const kinds = tickDeposit(dep, 0.05, true, carry, store);
  const count = kinds ? kinds.length : 0;
  assert.ok(count <= 1, `expected at most 1 deposit per call, got ${count}`);
});

test('a large dt does not dump the whole stack at once', () => {
  const dep = createDeposit();
  const carry = createCarry(100);
  for (let i = 0; i < 100; i++) carryAdd(carry, 'wood');
  const store = createStore();

  // a huge elapsed time, e.g. from a tab resuming after being backgrounded,
  // large enough to drain many but not all of a big stack
  const kinds = tickDeposit(dep, 5, true, carry, store);

  assert.ok(kinds.length < 100, 'the whole stack must not drain in a single call');
  assert.equal(kinds.length, Math.floor(5 / DEPOSIT_INTERVAL));
});

test('off the pad, nothing is deposited and the timer resets', () => {
  const dep = createDeposit();
  const carry = createCarry(8);
  carryAdd(carry, 'wood');
  const store = createStore();

  // accumulate some time on the pad, short of a deposit
  tickDeposit(dep, DEPOSIT_INTERVAL - 0.01, true, carry, store);
  assert.ok(dep.timer > 0);

  // step off the pad
  const kinds = tickDeposit(dep, 0.05, false, carry, store);
  assert.equal(kinds, null);
  assert.equal(dep.timer, 0);
  assert.equal(carryTotal(carry), 1);
  assert.equal(store.wood, 0);
});

test('on the pad with an empty carry, nothing accumulates', () => {
  const dep = createDeposit();
  const carry = createCarry(8);
  const store = createStore();

  tickDeposit(dep, 1, true, carry, store);
  assert.equal(dep.timer, 0);
});

test('over many calls, total deposited into store equals items removed from carry', () => {
  const dep = createDeposit();
  const carry = createCarry(8);
  for (let i = 0; i < 8; i++) carryAdd(carry, i % 2 === 0 ? 'wood' : 'coal');
  const store = createStore();

  let totalDeposited = 0;
  const startCount = carryTotal(carry);

  for (let i = 0; i < 200 && carryTotal(carry) > 0; i++) {
    const kinds = tickDeposit(dep, 0.05, true, carry, store);
    if (kinds) totalDeposited += kinds.length;
  }

  const totalInStore = store.wood + store.coal;
  assert.equal(totalInStore, startCount);
  assert.equal(totalDeposited, startCount);
  assert.equal(carryTotal(carry), 0);
});

test('the returned kinds list matches what was actually deposited', () => {
  const dep = createDeposit();
  const carry = createCarry(8);
  carryAdd(carry, 'wood');
  carryAdd(carry, 'coal');
  carryAdd(carry, 'wood');
  const store = createStore();

  const allKinds = [];
  for (let i = 0; i < 50 && carryTotal(carry) > 0; i++) {
    const kinds = tickDeposit(dep, 0.05, true, carry, store);
    if (kinds) allKinds.push(...kinds);
  }

  const woodCount = allKinds.filter(k => k === 'wood').length;
  const coalCount = allKinds.filter(k => k === 'coal').length;
  assert.equal(woodCount, store.wood);
  assert.equal(coalCount, store.coal);
  assert.equal(allKinds.length, 3);
});
