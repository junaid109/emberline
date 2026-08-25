// src/input/tap.js
//
// Rally taps: the game's only input besides the joystick.
//
// The joystick already claims the lower-left region, so this claims everything
// else. Splitting the screen by region rather than by gesture means the two
// controls can never fight over the same pointer, and the player never has to
// learn a modifier.
import { STICK_ZONE_X_MAX, STICK_ZONE_Y_MIN, TAP_MAX_SECONDS, TAP_MAX_DRIFT } from '../core/constants.js';

/**
 * Is this screen position in the region taps are allowed?
 *
 * Pure, and the exact complement of the joystick's activation gate — the two
 * are tested against each other so a future retune cannot open a dead zone or
 * an overlap between them.
 */
export function isTapZone(x, y, width, height) {
  return !(x <= width * STICK_ZONE_X_MAX && y >= height * STICK_ZONE_Y_MIN);
}

/**
 * Was this pointer interaction a tap rather than a drag?
 *
 * A phone in one hand wobbles, so a few pixels of drift is still a tap; a long
 * press or a real drag is not, which leaves room for future gestures without
 * reinterpreting old ones.
 */
export function isTap(seconds, driftPixels) {
  return seconds <= TAP_MAX_SECONDS && driftPixels <= TAP_MAX_DRIFT;
}

/**
 * Calls onTap(clientX, clientY) for taps landing outside the joystick region.
 *
 * Deliberately does NOT capture the pointer: capturing would steal moves from
 * the joystick if a thumb strayed across the boundary mid-drag.
 */
export function createTapper(element, onTap, now = () => performance.now()) {
  const pending = new Map();

  function viewport() {
    return {
      w: element.clientWidth || window.innerWidth,
      h: element.clientHeight || window.innerHeight,
    };
  }

  function onDown(e) {
    const { w, h } = viewport();
    if (!isTapZone(e.clientX, e.clientY, w, h)) return;
    pending.set(e.pointerId, { x: e.clientX, y: e.clientY, t: now() });
  }

  function onUp(e) {
    const start = pending.get(e.pointerId);
    if (!start) return;
    pending.delete(e.pointerId);

    const drift = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    if (isTap((now() - start.t) / 1000, drift)) onTap(e.clientX, e.clientY);
  }

  function onCancel(e) {
    pending.delete(e.pointerId);
  }

  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointerup', onUp);
  element.addEventListener('pointercancel', onCancel);
  window.addEventListener('blur', () => pending.clear());

  return {
    destroy() {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onCancel);
    },
  };
}
