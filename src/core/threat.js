// src/core/threat.js
//
// Wolves and the guard squad. Combat is entirely automatic -- the player never
// aims, never attacks, and never selects a target. The only decision is WHERE
// the squad stands, and the only cost is the time it takes to walk there.
//
// Pure: no rendering, no THREE, no clock.
import {
  WOLF_SPEED, WOLF_HP, WOLF_ATTACK_RADIUS, WOLF_HEAT_DAMAGE,
  SQUAD_SPEED, SQUAD_RANGE, SQUAD_DPS,
} from './constants.js';

// --- wolves ----------------------------------------------------------------

export function createWolf(x, z, hp = WOLF_HP) {
  return { x, z, hp, atFurnace: false };
}

/**
 * Walks every living wolf toward the furnace and reports the heat they chew
 * off it this tick.
 *
 * A wolf inside WOLF_ATTACK_RADIUS stops and mauls the furnace instead of
 * closing further, so damage is dealt by a visible animal standing at the fire
 * rather than by an invisible timer.
 */
export function tickWolves(wolves, dt, furnaceX, furnaceZ) {
  let heatDamage = 0;

  for (const w of wolves) {
    if (w.hp <= 0) continue;

    const dx = furnaceX - w.x;
    const dz = furnaceZ - w.z;
    const dist = Math.hypot(dx, dz);

    if (dist <= WOLF_ATTACK_RADIUS) {
      w.atFurnace = true;
      heatDamage += WOLF_HEAT_DAMAGE * dt;
      continue;
    }

    w.atFurnace = false;
    const step = Math.min(WOLF_SPEED * dt, dist);   // never overshoot the target
    w.x += (dx / dist) * step;
    w.z += (dz / dist) * step;
  }

  return heatDamage;
}

/**
 * Drops dead wolves. Returns the number removed, so the renderer knows how many
 * meshes to release and the HUD can count kills.
 *
 * Filtering in place keeps the array identity stable, which matters because the
 * renderer holds a parallel array keyed by index.
 */
export function reapWolves(wolves) {
  let removed = 0;
  for (let i = wolves.length - 1; i >= 0; i--) {
    if (wolves[i].hp <= 0) { wolves.splice(i, 1); removed++; }
  }
  return removed;
}

// --- guard squad -----------------------------------------------------------

export function createSquad(x, z) {
  return { x, z, targetX: x, targetZ: z, engaging: false };
}

/** Points the squad at a new position. The walk there is the cost of the order. */
export function rallySquad(squad, x, z) {
  squad.targetX = x;
  squad.targetZ = z;
}

export function squadArrived(squad) {
  return Math.hypot(squad.targetX - squad.x, squad.targetZ - squad.z) < 0.05;
}

/**
 * Moves the squad toward its rally point and applies damage to every wolf in
 * range. Returns the number of wolves killed this tick.
 *
 * Damage is spread over all wolves in range rather than focused on one. That is
 * a real design choice, not a simplification: focusing would make a lone squad
 * hold any gate indefinitely, whereas splitting means a big enough pack
 * overwhelms them, which is what forces the player to keep hauling instead of
 * parking the squad and watching.
 */
export function tickSquad(squad, dt, wolves, damageMult = 1) {
  const dx = squad.targetX - squad.x;
  const dz = squad.targetZ - squad.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 0.001) {
    const step = Math.min(SQUAD_SPEED * dt, dist);
    squad.x += (dx / dist) * step;
    squad.z += (dz / dist) * step;
  }

  const inRange = [];
  for (const w of wolves) {
    if (w.hp <= 0) continue;
    if (Math.hypot(w.x - squad.x, w.z - squad.z) <= SQUAD_RANGE) inRange.push(w);
  }

  squad.engaging = inRange.length > 0;
  if (inRange.length === 0) return 0;

  const each = (SQUAD_DPS * damageMult * dt) / inRange.length;
  let killed = 0;
  for (const w of inRange) {
    w.hp -= each;
    if (w.hp <= 0) killed++;
  }
  return killed;
}
