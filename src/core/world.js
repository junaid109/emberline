// src/core/world.js
//
// The whole simulation, with zero rendering dependency. This module owns all
// mutable world state and — critically — the ORDER the systems run in, which
// is the part that was previously trapped inside the frame loop and therefore
// untestable. Nothing here imports from src/render, src/input, or src/ui, and
// nothing here touches THREE, the DOM, or the clock.
//
// The renderer's job is reduced to: call tickWorld(), then copy the resulting
// numbers onto meshes.
import {
  PLAYER_SPEED, WORLD_RADIUS, WORLD_EDGE_MARGIN,
  HEAT_START, HEAT_DRAIN_DAY, HEAT_PER_WOOD, CARRY_CAP, HARVEST_RANGE,
  NODE_COUNT, NODE_RING_BASE, NODE_RING_STEP, NODE_AMOUNT, PAD_RADIUS,
  MAX_FRAME_DT, HEAT_DRAIN_NIGHT_MULT, WOLVES_FIRST_NIGHT, WOLVES_PER_NIGHT,
  WOLF_SPAWN_INTERVAL, GATE_RING_RADIUS, WOLF_SPAWN_SPREAD,
} from './constants.js';
import { drainHeat, addFuel } from './heat.js';
import { createNode, tickHarvest, tickRegrow } from './nodes.js';
import { createCarry, carryAdd, carryTotal, carryIsFull } from './carry.js';
import { createStore } from './store.js';
import { isOnPad, createDeposit, tickDeposit } from './deposit.js';
import { createCycle, tickCycle, wolvesForNight, gatesForNight } from './cycle.js';
import { createGates, nearestGate, telegraph, telegraphedGates } from './gates.js';
import { createWolf, tickWolves, reapWolves, createSquad, rallySquad, tickSquad } from './threat.js';

/**
 * Places the starting resource nodes on three interleaved rings around the
 * furnace. Returns a plain array; index is the node's stable identity, and
 * the renderer keys its meshes off that same index.
 */
export function spawnNodes(count = NODE_COUNT) {
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const r = NODE_RING_BASE + (i % 3) * NODE_RING_STEP;
    nodes.push(createNode('wood', Math.cos(a) * r, Math.sin(a) * r, NODE_AMOUNT));
  }
  return nodes;
}

export function createWorld(roll = Math.random) {
  const gates = createGates();
  return {
    roll,
    heat: HEAT_START,
    cycle: createCycle(),
    gates,
    wolves: [],
    // The squad starts at the gate the camera faces, so its first appearance
    // is on screen rather than somewhere the player has to go looking for.
    squad: createSquad(gates[0].x, gates[0].z),
    spawnTimer: 0,
    pendingWolves: 0,
    kills: 0,
    over: null,          // null | 'won' | 'lost'
    player: { x: 0, z: 8, angle: 0 },
    carry: createCarry(CARRY_CAP),
    store: createStore(),
    deposit: createDeposit(),
    nodes: spawnNodes(),
    pad: { x: 0, z: 0, radius: PAD_RADIUS },

    // Reused every frame rather than reallocated. Consumers must read it
    // before the next tickWorld call; nobody retains it across frames.
    events: {
      harvestedKind: null, depletedNode: -1, revivedNodes: [], deposited: null,
      stackChanged: false, onPad: false,
      phaseEntered: null, wolvesSpawned: 0, wolvesKilled: 0, mauled: false,
    },
  };
}

/**
 * Clamps a raw elapsed time to a step the simulation can safely take.
 *
 * This is load-bearing, not defensive hygiene: tickHarvest yields at most one
 * item per call and tickDeposit's loop is only bounded because MAX_FRAME_DT is
 * below both HARVEST_SECONDS and a sane multiple of DEPOSIT_INTERVAL. A
 * backgrounded tab handing us a 12-second step would otherwise empty a node
 * or a full carry stack in a single invisible frame.
 */
export function clampDt(rawSeconds) {
  if (!(rawSeconds > 0)) return 0;          // also catches NaN
  return Math.min(rawSeconds, MAX_FRAME_DT);
}

function movePlayer(player, dirX, dirZ, dt) {
  if (dirX === 0 && dirZ === 0) return;

  player.x += dirX * PLAYER_SPEED * dt;
  player.z += dirZ * PLAYER_SPEED * dt;

  const limit = WORLD_RADIUS - WORLD_EDGE_MARGIN;
  const dist = Math.hypot(player.x, player.z);
  if (dist > limit) {
    const k = limit / dist;
    player.x *= k;
    player.z *= k;
  }

  player.angle = Math.atan2(dirX, dirZ);
}

/**
 * Rally the guard squad to whichever gate is nearest a world point.
 *
 * The renderer resolves a screen tap to a ground position and calls this; the
 * snap-to-nearest-gate is deliberate, so a sloppy thumb on a moving phone still
 * produces the order the player meant.
 */
export function rallyToward(world, x, z) {
  const gate = nearestGate(world.gates, x, z);
  if (!gate) return null;
  rallySquad(world.squad, gate.x, gate.z);
  return gate;
}

/**
 * Wolves spawn just outside a gate, so they walk in through the lane.
 *
 * Spread across the mouth of the gate rather than stacked on one point: every
 * wolf walks a straight line to the same furnace, so identical spawn positions
 * produce a single-file column that reads as a queue instead of a pack. The
 * offset is perpendicular to the approach, so the lane still reads as a lane.
 */
function spawnAtGate(world, gate) {
  const k = (GATE_RING_RADIUS + 3) / GATE_RING_RADIUS;
  const inward = Math.hypot(gate.x, gate.z) || 1;

  // Unit vector perpendicular to the gate's inward direction.
  const perpX = -gate.z / inward;
  const perpZ = gate.x / inward;

  const spread = (world.roll() - 0.5) * 2 * WOLF_SPAWN_SPREAD;
  const depth = world.roll() * WOLF_SPAWN_SPREAD;   // stagger along the approach too

  world.wolves.push(createWolf(
    gate.x * k + perpX * spread - (gate.x / inward) * depth,
    gate.z * k + perpZ * spread - (gate.z / inward) * depth,
  ));
}

/**
 * Runs the phase clock and everything gated on it: the dusk telegraph, the
 * night wolf spawns, and the win check.
 */
function tickNightCycle(world, dt, ev) {
  const entered = tickCycle(world.cycle, dt);
  ev.phaseEntered = entered;

  if (entered === 'won') {
    world.over = 'won';
    return;
  }

  if (entered === 'dusk') {
    // The telegraph is rolled ONCE, at dusk, and the same gates are what
    // actually spawn. If these ever diverge the player is being lied to, and
    // the rally decision becomes a coin flip.
    telegraph(world.gates, gatesForNight(world.cycle.night), world.roll);
    world.pendingWolves = wolvesForNight(world.cycle.night, WOLVES_FIRST_NIGHT, WOLVES_PER_NIGHT);
    world.spawnTimer = 0;
  }

  if (world.cycle.phase === 'night' && world.pendingWolves > 0) {
    world.spawnTimer += dt;
    while (world.spawnTimer >= WOLF_SPAWN_INTERVAL && world.pendingWolves > 0) {
      world.spawnTimer -= WOLF_SPAWN_INTERVAL;
      const lanes = telegraphedGates(world.gates);
      if (lanes.length === 0) break;
      const lane = lanes[world.pendingWolves % lanes.length];
      spawnAtGate(world, lane);
      world.pendingWolves -= 1;
      ev.wolvesSpawned += 1;
    }
  }
}

/**
 * Advances the world by one already-clamped step.
 *
 * System order is deliberate and must not be shuffled:
 *   1. cycle      — sets the phase everything below is conditioned on
 *   2. move       — everything downstream reads the player's final position
 *   3. drain heat — so that (5) can only ever add to a post-drain value
 *   4. regrow     — the forest comes back, then (4b) harvest takes from it
 *   5. deposit    — empties the carry into the store, converting wood to heat
 *   6. threat     — squad kills wolves, surviving wolves chew the furnace
 *
 * Draining before depositing means every consumer of world.heat this frame
 * (ring radius, flame height, HUD) reads one settled number, never a stale
 * pre-drain or pre-deposit snapshot. Threat runs last so that a wolf's damage
 * is applied to the same settled value.
 */
export function tickWorld(world, dt, dirX, dirZ) {
  const ev = world.events;
  ev.harvestedKind = null;
  ev.depletedNode = -1;
  ev.revivedNodes.length = 0;
  ev.deposited = null;
  ev.stackChanged = false;

  ev.phaseEntered = null;
  ev.wolvesSpawned = 0;
  ev.wolvesKilled = 0;
  ev.mauled = false;

  if (world.over) return ev;

  const before = carryTotal(world.carry);

  tickNightCycle(world, dt, ev);

  movePlayer(world.player, dirX, dirZ, dt);

  // Night costs multiples of what day costs. Surviving the dark is what the
  // day's hauling was FOR, and this multiplier is the whole reason it matters.
  const nightly = world.cycle.phase === 'night' ? HEAT_DRAIN_NIGHT_MULT : 1;
  world.heat = drainHeat(world.heat, dt, HEAT_DRAIN_DAY * nightly);

  // Regrowth runs for every node, every frame, including ones the player is
  // standing in. A node the player is actively stripping is regrowing at the
  // same time; harvesting simply outruns it by a wide margin.
  for (let i = 0; i < world.nodes.length; i++) {
    if (tickRegrow(world.nodes[i], dt)) ev.revivedNodes.push(i);
  }

  if (!carryIsFull(world.carry)) {
    for (let i = 0; i < world.nodes.length; i++) {
      const node = world.nodes[i];
      if (node.depleted) continue;

      const dx = node.x - world.player.x;
      const dz = node.z - world.player.z;
      if (dx * dx + dz * dz > HARVEST_RANGE * HARVEST_RANGE) continue;

      const kind = tickHarvest(node, dt);
      if (kind) {
        carryAdd(world.carry, kind);
        ev.harvestedKind = kind;
        if (node.depleted) ev.depletedNode = i;
      }
      break;   // harvest one node at a time, even when several are in range
    }
  }

  ev.onPad = isOnPad(world.player.x, world.player.z, world.pad.x, world.pad.z, world.pad.radius);

  const deposited = tickDeposit(world.deposit, dt, ev.onPad, world.carry, world.store);
  if (deposited) {
    ev.deposited = deposited;
    for (const kind of deposited) {
      if (kind === 'wood') world.heat = addFuel(world.heat, HEAT_PER_WOOD);
    }
  }

  ev.wolvesKilled = tickSquad(world.squad, dt, world.wolves);
  world.kills += ev.wolvesKilled;
  reapWolves(world.wolves);

  const mauling = tickWolves(world.wolves, dt, world.pad.x, world.pad.z);
  if (mauling > 0) {
    ev.mauled = true;
    world.heat = drainHeat(world.heat, 1, mauling);   // mauling is already dt-scaled
  }

  if (world.heat <= 0) world.over = 'lost';

  ev.stackChanged = carryTotal(world.carry) !== before;
  return ev;
}
