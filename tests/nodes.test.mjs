// tests/nodes.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, tickHarvest } from '../src/core/nodes.js';
import { HARVEST_SECONDS } from '../src/core/constants.js';

// tickHarvest yields at most one item per call and does not reclaim progress
// beyond a single HARVEST_SECONDS interval. That is only safe because the
// caller (src/main.js) clamps dt to 0.05s before calling tickHarvest — assert
// that invariant explicitly here, mirroring tests/deposit.test.mjs.
test('clamped dt (0.05s) stays well under HARVEST_SECONDS, the invariant tickHarvest relies on', () => {
  assert.ok(0.05 < HARVEST_SECONDS, 'test assumption: clamped dt must be smaller than HARVEST_SECONDS');
});

test('a new node holds its full amount and is not depleted', () => {
  const n = createNode('wood', 5, 5, 3);
  assert.equal(n.remaining, 3);
  assert.equal(n.depleted, false);
});

test('ticking below the harvest time yields nothing', () => {
  const n = createNode('wood', 0, 0, 3);
  assert.equal(tickHarvest(n, HARVEST_SECONDS * 0.5), null);
});

test('ticking past the harvest time yields one item', () => {
  const n = createNode('wood', 0, 0, 3);
  const kind = tickHarvest(n, HARVEST_SECONDS + 0.01);
  assert.equal(kind, 'wood');
  assert.equal(n.remaining, 2);
});

test('progress carries over rather than resetting', () => {
  const n = createNode('wood', 0, 0, 3);
  tickHarvest(n, HARVEST_SECONDS * 0.6);
  assert.notEqual(tickHarvest(n, HARVEST_SECONDS * 0.6), null);
});

test('a node depletes and then yields nothing further', () => {
  const n = createNode('wood', 0, 0, 1);
  tickHarvest(n, HARVEST_SECONDS + 0.01);
  assert.equal(n.depleted, true);
  assert.equal(tickHarvest(n, HARVEST_SECONDS + 0.01), null);
});
