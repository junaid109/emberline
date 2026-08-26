// src/core/wildlife.js
//
// Hares. Pure — no THREE, no DOM, no clock.
//
// They are the only meat in the world, and meat is the only thing that makes a
// night cheaper, so a hare is a decision rather than scenery: the daylight you
// spend chasing one is daylight you did not spend hauling fuel.
//
// They dart and freeze rather than fleeing steadily. A steady flee is either
// uncatchable or a formality depending on one speed constant, and neither is a
// chase; darting gives the player something to read and time, and it is also
// what a hare actually does.
import {
  HARE_COUNT, HARE_DART_SPEED, HARE_DART_SECONDS, HARE_STILL_SECONDS,
  HARE_WANDER_SPEED, HARE_FLEE_RADIUS, HARE_CATCH_RADIUS, HARE_RESPAWN_SECONDS,
  HARE_INNER, HARE_OUTER,
} from './constants.js';

/** @param {() => number} roll */
function somewhereInTheWilds(roll) {
  const angle = roll() * Math.PI * 2;
  const radius = HARE_INNER + roll() * (HARE_OUTER - HARE_INNER);
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}

export function createHare(roll) {
  const at = somewhereInTheWilds(roll);
  return {
    x: at.x,
    z: at.z,
    mode: 'wander',        // 'wander' | 'dart' | 'still' | 'gone'
    timer: 0,
    dirX: 0,
    dirZ: 1,
    respawn: 0,
  };
}

export function createHares(roll, count = HARE_COUNT) {
  return Array.from({ length: count }, () => createHare(roll));
}

/** Keeps a hare inside the wilds, turning it back rather than letting it escape. */
function keepInTheWilds(hare) {
  const r = Math.hypot(hare.x, hare.z);
  if (r >= HARE_INNER && r <= HARE_OUTER) return;

  const clamped = Math.min(HARE_OUTER, Math.max(HARE_INNER, r)) / (r || 1);
  hare.x *= clamped;
  hare.z *= clamped;

  // Turned around rather than merely stopped: a hare pinned against the inner
  // edge would otherwise sit there being trivially catchable.
  hare.dirX = -hare.dirX;
  hare.dirZ = -hare.dirZ;
}

/**
 * Advances one hare.
 *
 * @returns {'caught'|null} 'caught' on the single tick the player takes it
 */
export function tickHare(hare, dt, player, roll) {
  if (hare.mode === 'gone') {
    hare.respawn -= dt;
    if (hare.respawn <= 0) {
      const at = somewhereInTheWilds(roll);
      hare.x = at.x;
      hare.z = at.z;
      hare.mode = 'wander';
      hare.timer = 0;
    }
    return null;
  }

  const dx = hare.x - player.x;
  const dz = hare.z - player.z;
  const toPlayer = Math.hypot(dx, dz);

  if (toPlayer <= HARE_CATCH_RADIUS) {
    hare.mode = 'gone';
    hare.respawn = HARE_RESPAWN_SECONDS;
    return 'caught';
  }

  hare.timer -= dt;

  if (toPlayer <= HARE_FLEE_RADIUS) {
    // Spooked. Alternate bursts away from the player with frozen moments — the
    // still beat is the player's window, and it is the whole chase.
    if (hare.timer <= 0) {
      const darting = hare.mode !== 'dart';
      hare.mode = darting ? 'dart' : 'still';
      hare.timer = darting ? HARE_DART_SECONDS : HARE_STILL_SECONDS;
      if (darting) {
        hare.dirX = dx / (toPlayer || 1);
        hare.dirZ = dz / (toPlayer || 1);
      }
    }
  } else if (hare.timer <= 0) {
    // Calm: amble somewhere new.
    hare.mode = 'wander';
    hare.timer = 1.5 + roll() * 2.5;
    const angle = roll() * Math.PI * 2;
    hare.dirX = Math.cos(angle);
    hare.dirZ = Math.sin(angle);
  }

  const speed = hare.mode === 'dart' ? HARE_DART_SPEED
    : hare.mode === 'still' ? 0
      : HARE_WANDER_SPEED;

  hare.x += hare.dirX * speed * dt;
  hare.z += hare.dirZ * speed * dt;
  keepInTheWilds(hare);

  return null;
}

/**
 * Advances every hare.
 *
 * @returns {number} how many were caught this tick
 */
export function tickHares(hares, dt, player, roll) {
  let caught = 0;
  for (const hare of hares) {
    if (tickHare(hare, dt, player, roll) === 'caught') caught++;
  }
  return caught;
}
