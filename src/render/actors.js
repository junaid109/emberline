// src/render/actors.js
/* global THREE */
import { PAD_RADIUS } from '../core/constants.js';

const COLORS = {
  parka: 0x2e86c1,
  skin: 0xe8c39e,
  boots: 0x3d2b1f,
  hood: 0xf4f6f7,
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
