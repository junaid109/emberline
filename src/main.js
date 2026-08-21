// src/main.js
/* global THREE */
import { createScene } from './render/scene.js';
import { createPlayer } from './render/actors.js';
import { createJoystick } from './input/joystick.js';
import { PLAYER_SPEED, WORLD_RADIUS, CAMERA_HEIGHT, CAMERA_DISTANCE } from './core/constants.js';

const view = createScene(document.getElementById('game'));
const stick = createJoystick(document.getElementById('game'));

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(WORLD_RADIUS, 48),
  new THREE.MeshLambertMaterial({ color: 0xe8eef4 })
);
ground.rotation.x = -Math.PI / 2;
view.scene.add(ground);

const player = createPlayer();
view.scene.add(player);

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

  view.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
