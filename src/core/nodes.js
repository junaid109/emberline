// src/core/nodes.js
import { HARVEST_SECONDS } from './constants.js';

export function createNode(kind, x, z, amount) {
  return { kind, x, z, remaining: amount, progress: 0, depleted: false };
}

/** Advances harvest progress. Returns { yielded, kind } for the caller to push into a carry. */
export function tickHarvest(node, dt) {
  if (node.depleted) return { yielded: false, kind: null };

  node.progress += dt;
  if (node.progress < HARVEST_SECONDS) return { yielded: false, kind: null };

  node.progress -= HARVEST_SECONDS;    // carry the remainder over, do not reset
  node.remaining -= 1;
  if (node.remaining <= 0) node.depleted = true;
  return { yielded: true, kind: node.kind };
}
