// tests/heat.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ringRadius, drainHeat, addFuel } from '../src/core/heat.js';
import { HEAT_MAX, RING_MIN, RING_MAX } from '../src/core/constants.js';

test('zero heat gives the minimum ring', () => {
  assert.equal(ringRadius(0), RING_MIN);
});

test('full heat gives the maximum ring', () => {
  assert.equal(ringRadius(HEAT_MAX), RING_MAX);
});

test('half heat gives the midpoint ring', () => {
  assert.equal(ringRadius(HEAT_MAX / 2), (RING_MIN + RING_MAX) / 2);
});

test('ring radius never goes below the minimum even for negative heat', () => {
  assert.equal(ringRadius(-50), RING_MIN);
});

test('drain reduces heat by rate times dt', () => {
  assert.equal(drainHeat(50, 2, 1.5), 47);
});

test('drain never goes below zero', () => {
  assert.equal(drainHeat(1, 10, 5), 0);
});

test('fuel is clamped at the maximum', () => {
  assert.equal(addFuel(95, 20), HEAT_MAX);
});

test('fuel adds normally well below the cap', () => {
  assert.equal(addFuel(30, 15), 45);
});

test('adding zero fuel leaves heat unchanged', () => {
  assert.equal(addFuel(40, 0), 40);
});
