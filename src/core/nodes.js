// src/core/nodes.js
import { NODE_REGROW_SECONDS } from './constants.js';

/**
 * @param {number} [regrowSeconds] seconds per log/lump grown back.
 *
 * Per node rather than global: a coal seam and a tree are both harvestables,
 * but a forest comes back within a run and a seam does not.
 */
export function createNode(kind, x, z, amount, regrowSeconds = NODE_REGROW_SECONDS) {
  return {
    kind, x, z, remaining: amount, cap: amount,
    regrowth: 0, regrowSeconds, depleted: false,
  };
}

/**
 * Takes one item from a node immediately.
 *
 * The pickaxe's yield. A swing has already paid its own cost — the cooldown in
 * src/core/action.js is the rhythm — so it either takes a log or finds nothing
 * left to take. No progress is stored, which means a node cannot bank partial
 * swings and hand out a free log to whoever walks past next.
 *
 * @returns {string|null} the kind taken, or null if the node is bare
 */
export function harvestOnce(node) {
  if (node.depleted || node.remaining <= 0) return null;

  node.remaining -= 1;
  if (node.remaining <= 0) node.depleted = true;
  return node.kind;
}

/**
 * Regrows a harvested node over time.
 *
 * Without this the world holds a fixed 60 wood against a run that costs
 * several hundred, so no amount of skill could finish seven nights: the game
 * was unwinnable and no test noticed, because every test that reached night 7
 * did so by pinning heat to HEAT_MAX each tick.
 *
 * Regrowth is a continuous trickle rather than a "respawn" event, so a node
 * you stripped and a node you took two logs from are in genuinely different
 * states, and the routing decision — which clearing is worth walking back to —
 * has a real answer rather than a binary one.
 *
 * @returns {boolean} true if the node came back from depleted this call,
 *                    which is the renderer's cue to show its mesh again
 */
export function tickRegrow(node, dt) {
  if (node.remaining >= node.cap) return false;

  node.regrowth += dt;
  if (node.regrowth < node.regrowSeconds) return false;

  node.regrowth -= node.regrowSeconds;
  node.remaining += 1;

  const revived = node.depleted;
  node.depleted = false;
  return revived;
}
