// src/render/actors.js
/* global THREE */

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

export function createTree(x, z) {
  const g = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, 1.4, 6),
    new THREE.MeshLambertMaterial({ color: 0x6b4423 })
  );
  trunk.position.y = 0.7;
  g.add(trunk);

  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 2.6, 7),
    new THREE.MeshLambertMaterial({ color: 0x2f6b4f })
  );
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
