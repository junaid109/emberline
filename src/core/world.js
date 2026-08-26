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
  FROZEN_SPEED_MULT, HEAT_PER_COAL, WORLDGEN_SEED, SQUAD_FED_DPS_MULT, CACHE_WOOD,
} from './constants.js';
import { drainHeat, addFuel, ringRadius } from './heat.js';
import { tickHarvest, tickRegrow } from './nodes.js';
import { generateWorld, pushOutOfBoulders } from './worldgen.js';
import { createCarry, carryAdd, carryTotal, carryIsFull } from './carry.js';
import { createStore } from './store.js';
import { isOnPad, createDeposit, tickDeposit } from './deposit.js';
import { createCycle, tickCycle, wolvesForNight, gatesForNight } from './cycle.js';
import { createGates, nearestGate, telegraph, telegraphedGates } from './gates.js';
import { createWolf, tickWolves, reapWolves, createSquad, rallySquad, tickSquad } from './threat.js';
import { createHares, tickHares } from './wildlife.js';
import { createWeather, rollEvent, drainMultiplier, cacheSite } from './weather.js';

/**
 * Places one run's harvestables. Kept as a named export because the renderer
 * and several tests reach for it directly.
 *
 * @deprecated by generateWorld — retained so the old shape still resolves.
 */
export function spawnNodes(seed = WORLDGEN_SEED) {
  return generateWorld(seed).nodes;
}

/**
 * @param {() => number} roll  injected RNG for the telegraph, so tests can pin it
 * @param {number} seed        the run's world layout; play passes a live value
 */
export function createWorld(roll = Math.random, seed = WORLDGEN_SEED) {
  const gates = createGates();
  const { nodes, boulders } = generateWorld(seed, gates);

  // Day one is rolled here rather than on the first tick. It is always calm, so
  // this settles it once and lets the per-day roll fire only on real phase
  // transitions.
  const weather = createWeather(seed);
  rollEvent(weather, 1);

  return {
    seed,
    boulders,
    hares: createHares(roll),
    weather,
    cache: null,             // a supply drop, while one is on the ground
    squadFed: false,         // the squad ate at dusk, so it fights harder tonight
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
    nodes,
    pad: { x: 0, z: 0, radius: PAD_RADIUS },

    // Reused every frame rather than reallocated. Consumers must read it
    // before the next tickWorld call; nobody retains it across frames.
    events: {
      harvestedKind: null, depletedNode: -1, revivedNodes: [], deposited: null,
      stackChanged: false, onPad: false, onFrozen: false,
      phaseEntered: null, wolvesSpawned: 0, wolvesKilled: 0, mauled: false,
      hareCaught: 0, eventRolled: null, cacheTaken: false,
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

/**
 * Moves the player, at a speed set by the ground underfoot.
 *
 * Thawed ground is fast; the frozen waste beyond the ring is deep snow. This is
 * the one place the heat number touches movement, and it is what makes stoking
 * the fire a way of reaching further rather than only a way of not dying.
 *
 * @returns {boolean} whether the player is standing on frozen ground
 */
function movePlayer(player, dirX, dirZ, dt, thawedRadius, boulders) {
  const frozen = Math.hypot(player.x, player.z) > thawedRadius;
  if (dirX === 0 && dirZ === 0) return frozen;

  const speed = PLAYER_SPEED * (frozen ? FROZEN_SPEED_MULT : 1);
  player.x += dirX * speed * dt;
  player.z += dirZ * speed * dt;

  const limit = WORLD_RADIUS - WORLD_EDGE_MARGIN;
  const dist = Math.hypot(player.x, player.z);
  if (dist > limit) {
    const k = limit / dist;
    player.x *= k;
    player.z *= k;
  }

  // Boulders are resolved after the world edge, so being pushed out of a rock
  // can never be what puts the player outside the world.
  pushOutOfBoulders(player, boulders);

  player.angle = Math.atan2(dirX, dirZ);
  return frozen;
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

  // A new day: roll its weather, and drop a cache if the roll called for one.
  // Day one is settled in createWorld, so this only ever fires on a REAL
  // transition — an in-tick bootstrap clause here would re-roll on the first
  // frame of every run and quietly overwrite whatever state it found.
  if (entered === 'day') {
    ev.eventRolled = rollEvent(world.weather, world.cycle.night);
    world.cache = cacheSite(world.weather, world.roll);
  }

  if (entered === 'dusk') {
    // The squad eats. Automatic on purpose: no button and no inventory screen —
    // the player's only decision was whether to spend daylight catching a hare.
    world.squadFed = world.store.meat > 0;
    if (world.squadFed) world.store.meat -= 1;

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
 *   2. move       — at a speed set by the heat ring; everything downstream
 *                  reads the player's final position
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
  ev.hareCaught = 0;
  ev.eventRolled = null;
  ev.cacheTaken = false;
  ev.wolvesSpawned = 0;
  ev.wolvesKilled = 0;
  ev.mauled = false;

  if (world.over) return ev;

  const before = carryTotal(world.carry);

  tickNightCycle(world, dt, ev);

  // Read the ring BEFORE this frame's drain, so the ground the player felt
  // underfoot is the same ground that was drawn for them last frame.
  ev.onFrozen = movePlayer(world.player, dirX, dirZ, dt, ringRadius(world.heat), world.boulders);

  // Night costs multiples of what day costs. Surviving the dark is what the
  // day's hauling was FOR, and this multiplier is the whole reason it matters.
  const nightly = world.cycle.phase === 'night' ? HEAT_DRAIN_NIGHT_MULT : 1;
  world.heat = drainHeat(world.heat, dt, HEAT_DRAIN_DAY * nightly * drainMultiplier(world.weather));

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

  ev.hareCaught = tickHares(world.hares, dt, world.player, world.roll);
  for (let i = 0; i < ev.hareCaught; i++) carryAdd(world.carry, 'meat');

  // A cache is walked into rather than harvested: it is a windfall, and making
  // the player stand and chop it would turn a gift into an errand.
  if (world.cache) {
    const reach = Math.hypot(world.cache.x - world.player.x, world.cache.z - world.player.z);
    if (reach <= 2.0) {
      for (let i = 0; i < world.cache.amount && !carryIsFull(world.carry); i++) {
        carryAdd(world.carry, 'wood');
      }
      world.cache = null;
      ev.cacheTaken = true;
    }
  }

  ev.onPad = isOnPad(world.player.x, world.player.z, world.pad.x, world.pad.z, world.pad.radius);

  const deposited = tickDeposit(world.deposit, dt, ev.onPad, world.carry, world.store);
  if (deposited) {
    ev.deposited = deposited;
    for (const kind of deposited) {
      if (kind === 'wood') world.heat = addFuel(world.heat, HEAT_PER_WOOD);
      // Coal burns far hotter than wood, which is what pays for the slow walk
      // out onto frozen ground to fetch it.
      if (kind === 'coal') world.heat = addFuel(world.heat, HEAT_PER_COAL);
    }
  }

  // A fed squad fights harder, and only for the night it ate before.
  const bite = world.squadFed && world.cycle.phase === 'night' ? SQUAD_FED_DPS_MULT : 1;
  ev.wolvesKilled = tickSquad(world.squad, dt, world.wolves, bite);
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
