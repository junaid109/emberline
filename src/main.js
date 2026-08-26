// src/main.js
//
// Bootstrap and render loop. This file owns no game rules: it builds the
// scene, hands input to tickWorld(), and copies the resulting numbers onto
// meshes. Everything that decides what happens lives in src/core/world.js,
// where it can be tested without a browser.
/* global THREE */
import { createScene } from './render/scene.js';
import {
  createPlayer, createTree, updateStack, createFurnace,
  createWolfMesh, createSquadMesh, createGateMesh,
} from './render/actors.js';
import { createGround } from './render/ground.js';
import { createScenery } from './render/scenery.js';
import { createGroundPicker } from './render/pick.js';
import { syncPool, faceToward } from './render/sync.js';
import { createJoystick } from './input/joystick.js';
import { createTapper } from './input/tap.js';
import { ringRadius } from './core/heat.js';
import { createWorld, tickWorld, clampDt, rallyToward } from './core/world.js';
import { scatterScenery } from './core/scatter.js';
import { phaseRemaining, phaseProgress } from './core/cycle.js';
import { createHud } from './ui/hud.js';
import { createTitle } from './ui/title.js';
import { createIgnition, tickIgnition } from './core/ignition.js';
import { CAMERA_HEIGHT, CAMERA_DISTANCE, HEAT_MAX } from './core/constants.js';

const canvas = document.getElementById('game');
const view = createScene(canvas);
const stick = createJoystick(canvas);
const hud = createHud(document.getElementById('ui'));
const groundView = createGround(view.scene);
const pickGround = createGroundPicker(view.camera, canvas);

let world = createWorld();

const player = createPlayer();
view.scene.add(player);

// Node meshes are keyed by the same index as world.nodes, so an event carrying
// a node index is all the renderer needs to find the mesh to hide.
let nodeMeshes = [];
let gateMeshes = [];

// Wolves come and go every night. Meshes are pooled rather than created and
// destroyed per wolf: allocating GPU resources during a wave would stutter on
// exactly the frames already doing the most work.
const wolfPool = [];

const furnace = createFurnace();
view.scene.add(furnace);

const squadMesh = createSquadMesh();
view.scene.add(squadMesh);

let sceneryBuilt = false;

function buildWorldMeshes() {
  for (const m of nodeMeshes) view.scene.remove(m);
  for (const m of gateMeshes) view.scene.remove(m);

  nodeMeshes = world.nodes.map((node) => {
    const mesh = createTree(node.x, node.z);
    view.scene.add(mesh);
    return mesh;
  });

  gateMeshes = world.gates.map((gate) => {
    const mesh = createGateMesh(gate.x, gate.z);
    view.scene.add(mesh);
    return mesh;
  });

  // The landscape is deterministic and identical every run, so it is built
  // once and simply left alone across restarts.
  if (!sceneryBuilt) {
    createScenery(view.scene, scatterScenery(world.gates, world.nodes));
    sceneryBuilt = true;
  }

  player.position.set(world.player.x, 0, world.player.z);
  furnace.position.set(world.pad.x, 0, world.pad.z);
  squadMesh.position.set(world.squad.x, 0, world.squad.z);
  updateStack(player.userData.stackAnchor, world.carry.items);
}
buildWorldMeshes();

/** Builds one wolf mesh and puts it in the scene. Called only when the pool grows. */
function spawnWolfMesh() {
  const mesh = createWolfMesh();
  view.scene.add(mesh);
  return mesh;
}

createTapper(canvas, (x, y) => {
  if (world.over) return;
  const point = pickGround(x, y);
  if (point) rallyToward(world, point.x, point.z);
});

hud.onRestart(() => {
  world = createWorld();
  buildWorldMeshes();
});

/**
 * How dark it is right now, 0 to 1.
 *
 * Dusk and dawn ramp rather than cut, so the player sees the light going and
 * has time to act on it. A hard switch would make the telegraph feel like a
 * penalty rather than a warning.
 */
function darkness(cycle) {
  const t = phaseProgress(cycle);
  switch (cycle.phase) {
    case 'dusk': return t;
    case 'night': return 1;
    case 'dawn': return 1 - t;
    default: return 0;
  }
}

// The title card holds the run back until the player lights the furnace. The
// scene behind it is the real one, already built and already rendering, so the
// backdrop costs a camera transform and nothing else.
const title = createTitle(document.getElementById('ui'));
const ignition = createIgnition();
let started = false;

/**
 * Slowly orbits the camp while the title card is up, and swings home as the
 * hold completes.
 *
 * A frozen frame would read as a screenshot, and a screenshot of a 3D game is
 * the one thing that makes a player wonder whether it is running at all.
 *
 * The settle term is why the orbit is not free: at the moment the fire catches
 * the camera could otherwise be anywhere on its circle, and play would open on
 * a jump cut of up to half a turn. Scaling the angle by (1 - settle) lands it
 * at exactly the play position on the frame ignition completes, so holding the
 * screen visibly brings the camera to rest behind the player.
 *
 * @param {number} settle 0 while idling, 1 the instant the fire catches
 */
function orbitCamera(now, settle) {
  const angle = now * 0.00007 * (1 - settle);
  const z = world.player.z * settle;          // the play camera looks at the player, not the origin
  view.camera.position.set(
    Math.sin(angle) * CAMERA_DISTANCE,
    CAMERA_HEIGHT,
    Math.cos(angle) * CAMERA_DISTANCE + z
  );
  view.camera.lookAt(0, 0, z);
}

let last = performance.now();
function frame(now) {
  const dt = clampDt((now - last) / 1000);
  last = now;

  if (!started) {
    if (tickIgnition(ignition, dt, title.held)) {
      started = true;
      title.dismiss();
      hud.setVisible(true);
    }
    title.setProgress(ignition.progress);

    // The furnace flame tracks the hold, so the fire the player is lighting is
    // visibly the fire in the scene rather than an unrelated progress bar.
    furnace.userData.setFlame(ignition.progress);
    groundView.setRingRadius(ringRadius(ignition.progress * world.heat));
    orbitCamera(now, ignition.progress);

    view.render();
    requestAnimationFrame(frame);
    return;
  }

  const ev = tickWorld(world, dt, stick.dir.x, stick.dir.y);

  player.position.x = world.player.x;
  player.position.z = world.player.z;
  player.rotation.y = world.player.angle;

  view.camera.position.set(world.player.x, CAMERA_HEIGHT, world.player.z + CAMERA_DISTANCE);
  view.camera.lookAt(world.player.x, 0, world.player.z);

  if (ev.depletedNode !== -1) nodeMeshes[ev.depletedNode].visible = false;
  // A regrown node has to come BACK, or the player is told the forest is gone
  // while the simulation quietly keeps handing them wood from an invisible tree.
  for (const i of ev.revivedNodes) nodeMeshes[i].visible = true;
  if (ev.stackChanged) updateStack(player.userData.stackAnchor, world.carry.items);

  // A telegraphed gate pulses. Motion is what actually catches a player's eye
  // on a small screen — a static colour change reads as scenery.
  const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);
  for (let i = 0; i < gateMeshes.length; i++) {
    gateMeshes[i].userData.setTelegraphed(world.gates[i].telegraphed, pulse);
  }

  syncPool(wolfPool, world.wolves, spawnWolfMesh, faceToward(world.pad.x, world.pad.z));

  squadMesh.position.set(world.squad.x, 0, world.squad.z);
  squadMesh.userData.setEngaging(world.squad.engaging);

  groundView.setRingRadius(ringRadius(world.heat));
  furnace.userData.setFlame(world.heat / HEAT_MAX);
  view.setDarkness(darkness(world.cycle));
  hud.update(world, phaseRemaining(world.cycle));

  view.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
