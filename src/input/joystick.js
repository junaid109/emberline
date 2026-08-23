// src/input/joystick.js
import { STICK_RADIUS, STICK_ZONE_X_MAX, STICK_ZONE_Y_MIN } from '../core/constants.js';

/**
 * Pure: converts a pointer position into a direction vector clamped to unit length.
 * Returns screen-space {x, y}; y is positive downward, as in DOM coordinates.
 */
export function stickVector(originX, originY, pointerX, pointerY, radius) {
  const dx = pointerX - originX;
  const dy = pointerY - originY;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: 0, y: 0 };
  const scale = Math.min(len, radius) / radius / len;
  return { x: dx * scale, y: dy * scale };
}

/**
 * Floating joystick: the stick origin is wherever the thumb first lands in the
 * lower-left region, rather than a fixed spot. Far more forgiving on a phone.
 */
export function createJoystick(element) {
  const state = { dir: { x: 0, y: 0 }, active: false };
  let pointerId = null;
  let origin = { x: 0, y: 0 };

  function reset() {
    pointerId = null;
    state.active = false;
    state.dir = { x: 0, y: 0 };
  }

  function onDown(e) {
    if (pointerId !== null) return;
    // Same viewport source as src/render/scene.js's resize(): the joystick's
    // own element (the #game canvas) is the same element the renderer sizes
    // itself against, so read its displayed CSS box directly. Falls back to
    // window.innerWidth/Height when the element does not report a client box
    // (e.g. the fake DOM elements used in tests), which also happens to
    // match the canvas in production, since #game is `position: fixed;
    // inset: 0`. Using a different source than the renderer here would let
    // the activation region drift relative to what the player actually sees
    // whenever the URL bar is showing or the page is pinch-zoomed.
    const viewportWidth = element.clientWidth || window.innerWidth;
    const viewportHeight = element.clientHeight || window.innerHeight;
    if (e.clientX > viewportWidth * STICK_ZONE_X_MAX) return;   // right side reserved for taps
    if (e.clientY < viewportHeight * STICK_ZONE_Y_MIN) return;  // upper area reserved for taps
    pointerId = e.pointerId;
    origin = { x: e.clientX, y: e.clientY };
    state.active = true;
    element.setPointerCapture(e.pointerId);
  }

  function onMove(e) {
    if (e.pointerId !== pointerId) return;
    state.dir = stickVector(origin.x, origin.y, e.clientX, e.clientY, STICK_RADIUS);
  }

  function onUp(e) {
    if (e.pointerId !== pointerId) return;
    reset();
  }

  function onBlurOrHidden() {
    if (pointerId === null) return;
    reset();
  }

  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerup', onUp);
  element.addEventListener('pointercancel', onUp);
  window.addEventListener('blur', onBlurOrHidden);
  document.addEventListener('visibilitychange', onBlurOrHidden);

  state.destroy = () => {
    element.removeEventListener('pointerdown', onDown);
    element.removeEventListener('pointermove', onMove);
    element.removeEventListener('pointerup', onUp);
    element.removeEventListener('pointercancel', onUp);
    window.removeEventListener('blur', onBlurOrHidden);
    document.removeEventListener('visibilitychange', onBlurOrHidden);
  };
  return state;
}
