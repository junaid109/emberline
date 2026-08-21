// src/input/joystick.js

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

const RADIUS = 60;

/**
 * Floating joystick: the stick origin is wherever the thumb first lands in the
 * lower-left region, rather than a fixed spot. Far more forgiving on a phone.
 */
export function createJoystick(element) {
  const state = { dir: { x: 0, y: 0 }, active: false };
  let pointerId = null;
  let origin = { x: 0, y: 0 };

  function onDown(e) {
    if (pointerId !== null) return;
    if (e.clientX > window.innerWidth * 0.6) return;   // right side reserved for taps
    pointerId = e.pointerId;
    origin = { x: e.clientX, y: e.clientY };
    state.active = true;
    element.setPointerCapture(e.pointerId);
  }

  function onMove(e) {
    if (e.pointerId !== pointerId) return;
    state.dir = stickVector(origin.x, origin.y, e.clientX, e.clientY, RADIUS);
  }

  function onUp(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    state.active = false;
    state.dir = { x: 0, y: 0 };
  }

  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerup', onUp);
  element.addEventListener('pointercancel', onUp);

  state.destroy = () => {
    element.removeEventListener('pointerdown', onDown);
    element.removeEventListener('pointermove', onMove);
    element.removeEventListener('pointerup', onUp);
    element.removeEventListener('pointercancel', onUp);
  };
  return state;
}
