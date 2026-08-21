// src/core/heat.js
import { HEAT_MAX, RING_MIN, RING_MAX } from './constants.js';

/** Maps fuel to the physical radius of thawed ground. The whole game is this function. */
export function ringRadius(heat) {
  const t = Math.max(0, Math.min(1, heat / HEAT_MAX));
  return RING_MIN + (RING_MAX - RING_MIN) * t;
}

export function drainHeat(heat, dt, rate) {
  return Math.max(0, heat - rate * dt);
}

export function addFuel(heat, amount) {
  return Math.min(HEAT_MAX, heat + amount);
}
