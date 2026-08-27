import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createNode, harvestOnce, tickRegrow } from '../src/core/nodes.js';
import { NODE_REGROW_SECONDS, SWING_COOLDOWN, MAX_FRAME_DT } from '../src/core/constants.js';

// harvestOnce is the pickaxe's yield. It replaced tickHarvest, which accrued
// time while the player stood still — a way of gathering that read on a phone
// as the game doing nothing.

test('clamped dt stays well under SWING_COOLDOWN, so no swing is ever skipped', () => {
  assert.ok(MAX_FRAME_DT < SWING_COOLDOWN,
    'a frame step at or above the cooldown would silently drop swings');
});

test('a swing takes exactly one item', () => {
  const n = createNode('wood', 0, 0, 3);
  assert.equal(harvestOnce(n), 'wood');
  assert.equal(n.remaining, 2);
});

test('a node reports the kind it actually holds', () => {
  const n = createNode('coal', 0, 0, 2);
  assert.equal(harvestOnce(n), 'coal');
});

test('a node depletes on the swing that empties it', () => {
  const n = createNode('wood', 0, 0, 1);
  assert.equal(harvestOnce(n), 'wood');
  assert.equal(n.depleted, true);
  assert.equal(harvestOnce(n), null, 'a bare node kept handing out logs');
});

test('a swing banks nothing, so a node cannot pay out a free log later', () => {
  // The failure mode of the old time-accrual harvest: partial progress stored
  // on the node meant walking past a half-chopped tree handed the next player
  // a log for one frame's work.
  const n = createNode('wood', 0, 0, 5);
  for (let i = 0; i < 20; i++) harvestOnce(n);
  assert.equal(n.remaining, 0);
  assert.equal(Object.keys(n).includes('progress'), false,
    'the node still carries harvest progress that nothing reads');
});

test('regrowth returns one item at a time, up to the cap', () => {
  const n = createNode('wood', 0, 0, 2);
  harvestOnce(n);
  harvestOnce(n);
  assert.equal(n.depleted, true);

  assert.equal(tickRegrow(n, NODE_REGROW_SECONDS), true, 'a stripped node should announce its return');
  assert.equal(n.remaining, 1);
  assert.equal(n.depleted, false);

  assert.equal(tickRegrow(n, NODE_REGROW_SECONDS), false, 'only the revival is announced');
  assert.equal(n.remaining, 2);

  tickRegrow(n, NODE_REGROW_SECONDS * 3);
  assert.equal(n.remaining, 2, 'regrowth overflowed the cap');
});
