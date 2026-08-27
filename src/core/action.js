// src/core/action.js
//
// The two right-hand buttons, as pure state.
//
// Both exist because of one playtest note: "I got attacked by wolves and then
// the fire went down and then nothing, what do I do?" The game had exactly one
// verb (walk) and one indirect order (rally), and neither of them feels like a
// response to a wolf standing on your furnace.
import { SWING_COOLDOWN, SPRINT_SECONDS, SPRINT_REGEN, SPRINT_FLOOR } from './constants.js';

export function createAction() {
  return {
    cooldown: 0,        // seconds until the pickaxe can swing again
    swinging: 0,        // seconds left in the current swing animation window
    stamina: 1,         // 0..1
    sprinting: false,
    locked: false,      // true after stamina hits zero, until it recovers past the floor
  };
}

/**
 * Advances the pickaxe. Returns true on the single tick a swing STARTS.
 *
 * Edge-triggered on the cooldown rather than on the button, so holding the
 * button gives a steady rhythm of swings instead of one swing per tap. On a
 * phone, requiring a tap per log would be a thumb-destroying way to gather.
 *
 * @param {boolean} held whether the pickaxe button is down this frame
 */
export function tickSwing(action, dt, held) {
  action.cooldown = Math.max(0, action.cooldown - dt);
  action.swinging = Math.max(0, action.swinging - dt);

  if (!held || action.cooldown > 0) return false;

  action.cooldown = SWING_COOLDOWN;
  action.swinging = SWING_COOLDOWN * 0.55;
  return true;
}

/**
 * Advances the sprint. Returns the speed multiplier to apply this frame.
 *
 * The lock is what stops a drained player from stutter-sprinting: once stamina
 * hits zero the button does nothing until it has recovered past SPRINT_FLOOR,
 * so running out is a real cost rather than a rounding error.
 *
 * @param {boolean} held whether the sprint button is down this frame
 * @param {number} sprintMult the multiplier to return while actually sprinting
 * @returns {number} 1 while walking, sprintMult while sprinting
 */
export function tickSprint(action, dt, held, sprintMult) {
  const wants = held && !action.locked && action.stamina > 0;

  if (wants) {
    action.stamina = Math.max(0, action.stamina - dt / SPRINT_SECONDS);
    action.sprinting = true;
    if (action.stamina === 0) action.locked = true;
    return sprintMult;
  }

  action.sprinting = false;
  action.stamina = Math.min(1, action.stamina + dt * SPRINT_REGEN);
  if (action.locked && action.stamina >= SPRINT_FLOOR) action.locked = false;
  return 1;
}
