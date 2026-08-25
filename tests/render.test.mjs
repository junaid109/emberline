// Smoke tests for the render, input, and UI layers against a Three.js stub.
//
// These prove no pixels. What they prove is that every module builds and every
// hook the frame loop reaches for actually exists — the class of failure that
// otherwise shows up as a black screen and an empty console, and costs a whole
// debugging cycle each to find by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeThreeStub, makeCanvasStub } from './helpers/three-stub.mjs';

globalThis.THREE = makeThreeStub();
globalThis.window = {
  innerWidth: 393,
  innerHeight: 852,
  devicePixelRatio: 3,
  addEventListener: () => {},
  removeEventListener: () => {},
};
globalThis.performance = globalThis.performance ?? { now: () => 0 };
globalThis.document = { addEventListener: () => {}, removeEventListener: () => {} };

const { createScene } = await import('../src/render/scene.js');
const actors = await import('../src/render/actors.js');
const { createGround } = await import('../src/render/ground.js');
const { createGroundPicker } = await import('../src/render/pick.js');
const { syncPool, faceToward } = await import('../src/render/sync.js');
const { createJoystick } = await import('../src/input/joystick.js');
const { createTapper, isTapZone, isTap } = await import('../src/input/tap.js');
const { createWorld, tickWorld, rallyToward } = await import('../src/core/world.js');
const { SQUAD_RANGE, MAX_DPR, TAP_MAX_DRIFT, TAP_MAX_SECONDS } = await import('../src/core/constants.js');

// --- scene -----------------------------------------------------------------

test('the scene builds and caps device pixel ratio', () => {
  const view = createScene(makeCanvasStub());
  assert.equal(view.renderer.pixelRatio, MAX_DPR, 'DPR 3 must be capped');
  assert.deepEqual(view.renderer.size, [393, 852]);
  view.render();
  assert.deepEqual(view.renderer.calls, ['render']);
});

test('setDarkness dims the lights and never inverts them', () => {
  const view = createScene(makeCanvasStub());
  const lights = () => view.scene.children.filter((c) => typeof c.intensity === 'number');

  view.setDarkness(0);
  const day = lights().map((l) => l.intensity);
  view.setDarkness(1);
  const night = lights().map((l) => l.intensity);

  assert.ok(day.length >= 2);
  for (let i = 0; i < day.length; i++) {
    assert.ok(night[i] < day[i], 'night must be darker than day');
    assert.ok(night[i] > 0, 'night must never reach pitch black — legibility is scored');
  }
});

test('setDarkness clamps out-of-range input rather than producing negative light', () => {
  const view = createScene(makeCanvasStub());
  view.setDarkness(-5);
  const a = view.scene.children.filter((c) => typeof c.intensity === 'number').map((l) => l.intensity);
  view.setDarkness(0);
  const b = view.scene.children.filter((c) => typeof c.intensity === 'number').map((l) => l.intensity);
  assert.deepEqual(a, b);
  view.setDarkness(99);
  for (const l of view.scene.children.filter((c) => typeof c.intensity === 'number')) {
    assert.ok(l.intensity > 0);
  }
});

// --- actors ----------------------------------------------------------------

test('every actor factory builds without throwing', () => {
  assert.ok(actors.createPlayer());
  assert.ok(actors.createTree(3, 4));
  assert.ok(actors.createFurnace());
  assert.ok(actors.createWolfMesh());
  assert.ok(actors.createSquadMesh());
  assert.ok(actors.createGateMesh(0, -26));
});

test('the player exposes the stack anchor the frame loop writes to', () => {
  const p = actors.createPlayer();
  assert.ok(p.userData.stackAnchor, 'main.js reads player.userData.stackAnchor every frame');
});

test('the furnace exposes setFlame and its pad radius', () => {
  const f = actors.createFurnace();
  assert.equal(typeof f.userData.setFlame, 'function');
  assert.equal(typeof f.userData.padRadius, 'number');
  f.userData.setFlame(0);
  f.userData.setFlame(1);
});

test('a gate exposes setTelegraphed and lights up when called', () => {
  const g = actors.createGateMesh(0, -26);
  assert.equal(typeof g.userData.setTelegraphed, 'function');

  const lightOf = (m) => m.children.find((c) => typeof c.intensity === 'number');
  g.userData.setTelegraphed(false, 0);
  assert.equal(lightOf(g).intensity, 0, 'an unlit gate must emit nothing');
  g.userData.setTelegraphed(true, 1);
  assert.ok(lightOf(g).intensity > 0, 'a telegraphed gate must be visibly lit');
});

test('the warning beam is fully invisible on an unlit gate', () => {
  // A beam that never quite reaches zero opacity would leave every gate faintly
  // marked, which is exactly as useless as marking none of them.
  const g = actors.createGateMesh(0, -26);
  const beams = g.children.filter((c) => c.material && 'opacity' in c.material);
  assert.ok(beams.length > 0);

  g.userData.setTelegraphed(false, 1);
  for (const b of beams) assert.equal(b.material.opacity, 0);

  g.userData.setTelegraphed(true, 1);
  assert.ok(beams.some((b) => b.material.opacity > 0.3), 'a lit gate needs a clearly visible beam');
});

test('a gate faces the furnace rather than sitting at a random angle', () => {
  const g = actors.createGateMesh(0, -26);
  assert.ok(Math.abs(g.rotation.y) < 1e-9, 'the north gate should face straight down the z axis');
});

test('the squad exposes setEngaging and draws its true reach', () => {
  const s = actors.createSquadMesh();
  assert.equal(typeof s.userData.setEngaging, 'function');
  s.userData.setEngaging(true);
  s.userData.setEngaging(false);

  // The range ring is the only thing telling the player what the squad covers.
  // It is built from SQUAD_RANGE, so it cannot quietly misreport it.
  const ring = s.children.find((c) => c.geometry && c.geometry.args.length >= 2
    && c.geometry.args[1] === SQUAD_RANGE);
  assert.ok(ring, 'the squad must draw a ring whose outer radius is exactly SQUAD_RANGE');
});

test('updateStack renders one item per carried resource', () => {
  const p = actors.createPlayer();
  actors.updateStack(p.userData.stackAnchor, ['wood', 'wood', 'wood']);
  assert.equal(p.userData.stackAnchor.children.length, 3);
  actors.updateStack(p.userData.stackAnchor, []);
  assert.equal(p.userData.stackAnchor.children.length, 0);
});

// --- ground ----------------------------------------------------------------

test('the ring keeps a constant rim band at every radius', () => {
  const scene = new THREE.Scene();
  const ground = createGround(scene);
  ground.setRingRadius(6);
  const small = scene.children.map((c) => c.scale.x);
  ground.setRingRadius(22);
  const large = scene.children.map((c) => c.scale.x);
  assert.notDeepEqual(small, large, 'changing the radius must change the geometry scale');
});

// --- picking ---------------------------------------------------------------

test('a ground pick resolves to a world position and drives a rally', () => {
  const canvas = makeCanvasStub();
  const view = createScene(canvas);
  const pick = createGroundPicker(view.camera, canvas);

  const point = pick(200, 300);
  assert.ok(point && typeof point.x === 'number' && typeof point.z === 'number');

  const world = createWorld(() => 0);
  const gate = rallyToward(world, point.x, point.z);
  assert.ok(gate, 'a valid ground pick must always resolve to a gate');
});

test('a pick against a zero-sized canvas returns null instead of NaN', () => {
  const canvas = makeCanvasStub(0, 0);
  const view = createScene(makeCanvasStub());
  const pick = createGroundPicker(view.camera, canvas);
  assert.equal(pick(10, 10), null);
});

// --- input regions ---------------------------------------------------------

test('the tap zone and the joystick zone tile the screen with no gap or overlap', () => {
  // If they overlapped, a rally tap could also nudge the player. If they left a
  // gap, part of the screen would be dead. Neither is discoverable by playing.
  const W = 393;
  const H = 852;
  const canvas = makeCanvasStub(W, H);
  const stick = createJoystick(canvas);

  let overlap = 0;
  let dead = 0;
  for (let x = 0; x < W; x += 7) {
    for (let y = 0; y < H; y += 7) {
      canvas.dispatch('pointerdown', { pointerId: 1, clientX: x, clientY: y });
      const inStick = stick.active;
      canvas.dispatch('pointerup', { pointerId: 1, clientX: x, clientY: y });

      const inTap = isTapZone(x, y, W, H);
      if (inStick && inTap) overlap++;
      if (!inStick && !inTap) dead++;
    }
  }
  assert.equal(overlap, 0, 'a point activates both controls');
  assert.equal(dead, 0, 'a point activates neither control');
});

test('a quick, steady press is a tap; a long or wandering one is not', () => {
  assert.ok(isTap(0.1, 3));
  assert.ok(isTap(TAP_MAX_SECONDS, TAP_MAX_DRIFT), 'the boundary itself should still count');
  assert.ok(!isTap(1.2, 2), 'a long press is not a tap');
  assert.ok(!isTap(0.1, TAP_MAX_DRIFT + 1), 'a drag is not a tap');
});

test('a tap outside the joystick region fires the rally callback exactly once', () => {
  const canvas = makeCanvasStub();
  let clock = 0;
  const fired = [];
  createTapper(canvas, (x, y) => fired.push([x, y]), () => clock);

  canvas.dispatch('pointerdown', { pointerId: 7, clientX: 300, clientY: 120 });
  clock = 90;
  canvas.dispatch('pointerup', { pointerId: 7, clientX: 302, clientY: 121 });
  assert.deepEqual(fired, [[302, 121]]);

  canvas.dispatch('pointerup', { pointerId: 7, clientX: 302, clientY: 121 });
  assert.equal(fired.length, 1, 'a stray pointerup must not re-fire the order');
});

test('a press in the joystick region never fires a rally', () => {
  const canvas = makeCanvasStub(393, 852);
  const fired = [];
  createTapper(canvas, () => fired.push(1), () => 0);

  canvas.dispatch('pointerdown', { pointerId: 3, clientX: 60, clientY: 700 });
  canvas.dispatch('pointerup', { pointerId: 3, clientX: 60, clientY: 700 });
  assert.equal(fired.length, 0);
});

test('a drag outside the joystick region does not fire a rally', () => {
  const canvas = makeCanvasStub();
  let clock = 0;
  const fired = [];
  createTapper(canvas, () => fired.push(1), () => clock);

  canvas.dispatch('pointerdown', { pointerId: 4, clientX: 300, clientY: 120 });
  clock = 90;
  canvas.dispatch('pointerup', { pointerId: 4, clientX: 300, clientY: 400 });
  assert.equal(fired.length, 0);
});

test('a cancelled pointer does not later fire a rally', () => {
  const canvas = makeCanvasStub();
  const fired = [];
  createTapper(canvas, () => fired.push(1), () => 0);

  canvas.dispatch('pointerdown', { pointerId: 5, clientX: 300, clientY: 120 });
  canvas.dispatch('pointercancel', { pointerId: 5 });
  canvas.dispatch('pointerup', { pointerId: 5, clientX: 300, clientY: 120 });
  assert.equal(fired.length, 0);
});

// --- the loop's contract with the world ------------------------------------

test('every field the frame loop reads off an event actually exists', () => {
  const world = createWorld(() => 0);
  const ev = tickWorld(world, 0.05, 0, 0);
  for (const key of ['depletedNode', 'stackChanged', 'phaseEntered', 'wolvesSpawned', 'mauled']) {
    assert.ok(key in ev, `main.js reads ev.${key} every frame`);
  }
  for (const key of ['heat', 'player', 'carry', 'store', 'cycle', 'gates', 'wolves', 'squad', 'pad', 'over', 'kills']) {
    assert.ok(key in world, `main.js reads world.${key} every frame`);
  }
});

// --- mesh pooling ----------------------------------------------------------
//
// Regression: the first version of this logic lived inline in the frame loop
// and iterated the POOL instead of the entity list, so the pool never grew past
// zero. Wolves existed, moved, and mauled the furnace completely invisibly.
// Nothing threw and nothing logged. Only a screenshot found it.

function fakeMesh() {
  return { visible: false, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };
}

test('an empty pool grows to cover the entities it is given', () => {
  const pool = [];
  const shown = syncPool(pool, [{ x: 1, z: 2 }, { x: 3, z: 4 }], fakeMesh);
  assert.equal(shown, 2);
  assert.equal(pool.length, 2, 'the pool must grow — this is the bug that shipped invisible wolves');
  assert.ok(pool.every((m) => m.visible));
  assert.deepEqual(pool.map((m) => [m.position.x, m.position.z]), [[1, 2], [3, 4]]);
});

test('the pool is reused rather than reallocated between waves', () => {
  const pool = [];
  syncPool(pool, [{ x: 0, z: 0 }, { x: 1, z: 1 }, { x: 2, z: 2 }], fakeMesh);
  const identities = [...pool];

  syncPool(pool, [{ x: 9, z: 9 }], fakeMesh);
  assert.equal(pool.length, 3, 'meshes should be kept, not destroyed');
  assert.deepEqual([...pool], identities, 'the same mesh objects must be reused');
});

test('surplus meshes are hidden, not left standing where a wolf died', () => {
  const pool = [];
  syncPool(pool, [{ x: 0, z: 0 }, { x: 1, z: 1 }], fakeMesh);
  syncPool(pool, [{ x: 0, z: 0 }], fakeMesh);
  assert.equal(pool[0].visible, true);
  assert.equal(pool[1].visible, false, 'a killed wolf must disappear');
});

test('an empty entity list hides everything', () => {
  const pool = [];
  syncPool(pool, [{ x: 0, z: 0 }], fakeMesh);
  assert.equal(syncPool(pool, [], fakeMesh), 0);
  assert.ok(pool.every((m) => !m.visible));
});

test('create is called only when the pool actually has to grow', () => {
  const pool = [];
  let built = 0;
  const counting = () => { built++; return fakeMesh(); };
  syncPool(pool, [{ x: 0, z: 0 }, { x: 1, z: 1 }], counting);
  assert.equal(built, 2);
  syncPool(pool, [{ x: 0, z: 0 }, { x: 1, z: 1 }], counting);
  assert.equal(built, 2, 'a steady wave must not allocate a single new mesh');
});

test('faceToward turns a wolf to look at the furnace', () => {
  const pool = [];
  syncPool(pool, [{ x: 0, z: 10 }], fakeMesh, faceToward(0, 0));
  assert.ok(Math.abs(pool[0].rotation.y - Math.PI) < 1e-9, 'a wolf due south should face north');
});

test('a live world drives the pool end to end', () => {
  // The integration the frame loop actually performs: wolves appear during a
  // night and each one gets a visible mesh.
  const world = createWorld(() => 0);
  const pool = [];
  for (let i = 0; i < 40000 && world.wolves.length === 0; i++) {
    world.heat = 100;
    tickWorld(world, 0.05, 0, 0);
  }
  assert.ok(world.wolves.length > 0, 'no wolves ever spawned');
  syncPool(pool, world.wolves, fakeMesh, faceToward(world.pad.x, world.pad.z));
  assert.equal(pool.filter((m) => m.visible).length, world.wolves.length);
});
