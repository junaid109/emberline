// The signature mechanic: the furnace IS the map.
//
// ringRadius() carries the comment "the whole game is this function", and for
// several milestones it was called from exactly one line — a renderer setting a
// ground texture parameter. The thawed circle was drawn and the simulation
// ignored it: the player crossed the frozen waste at full speed and the fire's
// only job was not hitting zero. The idea the whole entry rests on was a
// picture of itself.
//
// These tests exist so it can never quietly become decoration again.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createWorld, tickWorld } from '../src/core/world.js';
import { ringRadius } from '../src/core/heat.js';
import {
  MAX_FRAME_DT, PLAYER_SPEED, FROZEN_SPEED_MULT, HEAT_MAX, HEAT_START,
  RING_MIN, RING_MAX, NODE_RING_BASE, NODE_RING_STEP, WORLD_RADIUS,
} from '../src/core/constants.js';

const STEP = MAX_FRAME_DT;

/** Places the player at a given radius along +x and returns the world. */
function playerAt(world, radius) {
  world.player.x = radius;
  world.player.z = 0;
  return world;
}

/** Distance covered walking straight out along +x for one tick. */
function stepDistance(world) {
  const before = world.player.x;
  tickWorld(world, STEP, 1, 0);
  return world.player.x - before;
}

test('thawed ground is walked at full speed', () => {
  const w = createWorld(() => 0.5);
  w.heat = HEAT_MAX;
  playerAt(w, ringRadius(HEAT_MAX) - 2);

  assert.ok(Math.abs(stepDistance(w) - PLAYER_SPEED * STEP) < 1e-9);
});

test('frozen ground is deep snow, and costs real time to cross', () => {
  const w = createWorld(() => 0.5);
  w.heat = HEAT_MAX;
  playerAt(w, ringRadius(HEAT_MAX) + 2);

  const moved = stepDistance(w);
  assert.ok(Math.abs(moved - PLAYER_SPEED * FROZEN_SPEED_MULT * STEP) < 1e-9);
  assert.ok(moved > 0, 'frozen ground must be crossable, not a wall');
});

test('the two grounds are MEASURABLY different, whatever the constant says', () => {
  // Deliberately does not compute its expectation from FROZEN_SPEED_MULT.
  //
  // The test above does, which means it happily passes if the multiplier is set
  // to 1.0 and the mechanic is switched off: expected and actual move together.
  // This one measures both grounds and compares them, so it fails if the ring
  // ever stops mattering — by a retuned constant, or by the wiring in
  // movePlayer being lost the way ringRadius was lost in the renderer.
  const warm = createWorld(() => 0.5);
  warm.heat = HEAT_MAX;
  playerAt(warm, ringRadius(HEAT_MAX) - 4);
  const onThawed = stepDistance(warm);

  const cold = createWorld(() => 0.5);
  cold.heat = HEAT_MAX;
  playerAt(cold, ringRadius(HEAT_MAX) + 4);
  const onFrozen = stepDistance(cold);

  assert.ok(onFrozen < onThawed * 0.7,
    `frozen ground (${onFrozen.toFixed(3)}/tick) is barely slower than thawed `
    + `(${onThawed.toFixed(3)}/tick); the furnace is not the map`);
  assert.ok(onFrozen > onThawed * 0.25,
    'frozen ground is slow enough to read as a wall rather than as a cost');
});

test('the player can always crawl home, however low the fire has burned', () => {
  // The reason the frozen waste slows rather than blocks. A hard boundary would
  // strand a player whose fire burned low OUTSIDE it, with the very nodes they
  // need to refuel it on the far side — a death spiral with no counterplay.
  const w = createWorld(() => 0.5);
  w.heat = 0.5;                                   // nearly out: the ring is at its minimum
  playerAt(w, WORLD_RADIUS - 2);                  // and the player is as far away as possible

  const start = w.player.x;
  for (let i = 0; i < 400; i++) {
    w.heat = 0.5;                                 // held on the brink: test the walk, not the loss
    tickWorld(w, STEP, -1, 0);
  }
  assert.ok(w.player.x < start - 10, 'a cold player could not walk home');
});

test('stoking the fire visibly widens the ground you can move on', () => {
  // The loop the whole game is: burn wood, reach further, gather more wood.
  assert.ok(ringRadius(HEAT_MAX) > ringRadius(HEAT_MAX * 0.5),
    'a hotter furnace must thaw more ground');
  assert.ok(ringRadius(HEAT_MAX) - ringRadius(0) > 10,
    `the ring only grows by ${(ringRadius(HEAT_MAX) - ringRadius(0)).toFixed(1)} units; `
    + 'the fire barely changes the map');
});

test('a full furnace thaws exactly as far as the outermost trees', () => {
  // Not a coincidence worth losing. The outer node band sits precisely at
  // RING_MAX, so "the fire is full" and "the whole forest is in reach" are the
  // same sentence — which is what makes the ring readable as a goal rather than
  // as a gauge that happens to be round.
  const outermost = NODE_RING_BASE + 2 * NODE_RING_STEP;
  assert.equal(RING_MAX, outermost);
  assert.ok(NODE_RING_BASE > RING_MIN,
    'the nearest trees sit inside the dying ring, so a cold fire has no reach to lose');
});

test('the run OPENS with the far trees out of reach, which teaches the rule', () => {
  // The tutorial nobody has to write. The furnace starts at 78, thawing out to
  // ~18.5, and the outer band of trees stands at 22. A new player walks toward
  // them, hits deep snow, and learns in one gesture that the fire is the thing
  // that widens the world — before any wolf has appeared to complicate it.
  const start = ringRadius(HEAT_START);
  const outermost = NODE_RING_BASE + 2 * NODE_RING_STEP;
  assert.ok(start < outermost,
    'the outermost trees are already reachable at the start; nothing teaches the ring');
  assert.ok(start > NODE_RING_BASE,
    'even the nearest trees start out of reach, which reads as a broken game, not a lesson');
});

test('the world reports which ground the player is standing on', () => {
  const w = createWorld(() => 0.5);
  w.heat = HEAT_MAX;

  playerAt(w, ringRadius(HEAT_MAX) - 3);
  assert.equal(tickWorld(w, STEP, 0, 0).onFrozen, false);

  playerAt(w, ringRadius(HEAT_MAX) + 3);
  assert.equal(tickWorld(w, STEP, 0, 0).onFrozen, true);
});

test('a standing player is still told the ground froze under them', () => {
  // The ring shrinks as the fire burns down, so ground can go cold beneath a
  // player who never moved. If the check only ran on movement, they would keep
  // full speed on frozen ground until they happened to touch the stick.
  const w = createWorld(() => 0.5);
  w.heat = HEAT_MAX;
  playerAt(w, RING_MAX - 0.5);
  assert.equal(tickWorld(w, STEP, 0, 0).onFrozen, false);

  w.heat = 1;                                    // the fire collapses; the ring retreats
  assert.equal(tickWorld(w, STEP, 0, 0).onFrozen, true);
});

test('crossing the frozen waste is slow enough to be a real decision', () => {
  // If the penalty were mild the player would ignore the ring and the mechanic
  // would be flavour; if it were severe they would never leave and the map
  // would shrink to one circle.
  assert.ok(FROZEN_SPEED_MULT < 0.7, 'the frozen waste is barely slower than the camp');
  assert.ok(FROZEN_SPEED_MULT > 0.25, 'the frozen waste is so slow it reads as a wall');
});
