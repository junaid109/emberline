// src/render/pick.js
/* global THREE */

/**
 * Converts a CSS-pixel screen position into a point on the ground plane.
 *
 * This is what turns "the player tapped there" into "the player meant that
 * place in the world". Everything downstream (which gate to rally) is decided
 * in src/core, so this file stays purely a coordinate transform.
 *
 * Returns null when the ray misses the ground entirely — possible for a tap
 * near the top of the frame, where the camera is looking above the horizon.
 * Callers must handle that rather than rallying to a garbage position.
 */
export function createGroundPicker(camera, canvas) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();

  return function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(ndc, camera);
    const found = raycaster.ray.intersectPlane(plane, hit);
    return found ? { x: hit.x, z: hit.z } : null;
  };
}
