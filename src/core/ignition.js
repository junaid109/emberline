// src/core/ignition.js
//
// The hold that starts a run. Pure — no DOM, no THREE, no clock.
//
// It lives in core rather than in the UI because it is a small state machine
// with edges that are easy to get wrong (firing twice, firing on release,
// surviving a slipped thumb), and every one of those is worth a test.
import { IGNITION_HOLD_SECONDS, IGNITION_DECAY_MULT } from './constants.js';

export function createIgnition() {
  return { progress: 0, lit: false };
}

/**
 * Advances the hold.
 *
 * @param {{progress:number, lit:boolean}} state
 * @param {number} dt      seconds, already clamped by the caller
 * @param {boolean} held   whether the screen is being touched right now
 * @returns {boolean} true on the single tick the fire catches, false otherwise
 */
export function tickIgnition(state, dt, held) {
  // Once lit, stays lit. Without this the title card could fire a second time
  // on a thumb that never left the glass, and start two runs.
  if (state.lit) return false;

  const perSecond = 1 / IGNITION_HOLD_SECONDS;
  const rate = held ? perSecond : -perSecond * IGNITION_DECAY_MULT;

  state.progress = Math.max(0, Math.min(1, state.progress + rate * dt));

  if (state.progress >= 1) {
    state.lit = true;
    return true;
  }
  return false;
}
