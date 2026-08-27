import { test } from 'node:test';
import assert from 'node:assert/strict';

import { objective, COACH } from '../src/core/coach.js';
import { createWorld } from '../src/core/world.js';
import { HEAT_MAX, CARRY_CAP } from '../src/core/constants.js';

// The coaching line exists because a real player finished a whole run without
// working out what the game wanted. Every branch here is a question that
// playtest actually asked out loud.

function fresh() {
  const w = createWorld(() => 0.5);
  w.heat = HEAT_MAX;
  return w;
}

test('an empty-handed player is told to go and mine', () => {
  assert.equal(objective(fresh()), COACH.MINE);
});

test('a player holding wood is told where to put it', () => {
  const w = fresh();
  w.carry.items.push('wood');
  assert.equal(objective(w), COACH.FEED);
});

test('a full carry says so, because the swings have stopped working', () => {
  // The specific confusion this answers: the pickaxe silently stops yielding
  // once the carry is full, which without a word on screen reads as the button
  // having broken.
  const w = fresh();
  for (let i = 0; i < CARRY_CAP; i++) w.carry.items.push('wood');
  assert.equal(objective(w), COACH.FULL);
});

test('standing on the pad with fuel names what is happening', () => {
  const w = fresh();
  w.carry.items.push('wood');
  w.player.x = w.pad.x;
  w.player.z = w.pad.z;
  assert.equal(objective(w), COACH.FEEDING);
});

test('a dying fire outranks everything else on screen', () => {
  // Priority, not chronology. A player about to lose needs the line that stops
  // them losing, not the line that matches where they happen to be standing.
  const w = fresh();
  w.heat = HEAT_MAX * 0.1;
  assert.equal(objective(w), COACH.DYING);

  w.carry.items.push('wood');
  assert.equal(objective(w), COACH.FEED, 'a player already holding fuel needs the other half of the instruction');
});

test('dusk teaches the rally tap, which is the least discoverable control', () => {
  const w = fresh();
  w.cycle.phase = 'dusk';
  assert.equal(objective(w), COACH.GATE);
});

test('night says what the night is for', () => {
  const w = fresh();
  w.cycle.phase = 'night';
  assert.equal(objective(w), COACH.NIGHT);
});

test('a finished run says nothing, because the end card is talking', () => {
  const w = fresh();
  w.over = 'lost';
  assert.equal(objective(w), null);
});

test('every line is short enough to read at a glance on a phone', () => {
  // A hint that wraps or truncates mid-phrase is worse than no hint: it costs
  // attention and delivers half a sentence.
  for (const [key, line] of Object.entries(COACH)) {
    assert.ok(line.length <= 38, `${key} is ${line.length} characters: "${line}"`);
  }
});

test('a real world at every phase always has advice to give', () => {
  // No state may fall through to silence while the run is live — silence is
  // exactly what the playtest ran into.
  for (const phase of ['day', 'dusk', 'night', 'dawn']) {
    const w = fresh();
    w.cycle.phase = phase;
    for (const heat of [HEAT_MAX, HEAT_MAX * 0.5, 1]) {
      w.heat = heat;
      for (const carried of [0, 1, CARRY_CAP]) {
        w.carry.items.length = 0;
        for (let i = 0; i < carried; i++) w.carry.items.push('wood');
        assert.ok(objective(w), `no advice at phase ${phase}, heat ${heat}, carrying ${carried}`);
      }
    }
  }
});
