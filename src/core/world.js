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
  MAX_FRAME_DT,
} from './constants.js';
import { drainHeat, addFuel } from './heat.js';
import { createNode, tickHarvest } from './nodes.js';
import { createCarry, carryAdd, carryTotal, carryIsFull } from './carry.js';
import { createStore } from './store.js';
import { isOnPad, createDeposit, tickDeposit } from './deposit.js';

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

export function createWorld() {
  return {
    heat: HEAT_START,
    player: { x: 0, z: 8, angle: 0 },
    carry: createCarry(CARRY_CAP),
    store: createStore(),
    deposit: createDeposit(),
    nodes: spawnNodes(),
    pad: { x: 0, z: 0, radius: PAD_RADIUS },

    // Reused every frame rather than reallocated. Consumers must read it
    // before the next tickWorld call; nobody retains it across frames.
    events: { harvestedKind: null, depletedNode: -1, deposited: null, stackChanged: false, onPad: false },
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
 * Advances the world by one already-clamped step.
 *
 * System order is deliberate and must not be shuffled:
 *   1. move       — everything downstream reads the player's final position
 *   2. drain heat — so that (4) can only ever add to a post-drain value
 *   3. harvest    — fills the carry
 *   4. deposit    — empties the carry into the store, converting wood to heat
 *
 * Draining before depositing means every consumer of world.heat this frame
 * (ring radius, flame height, HUD) reads one settled number, never a stale
 * pre-drain or pre-deposit snapshot.
 */
export function tickWorld(world, dt, dirX, dirZ) {
  const ev = world.events;
  ev.harvestedKind = null;
  ev.depletedNode = -1;
  ev.deposited = null;
  ev.stackChanged = false;

  const before = carryTotal(world.carry);

  movePlayer(world.player, dirX, dirZ, dt);

  world.heat = drainHeat(world.heat, dt, HEAT_DRAIN_DAY);

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

  ev.stackChanged = carryTotal(world.carry) !== before;
  return ev;
}
