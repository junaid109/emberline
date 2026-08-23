// src/core/nodes.js
import { HARVEST_SECONDS } from './constants.js';

export function createNode(kind, x, z, amount) {
  return { kind, x, z, remaining: amount, progress: 0, depleted: false };
}

/**
 * Advances harvest progress. Returns the yielded kind string for the caller
 * to push into a carry, or null if nothing yielded this call.
 *
 * Yields at most one item per call and leaves any excess progress
 * unreclaimed — safe only because the caller (src/main.js) clamps its dt to
 * 0.05s, well under HARVEST_SECONDS (0.7s), so progress can never cross more
 * than one harvest interval in a single tick.
 */
export function tickHarvest(node, dt) {
  if (node.depleted) return null;

  node.progress += dt;
  if (node.progress < HARVEST_SECONDS) return null;

  node.progress -= HARVEST_SECONDS;    // carry the remainder over, do not reset
  node.remaining -= 1;
  if (node.remaining <= 0) node.depleted = true;
  return node.kind;
}
