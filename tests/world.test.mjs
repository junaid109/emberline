import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createWorld, tickWorld, clampDt, spawnNodes } from '../src/core/world.js';
import { carryTotal, carryIsFull } from '../src/core/carry.js';
import {
  PLAYER_SPEED, WORLD_RADIUS, WORLD_EDGE_MARGIN, HEAT_START, HEAT_DRAIN_DAY,
  HEAT_PER_WOOD, HEAT_MAX, CARRY_CAP, HARVEST_SECONDS, HARVEST_RANGE,
  NODE_COUNT, NODE_AMOUNT, MAX_FRAME_DT, DEPOSIT_INTERVAL,
  NODE_REGROW_SECONDS,
} from '../src/core/constants.js';

const STEP = MAX_FRAME_DT;

/** Runs n steps of dt with a fixed input direction. */
function run(world, n, dt = STEP, dx = 0, dz = 0) {
  for (let i = 0; i < n; i++) tickWorld(world, dt, dx, dz);
}

/**
 * Same, but keeps the furnace fed.
 *
 * The furnace now burns out in well under a minute, and tickWorld stops the
 * world once it does. A test about movement or harvesting that runs longer than
 * that would silently become a test about starvation instead, so these ones say
 * out loud that the fire is not the subject.
 */
function runFed(world, n, dt = STEP, dx = 0, dz = 0) {
  for (let i = 0; i < n; i++) { world.heat = HEAT_MAX; tickWorld(world, dt, dx, dz); }
}

/** Teleports the player next to a node without simulating the walk there. */
function standAt(world, x, z) {
  world.player.x = x;
  world.player.z = z;
}

// --- clampDt ---------------------------------------------------------------

test('clampDt caps a backgrounded-tab step at MAX_FRAME_DT', () => {
  assert.equal(clampDt(12), MAX_FRAME_DT);
});

test('clampDt passes a normal frame through untouched', () => {
  assert.equal(clampDt(0.016), 0.016);
});

test('clampDt rejects zero, negative, and NaN steps', () => {
  assert.equal(clampDt(0), 0);
  assert.equal(clampDt(-1), 0);
  assert.equal(clampDt(NaN), 0);
});

test('MAX_FRAME_DT stays below HARVEST_SECONDS, or tickHarvest silently drops yields', () => {
  assert.ok(MAX_FRAME_DT < HARVEST_SECONDS);
});

// --- spawn -----------------------------------------------------------------

test('spawnNodes places NODE_COUNT nodes, all outside the deposit pad', () => {
  const nodes = spawnNodes();
  assert.equal(nodes.length, NODE_COUNT);
  for (const n of nodes) {
    assert.ok(Math.hypot(n.x, n.z) > 5, 'a node spawned on top of the furnace');
    assert.ok(Math.hypot(n.x, n.z) < WORLD_RADIUS, 'a node spawned outside the world');
  }
});

test('the player does not start standing on the deposit pad', () => {
  const w = createWorld();
  const ev = tickWorld(w, STEP, 0, 0);
  assert.equal(ev.onPad, false);
});

// --- movement --------------------------------------------------------------

test('movement covers PLAYER_SPEED * dt in the input direction', () => {
  const w = createWorld();
  const z0 = w.player.z;
  tickWorld(w, STEP, 0, 1);
  assert.ok(Math.abs(w.player.z - (z0 + PLAYER_SPEED * STEP)) < 1e-9);
  assert.equal(w.player.x, 0);
});

test('zero input leaves position and facing untouched', () => {
  const w = createWorld();
  w.player.angle = 1.23;
  const { x, z } = w.player;
  run(w, 10);
  assert.equal(w.player.x, x);
  assert.equal(w.player.z, z);
  assert.equal(w.player.angle, 1.23, 'facing should not snap when the stick is released');
});

test('the player is clamped inside the world edge no matter how long they walk', () => {
  const w = createWorld();
  runFed(w, 2000, STEP, 1, 0);
  const limit = WORLD_RADIUS - WORLD_EDGE_MARGIN;
  assert.ok(Math.hypot(w.player.x, w.player.z) <= limit + 1e-9);
  assert.ok(w.player.x > limit - 1e-6, 'should be pressed right up against the edge');
});

test('clamping preserves direction rather than snapping to an axis', () => {
  const w = createWorld();
  w.player.x = 0;
  w.player.z = 0;                       // start centred so the walk is a true diagonal
  run(w, 2000, STEP, 1, 1);
  const limit = WORLD_RADIUS - WORLD_EDGE_MARGIN;
  assert.ok(Math.abs(Math.hypot(w.player.x, w.player.z) - limit) < 1e-6, 'should rest on the limit circle');
  assert.ok(w.player.x > 0 && w.player.z > 0, 'neither axis may be zeroed by the clamp');
  assert.ok(Math.abs(w.player.x - w.player.z) < 1e-3, 'diagonal walk should stop on the diagonal');
});

test('facing follows the input direction', () => {
  const w = createWorld();
  tickWorld(w, STEP, 1, 0);
  assert.ok(Math.abs(w.player.angle - Math.PI / 2) < 1e-9);
});

// --- heat ------------------------------------------------------------------

test('heat drains at HEAT_DRAIN_DAY per second', () => {
  const w = createWorld();
  run(w, 20);                                    // 20 * 0.05 = 1.0s
  assert.ok(Math.abs(w.heat - (HEAT_START - HEAT_DRAIN_DAY)) < 1e-9);
});

test('heat floors at zero and never goes negative', () => {
  const w = createWorld();
  run(w, 4000);
  assert.equal(w.heat, 0);
});

// --- harvest ---------------------------------------------------------------

test('standing on a node yields exactly one item per HARVEST_SECONDS', () => {
  const w = createWorld();
  const node = w.nodes[0];
  standAt(w, node.x, node.z);

  // One item's worth of time, minus a frame.
  const framesPerItem = Math.round(HARVEST_SECONDS / STEP);
  run(w, framesPerItem - 1);
  assert.equal(carryTotal(w.carry), 0);

  tickWorld(w, STEP, 0, 0);
  assert.equal(carryTotal(w.carry), 1);
});

test('a node out of HARVEST_RANGE yields nothing', () => {
  const w = createWorld();
  const node = w.nodes[0];
  standAt(w, node.x + HARVEST_RANGE + 0.5, node.z);
  run(w, 200);
  assert.equal(carryTotal(w.carry), 0);
});

test('a node just inside HARVEST_RANGE does yield', () => {
  const w = createWorld();
  const node = w.nodes[0];
  standAt(w, node.x + HARVEST_RANGE - 0.01, node.z);
  run(w, 200);
  assert.ok(carryTotal(w.carry) > 0);
});

test('a node depletes after NODE_AMOUNT items and reports its index once', () => {
  const w = createWorld();
  const node = w.nodes[0];
  standAt(w, node.x, node.z);

  // Stop short of NODE_REGROW_SECONDS. Past it the forest hands the node
  // another log and the player takes that too, which is a SECOND depletion and
  // a legitimately second event — see the test below.
  const ticks = Math.floor((NODE_REGROW_SECONDS - 1) / STEP);

  let depletedEvents = 0;
  for (let i = 0; i < ticks; i++) {
    const ev = tickWorld(w, STEP, 0, 0);
    if (ev.depletedNode !== -1) {
      assert.equal(ev.depletedNode, 0);
      depletedEvents++;
    }
  }
  assert.equal(node.depleted, true);
  assert.equal(node.remaining <= 0, true);
  assert.equal(depletedEvents, 1, 'depletion should be announced exactly once');
  assert.equal(carryTotal(w.carry), Math.min(NODE_AMOUNT, CARRY_CAP));
});

test('a node that regrows and is stripped again announces BOTH times', () => {
  // The renderer hides a tree on depletedNode and shows it again on
  // revivedNodes. If either event fired only once per run, a regrown tree would
  // be permanently invisible or a stripped one permanently visible, and the
  // silhouette would stop meaning anything.
  const w = createWorld();
  const node = w.nodes[0];
  standAt(w, node.x, node.z);

  let depleted = 0;
  let revived = 0;
  for (let i = 0; i < Math.floor((NODE_REGROW_SECONDS * 2 + 4) / STEP); i++) {
    w.carry.items.length = 0;                 // an infinitely deep pocket: test the node, not the carry
    const ev = tickWorld(w, STEP, 0, 0);
    if (ev.depletedNode === 0) depleted++;
    if (ev.revivedNodes.includes(0)) revived++;
  }
  assert.ok(depleted >= 2, `the node was only reported depleted ${depleted} time(s)`);
  assert.ok(revived >= 1, 'a regrown node was never reported back to the renderer');
  assert.ok(Math.abs(depleted - revived) <= 1,
    `depletions (${depleted}) and revivals (${revived}) must stay paired`);
});

test('one node holds less than a full carry, so hauling needs more than one tree', () => {
  // Guards the tuning relationship, not the code: if NODE_AMOUNT ever exceeds
  // CARRY_CAP, a single tree becomes a full run and the map stops mattering.
  assert.ok(NODE_AMOUNT < CARRY_CAP);
});

test('harvesting stops at CARRY_CAP', () => {
  const w = createWorld();
  w.nodes[0].remaining = 100;                  // an inexhaustible node, so the cap is what stops us
  standAt(w, w.nodes[0].x, w.nodes[0].z);
  runFed(w, 2000);
  assert.ok(carryIsFull(w.carry));
  assert.equal(carryTotal(w.carry), CARRY_CAP);
});

test('only one node is harvested per tick even when two are in range', () => {
  const w = createWorld();
  // Force two nodes to occupy the same spot, then stand on it.
  w.nodes[1].x = w.nodes[0].x;
  w.nodes[1].z = w.nodes[0].z;
  standAt(w, w.nodes[0].x, w.nodes[0].z);

  const framesPerItem = Math.round(HARVEST_SECONDS / STEP);
  run(w, framesPerItem);
  assert.equal(carryTotal(w.carry), 1, 'two overlapping nodes must not double-yield');
});

test('stackChanged fires on the frame an item is gained and not otherwise', () => {
  const w = createWorld();
  standAt(w, w.nodes[0].x, w.nodes[0].z);

  const framesPerItem = Math.round(HARVEST_SECONDS / STEP);
  let changes = 0;
  for (let i = 0; i < framesPerItem; i++) {
    if (tickWorld(w, STEP, 0, 0).stackChanged) changes++;
  }
  assert.equal(changes, 1);
});

// --- deposit ---------------------------------------------------------------

test('walking onto the pad with wood converts it to heat', () => {
  const w = createWorld();
  standAt(w, w.nodes[0].x, w.nodes[0].z);
  run(w, Math.round(HARVEST_SECONDS / STEP) * 3);        // gather 3 wood
  const gathered = carryTotal(w.carry);
  assert.equal(gathered, 3);

  standAt(w, w.pad.x, w.pad.z);
  const heatBefore = w.heat;
  run(w, 60);

  assert.equal(carryTotal(w.carry), 0, 'the stack should have fully drained');
  assert.equal(w.store.wood, 3);
  assert.ok(w.heat > heatBefore, 'depositing wood must raise heat');
});

test('deposit drains at most one item per tick', () => {
  const w = createWorld();
  w.nodes[0].remaining = 100;
  standAt(w, w.nodes[0].x, w.nodes[0].z);
  runFed(w, 2000);                                       // fill to CARRY_CAP
  assert.equal(carryTotal(w.carry), CARRY_CAP);

  standAt(w, w.pad.x, w.pad.z);
  const ev = tickWorld(w, STEP, 0, 0);
  assert.ok(ev.deposited === null || ev.deposited.length <= 1,
    'a clamped step must never dump more than one item in a frame');
  assert.ok(MAX_FRAME_DT < DEPOSIT_INTERVAL * 2);
});

test('stepping off the pad mid-drain stops the deposit', () => {
  const w = createWorld();
  w.nodes[0].remaining = 100;
  standAt(w, w.nodes[0].x, w.nodes[0].z);
  runFed(w, 2000);

  standAt(w, w.pad.x, w.pad.z);
  runFed(w, 3);
  const partway = carryTotal(w.carry);
  assert.ok(partway < CARRY_CAP, 'expected some items to have drained');

  standAt(w, 0, 20);                                     // off the pad, away from every node
  runFed(w, 60);
  assert.equal(carryTotal(w.carry), partway, 'carry must freeze once off the pad');
});

test('heat gained by depositing is capped at HEAT_MAX', () => {
  const w = createWorld();
  w.heat = HEAT_MAX;
  w.carry.items.push('wood', 'wood', 'wood');
  standAt(w, w.pad.x, w.pad.z);
  run(w, 60);
  assert.ok(w.heat <= HEAT_MAX);
});

test('non-wood resources bank into the store without touching heat', () => {
  const w = createWorld();
  w.carry.items.push('stone', 'stone');
  standAt(w, w.pad.x, w.pad.z);
  const heatBefore = w.heat;
  run(w, 60);
  assert.equal(w.store.stone, 2);
  assert.equal(w.store.wood, 0);
  assert.ok(w.heat < heatBefore, 'heat should only have drained, never risen');
});

test('deposit yields exactly HEAT_PER_WOOD per log', () => {
  const w = createWorld();
  w.heat = 10;
  w.carry.items.push('wood');
  standAt(w, w.pad.x, w.pad.z);

  let drained = 0;
  let ticks = 0;
  while (carryTotal(w.carry) > 0 && ticks < 100) {
    tickWorld(w, STEP, 0, 0);
    drained += HEAT_DRAIN_DAY * STEP;
    ticks++;
  }
  assert.ok(Math.abs(w.heat - (10 - drained + HEAT_PER_WOOD)) < 1e-9);
});

// --- system ordering -------------------------------------------------------

test('heat drain is applied before deposit fuel, so one settled value is published', () => {
  // If deposit ran before drain, the frame's fuel gain would be shaved by that
  // same frame's drain. Pin the exact arithmetic so a reorder fails loudly.
  const w = createWorld();
  w.heat = 50;
  w.carry.items.push('wood');
  standAt(w, w.pad.x, w.pad.z);

  let ticks = 0;
  while (carryTotal(w.carry) > 0) { tickWorld(w, STEP, 0, 0); ticks++; }
  const expected = 50 - HEAT_DRAIN_DAY * STEP * ticks + HEAT_PER_WOOD;
  assert.ok(Math.abs(w.heat - expected) < 1e-9);
});

test('a full gather-haul-deposit round trip completes under joystick control', () => {
  const w = createWorld();
  const node = w.nodes[0];

  // Walk toward the node until in range, then let auto-harvest strip it bare.
  for (let i = 0; i < 600 && !node.depleted; i++) {
    const dx = node.x - w.player.x;
    const dz = node.z - w.player.z;
    const d = Math.hypot(dx, dz);
    const inRange = d <= HARVEST_RANGE - 0.1;
    tickWorld(w, STEP, inRange ? 0 : dx / d, inRange ? 0 : dz / d);
  }
  assert.equal(carryTotal(w.carry), NODE_AMOUNT, 'never emptied the tree into the stack');

  // Haul back to the furnace and unload.
  for (let i = 0; i < 900 && carryTotal(w.carry) > 0; i++) {
    const dx = w.pad.x - w.player.x;
    const dz = w.pad.z - w.player.z;
    const d = Math.hypot(dx, dz) || 1;
    const arrived = d < 0.2;
    tickWorld(w, STEP, arrived ? 0 : dx / d, arrived ? 0 : dz / d);
  }
  assert.equal(carryTotal(w.carry), 0, 'never unloaded at the furnace');
  assert.equal(w.store.wood, NODE_AMOUNT);
  assert.ok(w.heat > 0, 'the furnace should still be burning after a successful run');
});
