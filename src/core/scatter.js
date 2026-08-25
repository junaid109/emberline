// src/core/scatter.js
//
// Deterministic placement of decorative scenery. Pure — no THREE, no DOM.
//
// This is core rather than render logic because WHERE scenery may stand is a
// gameplay rule, not a decoration. None of it is harvestable, so a decorative
// conifer standing where a resource tree could stand would teach the player
// that walking into trees sometimes does nothing, and the harvest loop would
// start feeling broken rather than the scenery feeling wrong.
import {
  SCENERY_SEED, CAMP_SCENERY_COUNT, TREELINE_INNER, TREELINE_OUTER, TREELINE_COUNT,
  FARWOOD_OUTER, FARWOOD_COUNT, SCENERY_GATE_CLEARANCE, SCENERY_NODE_CLEARANCE,
  SCENERY_CAMP_INNER, WORLD_RADIUS,
} from './constants.js';

export const SCENERY_KINDS = ['pine', 'snowpine', 'rock', 'shrub', 'snag', 'drift'];

/**
 * Small, fast, seeded PRNG (mulberry32).
 *
 * Seeded rather than Math.random so the landscape is identical on every run and
 * on every device. A judge and the entrant see the same world, a screenshot
 * stays reproducible, and placement can be asserted in tests.
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Picks a kind from a weighted table: [['pine', 6], ['rock', 1], ...]. */
function pickWeighted(table, roll) {
  let total = 0;
  for (const [, weight] of table) total += weight;

  let r = roll * total;
  for (const [kind, weight] of table) {
    r -= weight;
    if (r <= 0) return kind;
  }
  return table[table.length - 1][0];
}

/**
 * Uniform point in an annulus.
 *
 * The sqrt is not cosmetic: sampling radius linearly would pile scenery toward
 * the inner edge of every band, because a ring's area grows with r.
 */
function pointInAnnulus(rng, inner, outer) {
  const angle = rng() * Math.PI * 2;
  const r = Math.sqrt(inner * inner + rng() * (outer * outer - inner * inner));
  return { x: Math.cos(angle) * r, z: Math.sin(angle) * r, r };
}

/**
 * @param {{points: object[], clearance: number}[]} zones
 *
 * Clearance is per group, not one global number: a gate needs far more room
 * than a resource node, because a gate carries the dusk telegraph and a prop
 * standing in front of it hides the night's only piece of information.
 */
function farEnough(x, z, zones) {
  for (const { points, clearance } of zones) {
    const c2 = clearance * clearance;
    for (const o of points) {
      const dx = o.x - x;
      const dz = o.z - z;
      if (dx * dx + dz * dz < c2) return false;
    }
  }
  return true;
}

/**
 * Fills one biome band with props, rejecting positions that violate clearance.
 *
 * Rejection sampling is capped rather than looped until satisfied: an
 * over-constrained band would otherwise spin forever, and a slightly sparse
 * band is a far better failure than a hung frame.
 */
function fillBand(out, rng, { count, inner, outer, table, zones = [], scale }) {
  const maxAttempts = count * 12;
  let placed = 0;

  for (let i = 0; i < maxAttempts && placed < count; i++) {
    const p = pointInAnnulus(rng, inner, outer);
    if (zones.length && !farEnough(p.x, p.z, zones)) continue;

    out.push({
      kind: pickWeighted(table, rng()),
      x: p.x,
      z: p.z,
      // Scale and rotation are per-prop so a few shared geometries do not read
      // as a copy-pasted field of identical objects.
      scale: scale[0] + rng() * (scale[1] - scale[0]),
      rotY: rng() * Math.PI * 2,
    });
    placed++;
  }

  return placed;
}

/**
 * Builds the whole landscape.
 *
 * Three bands, from the clearing outward:
 *   camp     — low scenery only, inside where the player walks
 *   treeline — dense forest just out of reach, which is what makes the
 *              playable circle read as a clearing rather than as an edge
 *   farwood  — thinning trees running out to the fog, so there is a horizon
 *
 * @param {object[]} gates  kept clear so the dusk telegraph stays readable
 * @param {object[]} nodes  kept clear so harvestables are never crowded
 */
export function scatterScenery(gates = [], nodes = [], seed = SCENERY_SEED) {
  const rng = makeRng(seed);
  const props = [];

  // Inside the camp: nothing tree-shaped. A conifer silhouette must always
  // mean "wood you can take".
  fillBand(props, rng, {
    count: CAMP_SCENERY_COUNT,
    inner: SCENERY_CAMP_INNER,
    outer: WORLD_RADIUS - 1,
    table: [['rock', 3], ['shrub', 4], ['drift', 3]],
    zones: [
      { points: gates, clearance: SCENERY_GATE_CLEARANCE },
      { points: nodes, clearance: SCENERY_NODE_CLEARANCE },
    ],
    scale: [0.6, 1.25],
  });

  fillBand(props, rng, {
    count: TREELINE_COUNT,
    inner: TREELINE_INNER,
    outer: TREELINE_OUTER,
    table: [['pine', 5], ['snowpine', 4], ['snag', 1], ['rock', 1], ['shrub', 1]],
    zones: [{ points: gates, clearance: SCENERY_GATE_CLEARANCE }],
    scale: [0.85, 1.8],
  });

  fillBand(props, rng, {
    count: FARWOOD_COUNT,
    inner: TREELINE_OUTER,
    outer: FARWOOD_OUTER,
    table: [['pine', 4], ['snowpine', 5], ['snag', 2], ['rock', 2]],
    zones: [],
    scale: [1.0, 2.4],
  });

  return props;
}

/** Groups props by kind, which is how the renderer batches them into instances. */
export function groupByKind(props) {
  const groups = new Map();
  for (const p of props) {
    if (!groups.has(p.kind)) groups.set(p.kind, []);
    groups.get(p.kind).push(p);
  }
  return groups;
}
