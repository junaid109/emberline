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
