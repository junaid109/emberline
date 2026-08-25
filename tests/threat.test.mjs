import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGates, nearestGate, telegraph, telegraphedGates } from '../src/core/gates.js';
import {
  createWolf, tickWolves, reapWolves,
  createSquad, rallySquad, squadArrived, tickSquad,
} from '../src/core/threat.js';
import {
  GATE_COUNT, GATE_RING_RADIUS, RING_MAX, WORLD_RADIUS,
  WOLF_SPEED, WOLF_HP, WOLF_ATTACK_RADIUS, WOLF_HEAT_DAMAGE,
  SQUAD_SPEED, SQUAD_RANGE, SQUAD_DPS, PLAYER_SPEED, MAX_FRAME_DT,
} from '../src/core/constants.js';

const STEP = MAX_FRAME_DT;

// --- gates -----------------------------------------------------------------

test('gates are evenly spaced on a ring outside the maximum thawed area', () => {
  const gates = createGates();
  assert.equal(gates.length, GATE_COUNT);
  for (const g of gates) {
    const r = Math.hypot(g.x, g.z);
    assert.ok(Math.abs(r - GATE_RING_RADIUS) < 1e-9);
    assert.ok(r > RING_MAX, 'a gate inside the heat ring would never feel like a frontier');
    assert.ok(r < WORLD_RADIUS, 'the player must be able to reach a gate');
  }
});

test('gate 0 sits at the top of the screen, where the camera looks', () => {
  const [g0] = createGates();
  assert.ok(Math.abs(g0.x) < 1e-9);
  assert.ok(g0.z < 0);
});

test('gates are mutually distant, so a tap can never be ambiguous', () => {
  const gates = createGates();
  for (let i = 0; i < gates.length; i++) {
    for (let j = i + 1; j < gates.length; j++) {
      assert.ok(Math.hypot(gates[i].x - gates[j].x, gates[i].z - gates[j].z) > SQUAD_RANGE * 2);
    }
  }
});

test('nearestGate resolves a tap to the gate it is closest to', () => {
  const gates = createGates();
  for (const g of gates) {
    assert.equal(nearestGate(gates, g.x + 0.4, g.z - 0.3).index, g.index);
  }
});

test('nearestGate still answers for a tap at the exact centre', () => {
  const gates = createGates();
  assert.ok(nearestGate(gates, 0, 0) !== null);
});

test('telegraph marks exactly the requested number of distinct gates', () => {
  for (const n of [1, 2, 3]) {
    const gates = createGates();
    const picked = telegraph(gates, n, () => 0.5);
    assert.equal(picked.length, n);
    assert.equal(new Set(picked).size, n, 'the same gate must not be picked twice');
    assert.equal(telegraphedGates(gates).length, n);
  }
});

test('telegraph clears the previous night before marking the new one', () => {
  const gates = createGates();
  telegraph(gates, 3, () => 0);
  telegraph(gates, 1, () => 0);
  assert.equal(telegraphedGates(gates).length, 1);
});

test('telegraph never asks for more gates than exist', () => {
  const gates = createGates();
  assert.equal(telegraph(gates, 99, () => 0.99).length, GATE_COUNT);
});

test('a roll of exactly 1 does not index off the end', () => {
  const gates = createGates();
  const picked = telegraph(gates, 2, () => 1);
  assert.equal(picked.length, 2);
  for (const i of picked) assert.ok(i >= 0 && i < GATE_COUNT);
});

// --- wolves ----------------------------------------------------------------

test('a wolf walks toward the furnace at WOLF_SPEED', () => {
  const w = createWolf(20, 0);
  tickWolves([w], 1, 0, 0);
  assert.ok(Math.abs(w.x - (20 - WOLF_SPEED)) < 1e-9);
});

test('wolves are slower than the player, so a haul is always escapable', () => {
  assert.ok(WOLF_SPEED < PLAYER_SPEED);
});

test('a wolf stops at the furnace instead of overshooting through it', () => {
  const w = createWolf(WOLF_ATTACK_RADIUS + 0.1, 0);
  for (let i = 0; i < 200; i++) tickWolves([w], STEP, 0, 0);
  // It may step at most one frame's travel inside the radius before stopping,
  // but it must never walk on through the fire and out the other side.
  const floor = WOLF_ATTACK_RADIUS - WOLF_SPEED * STEP - 1e-9;
  assert.ok(Math.hypot(w.x, w.z) >= floor, 'a wolf walked into the middle of the furnace');
  assert.equal(w.atFurnace, true);
});

test('a wolf at the furnace deals WOLF_HEAT_DAMAGE per second', () => {
  const w = createWolf(0.5, 0);
  const dmg = tickWolves([w], 1, 0, 0);
  assert.ok(Math.abs(dmg - WOLF_HEAT_DAMAGE) < 1e-9);
});

test('a wolf still walking in deals no damage', () => {
  const w = createWolf(20, 0);
  assert.equal(tickWolves([w], 1, 0, 0), 0);
});

test('damage scales with the size of the pack that got through', () => {
  const pack = [createWolf(0.5, 0), createWolf(0, 0.5), createWolf(0.4, 0.4)];
  const dmg = tickWolves(pack, 1, 0, 0);
  assert.ok(Math.abs(dmg - 3 * WOLF_HEAT_DAMAGE) < 1e-9);
});

test('dead wolves neither move nor bite', () => {
  const dead = createWolf(0.5, 0, 0);
  assert.equal(tickWolves([dead], 1, 0, 0), 0);
  assert.equal(dead.x, 0.5);
});

test('reapWolves removes only the dead and keeps array identity', () => {
  const wolves = [createWolf(1, 0), createWolf(2, 0, 0), createWolf(3, 0)];
  const ref = wolves;
  assert.equal(reapWolves(wolves), 1);
  assert.equal(wolves, ref);
  assert.equal(wolves.length, 2);
  assert.deepEqual(wolves.map((w) => w.x), [1, 3]);
});

// --- squad -----------------------------------------------------------------

test('the squad walks to its rally point and stops there', () => {
  const s = createSquad(0, 0);
  rallySquad(s, 10, 0);
  for (let i = 0; i < 500; i++) tickSquad(s, STEP, []);
  assert.ok(squadArrived(s));
  assert.ok(Math.abs(s.x - 10) < 1e-6);
});

test('rallying costs travel time, which is what makes a wrong call hurt', () => {
  const gates = createGates();
  const s = createSquad(gates[0].x, gates[0].z);
  rallySquad(s, gates[1].x, gates[1].z);

  let ticks = 0;
  while (!squadArrived(s) && ticks < 100000) { tickSquad(s, STEP, []); ticks++; }
  const seconds = ticks * STEP;
  const expected = Math.hypot(gates[1].x - gates[0].x, gates[1].z - gates[0].z) / SQUAD_SPEED;
  assert.ok(Math.abs(seconds - expected) < 0.2, `took ${seconds.toFixed(2)}s, expected ~${expected.toFixed(2)}s`);
  assert.ok(seconds > 3, 'crossing the map should be a real commitment, not instant');
});

test('the squad damages every wolf inside SQUAD_RANGE', () => {
  const s = createSquad(0, 0);
  const near = createWolf(SQUAD_RANGE - 0.1, 0);
  tickSquad(s, 1, [near]);
  assert.ok(near.hp < WOLF_HP);
  assert.equal(s.engaging, true);
});

test('the squad cannot touch a wolf outside its range', () => {
  const s = createSquad(0, 0);
  const far = createWolf(SQUAD_RANGE + 0.5, 0);
  tickSquad(s, 1, [far]);
  assert.equal(far.hp, WOLF_HP);
  assert.equal(s.engaging, false);
});

test('damage is split across the pack, so numbers overwhelm one squad', () => {
  const solo = createWolf(1, 0);
  tickSquad(createSquad(0, 0), 1, [solo]);
  const soloDamage = WOLF_HP - solo.hp;

  const pack = [createWolf(1, 0), createWolf(1.2, 0), createWolf(0.8, 0)];
  tickSquad(createSquad(0, 0), 1, pack);
  const eachDamage = WOLF_HP - pack[0].hp;

  assert.ok(Math.abs(soloDamage - SQUAD_DPS) < 1e-9);
  assert.ok(Math.abs(eachDamage - SQUAD_DPS / 3) < 1e-9);
  assert.ok(eachDamage < soloDamage);
});

test('the squad reports kills exactly once', () => {
  const s = createSquad(0, 0);
  const w = createWolf(1, 0);
  let killed = 0;
  for (let i = 0; i < 400; i++) killed += tickSquad(s, STEP, [w]);
  assert.equal(killed, 1, 'a dead wolf must not be re-counted every tick');
});

test('a wolf held at range by the squad dies before it can reach the fire', () => {
  // The squad standing on its gate must actually beat a single wolf coming down
  // that lane -- otherwise rallying correctly still loses, and the decision the
  // whole night is built around means nothing.
  const gates = createGates();
  const gate = gates[0];
  const s = createSquad(gate.x, gate.z);
  const k = (GATE_RING_RADIUS + 3) / GATE_RING_RADIUS;
  const wolves = [createWolf(gate.x * k, gate.z * k)];

  let heatLost = 0;
  for (let i = 0; i < 4000 && wolves.length > 0; i++) {
    tickSquad(s, STEP, wolves);
    reapWolves(wolves);
    heatLost += tickWolves(wolves, STEP, 0, 0);
  }
  assert.equal(wolves.length, 0, 'the squad never killed the wolf');
  assert.equal(heatLost, 0, 'the wolf reached the furnace despite a correct rally');
});
