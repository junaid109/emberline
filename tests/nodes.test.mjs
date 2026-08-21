// tests/nodes.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, tickHarvest } from '../src/core/nodes.js';
import { HARVEST_SECONDS } from '../src/core/constants.js';

test('a new node holds its full amount and is not depleted', () => {
  const n = createNode('wood', 5, 5, 3);
  assert.equal(n.remaining, 3);
  assert.equal(n.depleted, false);
});

test('ticking below the harvest time yields nothing', () => {
  const n = createNode('wood', 0, 0, 3);
  assert.equal(tickHarvest(n, HARVEST_SECONDS * 0.5).yielded, false);
});

test('ticking past the harvest time yields one item', () => {
  const n = createNode('wood', 0, 0, 3);
  const r = tickHarvest(n, HARVEST_SECONDS + 0.01);
  assert.equal(r.yielded, true);
  assert.equal(r.kind, 'wood');
  assert.equal(n.remaining, 2);
});

test('progress carries over rather than resetting', () => {
  const n = createNode('wood', 0, 0, 3);
  tickHarvest(n, HARVEST_SECONDS * 0.6);
  assert.equal(tickHarvest(n, HARVEST_SECONDS * 0.6).yielded, true);
});

test('a node depletes and then yields nothing further', () => {
  const n = createNode('wood', 0, 0, 1);
  tickHarvest(n, HARVEST_SECONDS + 0.01);
  assert.equal(n.depleted, true);
  assert.equal(tickHarvest(n, HARVEST_SECONDS + 0.01).yielded, false);
});
