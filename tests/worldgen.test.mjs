// Procedural world generation.
//
// The whole point of a generator is that nobody will ever look at most of its
// output, so "it looked right on the default seed" is not evidence of anything.
// These tests fuzz hundreds of seeds and assert the properties that make a
// world PLAYABLE — a run that generates a walled-off coal seam, a gate you
// cannot walk to, or two trees inside each other is not a variation, it is a
// broken run that only some players get.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generateWorld, pushOutOfBoulders } from '../src/core/worldgen.js';
import { createGates } from '../src/core/gates.js';
import { createWorld, tickWorld } from '../src/core/world.js';
import {
  NODE_COUNT, NODE_RING_BASE, NODE_RING_STEP, NODE_RADIUS_JITTER, NODE_AMOUNT,
  COAL_SEAMS, COAL_AMOUNT, COAL_INNER, COAL_OUTER, HEAT_PER_COAL, HEAT_PER_WOOD,
  BOULDER_COUNT, BOULDER_RADIUS, BOULDER_INNER, BOULDER_OUTER,
  BOULDER_GATE_CLEARANCE, BOULDER_NODE_CLEARANCE,
  WORLD_RADIUS, WORLD_EDGE_MARGIN, RING_MAX, PAD_RADIUS, HARVEST_RANGE,
  MAX_FRAME_DT, HEAT_MAX,
} from '../src/core/constants.js';

const GATES = createGates();
const SEEDS = Array.from({ length: 240 }, (_, i) => 1000 + i * 7919);   // a spread, not 0..239
const STEP = MAX_FRAME_DT;

const radius = (p) => Math.hypot(p.x, p.z);
const between = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Runs `check` against every seed, naming the seed that broke. */
function everySeed(check) {
  for (const seed of SEEDS) {
    const world = generateWorld(seed, GATES);
    try {
      check(world, seed);
    } catch (e) {
      e.message = `seed ${seed}: ${e.message}`;
      throw e;
    }
  }
}

test('every seed produces the same census', () => {
  everySeed((w) => {
    assert.equal(w.nodes.filter((n) => n.kind === 'wood').length, NODE_COUNT);
    assert.equal(w.nodes.filter((n) => n.kind === 'coal').length, COAL_SEAMS);
    assert.equal(w.boulders.length, BOULDER_COUNT,
      'the rejection sampler gave up before filling the world');
  });
});

test('different seeds really do produce different worlds', () => {
  // Without this the generator could be seeded and still deterministic in the
  // wrong way — every run identical, which is the bug it exists to fix.
  const shapes = new Set(SEEDS.slice(0, 50).map(
    (s) => JSON.stringify(generateWorld(s, GATES).nodes.map((n) => [n.x.toFixed(2), n.z.toFixed(2)]))
  ));
  assert.equal(shapes.size, 50, 'two seeds generated the identical layout');
});

test('the same seed always produces the same world', () => {
  // A run has to be reproducible: a screenshot, a bug report and a test all
  // depend on being able to get the same forest back.
  for (const seed of SEEDS.slice(0, 20)) {
    assert.deepEqual(generateWorld(seed, GATES), generateWorld(seed, GATES));
  }
});

test('trees never leave the band that teaches the thaw rule', () => {
  // The bands are fixed on purpose. A full furnace thaws exactly to the outer
  // band, and a run opens with that band out of reach — both relationships die
  // if a tree can wander.
  everySeed((w) => {
    for (const n of w.nodes.filter((x) => x.kind === 'wood')) {
      const r = radius(n);
      assert.ok(r >= NODE_RING_BASE - NODE_RADIUS_JITTER - 1e-9,
        `a tree at radius ${r.toFixed(1)} fell inside the innermost band`);
      assert.ok(r <= NODE_RING_BASE + 2 * NODE_RING_STEP + NODE_RADIUS_JITTER + 1e-9,
        `a tree at radius ${r.toFixed(1)} escaped the outermost band`);
    }
  });
});

test('every coal seam lies on frozen ground, which is the whole point of coal', () => {
  // Coal is the reward for entering the cold. A seam inside the thawed ring
  // would be strictly better wood, and the risk it exists to create vanishes.
  everySeed((w) => {
    for (const n of w.nodes.filter((x) => x.kind === 'coal')) {
      assert.ok(radius(n) > RING_MAX,
        `a coal seam at radius ${radius(n).toFixed(1)} sits on ground the furnace can thaw`);
      assert.ok(radius(n) >= COAL_INNER - 1e-9 && radius(n) <= COAL_OUTER + 1e-9);
    }
  });
});

test('nothing generates outside the world or on the furnace', () => {
  everySeed((w) => {
    for (const thing of [...w.nodes, ...w.boulders]) {
      assert.ok(radius(thing) < WORLD_RADIUS - WORLD_EDGE_MARGIN,
        'something generated where the player cannot reach it');
      assert.ok(radius(thing) > PAD_RADIUS + 2, 'something generated on the deposit pad');
    }
  });
});

test('no two harvestables sit inside each other', () => {
  // The harvest loop takes the FIRST node in range and breaks. Two overlapping
  // nodes would make which one you are cutting depend on array order, which the
  // player cannot see and cannot predict.
  everySeed((w) => {
    for (let i = 0; i < w.nodes.length; i++) {
      for (let j = i + 1; j < w.nodes.length; j++) {
        assert.ok(between(w.nodes[i], w.nodes[j]) > HARVEST_RANGE,
          `two harvestables are ${between(w.nodes[i], w.nodes[j]).toFixed(1)} apart`);
      }
    }
  });
});

test('a boulder never walls off a harvestable', () => {
  // The failure that would only bite some players: a seam ringed by rock, its
  // fuel simply absent from that run, with nothing on screen explaining why.
  everySeed((w) => {
    for (const b of w.boulders) {
      for (const n of w.nodes) {
        assert.ok(between(b, n) >= BOULDER_NODE_CLEARANCE + BOULDER_RADIUS - 1e-9,
          'a boulder is crowding a harvestable');
      }
    }
  });
});

test('a boulder never blocks an approach lane', () => {
  // A gate carries the dusk telegraph and the squad has to be able to stand at
  // it. Rock in the mouth of a lane breaks both.
  everySeed((w) => {
    for (const b of w.boulders) {
      for (const g of GATES) {
        assert.ok(between(b, g) >= BOULDER_GATE_CLEARANCE + BOULDER_RADIUS - 1e-9,
          'a boulder is standing in a gate');
      }
    }
  });
});

test('two boulders can never form a gap the player cannot fit through', () => {
  everySeed((w) => {
    for (let i = 0; i < w.boulders.length; i++) {
      for (let j = i + 1; j < w.boulders.length; j++) {
        assert.ok(between(w.boulders[i], w.boulders[j]) >= BOULDER_RADIUS * 4 - 1e-9,
          'two boulders are close enough to pinch the player out');
      }
    }
  });
});

test('boulders stand only on frozen ground, never in the camp', () => {
  // Same rule as the scenery, for the same reason: at night a static shape
  // inside the thawed ring reads exactly like an approaching wolf.
  everySeed((w) => {
    for (const b of w.boulders) {
      assert.ok(radius(b) > RING_MAX, 'a boulder stands on ground the furnace can thaw');
    }
  });
});

test('being pushed out of a boulder can never push you out of the world', () => {
  // The ejection runs AFTER the world-edge clamp, so a boulder near the rim
  // could otherwise shove the player past it and strand them outside.
  const worst = BOULDER_OUTER + BOULDER_RADIUS + 0.45;
  assert.ok(worst < WORLD_RADIUS - WORLD_EDGE_MARGIN,
    `a boulder at the outer limit can eject the player to ${worst.toFixed(1)}, `
    + `past the world edge at ${WORLD_RADIUS - WORLD_EDGE_MARGIN}`);
});

test('ejection always leaves the point outside every boulder', () => {
  everySeed((w, seed) => {
    if (!w.boulders.length) return;
    const rng = (n) => ((seed * 9301 + n * 49297) % 233280) / 233280;

    for (let i = 0; i < 40; i++) {
      const b = w.boulders[i % w.boulders.length];
      // Start inside the rock, at a variety of offsets including dead centre.
      const point = { x: b.x + (rng(i) - 0.5) * b.radius, z: b.z + (rng(i + 7) - 0.5) * b.radius };
      pushOutOfBoulders(point, w.boulders);

      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.z), 'ejection produced NaN');
      for (const other of w.boulders) {
        assert.ok(between(point, other) >= other.radius + 0.45 - 1e-6,
          'the point is still inside a boulder after ejection');
      }
    }
  });
});

test('a point at the exact centre of a boulder is ejected, not divided by zero', () => {
  const boulders = [{ x: 10, z: 10, radius: BOULDER_RADIUS }];
  const point = { x: 10, z: 10 };
  assert.equal(pushOutOfBoulders(point, boulders), true);
  assert.ok(Number.isFinite(point.x) && Number.isFinite(point.z));
  assert.ok(between(point, boulders[0]) >= BOULDER_RADIUS);
});

test('a point in open ground is left exactly where it was', () => {
  const boulders = [{ x: 10, z: 10, radius: BOULDER_RADIUS }];
  const point = { x: -20, z: 3 };
  assert.equal(pushOutOfBoulders(point, boulders), false);
  assert.deepEqual(point, { x: -20, z: 3 });
});

test('a boulder actually stops the player walking through it', () => {
  const w = createWorld(() => 0.5);
  const b = w.boulders[0];
  // Line the player up outside the rock, aimed straight at its centre.
  const d = Math.hypot(b.x, b.z);
  w.player.x = b.x * ((d + 4) / d);
  w.player.z = b.z * ((d + 4) / d);
  const toward = { x: (b.x - w.player.x) / 4, z: (b.z - w.player.z) / 4 };

  for (let i = 0; i < 200; i++) {
    w.heat = HEAT_MAX;
    tickWorld(w, STEP, toward.x, toward.z);
  }
  assert.ok(Math.hypot(w.player.x - b.x, w.player.z - b.z) >= b.radius,
    'the player walked into the middle of a boulder');
});

test('coal is worth the walk out onto slow ground', () => {
  // If a lump were not worth appreciably more than a log, the risk the frozen
  // waste imposes would buy the player nothing and nobody would ever go.
  assert.ok(HEAT_PER_COAL > HEAT_PER_WOOD * 2,
    `coal at ${HEAT_PER_COAL} is barely better than wood at ${HEAT_PER_WOOD}`);
  // But a seam holds less than a tree, so coal is a detour and not a replacement
  // for the forest.
  assert.ok(COAL_AMOUNT < NODE_AMOUNT);
  assert.ok(COAL_SEAMS * COAL_AMOUNT * HEAT_PER_COAL < NODE_COUNT * NODE_AMOUNT * HEAT_PER_WOOD,
    'the coal in the ground outweighs the whole forest');
});

test('a generated world still starts a real run', () => {
  // The integration check: whatever the seed, createWorld must hand back a
  // world tickWorld can actually run.
  for (const seed of SEEDS.slice(0, 25)) {
    const w = createWorld(() => 0.5, seed);
    for (let i = 0; i < 100; i++) tickWorld(w, STEP, 1, 0.4);
    assert.equal(w.over, null, `seed ${seed} ended the run in 5 seconds`);
    assert.ok(Number.isFinite(w.player.x) && Number.isFinite(w.player.z));
    assert.ok(Math.hypot(w.player.x, w.player.z) <= WORLD_RADIUS);
  }
});
