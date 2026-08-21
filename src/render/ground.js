// src/render/ground.js
/* global THREE */
import { WORLD_RADIUS, RING_MIN, RING_MAX, RIM_BAND } from '../core/constants.js';

export function createGround(scene) {
  const snow = new THREE.Mesh(
    new THREE.CircleGeometry(WORLD_RADIUS, 64),
    new THREE.MeshLambertMaterial({ color: 0xdce8f2 })
  );
  snow.rotation.x = -Math.PI / 2;
  scene.add(snow);

  // Unit-radius discs; scaled at runtime so we never rebuild geometry per frame.
  // The rim is a filled disc at the full ring radius, in the warm rim colour; the thawed
  // disc is drawn on top at (radius - RIM_BAND), so the rim shows through as a constant
  // world-space band regardless of ring radius — no RingGeometry, no per-frame allocation.
  const rim = new THREE.Mesh(
    new THREE.CircleGeometry(1, 64),
    new THREE.MeshBasicMaterial({ color: 0xffb45c })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.01;
  scene.add(rim);

  const thawed = new THREE.Mesh(
    new THREE.CircleGeometry(1, 64),
    new THREE.MeshLambertMaterial({ color: 0xa8814f })
  );
  thawed.rotation.x = -Math.PI / 2;
  thawed.position.y = 0.02;
  scene.add(thawed);

  return {
    setRingRadius(r) {
      const clamped = Math.max(RING_MIN, Math.min(r, RING_MAX));
      rim.scale.set(clamped, clamped, 1);
      // Guard the degenerate case: never let the inner (thawed) radius reach zero or go
      // negative, even if RING_MIN/RIM_BAND are retuned such that RING_MIN <= RIM_BAND.
      const inner = Math.max(0.01, clamped - RIM_BAND);
      thawed.scale.set(inner, inner, 1);
    },
  };
}
