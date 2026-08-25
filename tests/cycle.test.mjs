import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createCycle, tickCycle, phaseDuration, phaseRemaining, phaseProgress,
  curve, wolvesForNight, gatesForNight, PHASES,
} from '../src/core/cycle.js';
import {
  TOTAL_NIGHTS, DAY_SECONDS_FIRST, DAY_SECONDS_LAST, DUSK_SECONDS,
  NIGHT_SECONDS_FIRST, NIGHT_SECONDS_LAST, DAWN_SECONDS, MAX_FRAME_DT,
  WOLVES_FIRST_NIGHT, WOLVES_PER_NIGHT,
} from '../src/core/constants.js';

const STEP = MAX_FRAME_DT;

/** Runs the clock until `entered` is seen, returning the transitions in order. */
function runUntil(cycle, wanted, maxTicks = 200000) {
  const seen = [];
  for (let i = 0; i < maxTicks; i++) {
    const entered = tickCycle(cycle, STEP);
    if (entered) {
      seen.push(entered);
      if (entered === wanted) return seen;
    }
  }
  throw new Error(`never reached ${wanted}; saw ${seen.join(',')}`);
}

test('a run starts on the morning of night 1', () => {
  const c = createCycle();
  assert.equal(c.phase, 'day');
  assert.equal(c.night, 1);
  assert.equal(c.finished, false);
});

test('phases advance day -> dusk -> night -> dawn -> day', () => {
  const c = createCycle();
  const seen = runUntil(c, 'day');
  assert.deepEqual(seen, ['dusk', 'night', 'dawn', 'day']);
  assert.equal(c.night, 2, 'the night counter should advance on the new day');
});

test('every phase has a positive duration on every night', () => {
  for (let n = 1; n <= TOTAL_NIGHTS; n++) {
    for (const p of PHASES) assert.ok(phaseDuration(p, n) > 0, `${p} on night ${n}`);
  }
});

test('phaseDuration rejects an unknown phase rather than returning a default', () => {
  assert.throws(() => phaseDuration('midnight', 1));
});

test('days shorten and nights lengthen across the run', () => {
  assert.ok(Math.abs(phaseDuration('day', 1) - DAY_SECONDS_FIRST) < 1e-9);
  assert.ok(Math.abs(phaseDuration('day', TOTAL_NIGHTS) - DAY_SECONDS_LAST) < 1e-9);
  assert.ok(Math.abs(phaseDuration('night', 1) - NIGHT_SECONDS_FIRST) < 1e-9);
  assert.ok(Math.abs(phaseDuration('night', TOTAL_NIGHTS) - NIGHT_SECONDS_LAST) < 1e-9);

  for (let n = 2; n <= TOTAL_NIGHTS; n++) {
    assert.ok(phaseDuration('day', n) < phaseDuration('day', n - 1), `day ${n}`);
    assert.ok(phaseDuration('night', n) > phaseDuration('night', n - 1), `night ${n}`);
  }
});

test('dusk and dawn are the same length every night, so the tells stay learnable', () => {
  for (let n = 1; n <= TOTAL_NIGHTS; n++) {
    assert.equal(phaseDuration('dusk', n), DUSK_SECONDS);
    assert.equal(phaseDuration('dawn', n), DAWN_SECONDS);
  }
});

test('curve clamps outside the night range instead of extrapolating', () => {
  assert.equal(curve(0, 10, 20), 10);
  assert.equal(curve(-5, 10, 20), 10);
  assert.equal(curve(TOTAL_NIGHTS + 9, 10, 20), 20);
});

test('MAX_FRAME_DT is below the shortest phase, or a tick could skip one entirely', () => {
  const shortest = Math.min(...PHASES.map((p) => phaseDuration(p, TOTAL_NIGHTS)));
  assert.ok(MAX_FRAME_DT < shortest);
});

test('surviving the final dawn wins, and the clock then stops', () => {
  const c = createCycle();
  let won = false;
  for (let i = 0; i < 400000 && !won; i++) {
    if (tickCycle(c, STEP) === 'won') won = true;
  }
  assert.ok(won, 'the run never reached a win');
  assert.equal(c.finished, true);
  assert.equal(c.night, TOTAL_NIGHTS);
  assert.equal(tickCycle(c, STEP), null, 'a finished cycle must not keep transitioning');
});

test('the full run lands in the ballpark of a ten-minute session', () => {
  let total = 0;
  for (let n = 1; n <= TOTAL_NIGHTS; n++) {
    for (const p of PHASES) total += phaseDuration(p, n);
  }
  assert.ok(total > 8 * 60 && total < 13 * 60, `run is ${(total / 60).toFixed(1)} minutes`);
});

test('phaseRemaining counts down and never goes negative', () => {
  const c = createCycle();
  const first = phaseRemaining(c);
  tickCycle(c, STEP);
  assert.ok(phaseRemaining(c) < first);
  for (let i = 0; i < 5000; i++) {
    tickCycle(c, STEP);
    assert.ok(phaseRemaining(c) >= 0);
  }
});

test('phaseProgress runs 0 to 1 within a phase', () => {
  const c = createCycle();
  assert.equal(phaseProgress(c), 0);
  tickCycle(c, phaseDuration('day', 1) / 2);
  assert.ok(Math.abs(phaseProgress(c) - 0.5) < 1e-6);
});

test('leftover time carries into the new phase rather than being discarded', () => {
  const c = createCycle();
  const day = phaseDuration('day', 1);
  tickCycle(c, day - 0.01);
  const entered = tickCycle(c, 0.03);
  assert.equal(entered, 'dusk');
  assert.ok(Math.abs(c.elapsed - 0.02) < 1e-9, 'the 0.02s overshoot should start dusk');
});

test('wolf counts rise every night', () => {
  assert.equal(wolvesForNight(1, WOLVES_FIRST_NIGHT, WOLVES_PER_NIGHT), WOLVES_FIRST_NIGHT);
  for (let n = 2; n <= TOTAL_NIGHTS; n++) {
    assert.ok(
      wolvesForNight(n, WOLVES_FIRST_NIGHT, WOLVES_PER_NIGHT)
      > wolvesForNight(n - 1, WOLVES_FIRST_NIGHT, WOLVES_PER_NIGHT),
    );
  }
});

test('gate pressure escalates to two lanes, then all three for the finale', () => {
  for (let n = 1; n <= 5; n++) assert.equal(gatesForNight(n), 1, `night ${n}`);
  assert.equal(gatesForNight(6), 2);
  assert.equal(gatesForNight(TOTAL_NIGHTS), 3);
});
