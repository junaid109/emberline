// Placement rules for the decorative landscape.
//
// These are gameplay tests wearing scenery clothes. None of this scenery is
// harvestable, so where it may stand decides whether the player can trust what
// a silhouette means.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scatterScenery, groupByKind, makeRng, SCENERY_KINDS } from '../src/core/scatter.js';
import { createGates } from '../src/core/gates.js';
import { createWorld } from '../src/core/world.js';
import {
  WORLD_RADIUS, SCENERY_CAMP_INNER, SCENERY_GATE_CLEARANCE, SCENERY_NODE_CLEARANCE,
  TREELINE_INNER, FARWOOD_OUTER, GROUND_VISUAL_RADIUS, PAD_RADIUS, RING_MAX,
} from '../src/core/constants.js';

const gates = createGates();
const nodes = createWorld(() => 0).nodes;
const props = scatterScenery(gates, nodes);

const TREE_KINDS = new Set(['pine', 'snowpine', 'snag']);

test('the scatter produces a substantial landscape', () => {
  assert.ok(props.length > 400, `only ${props.length} props`);
});

test('every prop is a known kind', () => {
  for (const p of props) assert.ok(SCENERY_KINDS.includes(p.kind), `unknown kind ${p.kind}`);
});

test('the landscape is identical on every run and every device', () => {
  // Seeded rather than random: a judge and the entrant must see the same world,
  // and a screenshot has to stay reproducible.
  const a = scatterScenery(gates, nodes);
  const b = scatterScenery(gates, nodes);
  assert.deepEqual(a, b);
});

test('a different seed produces a different landscape', () => {
  const other = scatterScenery(gates, nodes, 999);
  assert.notDeepEqual(other, props);
  assert.ok(other.length > 400);
});

test('makeRng is deterministic and stays in [0, 1)', () => {
  const a = makeRng(42);
  const b = makeRng(42);
  for (let i = 0; i < 500; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});

test('no tree-shaped scenery stands where the player can walk', () => {
  // The load-bearing rule. A decorative conifer inside the playable circle
  // would teach the player that walking into a tree sometimes does nothing,
  // and the harvest loop would start feeling broken.
  for (const p of props) {
    if (!TREE_KINDS.has(p.kind)) continue;
    assert.ok(Math.hypot(p.x, p.z) > WORLD_RADIUS,
      `a ${p.kind} stands at radius ${Math.hypot(p.x, p.z).toFixed(1)}, inside the playable circle`);
  }
});

test('nothing ever stands on ground the furnace has thawed', () => {
  // The thawed circle is the entire playable area, and at night a static rock
  // inside the ring reads exactly like an approaching wolf.
  assert.ok(SCENERY_CAMP_INNER > RING_MAX, 'scenery could stand on fully thawed ground');
  assert.ok(SCENERY_CAMP_INNER > PAD_RADIUS, 'the clearance must at least cover the pad');
  for (const p of props) {
    assert.ok(Math.hypot(p.x, p.z) >= SCENERY_CAMP_INNER,
      `a ${p.kind} stands at radius ${Math.hypot(p.x, p.z).toFixed(1)}, inside the thawed ground`);
  }
});

test('nothing crowds a harvestable node', () => {
  for (const p of props) {
    for (const n of nodes) {
      assert.ok(Math.hypot(p.x - n.x, p.z - n.z) >= SCENERY_NODE_CLEARANCE - 1e-9,
        'scenery is crowding a resource node');
    }
  }
});

test('gates stay clear, so the dusk telegraph is never occluded', () => {
  for (const p of props) {
    for (const g of gates) {
      assert.ok(Math.hypot(p.x - g.x, p.z - g.z) >= SCENERY_GATE_CLEARANCE - 1e-9,
        'scenery is blocking a gate');
    }
  }
});

test('the treeline sits outside the playable circle', () => {
  assert.ok(TREELINE_INNER > WORLD_RADIUS,
    'the forest must start beyond where the player can walk, or the clearing has no edge');
});

test('nothing is scattered past the drawn ground', () => {
  for (const p of props) {
    assert.ok(Math.hypot(p.x, p.z) <= FARWOOD_OUTER + 1e-6, 'a prop is beyond its band');
  }
  assert.ok(FARWOOD_OUTER < GROUND_VISUAL_RADIUS, 'a tree must never float past the edge of the snow');
});

test('the frozen band around the camp holds only low scenery, and is populated', () => {
  const inCamp = props.filter((p) => Math.hypot(p.x, p.z) <= WORLD_RADIUS);
  assert.ok(inCamp.length > 12, `the camp fringe looks bare: ${inCamp.length} props`);
  for (const p of inCamp) assert.ok(!TREE_KINDS.has(p.kind));
});

test('the treeline is dense enough to read as a forest', () => {
  const inTreeline = props.filter((p) => {
    const r = Math.hypot(p.x, p.z);
    return r > TREELINE_INNER && r < 96;
  });
  assert.ok(inTreeline.length > 150, `only ${inTreeline.length} props in the treeline`);
});

test('props vary in size and facing rather than being stamped copies', () => {
  const scales = new Set(props.map((p) => p.scale.toFixed(4)));
  const rots = new Set(props.map((p) => p.rotY.toFixed(4)));
  assert.ok(scales.size > props.length * 0.8, 'too many props share an identical scale');
  assert.ok(rots.size > props.length * 0.8, 'too many props share an identical rotation');
  for (const p of props) {
    assert.ok(p.scale > 0, 'a prop has a non-positive scale');
    assert.ok(p.rotY >= 0 && p.rotY <= Math.PI * 2);
  }
});

test('both snowy and bare conifers appear, so the forest is not one asset', () => {
  const groups = groupByKind(props);
  assert.ok(groups.get('pine').length > 40);
  assert.ok(groups.get('snowpine').length > 40);
});

test('groupByKind partitions the props without losing or duplicating any', () => {
  const groups = groupByKind(props);
  let total = 0;
  for (const [kind, list] of groups) {
    total += list.length;
    for (const p of list) assert.equal(p.kind, kind);
  }
  assert.equal(total, props.length);
});

test('the heat ring at full heat never reaches the treeline', () => {
  assert.ok(RING_MAX < TREELINE_INNER, 'the thawed ground would swallow the forest');
});

test('an over-constrained band gives up rather than looping forever', () => {
  // Rejection sampling with impossible clearance must terminate. A sparse band
  // is a far better failure than a hung frame.
  const impossible = Array.from({ length: 400 }, (_, i) => ({
    x: Math.cos(i) * 60, z: Math.sin(i) * 60,
  }));
  const result = scatterScenery(impossible, impossible);
  assert.ok(Array.isArray(result));
});
