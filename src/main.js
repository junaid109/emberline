// src/main.js
//
// Bootstrap and render loop. This file owns no game rules: it builds the
// scene, hands the joystick direction to tickWorld(), and copies the resulting
// numbers onto meshes. Everything that decides what happens lives in
// src/core/world.js, where it can be tested without a browser.
/* global THREE */
import { createScene } from './render/scene.js';
import { createPlayer, createTree, updateStack, createFurnace } from './render/actors.js';
import { createGround } from './render/ground.js';
import { createJoystick } from './input/joystick.js';
import { ringRadius } from './core/heat.js';
import { createWorld, tickWorld, clampDt } from './core/world.js';
import { createHud } from './ui/hud.js';
import { CAMERA_HEIGHT, CAMERA_DISTANCE, HEAT_MAX } from './core/constants.js';

const view = createScene(document.getElementById('game'));
const stick = createJoystick(document.getElementById('game'));
const hud = createHud(document.getElementById('ui'));
const groundView = createGround(view.scene);

const world = createWorld();

const player = createPlayer();
player.position.set(world.player.x, 0, world.player.z);
view.scene.add(player);

// Node meshes are keyed by the same index as world.nodes, so an event carrying
// a node index is all the renderer needs to find the mesh to hide.
const nodeMeshes = world.nodes.map((node) => {
  const mesh = createTree(node.x, node.z);
  view.scene.add(mesh);
  return mesh;
});

const furnace = createFurnace();
furnace.position.set(world.pad.x, 0, world.pad.z);
view.scene.add(furnace);

let last = performance.now();
function frame(now) {
  const dt = clampDt((now - last) / 1000);
  last = now;

  const ev = tickWorld(world, dt, stick.dir.x, stick.dir.y);

  player.position.x = world.player.x;
  player.position.z = world.player.z;
  player.rotation.y = world.player.angle;

  view.camera.position.set(world.player.x, CAMERA_HEIGHT, world.player.z + CAMERA_DISTANCE);
  view.camera.lookAt(world.player.x, 0, world.player.z);

  if (ev.depletedNode !== -1) nodeMeshes[ev.depletedNode].visible = false;
  if (ev.stackChanged) updateStack(player.userData.stackAnchor, world.carry.items);

  groundView.setRingRadius(ringRadius(world.heat));
  furnace.userData.setFlame(world.heat / HEAT_MAX);
  hud.update(world.store, world.heat);

  view.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
