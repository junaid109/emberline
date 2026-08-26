// The hold that starts a run.
//
// A small state machine, but one with edges that are easy to get wrong and
// unpleasant to get wrong in front of a judge: firing twice and starting two
// runs, firing on release instead of on completion, or punishing a thumb that
// slipped by throwing the whole hold away.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createIgnition, tickIgnition } from '../src/core/ignition.js';
import {
  IGNITION_HOLD_SECONDS, IGNITION_DECAY_MULT, MAX_FRAME_DT,
} from '../src/core/constants.js';

const STEP = MAX_FRAME_DT;

/** Holds for a number of seconds; returns how many times the fire caught. */
function hold(state, seconds, held = true) {
  let fired = 0;
  for (let t = 0; t < seconds / STEP; t++) if (tickIgnition(state, STEP, held)) fired++;
  return fired;
}

test('a fresh title card is unlit and empty', () => {
  const s = createIgnition();
  assert.equal(s.lit, false);
  assert.equal(s.progress, 0);
});

test('holding for the full duration lights the fire', () => {
  const s = createIgnition();
  assert.equal(hold(s, IGNITION_HOLD_SECONDS + STEP), 1);
  assert.equal(s.lit, true);
  assert.equal(s.progress, 1);
});

test('it fires exactly once, however long the thumb stays down', () => {
  // A second firing would start a second run over the top of the first.
  const s = createIgnition();
  hold(s, IGNITION_HOLD_SECONDS + STEP);
  assert.equal(hold(s, 5), 0, 'the fire caught more than once');
});

test('letting go early does not start the run', () => {
  const s = createIgnition();
  hold(s, IGNITION_HOLD_SECONDS * 0.5);
  assert.equal(s.lit, false);
  assert.equal(hold(s, 2, false), 0, 'releasing lit the fire');
});

test('a slipped thumb drains progress rather than throwing it away', () => {
  // A phone wobbles. Resetting to zero on release would read as the game
  // blaming the player before the run has even begun.
  const s = createIgnition();
  hold(s, IGNITION_HOLD_SECONDS * 0.8);
  const peak = s.progress;
  assert.ok(peak > 0.5);

  hold(s, STEP * 2, false);              // a brief slip
  assert.ok(s.progress < peak, 'releasing did not drain the hold at all');
  assert.ok(s.progress > 0, 'a two-frame slip wiped the whole hold');
});

test('the drain is faster than the fill, so the hold must be deliberate', () => {
  const s = createIgnition();
  hold(s, IGNITION_HOLD_SECONDS * 0.6);
  const gained = s.progress;

  const t = createIgnition();
  t.progress = 1;
  t.lit = false;
  hold(t, IGNITION_HOLD_SECONDS * 0.6, false);
  const lost = 1 - t.progress;

  assert.ok(lost > gained, 'letting go is not more costly than holding on');
  assert.ok(IGNITION_DECAY_MULT > 1);
});

test('progress never leaves 0..1, however long the input runs', () => {
  const s = createIgnition();
  for (let t = 0; t < 400; t++) {
    tickIgnition(s, STEP, t % 7 !== 0);          // a jittery, unreliable thumb
    assert.ok(s.progress >= 0 && s.progress <= 1, `progress escaped to ${s.progress}`);
  }
});

test('a released card settles back to empty rather than hovering', () => {
  const s = createIgnition();
  hold(s, IGNITION_HOLD_SECONDS * 0.9);
  hold(s, 5, false);
  assert.equal(s.progress, 0);
  assert.equal(s.lit, false);
});

test('the hold is long enough to be deliberate and short enough not to nag', () => {
  // Under ~0.5s and picking the phone up starts a run; over ~1.5s and the
  // player thinks the button is broken and lets go to try again.
  assert.ok(IGNITION_HOLD_SECONDS >= 0.5, 'an accidental touch would start the run');
  assert.ok(IGNITION_HOLD_SECONDS <= 1.5, 'the hold is long enough to read as unresponsive');
});
