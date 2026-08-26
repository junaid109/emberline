// src/core/worldgen.js
//
// Builds the harvestables and obstacles for one run. Pure, seeded, no THREE.
//
// Every run used to generate the same forest — ten trees at ten fixed angles —
// so a second run taught the player nothing they had not already seen. That is
// a direct cost to the only reason anyone plays a ten-minute game twice.
//
// What varies and what does not is a deliberate split. The BANDS are fixed,
// because the relationships they encode carry the whole teaching arc of the
// game: a full furnace thaws exactly to the outer band, and a run opens with
// that band just out of reach. Which angle and which radius inside a band is
// rolled fresh. So every run is a different forest and the same lesson.
import { makeRng } from './scatter.js';
import { createNode } from './nodes.js';
import {
  WORLDGEN_SEED, NODE_COUNT, NODE_RING_BASE, NODE_RING_STEP, NODE_AMOUNT,
  NODE_ANGLE_JITTER, NODE_RADIUS_JITTER,
  COAL_SEAMS, COAL_AMOUNT, COAL_REGROW_SECONDS, COAL_INNER, COAL_OUTER,
  BOULDER_COUNT, BOULDER_RADIUS, BOULDER_INNER, BOULDER_OUTER,
  BOULDER_GATE_CLEARANCE, BOULDER_NODE_CLEARANCE, NODE_MIN_SPACING,
} from './constants.js';

/** Which of the three interleaved bands slot `i` belongs to. */
function bandRadius(i) {
  return NODE_RING_BASE + (i % 3) * NODE_RING_STEP;
}

function polar(angle, radius) {
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * Wood trees, on the three fixed bands, at rolled angles and radii.
 *
 * The jitter is bounded rather than free: a tree that wandered out of its band
 * would break the two relationships the opening minute depends on.
 */
function generateTrees(rng) {
  const trees = [];

  for (let i = 0; i < NODE_COUNT; i++) {
    const even = (i / NODE_COUNT) * Math.PI * 2;
    let placed = null;

    // Retried rather than trusted. Jitter of NODE_RADIUS_JITTER either side of
    // bands NODE_RING_STEP apart lets two adjacent bands come within 0.8 units
    // of each other, which is well inside harvest range.
    for (let attempt = 0; attempt < 24 && !placed; attempt++) {
      const angle = even + (rng() - 0.5) * 2 * NODE_ANGLE_JITTER;
      const radius = bandRadius(i) + (rng() - 0.5) * 2 * NODE_RADIUS_JITTER;
      const at = polar(angle, radius);
      if (trees.every((t) => distance(t, at) >= NODE_MIN_SPACING)) placed = at;
    }

    // Every attempt crowded: fall back to the un-jittered slot, which is the
    // evenly spaced layout the jitter is a variation ON and so is always clear.
    const at = placed ?? polar(even, bandRadius(i));
    trees.push(createNode('wood', at.x, at.z, NODE_AMOUNT));
  }
  return trees;
}

/**
 * Coal seams, always on frozen ground.
 *
 * Placed by rejection against the trees so a seam never sits on top of one:
 * two harvestables inside each other's range would make which one you are
 * cutting a coin flip, since the harvest loop takes the first node it finds.
 */
function generateCoal(rng, trees) {
  const seams = [];
  const maxAttempts = COAL_SEAMS * 200;

  for (let i = 0; seams.length < COAL_SEAMS && i < maxAttempts; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = COAL_INNER + rng() * (COAL_OUTER - COAL_INNER);
    const at = polar(angle, radius);

    const crowded = [...trees, ...seams].some((n) => distance(n, at) < NODE_MIN_SPACING);
    if (crowded) continue;

    seams.push(createNode('coal', at.x, at.z, COAL_AMOUNT, COAL_REGROW_SECONDS));
  }
  return seams;
}

/**
 * Blocking boulders, on frozen ground only.
 *
 * Every rejection rule here is a playability rule, not a tidiness one:
 *   - clear of harvestables, or a seam can be walled off and the fuel it holds
 *     is simply gone from the run
 *   - clear of gates, so an approach lane stays walkable and the dusk telegraph
 *     stays readable
 *   - clear of each other by more than the player is wide, so two boulders can
 *     never form a gap the player cannot fit through
 */
function generateBoulders(rng, blockers, gates) {
  const boulders = [];
  const maxAttempts = BOULDER_COUNT * 300;

  for (let i = 0; boulders.length < BOULDER_COUNT && i < maxAttempts; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = BOULDER_INNER + rng() * (BOULDER_OUTER - BOULDER_INNER);
    const at = polar(angle, radius);

    if (blockers.some((n) => distance(n, at) < BOULDER_NODE_CLEARANCE + BOULDER_RADIUS)) continue;
    if (gates.some((g) => distance(g, at) < BOULDER_GATE_CLEARANCE + BOULDER_RADIUS)) continue;
    // Four radii apart: two boulders can touch only if they are two diameters
    // apart, so no pair ever forms a slot narrower than the player.
    if (boulders.some((b) => distance(b, at) < BOULDER_RADIUS * 4)) continue;

    boulders.push({ x: at.x, z: at.z, radius: BOULDER_RADIUS });
  }
  return boulders;
}

/**
 * Generates one run's world.
 *
 * @param {number} seed
 * @param {{x:number,z:number}[]} gates kept walkable
 * @returns {{nodes: object[], boulders: object[]}} nodes holds trees then seams
 */
export function generateWorld(seed = WORLDGEN_SEED, gates = []) {
  const rng = makeRng(seed);
  const trees = generateTrees(rng);
  const seams = generateCoal(rng, trees);
  const nodes = [...trees, ...seams];
  return { nodes, boulders: generateBoulders(rng, nodes, gates) };
}

/**
 * Pushes a point out of any boulder it has entered.
 *
 * Resolved by ejection along the centre line rather than by refusing the move.
 * Refusing would let a player walk into a boulder and stick there with the
 * stick held, which reads as the game having frozen; ejection slides them
 * around it, which reads as a rock.
 *
 * @returns {boolean} whether a collision was resolved
 */
export function pushOutOfBoulders(point, boulders, bodyRadius = 0.45) {
  let hit = false;

  for (const b of boulders) {
    const dx = point.x - b.x;
    const dz = point.z - b.z;
    const reach = b.radius + bodyRadius;
    const d = Math.hypot(dx, dz);

    if (d >= reach) continue;

    hit = true;
    // Dead centre: no direction to push along, so pick one rather than divide
    // by zero and send the player to NaN.
    if (d < 1e-6) {
      point.x = b.x + reach;
      continue;
    }
    point.x = b.x + (dx / d) * reach;
    point.z = b.z + (dz / d) * reach;
  }

  return hit;
}
