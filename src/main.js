// src/main.js
/* global THREE */
import { createScene } from './render/scene.js';
import { createPlayer, createTree, updateStack, createFurnace } from './render/actors.js';
import { createGround } from './render/ground.js';
import { createJoystick } from './input/joystick.js';
import { ringRadius, drainHeat, addFuel } from './core/heat.js';
import { createNode, tickHarvest } from './core/nodes.js';
import { createCarry, carryAdd, carryTotal, carryIsFull } from './core/carry.js';
import { createStore } from './core/store.js';
import { isOnPad, createDeposit, tickDeposit } from './core/deposit.js';
import { createHud } from './ui/hud.js';
import {
  PLAYER_SPEED, WORLD_RADIUS, WORLD_EDGE_MARGIN, CAMERA_HEIGHT, CAMERA_DISTANCE,
  HEAT_START, HEAT_DRAIN_DAY, HEAT_PER_WOOD, CARRY_CAP, HARVEST_RANGE, HEAT_MAX,
  NODE_COUNT, NODE_RING_BASE, NODE_RING_STEP, NODE_AMOUNT,
} from './core/constants.js';

const view = createScene(document.getElementById('game'));
const stick = createJoystick(document.getElementById('game'));

const groundView = createGround(view.scene);

const state = { heat: HEAT_START };

const player = createPlayer();
view.scene.add(player);

const carry = createCarry(CARRY_CAP);
const nodes = [];

for (let i = 0; i < NODE_COUNT; i++) {
  const a = (i / NODE_COUNT) * Math.PI * 2;
  const r = NODE_RING_BASE + (i % 3) * NODE_RING_STEP;
  const node = createNode('wood', Math.cos(a) * r, Math.sin(a) * r, NODE_AMOUNT);
  node.mesh = createTree(node.x, node.z);
  view.scene.add(node.mesh);
  nodes.push(node);
}

const furnace = createFurnace();
view.scene.add(furnace);

const store = createStore();
const hud = createHud(document.getElementById('ui'));

const deposit = createDeposit();
let lastStackCount = 0;

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);  // clamp: a backgrounded tab must not produce a huge step
  last = now;

  const { x, y } = stick.dir;
  if (x !== 0 || y !== 0) {
    player.position.x += x * PLAYER_SPEED * dt;
    player.position.z += y * PLAYER_SPEED * dt;
    const limit = WORLD_RADIUS - WORLD_EDGE_MARGIN;
    if (player.position.length() > limit) player.position.setLength(limit);
    player.rotation.y = Math.atan2(x, y);
  }

  view.camera.position.set(player.position.x, CAMERA_HEIGHT, player.position.z + CAMERA_DISTANCE);
  view.camera.lookAt(player.position.x, 0, player.position.z);

  // All heat mutation (drain, then deposit fuel) happens first, so every
  // consumer below — ring radius, flame, HUD — reads the same final value
  // for this frame instead of a stale pre-deposit or pre-drain snapshot.
  state.heat = drainHeat(state.heat, dt, HEAT_DRAIN_DAY);

  if (!carryIsFull(carry)) {
    for (const node of nodes) {
      if (node.depleted) continue;
      const dx = node.x - player.position.x;
      const dz = node.z - player.position.z;
      if (dx * dx + dz * dz > HARVEST_RANGE * HARVEST_RANGE) continue;

      const kind = tickHarvest(node, dt);
      if (kind) {
        carryAdd(carry, kind);
        if (node.depleted) node.mesh.visible = false;
      }
      break;   // harvest one node at a time
    }
  }

  if (carryTotal(carry) !== lastStackCount) {
    updateStack(player.userData.stackAnchor, carry.items);
    lastStackCount = carryTotal(carry);
  }

  const onPad = isOnPad(player.position.x, player.position.z, furnace.position.x, furnace.position.z, furnace.userData.padRadius);

  const depositedKinds = tickDeposit(deposit, dt, onPad, carry, store);
  if (depositedKinds) {
    for (const kind of depositedKinds) {
      if (kind === 'wood') state.heat = addFuel(state.heat, HEAT_PER_WOOD);
    }
  }

  groundView.setRingRadius(ringRadius(state.heat));
  furnace.userData.setFlame(state.heat / HEAT_MAX);
  hud.update(store, state.heat);

  view.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
