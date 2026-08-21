// src/main.js
/* global THREE */
import { createScene } from './render/scene.js';
import { createPlayer, createTree, updateStack, createFurnace } from './render/actors.js';
import { createGround } from './render/ground.js';
import { createJoystick } from './input/joystick.js';
import { ringRadius, drainHeat, addFuel } from './core/heat.js';
import { createNode, tickHarvest } from './core/nodes.js';
import { createCarry, carryAdd, carryTotal, carryIsFull, carryPop } from './core/carry.js';
import { createStore, storeAdd } from './core/store.js';
import { createHud } from './ui/hud.js';
import { PLAYER_SPEED, WORLD_RADIUS, CAMERA_HEIGHT, CAMERA_DISTANCE, HEAT_START, HEAT_DRAIN_DAY, CARRY_CAP, HARVEST_RANGE, DEPOSIT_INTERVAL, HEAT_MAX } from './core/constants.js';

const view = createScene(document.getElementById('game'));
const stick = createJoystick(document.getElementById('game'));

const groundView = createGround(view.scene);

const state = { heat: HEAT_START };

const player = createPlayer();
view.scene.add(player);

const carry = createCarry(CARRY_CAP);
const nodes = [];

for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2;
  const r = 14 + (i % 3) * 4;
  const node = createNode('wood', Math.cos(a) * r, Math.sin(a) * r, 6);
  node.mesh = createTree(node.x, node.z);
  view.scene.add(node.mesh);
  nodes.push(node);
}

const furnace = createFurnace();
view.scene.add(furnace);

const store = createStore();
const hud = createHud(document.getElementById('ui'));

let depositTimer = 0;
let lastStackCount = 0;

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);  // clamp: a backgrounded tab must not produce a huge step
  last = now;

  const { x, y } = stick.dir;
  if (x !== 0 || y !== 0) {
    player.position.x += x * PLAYER_SPEED * dt;
    player.position.z += y * PLAYER_SPEED * dt;
    const limit = WORLD_RADIUS - 1;
    if (player.position.length() > limit) player.position.setLength(limit);
    player.rotation.y = Math.atan2(x, y);
  }

  view.camera.position.set(player.position.x, CAMERA_HEIGHT, player.position.z + CAMERA_DISTANCE);
  view.camera.lookAt(player.position.x, 0, player.position.z);

  state.heat = drainHeat(state.heat, dt, HEAT_DRAIN_DAY);
  groundView.setRingRadius(ringRadius(state.heat));

  if (!carryIsFull(carry)) {
    for (const node of nodes) {
      if (node.depleted) continue;
      const dx = node.x - player.position.x;
      const dz = node.z - player.position.z;
      if (dx * dx + dz * dz > HARVEST_RANGE * HARVEST_RANGE) continue;

      const { yielded, kind } = tickHarvest(node, dt);
      if (yielded) {
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

  const pdx = player.position.x - furnace.position.x;
  const pdz = player.position.z - furnace.position.z;
  const onPad = pdx * pdx + pdz * pdz <= furnace.userData.padRadius ** 2;

  if (onPad && carryTotal(carry) > 0) {
    depositTimer += dt;
    while (depositTimer >= DEPOSIT_INTERVAL && carryTotal(carry) > 0) {
      depositTimer -= DEPOSIT_INTERVAL;
      const kind = carryPop(carry);
      storeAdd(store, kind, 1);
      if (kind === 'wood') state.heat = addFuel(state.heat, 6);
    }
  } else {
    depositTimer = 0;
  }

  furnace.userData.setFlame(state.heat / HEAT_MAX);
  hud.update(store, state.heat);

  view.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
