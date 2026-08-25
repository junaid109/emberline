// Integration tests for the night loop: the phase clock, the telegraph, the
// wolves it summons, and the rally decision that answers them.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createWorld, tickWorld, rallyToward } from '../src/core/world.js';
import { telegraphedGates } from '../src/core/gates.js';
import { wolvesForNight, gatesForNight, phaseDuration } from '../src/core/cycle.js';
import {
  MAX_FRAME_DT, HEAT_MAX, HEAT_DRAIN_DAY, HEAT_DRAIN_NIGHT_MULT,
  WOLVES_FIRST_NIGHT, WOLVES_PER_NIGHT, TOTAL_NIGHTS, GATE_RING_RADIUS,
  WOLF_SPAWN_SPREAD, GATE_COUNT, RING_MAX,
} from '../src/core/constants.js';

const STEP = MAX_FRAME_DT;

/** A world with a fixed roll, so the telegraph is reproducible. */
function fixedWorld(rollValue = 0) {
  return createWorld(() => rollValue);
}

/**
 * Runs until the given phase is entered, keeping the furnace fed so the run
 * does not simply starve before it gets there.
 */
function advanceTo(world, phase, maxTicks = 200000) {
  for (let i = 0; i < maxTicks; i++) {
    world.heat = HEAT_MAX;
    const ev = tickWorld(world, STEP, 0, 0);
    if (ev.phaseEntered === phase) return ev;
  }
  throw new Error(`never entered ${phase}`);
}

test('a run begins in daylight with no wolves and nothing telegraphed', () => {
  const w = fixedWorld();
  tickWorld(w, STEP, 0, 0);
  assert.equal(w.cycle.phase, 'day');
  assert.equal(w.wolves.length, 0);
  assert.equal(telegraphedGates(w.gates).length, 0);
});

test('dusk telegraphs exactly the number of gates the night calls for', () => {
  const w = fixedWorld();
  advanceTo(w, 'dusk');
  assert.equal(telegraphedGates(w.gates).length, gatesForNight(w.cycle.night));
});

test('wolves spawn only at telegraphed gates — the tell must never lie', () => {
  // This is the load-bearing test of the whole night. If wolves can appear at a
  // gate that was not lit, the rally decision is a coin flip and the dusk
  // window is decoration.
  const w = fixedWorld(0.7);
  advanceTo(w, 'night');

  const lit = telegraphedGates(w.gates);
  assert.ok(lit.length > 0);

  for (let i = 0; i < 4000; i++) {
    w.heat = HEAT_MAX;
    tickWorld(w, STEP, 0, 0);
    for (const wolf of w.wolves) {
      // A wolf's spawn point is on the gate ring; find the gate it came from by
      // proximity at the moment it appears, before it walks far.
      const nearestLit = Math.min(...lit.map((g) => Math.hypot(wolf.x - g.x, wolf.z - g.z)));
      const nearestDark = Math.min(...w.gates.filter((g) => !g.telegraphed)
        .map((g) => Math.hypot(wolf.x - g.x, wolf.z - g.z)));
      assert.ok(nearestLit <= nearestDark + 1e-9,
        'a wolf appeared closer to an unlit gate than to any lit one');
    }
  }
});

test('the night sends the full wave the escalation curve promises', () => {
  const w = fixedWorld(0.2);
  advanceTo(w, 'night');

  let spawned = 0;
  for (let i = 0; i < 20000 && w.cycle.phase === 'night'; i++) {
    w.heat = HEAT_MAX;
    spawned += tickWorld(w, STEP, 0, 0).wolvesSpawned;
  }
  assert.equal(spawned, wolvesForNight(1, WOLVES_FIRST_NIGHT, WOLVES_PER_NIGHT));
});

test('the whole wave fits inside the night it belongs to', () => {
  // A wave that cannot finish spawning before dawn would silently shrink the
  // difficulty curve on exactly the nights meant to be hardest.
  const { WOLF_SPAWN_INTERVAL } = { WOLF_SPAWN_INTERVAL: 1.6 };
  for (let n = 1; n <= TOTAL_NIGHTS; n++) {
    const wolves = wolvesForNight(n, WOLVES_FIRST_NIGHT, WOLVES_PER_NIGHT);
    assert.ok(wolves * WOLF_SPAWN_INTERVAL < phaseDuration('night', n),
      `night ${n}: ${wolves} wolves need ${wolves * WOLF_SPAWN_INTERVAL}s of a ` +
      `${phaseDuration('night', n)}s night`);
  }
});

test('heat drains faster at night than by day', () => {
  const day = fixedWorld();
  day.heat = HEAT_MAX;
  tickWorld(day, STEP, 0, 0);
  const dayLoss = HEAT_MAX - day.heat;

  const night = fixedWorld();
  advanceTo(night, 'night');
  night.heat = HEAT_MAX;
  tickWorld(night, STEP, 0, 0);
  const nightLoss = HEAT_MAX - night.heat;

  assert.ok(Math.abs(dayLoss - HEAT_DRAIN_DAY * STEP) < 1e-9);
  assert.ok(Math.abs(nightLoss - HEAT_DRAIN_DAY * HEAT_DRAIN_NIGHT_MULT * STEP) < 1e-9);
  assert.ok(nightLoss > dayLoss);
});

test('a rally tap snaps to the nearest gate, so a sloppy thumb still works', () => {
  const w = fixedWorld();
  for (const g of w.gates) {
    const gate = rallyToward(w, g.x + 2.5, g.z - 2.0);
    assert.equal(gate.index, g.index);
    assert.equal(w.squad.targetX, g.x);
    assert.equal(w.squad.targetZ, g.z);
  }
});

test('a rally tap far outside the world still resolves to a gate', () => {
  const w = fixedWorld();
  assert.ok(rallyToward(w, 9999, -9999) !== null);
});

test('the squad starts on a gate rather than somewhere off screen', () => {
  const w = fixedWorld();
  const onAGate = w.gates.some((g) => Math.hypot(g.x - w.squad.x, g.z - w.squad.z) < 1e-9);
  assert.ok(onAGate);
});

test('a correctly rallied squad clears the night without the furnace being touched', () => {
  // The payoff test: rally to the lit gate at dusk, do nothing else, and the
  // night should cost only the ambient burn. If this fails, playing well and
  // playing badly are indistinguishable.
  const w = fixedWorld(0.35);
  advanceTo(w, 'dusk');
  const [lit] = telegraphedGates(w.gates);
  rallyToward(w, lit.x, lit.z);

  let mauledTicks = 0;
  for (let i = 0; i < 40000 && w.cycle.phase !== 'dawn'; i++) {
    w.heat = HEAT_MAX;
    if (tickWorld(w, STEP, 0, 0).mauled) mauledTicks++;
  }
  assert.equal(mauledTicks, 0, 'wolves reached the furnace despite a correct rally');
  assert.ok(w.kills > 0, 'the squad never actually killed anything');
  assert.equal(w.wolves.length, 0, 'wolves were left alive at dawn');
});

test('ignoring the night lets wolves reach the furnace and maul it', () => {
  // The mirror of the test above: if the squad is parked on the wrong gate, the
  // furnace must actually suffer for it.
  const w = fixedWorld(0.35);
  advanceTo(w, 'dusk');
  const dark = w.gates.find((g) => !g.telegraphed);
  rallyToward(w, dark.x, dark.z);

  let mauledTicks = 0;
  for (let i = 0; i < 40000 && w.cycle.phase !== 'dawn'; i++) {
    w.heat = HEAT_MAX;
    if (tickWorld(w, STEP, 0, 0).mauled) mauledTicks++;
  }
  assert.ok(mauledTicks > 0, 'a wrong rally cost the player nothing');
});

test('wolves spawn outside the gate ring and walk inward', () => {
  const w = fixedWorld(0.1);
  advanceTo(w, 'night');
  for (let i = 0; i < 200; i++) {
    w.heat = HEAT_MAX;
    if (tickWorld(w, STEP, 0, 0).wolvesSpawned > 0) break;
  }
  assert.ok(w.wolves.length > 0);
  assert.ok(Math.hypot(w.wolves[0].x, w.wolves[0].z) > GATE_RING_RADIUS);
});

test('the furnace reaching zero ends the run', () => {
  const w = fixedWorld();
  w.heat = 0.01;
  tickWorld(w, STEP, 0, 0);
  assert.equal(w.over, 'lost');
});

test('a finished world stops simulating entirely', () => {
  const w = fixedWorld();
  w.heat = 0.01;
  tickWorld(w, STEP, 0, 0);
  const { x, z } = w.player;
  const night = w.cycle.night;
  for (let i = 0; i < 100; i++) tickWorld(w, STEP, 1, 1);
  assert.equal(w.player.x, x, 'the player kept moving after losing');
  assert.equal(w.cycle.night, night, 'the clock kept running after losing');
});

test('surviving all seven nights wins', () => {
  const w = fixedWorld(0.5);
  let won = false;
  for (let i = 0; i < 400000 && !won; i++) {
    w.heat = HEAT_MAX;                       // an unlimited fuel supply: test the clock, not the economy
    w.wolves.length = 0;                     // and no wolf pressure
    if (tickWorld(w, STEP, 0, 0).phaseEntered === 'won') won = true;
  }
  assert.ok(won, 'the run never reached a win');
  assert.equal(w.over, 'won');
  assert.equal(w.cycle.night, TOTAL_NIGHTS);
});

test('wolves spread across the gate mouth instead of stacking in single file', () => {
  // A screenshot caught every wolf spawning on the identical point and walking
  // the identical line to the furnace: a conga line, not a pack.
  let roll = 0;
  const w = createWorld(() => { roll = (roll + 0.37) % 1; return roll; });
  advanceTo(w, 'night');

  for (let i = 0; i < 4000 && w.wolves.length < 3; i++) {
    w.heat = HEAT_MAX;
    tickWorld(w, STEP, 0, 0);
  }
  assert.ok(w.wolves.length >= 3, 'not enough wolves spawned to compare');

  const positions = w.wolves.map((x) => `${x.x.toFixed(3)},${x.z.toFixed(3)}`);
  assert.equal(new Set(positions).size, positions.length, 'two wolves occupy the same point');
});

test('spawn spread never pushes a wolf toward the wrong gate', () => {
  // The lane must still read as one lane. The spread has to stay well under the
  // distance between neighbouring gates or the telegraph becomes ambiguous.
  const gates = createWorld(() => 0).gates;
  const gap = Math.hypot(gates[0].x - gates[1].x, gates[0].z - gates[1].z);
  assert.ok(WOLF_SPAWN_SPREAD * 2 < gap / 2,
    `spread ${WOLF_SPAWN_SPREAD * 2} is too wide for gates ${gap.toFixed(1)} apart`);
  assert.equal(GATE_COUNT, 3);
});

test('spawned wolves still start outside the heat ring', () => {
  // Measured at the instant of spawn. Reading positions later would just be
  // measuring how far they had already walked.
  const w = createWorld(() => 0.99);           // worst case: spread pushed fully inward
  advanceTo(w, 'night');

  const spawnRadii = [];
  for (let i = 0; i < 4000 && spawnRadii.length < 3; i++) {
    w.heat = HEAT_MAX;
    const ev = tickWorld(w, STEP, 0, 0);
    for (let n = 0; n < ev.wolvesSpawned; n++) {
      const fresh = w.wolves[w.wolves.length - 1 - n];
      spawnRadii.push(Math.hypot(fresh.x, fresh.z));
    }
  }

  assert.ok(spawnRadii.length >= 3, 'not enough wolves spawned to measure');
  for (const r of spawnRadii) {
    assert.ok(r > RING_MAX, `a wolf spawned at radius ${r.toFixed(1)}, inside the thawed ground`);
    assert.ok(r > GATE_RING_RADIUS - WOLF_SPAWN_SPREAD - 1e-9,
      'a wolf spawned well inside the treeline');
  }
});
