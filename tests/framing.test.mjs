// Framing invariants.
//
// These are the checks that would have caught a scene rendering as one flat
// grey field: the diorama camera sits ~88 units from its target, but fog was
// left at a hand-picked 40-80 range, so every object in the game was past
// fog.far. No gameplay test can see that. These can.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CAMERA_HEIGHT, CAMERA_DISTANCE, CAMERA_TARGET_WIDTH, CAMERA_TARGET_DIST,
  CAMERA_MAX_SCENE_DIST, CAMERA_FAR, FOG_NEAR, FOG_FAR,
  WORLD_RADIUS, RING_MAX, GROUND_VISUAL_RADIUS, GATE_RING_RADIUS,
} from '../src/core/constants.js';

/**
 * Mirrors the vertical-FOV solve in src/render/scene.js resize(): given an
 * aspect ratio, what horizontal ground width does the camera actually show?
 */
function visibleGroundWidth(aspect) {
  const hHalf = Math.atan((CAMERA_TARGET_WIDTH / 2) / CAMERA_TARGET_DIST);
  const vFov = 2 * Math.atan(Math.tan(hHalf) / aspect);
  const vHalf = vFov / 2;
  const hHalfBack = Math.atan(Math.tan(vHalf) * aspect);
  return 2 * CAMERA_TARGET_DIST * Math.tan(hHalfBack);
}

test('the camera-to-target distance matches the camera placement', () => {
  const expected = Math.sqrt(CAMERA_HEIGHT ** 2 + CAMERA_DISTANCE ** 2);
  assert.ok(Math.abs(CAMERA_TARGET_DIST - expected) < 1e-9);
});

test('fog starts beyond the camera target, or the whole scene washes out', () => {
  assert.ok(FOG_NEAR > CAMERA_TARGET_DIST,
    `fog.near ${FOG_NEAR} is inside the camera target distance ${CAMERA_TARGET_DIST}`);
});

test('fog ends beyond the far edge of the playfield', () => {
  assert.ok(FOG_FAR > CAMERA_MAX_SCENE_DIST,
    `fog.far ${FOG_FAR} would erase ground at ${CAMERA_MAX_SCENE_DIST}`);
});

test('fog has a usable depth band rather than a hard cutoff', () => {
  assert.ok(FOG_FAR - FOG_NEAR > 20);
});

test('the far clip plane clears the whole playfield', () => {
  assert.ok(CAMERA_FAR > CAMERA_MAX_SCENE_DIST);
  assert.ok(CAMERA_FAR >= FOG_FAR, 'geometry should reach full fog before it is clipped');
});

test('the full heat ring fits horizontally in portrait', () => {
  // iPhone 16 and S24 Ultra are both about 19.5:9.
  for (const aspect of [393 / 852, 412 / 883, 375 / 812]) {
    const width = visibleGroundWidth(aspect);
    assert.ok(width > 2 * RING_MAX,
      `at aspect ${aspect.toFixed(3)} only ${width.toFixed(1)} units are visible, ` +
      `but the ring is ${2 * RING_MAX} across`);
  }
});

test('the visible width is stable across portrait aspect ratios', () => {
  // The point of solving FOV from a target width: aspect must not change it.
  const a = visibleGroundWidth(393 / 852);
  const b = visibleGroundWidth(412 / 883);
  assert.ok(Math.abs(a - b) < 1e-6);
});

test('the playfield is wider than the maximum heat ring', () => {
  assert.ok(WORLD_RADIUS > RING_MAX, 'there must be frozen ground outside the ring to walk into');
});

test('the snow is drawn well past the walkable edge, so the world has no visible cliff', () => {
  assert.ok(GROUND_VISUAL_RADIUS > WORLD_RADIUS * 2);
  assert.ok(GROUND_VISUAL_RADIUS > FOG_FAR,
    'the snowfield must outrun fog.far, or it ends in a hard edge against the clear colour');
});

test('all three gates fit inside the frame, with margin', () => {
  // The dusk telegraph is the entire night decision. A lit gate pinned to the
  // frame edge — which is what a screenshot caught it doing — makes that
  // decision unreadable on a phone.
  for (const aspect of [393 / 852, 412 / 883, 375 / 812]) {
    const halfWidth = visibleGroundWidth(aspect) / 2;
    assert.ok(halfWidth > GATE_RING_RADIUS * 1.06,
      `at aspect ${aspect.toFixed(3)} the frame half-width is ${halfWidth.toFixed(1)}, ` +
      `against gates at ${GATE_RING_RADIUS}`);
  }
});

test('the heat ring still fits once the frame is sized for the gates', () => {
  assert.ok(GATE_RING_RADIUS > RING_MAX, 'gates must stay outside the thawed ground');
  assert.ok(visibleGroundWidth(393 / 852) > 2 * RING_MAX);
});
