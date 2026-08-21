import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stickVector, createJoystick } from '../src/input/joystick.js';

// --- minimal fake DOM for exercising createJoystick's activation-region gate ---

function makeFakeElement() {
  const listeners = {};
  return {
    listeners,
    addEventListener(type, fn) {
      (listeners[type] ||= []).push(fn);
    },
    removeEventListener(type, fn) {
      if (!listeners[type]) return;
      listeners[type] = listeners[type].filter((f) => f !== fn);
    },
    dispatch(type, event) {
      for (const fn of listeners[type] || []) fn(event);
    },
    setPointerCapture() {},
  };
}

function withFakeGlobals(innerWidth, innerHeight, fn) {
  const prevWindow = globalThis.window;
  const prevDocument = globalThis.document;
  const windowListeners = {};
  const documentListeners = {};
  globalThis.window = {
    innerWidth,
    innerHeight,
    addEventListener(type, cb) {
      (windowListeners[type] ||= []).push(cb);
    },
    removeEventListener(type, cb) {
      if (!windowListeners[type]) return;
      windowListeners[type] = windowListeners[type].filter((f) => f !== cb);
    },
    dispatch(type, event) {
      for (const cb of windowListeners[type] || []) cb(event);
    },
  };
  globalThis.document = {
    addEventListener(type, cb) {
      (documentListeners[type] ||= []).push(cb);
    },
    removeEventListener(type, cb) {
      if (!documentListeners[type]) return;
      documentListeners[type] = documentListeners[type].filter((f) => f !== cb);
    },
    dispatch(type, event) {
      for (const cb of documentListeners[type] || []) cb(event);
    },
  };
  try {
    return fn();
  } finally {
    globalThis.window = prevWindow;
    globalThis.document = prevDocument;
  }
}

test('returns zero at the origin', () => {
  assert.deepEqual(stickVector(100, 100, 100, 100, 50), { x: 0, y: 0 });
});

test('returns a unit vector at the rim', () => {
  const v = stickVector(100, 100, 150, 100, 50);
  assert.equal(v.x, 1);
  assert.equal(v.y, 0);
});

test('clamps magnitude to 1 beyond the rim', () => {
  const v = stickVector(100, 100, 400, 100, 50);
  assert.equal(v.x, 1);
});

test('scales linearly inside the rim', () => {
  const v = stickVector(100, 100, 125, 100, 50);
  assert.equal(v.x, 0.5);
});

test('normalises diagonals so they are not faster', () => {
  const v = stickVector(0, 0, 100, 100, 50);
  assert.ok(Math.abs(Math.hypot(v.x, v.y) - 1) < 1e-9);
});

test('handles a leftward drag with a negative x and zero y', () => {
  const v = stickVector(100, 100, 50, 100, 50);
  assert.equal(v.x, -1);
  assert.equal(v.y, 0);
});

test('handles an upward drag with a negative y and zero x', () => {
  const v = stickVector(100, 100, 100, 50, 50);
  assert.equal(v.x, 0);
  assert.equal(v.y, -1);
});

test('handles an up-left drag with negative x and y, normalised', () => {
  const v = stickVector(100, 100, 60, 60, 50);
  assert.ok(v.x < 0);
  assert.ok(v.y < 0);
  assert.ok(Math.abs(v.x - v.y) < 1e-9); // symmetric diagonal
  assert.ok(Math.abs(Math.hypot(v.x, v.y) - 1) < 1e-9);
});

// --- activation region gate (lower-left only) ---
// Reference viewport: iPhone 16, 393x852 CSS px.

test('activates on a touch in the lower-left region', () => {
  withFakeGlobals(393, 852, () => {
    const element = makeFakeElement();
    const joystick = createJoystick(element);
    element.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 800 });
    assert.equal(joystick.active, true);
    joystick.destroy();
  });
});

test('rejects a touch too far right, even in the lower half', () => {
  withFakeGlobals(393, 852, () => {
    const element = makeFakeElement();
    const joystick = createJoystick(element);
    // clientX = 300 > 0.6 * 393 = 235.8
    element.dispatch('pointerdown', { pointerId: 1, clientX: 300, clientY: 800 });
    assert.equal(joystick.active, false);
    joystick.destroy();
  });
});

test('rejects a touch too high, even in the left portion (upper-left tap target)', () => {
  // This is the case an X-only gate gets wrong: clientX = 100 is left of the
  // 0.6 * 393 = 235.8 threshold, so an X-only check would wrongly activate here.
  // Only the added Y check (clientY must be below 0.45 * 852 = 383.4) rejects it.
  withFakeGlobals(393, 852, () => {
    const element = makeFakeElement();
    const joystick = createJoystick(element);
    element.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
    assert.equal(joystick.active, false);
    joystick.destroy();
  });
});

test('also works at the Galaxy S24 Ultra reference viewport (412x883)', () => {
  withFakeGlobals(412, 883, () => {
    const element = makeFakeElement();
    const joystick = createJoystick(element);
    element.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 800 });
    assert.equal(joystick.active, true);
    joystick.destroy();
  });
});

test('a window blur clears an active stick, matching pointerup behaviour', () => {
  withFakeGlobals(393, 852, () => {
    const element = makeFakeElement();
    const joystick = createJoystick(element);
    element.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 800 });
    element.dispatch('pointermove', { pointerId: 1, clientX: 130, clientY: 800 });
    assert.equal(joystick.active, true);
    assert.notDeepEqual(joystick.dir, { x: 0, y: 0 });

    // simulate losing focus without a pointerup/pointercancel
    globalThis.window.dispatch('blur', {});

    assert.equal(joystick.active, false);
    assert.deepEqual(joystick.dir, { x: 0, y: 0 });

    joystick.destroy();
  });
});

test('the page becoming hidden clears an active stick, matching pointerup behaviour', () => {
  withFakeGlobals(393, 852, () => {
    const element = makeFakeElement();
    const joystick = createJoystick(element);
    element.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 800 });
    element.dispatch('pointermove', { pointerId: 1, clientX: 130, clientY: 800 });
    assert.equal(joystick.active, true);

    // simulate the page being backgrounded without a pointerup/pointercancel
    globalThis.document.dispatch('visibilitychange', {});

    assert.equal(joystick.active, false);
    assert.deepEqual(joystick.dir, { x: 0, y: 0 });

    joystick.destroy();
  });
});

test('destroy() removes the blur and visibilitychange listeners it added', () => {
  withFakeGlobals(393, 852, () => {
    const element = makeFakeElement();
    const joystick = createJoystick(element);
    joystick.destroy();
    element.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 800 });
    // after destroy, window/document dispatches must not throw or resurrect state
    assert.doesNotThrow(() => globalThis.window.dispatch('blur', {}));
    assert.doesNotThrow(() => globalThis.document.dispatch('visibilitychange', {}));
  });
});
