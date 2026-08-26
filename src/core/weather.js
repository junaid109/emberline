// src/core/weather.js
//
// One event rolled per day. Pure — no THREE, no DOM, no clock.
//
// The point is not variety for its own sake: it is that no two runs pressure
// the player in the same order, so the thing you learn is how to READ a run
// rather than how to repeat one. A blizzard turns a comfortable day into a
// scramble; a cache makes a walk into the wilds pay twice.
import { makeRng } from './scatter.js';
import { CACHE_WOOD, CACHE_INNER, CACHE_OUTER, BLIZZARD_DRAIN_MULT } from './constants.js';

export const EVENTS = ['calm', 'blizzard', 'cache'];

/** Weighted so most days are ordinary and an event still means something. */
const WEIGHTS = [['calm', 5], ['blizzard', 3], ['cache', 3]];

export const EVENT_LABEL = {
  calm: null,                       // an ordinary day is not worth a banner
  blizzard: 'BLIZZARD',
  cache: 'SUPPLY CACHE SIGHTED',
};

export function createWeather(seed) {
  return { event: 'calm', rng: makeRng(seed ^ 0x5bf03635), day: 0 };
}

/**
 * Rolls the event for a day.
 *
 * Day one is always calm, and that is not politeness. The first day is the only
 * tutorial this game has — it is where the player learns what a normal furnace
 * burn feels like and that the outer trees are out of reach. A blizzard during
 * it would teach them that the normal state of the world is emergency, and
 * every judgement they formed afterwards would be calibrated against a lie.
 *
 * @returns {string} the event now in force
 */
export function rollEvent(weather, day) {
  weather.day = day;

  if (day <= 1) {
    weather.event = 'calm';
    return weather.event;
  }

  const total = WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  let r = weather.rng() * total;
  for (const [event, w] of WEIGHTS) {
    r -= w;
    if (r <= 0) {
      weather.event = event;
      return event;
    }
  }
  weather.event = 'calm';
  return weather.event;
}

/** How much faster the furnace burns under the current event. */
export function drainMultiplier(weather) {
  return weather.event === 'blizzard' ? BLIZZARD_DRAIN_MULT : 1;
}

/**
 * Where a supply cache lands, or null on a day that has none.
 *
 * Always out in the wilds, past the thawed edge, for the same reason coal is:
 * a reward standing inside the camp is not a reward, it is a delay.
 */
export function cacheSite(weather, roll) {
  if (weather.event !== 'cache') return null;

  const angle = roll() * Math.PI * 2;
  const radius = CACHE_INNER + roll() * (CACHE_OUTER - CACHE_INNER);
  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius,
    amount: CACHE_WOOD,
  };
}
