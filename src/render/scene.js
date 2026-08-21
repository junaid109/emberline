// src/render/scene.js
/* global THREE */
import { MAX_DPR, CAMERA_FOV, CAMERA_HEIGHT, CAMERA_DISTANCE } from '../core/constants.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x0d1b2a);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9fb6c9, 40, 80);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 200);
  camera.position.set(0, CAMERA_HEIGHT, CAMERA_DISTANCE);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xcfe4f5, 0x4a5a6a, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(-12, 24, 8);
  scene.add(sun);

  function resize() {
    // Use the visual viewport where available so the iOS URL bar does not desync the canvas.
    const w = Math.round(window.visualViewport?.width ?? window.innerWidth);
    const h = Math.round(window.visualViewport?.height ?? window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  resize();
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);

  return { scene, camera, renderer, resize, render: () => renderer.render(scene, camera) };
}
