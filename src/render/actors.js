// src/render/actors.js
/* global THREE */
import { PAD_RADIUS, SQUAD_RANGE } from '../core/constants.js';

import {
  PLAYER_PARKA, PLAYER_SKIN, PLAYER_BOOTS, PLAYER_HOOD, PLAYER_SHADOW,
  GUARD, WOLF, WOLF_EYE, COAL_SEAM, COAL_GLINT, BOULDER, HARE, CACHE_CRATE, CACHE_FLAG,
} from './palette.js';

const COLORS = {
  parka: PLAYER_PARKA,
  skin: PLAYER_SKIN,
  boots: PLAYER_BOOTS,
  hood: PLAYER_HOOD,
};

function box(w, h, d, color) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
}

/** Procedural low-poly survivor. Abstract and bipedal, which the design guidance explicitly allows. */
export function createPlayer() {
  const g = new THREE.Group();

  const legs = box(0.7, 0.7, 0.5, COLORS.boots);
  legs.position.y = 0.35;
  g.add(legs);

  const body = box(0.9, 1.1, 0.6, COLORS.parka);
  body.position.y = 1.25;
  g.add(body);

  const head = box(0.55, 0.5, 0.5, COLORS.skin);
  head.position.y = 2.05;
  g.add(head);

  const hood = box(0.75, 0.25, 0.7, COLORS.hood);
  hood.position.y = 2.3;
  g.add(hood);

  // A dark contact shadow. The frozen waste is now somewhere the player has a
  // reason to walk, and no single parka colour reads equally well on snow and
  // on worked earth — so the figure also carries an anchor that reads on both,
  // and says exactly which point of ground the game thinks they stand on.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 16),
    new THREE.MeshBasicMaterial({
      color: PLAYER_SHADOW, transparent: true, opacity: 0.34, depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;              // just clear of the ground, to avoid z-fighting
  g.add(shadow);

  g.userData.stackAnchor = new THREE.Group();
  g.userData.stackAnchor.position.set(0, 1.7, -0.45);   // on the back
  g.add(g.userData.stackAnchor);

  return g;
}

const LOG_GEO = new THREE.BoxGeometry(0.55, 0.16, 0.55);
const LOG_MAT = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });

const TRUNK_GEO = new THREE.CylinderGeometry(0.18, 0.24, 1.4, 6);
const TRUNK_MAT = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
const FOLIAGE_GEO = new THREE.ConeGeometry(1.1, 2.6, 7);
const FOLIAGE_MAT = new THREE.MeshLambertMaterial({ color: 0x2f6b4f });

export function createTree(x, z) {
  const g = new THREE.Group();

  const trunk = new THREE.Mesh(TRUNK_GEO, TRUNK_MAT);
  trunk.position.y = 0.7;
  g.add(trunk);

  const foliage = new THREE.Mesh(FOLIAGE_GEO, FOLIAGE_MAT);
  foliage.position.y = 2.3;
  g.add(foliage);

  g.position.set(x, 0, z);
  return g;
}

/**
 * Rebuilds the carried stack to match `items`. Called only when the count changes,
 * never per frame, so the allocation is cheap.
 */
export function updateStack(anchor, items) {
  while (anchor.children.length > items.length) {
    anchor.remove(anchor.children[anchor.children.length - 1]);
  }
  while (anchor.children.length < items.length) {
    const log = new THREE.Mesh(LOG_GEO, LOG_MAT);
    log.position.y = anchor.children.length * 0.18;
    log.rotation.y = (anchor.children.length % 2) * 0.4;   // slight alternation reads as hand-stacked
    anchor.add(log);
  }
}

const FURNACE_BASE_GEO = new THREE.CylinderGeometry(1.5, 1.8, 2.2, 8);
const FURNACE_BASE_MAT = new THREE.MeshLambertMaterial({ color: 0x5a5a5f });
const FURNACE_FLAME_GEO = new THREE.ConeGeometry(0.9, 2.0, 6);
const FURNACE_FLAME_MAT = new THREE.MeshBasicMaterial({ color: 0xff8c1a });
// Pad inner radius kept a fixed 1 unit inside PAD_RADIUS so the visual ring
// and the isOnPad collision radius (PAD_RADIUS itself) can never drift apart.
// A thin, half-transparent ring read as almost nothing against the thawed
// ground: standing on the furnace and having nothing happen is the worst
// possible first impression, and walk-in pads are the game's ONLY interaction
// verb. The pad is now a bright filled disc with a solid rim, so where to stand
// is unmistakable. Both are sized from PAD_RADIUS, so what is drawn can never
// drift from what isOnPad actually tests.
const FURNACE_PAD_GEO = new THREE.CircleGeometry(PAD_RADIUS, 40);
const FURNACE_PAD_MAT = new THREE.MeshBasicMaterial({ color: 0xffd36e, transparent: true, opacity: 0.4 });
const FURNACE_PAD_RIM_GEO = new THREE.RingGeometry(PAD_RADIUS - 0.35, PAD_RADIUS, 40);
const FURNACE_PAD_RIM_MAT = new THREE.MeshBasicMaterial({ color: 0xfff2c4, transparent: true, opacity: 0.95, side: THREE.DoubleSide });

export function createFurnace() {
  const g = new THREE.Group();

  const base = new THREE.Mesh(FURNACE_BASE_GEO, FURNACE_BASE_MAT);
  base.position.y = 1.1;
  g.add(base);

  const flame = new THREE.Mesh(FURNACE_FLAME_GEO, FURNACE_FLAME_MAT);
  flame.position.y = 3.1;
  g.add(flame);

  const glow = new THREE.PointLight(0xffa040, 2.0, 30, 2);
  glow.position.y = 3.2;
  g.add(glow);

  /** @param {number} t normalised fuel, 0 to 1 */
  g.userData.setFlame = (t) => {
    const s = 0.25 + t * 0.75;
    flame.scale.set(s, s, s);
    flame.position.y = 2.4 + s * 0.7;
    glow.intensity = 0.4 + t * 2.6;
  };

  // Walk-in deposit pad, flush with the ground.
  const pad = new THREE.Mesh(FURNACE_PAD_GEO, FURNACE_PAD_MAT);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.03;
  g.add(pad);

  const padRim = new THREE.Mesh(FURNACE_PAD_RIM_GEO, FURNACE_PAD_RIM_MAT);
  padRim.rotation.x = -Math.PI / 2;
  padRim.position.y = 0.04;
  g.add(padRim);

  g.userData.padRadius = PAD_RADIUS;

  return g;
}

// --- night actors ----------------------------------------------------------
// All geometry and materials are module-level singletons, shared across every
// instance. Wolves are created and destroyed every night, so allocating per
// wolf would churn GPU resources on exactly the frames already doing the most
// work.

const WOLF_BODY_GEO = new THREE.BoxGeometry(0.7, 0.55, 1.5);
const WOLF_HEAD_GEO = new THREE.BoxGeometry(0.45, 0.42, 0.5);
const WOLF_MAT = new THREE.MeshLambertMaterial({ color: WOLF });
const WOLF_EYE_GEO = new THREE.SphereGeometry(0.09, 6, 6);
const WOLF_EYE_MAT = new THREE.MeshBasicMaterial({ color: WOLF_EYE });

export function createWolfMesh() {
  const g = new THREE.Group();

  const body = new THREE.Mesh(WOLF_BODY_GEO, WOLF_MAT);
  body.position.y = 0.7;
  g.add(body);

  const head = new THREE.Mesh(WOLF_HEAD_GEO, WOLF_MAT);
  head.position.set(0, 0.95, 0.85);
  g.add(head);

  // Eyes are MeshBasicMaterial, so they stay bright when the night lighting
  // drops. At night the wolves should be readable as two approaching sparks
  // well before their silhouette resolves.
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(WOLF_EYE_GEO, WOLF_EYE_MAT);
    eye.position.set(0.13 * side, 1.0, 1.08);
    g.add(eye);
  }

  return g;
}

const GUARD_BODY_GEO = new THREE.CapsuleGeometry(0.32, 0.9, 4, 8);
const GUARD_MAT = new THREE.MeshLambertMaterial({ color: GUARD });
const SQUAD_RING_GEO = new THREE.RingGeometry(SQUAD_RANGE - 0.18, SQUAD_RANGE, 40);
const SQUAD_RING_MAT = new THREE.MeshBasicMaterial({
  color: 0xff7b6b, transparent: true, opacity: 0.45, side: THREE.DoubleSide,
});

/**
 * The guard squad: three bodies plus a ring showing exactly how far they
 * reach.
 *
 * Drawing the range is not decoration. Combat is automatic, so the ONLY thing
 * the player controls is where this circle sits — it has to be visible to be
 * decidable, and it is built from SQUAD_RANGE so it cannot misreport it.
 */
export function createSquadMesh() {
  const g = new THREE.Group();

  const offsets = [[0, 0], [-0.55, 0.4], [0.55, 0.4]];
  for (const [dx, dz] of offsets) {
    const guard = new THREE.Mesh(GUARD_BODY_GEO, GUARD_MAT);
    guard.position.set(dx, 0.75, dz);
    g.add(guard);
  }

  const ring = new THREE.Mesh(SQUAD_RING_GEO, SQUAD_RING_MAT);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  g.add(ring);

  g.userData.setEngaging = (on) => { SQUAD_RING_MAT.opacity = on ? 0.8 : 0.45; };
  return g;
}

const GATE_POST_GEO = new THREE.BoxGeometry(0.5, 3.2, 0.5);
const GATE_POST_MAT = new THREE.MeshLambertMaterial({ color: 0x6b5a45 });
const GATE_ARCH_GEO = new THREE.BoxGeometry(3.4, 0.45, 0.5);

/**
 * A gate: two posts and a lintel, plus a lamp that lights when this lane is
 * the one the wolves will use.
 *
 * The lamp is the dusk telegraph — the single piece of information the rally
 * decision is made from — so it is emissive-bright and sits above the
 * silhouette where nothing can occlude it.
 */
export function createGateMesh(x, z) {
  const g = new THREE.Group();

  for (const side of [-1.45, 1.45]) {
    const post = new THREE.Mesh(GATE_POST_GEO, GATE_POST_MAT);
    post.position.set(side, 1.6, 0);
    g.add(post);
  }

  const arch = new THREE.Mesh(GATE_ARCH_GEO, GATE_POST_MAT);
  arch.position.y = 3.4;
  g.add(arch);

  // Per-gate material: each lamp changes colour independently.
  //
  // MeshBasicMaterial ignores lighting, so the lamp stays exactly as bright at
  // midnight as at noon. It is oversized on purpose: at this camera distance a
  // realistically-scaled lamp is about three pixels, and this is the single
  // piece of information the night's decision is made from.
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x3a4654 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 12), lampMat);
  lamp.position.y = 4.8;
  g.add(lamp);

  // A vertical shaft above the lit gate. A tall bright column survives being
  // small on screen far better than a dot does, and it stays visible even when
  // the gate itself is near the edge of the frame.
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xff6a52, transparent: true, opacity: 0 });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.9, 14, 8, 1, true), beamMat);
  beam.position.y = 11;
  g.add(beam);

  const warnLight = new THREE.PointLight(0xff4d3d, 0, 22, 2);
  warnLight.position.y = 4.3;
  g.add(warnLight);

  g.position.set(x, 0, z);
  // Face the furnace, so the gate reads as a way in rather than a loose prop.
  g.rotation.y = Math.atan2(-x, -z);

  g.userData.setTelegraphed = (on, pulse) => {
    lampMat.color.setHex(on ? 0xff4d3d : 0x3a4654);
    warnLight.intensity = on ? 1.2 + pulse * 1.8 : 0;
    beamMat.opacity = on ? 0.22 + pulse * 0.3 : 0;
  };

  return g;
}


// --- the wilds -------------------------------------------------------------

// Sized from a capture at the reference layout rather than by eye in isolation:
// at 0.62 the seam read as a speck of grit beside the boulders, and a player
// cannot choose to walk out for fuel they cannot see is there.
const SEAM_GEO = new THREE.DodecahedronGeometry(0.86, 0);
const SEAM_MAT = new THREE.MeshLambertMaterial({ color: COAL_SEAM, flatShading: true });
const GLINT_GEO = new THREE.OctahedronGeometry(0.34, 0);
const GLINT_MAT = new THREE.MeshBasicMaterial({ color: COAL_GLINT });

/**
 * A coal seam: a cluster of near-black lumps with an ember glint on top.
 *
 * The glint is MeshBasic rather than lit, so it stays bright at night. A seam
 * is worth crossing frozen ground for, and a player has to be able to pick one
 * out in the dark to decide whether the walk is worth it.
 */
export function createCoalSeam(x, z) {
  const g = new THREE.Group();

  const offsets = [[0, 0, 0.8], [0.82, 0.34, 0.6], [-0.76, 0.28, 0.62], [0.14, -0.7, 0.5]];
  for (const [ox, oz, scale] of offsets) {
    const lump = new THREE.Mesh(SEAM_GEO, SEAM_MAT);
    lump.position.set(ox, 0.34 * scale, oz);
    lump.scale.setScalar(scale);
    lump.rotation.set(ox, oz, 0.4);
    g.add(lump);
  }

  const glint = new THREE.Mesh(GLINT_GEO, GLINT_MAT);
  glint.position.set(0.05, 0.96, 0.05);
  g.add(glint);

  g.position.set(x, 0, z);
  return g;
}

const BOULDER_GEO = new THREE.DodecahedronGeometry(1, 0);
const BOULDER_MAT = new THREE.MeshLambertMaterial({ color: BOULDER, flatShading: true });

/**
 * A blocking boulder, drawn at the radius the simulation actually collides at.
 *
 * The size is passed in rather than chosen here: a rock the player bounces off
 * two metres before touching would read as a bug in the controls, which is a
 * far worse feeling than an ugly rock.
 */
export function createBoulder(x, z, radius) {
  const mesh = new THREE.Mesh(BOULDER_GEO, BOULDER_MAT);
  mesh.position.set(x, radius * 0.55, z);
  mesh.scale.set(radius, radius * 0.85, radius);
  mesh.rotation.set(x * 0.3, z * 0.7, 0.2);
  return mesh;
}


const HARE_BODY_GEO = new THREE.BoxGeometry(0.46, 0.38, 0.72);
const HARE_EAR_GEO = new THREE.BoxGeometry(0.09, 0.42, 0.14);
const HARE_MAT = new THREE.MeshLambertMaterial({ color: HARE, flatShading: true });

/**
 * A hare. Small, pale and upright-eared.
 *
 * Deliberately unlike the wolf it shares a silhouette family with: dark and low
 * means danger, pale and small with ears means food. That distinction gets read
 * at a glance, at distance, usually while the player is deciding whether they
 * have time for it.
 */
export function createHareMesh() {
  const g = new THREE.Group();

  const body = new THREE.Mesh(HARE_BODY_GEO, HARE_MAT);
  body.position.y = 0.3;
  g.add(body);

  for (const side of [-0.12, 0.12]) {
    const ear = new THREE.Mesh(HARE_EAR_GEO, HARE_MAT);
    ear.position.set(side, 0.66, -0.24);
    ear.rotation.x = -0.18;
    g.add(ear);
  }

  return g;
}

const CRATE_GEO = new THREE.BoxGeometry(1.15, 0.8, 1.15);
const CRATE_MAT = new THREE.MeshLambertMaterial({ color: CACHE_CRATE, flatShading: true });
const POLE_GEO = new THREE.CylinderGeometry(0.06, 0.06, 2.4, 5);
const FLAG_GEO = new THREE.BoxGeometry(0.9, 0.5, 0.06);
const FLAG_MAT = new THREE.MeshBasicMaterial({ color: CACHE_FLAG });

/**
 * A supply cache: a crate under a tall green flag.
 *
 * The flag is the whole point and is drawn unlit, so it survives the night. A
 * cache the player cannot spot from across the field is not an event, it is a
 * message about an event.
 */
export function createCacheMesh() {
  const g = new THREE.Group();

  const crate = new THREE.Mesh(CRATE_GEO, CRATE_MAT);
  crate.position.y = 0.4;
  g.add(crate);

  const pole = new THREE.Mesh(POLE_GEO, CRATE_MAT);
  pole.position.y = 1.5;
  g.add(pole);

  const flag = new THREE.Mesh(FLAG_GEO, FLAG_MAT);
  flag.position.set(0.5, 2.4, 0);
  g.add(flag);

  return g;
}
