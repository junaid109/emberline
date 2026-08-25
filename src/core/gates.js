// src/core/gates.js
//
// The three approach lanes. Wolves only ever come down a gate, so the player's
// night decision is always a choice between three known places rather than a
// search of the whole perimeter -- which is what lets combat stay automatic
// without feeling like nothing is being decided.
import { GATE_COUNT, GATE_RING_RADIUS } from './constants.js';

export function createGates(count = GATE_COUNT, radius = GATE_RING_RADIUS) {
  const gates = [];
  for (let i = 0; i < count; i++) {
    // Start at -90deg so gate 0 sits at the top of the screen (-z), where the
    // camera looks; the rest are evenly spaced clockwise from there.
    const a = -Math.PI / 2 + (i / count) * Math.PI * 2;
    gates.push({ index: i, x: Math.cos(a) * radius, z: Math.sin(a) * radius, telegraphed: false });
  }
  return gates;
}

/** The gate nearest an arbitrary world point. Used to resolve a rally tap. */
export function nearestGate(gates, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const g of gates) {
    const dx = g.x - x;
    const dz = g.z - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = g; }
  }
  return best;
}

/**
 * Marks which gates the coming night will use.
 *
 * `roll` is injected rather than calling Math.random directly, so the choice is
 * deterministic under test and the telegraph can be asserted against the wolves
 * that actually spawn.
 */
export function telegraph(gates, count, roll = Math.random) {
  for (const g of gates) g.telegraphed = false;

  const pool = gates.map((g) => g.index);
  const picked = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const k = Math.min(pool.length - 1, Math.floor(roll() * pool.length));
    picked.push(pool.splice(k, 1)[0]);
  }

  for (const i of picked) gates[i].telegraphed = true;
  return picked;
}

export function telegraphedGates(gates) {
  return gates.filter((g) => g.telegraphed);
}
