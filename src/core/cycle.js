// src/core/cycle.js
//
// The day/night phase machine. Pure: it knows about elapsed time and nothing
// else -- no rendering, no wolves, no heat. Everything that needs to react to a
// phase change reads the transition this returns.
import {
  TOTAL_NIGHTS, DAY_SECONDS_FIRST, DAY_SECONDS_LAST, DUSK_SECONDS,
  NIGHT_SECONDS_FIRST, NIGHT_SECONDS_LAST, DAWN_SECONDS,
} from './constants.js';

export const PHASES = ['day', 'dusk', 'night', 'dawn'];

/**
 * Interpolates a per-night value across the run.
 *
 * night is 1-based. Night 1 gives `first`, night TOTAL_NIGHTS gives `last`, and
 * the nights between are evenly spaced. Escalation lives in this one function,
 * so retuning the curve never means hunting through the phase machine.
 */
export function curve(night, first, last) {
  if (TOTAL_NIGHTS <= 1) return last;
  const t = (Math.min(Math.max(night, 1), TOTAL_NIGHTS) - 1) / (TOTAL_NIGHTS - 1);
  return first + (last - first) * t;
}

export function phaseDuration(phase, night) {
  switch (phase) {
    case 'day': return curve(night, DAY_SECONDS_FIRST, DAY_SECONDS_LAST);
    case 'dusk': return DUSK_SECONDS;
    case 'night': return curve(night, NIGHT_SECONDS_FIRST, NIGHT_SECONDS_LAST);
    case 'dawn': return DAWN_SECONDS;
    default: throw new Error(`unknown phase: ${phase}`);
  }
}

export function createCycle() {
  return { phase: 'day', night: 1, elapsed: 0, finished: false };
}

/** Seconds left in the current phase. Drives the HUD countdown. */
export function phaseRemaining(cycle) {
  return Math.max(0, phaseDuration(cycle.phase, cycle.night) - cycle.elapsed);
}

/** 0 at the start of the current phase, 1 at its end. Drives lighting blends. */
export function phaseProgress(cycle) {
  const total = phaseDuration(cycle.phase, cycle.night);
  return total <= 0 ? 1 : Math.min(1, cycle.elapsed / total);
}

/**
 * Advances the clock.
 *
 * Returns the phase that was ENTERED this tick, or null if the phase did not
 * change. Callers use that edge to spawn a wolf wave, roll the telegraph, or
 * show the dawn tally -- none of which should fire more than once per phase.
 *
 * Only one transition is processed per call. That is safe because dt is clamped
 * (MAX_FRAME_DT) far below the shortest phase (DAWN_SECONDS), so time can never
 * cross two boundaries in one step.
 */
export function tickCycle(cycle, dt) {
  if (cycle.finished) return null;

  cycle.elapsed += dt;
  if (cycle.elapsed < phaseDuration(cycle.phase, cycle.night)) return null;

  cycle.elapsed -= phaseDuration(cycle.phase, cycle.night);   // carry the remainder

  switch (cycle.phase) {
    case 'day':
      cycle.phase = 'dusk';
      break;
    case 'dusk':
      cycle.phase = 'night';
      break;
    case 'night':
      cycle.phase = 'dawn';
      break;
    case 'dawn':
      // Surviving the dawn after the final night is the win condition.
      if (cycle.night >= TOTAL_NIGHTS) {
        cycle.finished = true;
        cycle.elapsed = 0;
        return 'won';
      }
      cycle.night += 1;
      cycle.phase = 'day';
      break;
  }

  return cycle.phase;
}

/** How many wolves the given night sends, in total, across all its gates. */
export function wolvesForNight(night, first, perNight) {
  return first + (Math.min(Math.max(night, 1), TOTAL_NIGHTS) - 1) * perNight;
}

/**
 * How many gates the given night attacks at once. The spec escalates from one
 * lane, to two on night 6, to all three for the night-7 whiteout -- so the
 * rally decision goes from "pick right" to "pick which one to lose".
 */
export function gatesForNight(night) {
  if (night >= TOTAL_NIGHTS) return 3;
  if (night >= 6) return 2;
  return 1;
}
