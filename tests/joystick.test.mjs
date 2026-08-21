import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stickVector } from '../src/input/joystick.js';

test('returns zero at the origin', () => {
  assert.deepEqual(stickVector(100, 100, 100, 100, 50), { x: 0, y: 0 });
});

test('returns a unit vector at the rim', () => {
  const v = stickVector(100, 100, 150, 100, 50);
  assert.equal(v.x, 1);
  assert.equal(v.y, 0);
});

test('clamps magnitude to 1 beyond the rim', () => {
  const v = stickVector(100, 100, 400, 100, 50);
  assert.equal(v.x, 1);
});

test('scales linearly inside the rim', () => {
  const v = stickVector(100, 100, 125, 100, 50);
  assert.equal(v.x, 0.5);
});

test('normalises diagonals so they are not faster', () => {
  const v = stickVector(0, 0, 100, 100, 50);
  assert.ok(Math.abs(Math.hypot(v.x, v.y) - 1) < 1e-9);
});
