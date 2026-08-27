import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createAction, tickSwing, tickSprint } from '../src/core/action.js';
import {
  SWING_COOLDOWN, SPRINT_MULT, SPRINT_SECONDS, SPRINT_FLOOR, MAX_FRAME_DT,
} from '../src/core/constants.js';

const STEP = MAX_FRAME_DT;

// --- the pickaxe -----------------------------------------------------------

test('the first press swings immediately', () => {
  // A button whose first press does nothing reads as a broken game. This is
  // the whole reason gathering moved off proximity and onto a button.
  const a = createAction();
  assert.equal(tickSwing(a, STEP, true), true);
});

test('a held button swings once per cooldown, not once per frame', () => {
  const a = createAction();
  let swings = 0;
  const frames = Math.ceil(SWING_COOLDOWN / STEP) * 3 + 1;
  for (let i = 0; i < frames; i++) if (tickSwing(a, STEP, true)) swings++;
  assert.equal(swings, 4, 'the opening swing plus one per cooldown');
});

test('a released button never swings', () => {
  const a = createAction();
  for (let i = 0; i < 200; i++) {
    assert.equal(tickSwing(a, STEP, false), false);
  }
});

test('releasing mid-cooldown does not bank a free instant swing', () => {
  // If the cooldown only ticked while held, a player could tap-release-tap to
  // swing far faster than the rhythm allows.
  const a = createAction();
  tickSwing(a, STEP, true);                      // opening swing
  tickSwing(a, STEP, false);                     // let go for one frame
  assert.equal(tickSwing(a, STEP, true), false, 'the cooldown was bypassed by releasing');
});

// --- the sprint ------------------------------------------------------------

test('sprinting returns the multiplier and walking returns one', () => {
  const a = createAction();
  assert.equal(tickSprint(a, STEP, true, SPRINT_MULT), SPRINT_MULT);
  assert.equal(tickSprint(a, STEP, false, SPRINT_MULT), 1);
});

test('stamina runs out after about SPRINT_SECONDS of holding', () => {
  const a = createAction();
  let held = 0;
  while (tickSprint(a, STEP, true, SPRINT_MULT) > 1) held += STEP;
  assert.ok(Math.abs(held - SPRINT_SECONDS) < STEP * 2,
    `sprint lasted ${held.toFixed(2)}s against a budget of ${SPRINT_SECONDS}s`);
  // Not stamina === 0: the loop exits on the first frame that returns 1, and
  // that frame has already started refilling. The lock is the durable proof
  // that the tank actually hit empty.
  assert.equal(a.locked, true, 'running dry should lock the sprint');
});

test('a drained sprint stays locked until stamina passes the floor', () => {
  // Without the lock, a drained player stutter-sprints: one frame of sprint per
  // frame of regen, which makes running out cost nothing at all.
  const a = createAction();
  while (tickSprint(a, STEP, true, SPRINT_MULT) > 1);
  assert.equal(a.locked, true);

  // Still holding, still drained: the button must do nothing.
  assert.equal(tickSprint(a, STEP, true, SPRINT_MULT), 1);
  assert.ok(a.stamina > 0, 'stamina should recover even while the button is held down');

  while (a.locked) tickSprint(a, STEP, true, SPRINT_MULT);
  assert.ok(a.stamina >= SPRINT_FLOOR);
  assert.equal(tickSprint(a, STEP, true, SPRINT_MULT), SPRINT_MULT, 'sprint never came back');
});

test('stamina refills when the button is up, and stops at full', () => {
  const a = createAction();
  a.stamina = 0.4;
  for (let i = 0; i < 2000; i++) tickSprint(a, STEP, false, SPRINT_MULT);
  assert.equal(a.stamina, 1, 'stamina overflowed or never refilled');
});

test('sprint is faster than walking, but not so fast the world stops mattering', () => {
  assert.ok(SPRINT_MULT > 1.2, 'a sprint that is barely faster is not worth a button');
  assert.ok(SPRINT_MULT < 2.0, 'a sprint this fast makes the walk speed irrelevant');
});
