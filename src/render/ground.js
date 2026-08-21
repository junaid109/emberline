// src/render/ground.js
/* global THREE */
import { WORLD_RADIUS, RING_MAX } from '../core/constants.js';

export function createGround(scene) {
  const snow = new THREE.Mesh(
    new THREE.CircleGeometry(WORLD_RADIUS, 64),
    new THREE.MeshLambertMaterial({ color: 0xdce8f2 })
  );
  snow.rotation.x = -Math.PI / 2;
  scene.add(snow);

  // Unit-radius disc; scaled at runtime so we never rebuild geometry per frame.
  const thawed = new THREE.Mesh(
    new THREE.CircleGeometry(1, 64),
    new THREE.MeshLambertMaterial({ color: 0xa8814f })
  );
  thawed.rotation.x = -Math.PI / 2;
  thawed.position.y = 0.01;
  scene.add(thawed);

  const rim = new THREE.Mesh(
    new THREE.RingGeometry(0.97, 1, 64),
    new THREE.MeshBasicMaterial({ color: 0xffb45c, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.02;
  scene.add(rim);

  return {
    setRingRadius(r) {
      const clamped = Math.min(r, RING_MAX);
      thawed.scale.set(clamped, clamped, 1);
      rim.scale.set(clamped, clamped, 1);
    },
  };
}
