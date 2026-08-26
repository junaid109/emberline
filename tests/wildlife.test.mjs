// Hares, and the trade they represent.
//
// A hare is not scenery. Meat is the only thing that makes a night cheaper, so
// the daylight spent chasing one is daylight not spent hauling fuel — which
// means the single most important property here is that a chase can actually be
// WON. An uncatchable hare is not a hard chase, it is a lie about a choice.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHare, createHares, tickHare, tickHares } from '../src/core/wildlife.js';
import { createWorld, tickWorld } from '../src/core/world.js';
import { carryCountOf } from '../src/core/carry.js';
import {
  MAX_FRAME_DT, HARE_COUNT, HARE_INNER, HARE_OUTER, HARE_FLEE_RADIUS,
  HARE_CATCH_RADIUS, HARE_RESPAWN_SECONDS, HARE_DART_SPEED, HARE_WANDER_SPEED,
  PLAYER_SPEED, FROZEN_SPEED_MULT, RING_MAX, WORLD_RADIUS, HEAT_MAX,
} from '../src/core/constants.js';

const STEP = MAX_FRAME_DT;

/** A deterministic roll that still varies, so wandering is reproducible. */
function seededRoll(start = 0.17) {
  let v = start;
  return () => { v = (v * 9301 + 0.49297) % 1; return v; };
}

const far = { x: 200, z: 200 };            // a player nowhere near anything

test('hares start out in the wilds, never in the camp', () => {
  const hares = createHares(seededRoll());
  assert.equal(hares.length, HARE_COUNT);
  for (const h of hares) {
    const r = Math.hypot(h.x, h.z);
    assert.ok(r >= HARE_INNER && r <= HARE_OUTER, `a hare started at radius ${r.toFixed(1)}`);
    assert.ok(r > RING_MAX, 'a hare started on ground the furnace can thaw');
  }
});

test('an undisturbed hare ambles, and stays in the wilds', () => {
  const roll = seededRoll();
  const hare = createHare(roll);
  for (let t = 0; t < 600; t++) {
    tickHare(hare, STEP, far, roll);
    const r = Math.hypot(hare.x, hare.z);
    assert.ok(r >= HARE_INNER - 1e-6 && r <= HARE_OUTER + 1e-6,
      `a hare wandered to radius ${r.toFixed(1)}`);
    assert.ok(Number.isFinite(hare.x) && Number.isFinite(hare.z));
  }
});

test('a hare bolts when the player comes close', () => {
  const roll = seededRoll();
  const hare = createHare(roll);
  hare.mode = 'wander';

  // Stand just inside its notice radius, on the inward side.
  const r = Math.hypot(hare.x, hare.z);
  const player = { x: hare.x * (1 - HARE_FLEE_RADIUS * 0.5 / r), z: hare.z * (1 - HARE_FLEE_RADIUS * 0.5 / r) };

  const before = Math.hypot(hare.x - player.x, hare.z - player.z);
  const modes = new Set();
  for (let t = 0; t < 40; t++) {
    tickHare(hare, STEP, player, roll);
    modes.add(hare.mode);
  }
  assert.ok(modes.has('dart'), 'the hare never bolted');
  assert.ok(Math.hypot(hare.x - player.x, hare.z - player.z) > before,
    'the hare did not put distance between itself and the player');
});

test('a spooked hare alternates darting with freezing', () => {
  // The still beat is the player window, and it is the entire chase. A hare
  // that only ever darted would be a speed check, not a decision.
  const roll = seededRoll();
  const hare = createHare(roll);
  const player = { x: hare.x - 3, z: hare.z };

  const seen = new Set();
  for (let t = 0; t < 200; t++) {
    if (tickHare(hare, STEP, player, roll) === 'caught') break;
    seen.add(hare.mode);
  }
  assert.ok(seen.has('dart') && seen.has('still'),
    `the hare only ever showed ${[...seen].join(', ')}`);
});

test('a chase can actually be won, even on frozen ground', () => {
  // The load-bearing test. Hares live in the wilds, which the player crosses at
  // FROZEN_SPEED_MULT, so the chase must still close — a hare nobody can catch
  // makes meat unreachable and the whole trade imaginary.
  const roll = seededRoll();
  const hare = createHare(roll);
  const player = { x: hare.x * 0.86, z: hare.z * 0.86 };
  const speed = PLAYER_SPEED * FROZEN_SPEED_MULT;

  let caught = false;
  for (let t = 0; t < 30 / STEP && !caught; t++) {
    const dx = hare.x - player.x;
    const dz = hare.z - player.z;
    const d = Math.hypot(dx, dz) || 1;
    player.x += (dx / d) * speed * STEP;
    player.z += (dz / d) * speed * STEP;
    caught = tickHare(hare, STEP, player, roll) === 'caught';
  }
  assert.ok(caught, 'a player walking straight at a hare for 30s never caught it');
});

test('but the chase is not free — a hare outruns a standing start', () => {
  // If catching one were instant it would not be a trade, and meat would be a
  // pickup rather than a decision about where the day goes.
  assert.ok(HARE_DART_SPEED > PLAYER_SPEED * FROZEN_SPEED_MULT,
    'a darting hare is slower than the player, so there is no chase at all');
  assert.ok(HARE_WANDER_SPEED < PLAYER_SPEED * FROZEN_SPEED_MULT,
    'even an unbothered hare cannot be walked down');
});

test('a caught hare leaves the field and comes back later', () => {
  const roll = seededRoll();
  const hare = createHare(roll);
  const player = { x: hare.x, z: hare.z };

  assert.equal(tickHare(hare, STEP, player, roll), 'caught');
  assert.equal(hare.mode, 'gone');

  // It must not be catchable again while it is gone.
  for (let t = 0; t < (HARE_RESPAWN_SECONDS - 1) / STEP; t++) {
    assert.equal(tickHare(hare, STEP, player, roll), null, 'a gone hare was caught again');
  }
  for (let t = 0; t < 2 / STEP; t++) tickHare(hare, STEP, far, roll);
  assert.notEqual(hare.mode, 'gone', 'the hare never came back');
  assert.ok(Math.hypot(hare.x, hare.z) >= HARE_INNER - 1e-6);
});

test('tickHares reports every catch in a tick', () => {
  const roll = seededRoll();
  const hares = createHares(roll, 3);
  const player = { x: hares[0].x, z: hares[0].z };
  hares[1].x = player.x + HARE_CATCH_RADIUS * 0.5;
  hares[1].z = player.z;

  assert.equal(tickHares(hares, STEP, player, roll), 2);
});

test('catching a hare puts meat in the carry', () => {
  // A varying roll, not a constant one: createWorld feeds its roll straight to
  // hare placement, so a fixed 0.5 stacks all four on the same point and the
  // player would take the lot in one tick.
  const w = createWorld(seededRoll());
  const hare = w.hares[0];
  w.player.x = hare.x;
  w.player.z = hare.z;
  w.heat = HEAT_MAX;

  const ev = tickWorld(w, STEP, 0, 0);
  assert.equal(ev.hareCaught, 1);
  assert.equal(carryCountOf(w.carry, 'meat'), 1);
});

test('hares do not all spawn on the same spot', () => {
  // What the test above tripped over. In play the roll is Math.random, but a
  // generator that collapses under a degenerate roll is one worth knowing about.
  const hares = createHares(seededRoll(), 4);
  const spots = new Set(hares.map((h) => `${h.x.toFixed(2)},${h.z.toFixed(2)}`));
  assert.equal(spots.size, hares.length, 'two hares spawned on the identical point');
});

test('hares never escape the world', () => {
  const roll = seededRoll(0.61);
  const hares = createHares(roll, 6);
  const player = { x: 0, z: 0 };
  for (let t = 0; t < 4000; t++) {
    tickHares(hares, STEP, player, roll);
    for (const h of hares) {
      assert.ok(Math.hypot(h.x, h.z) <= WORLD_RADIUS, 'a hare left the world');
    }
  }
});
