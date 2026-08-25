// src/render/scene.js
/* global THREE */
import {
  MAX_DPR, CAMERA_FOV, CAMERA_HEIGHT, CAMERA_DISTANCE, CAMERA_TARGET_WIDTH,
  CAMERA_TARGET_DIST, CAMERA_FAR, FOG_NEAR, FOG_FAR,
} from '../core/constants.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x0d1b2a);

  const scene = new THREE.Scene();
  // Fog bounds are derived from the camera geometry, never hand-picked: the
  // diorama camera sits ~88 units from its target, so a fixed 40-80 range put
  // the entire world past fog.far and rendered it as one flat grey field.
  scene.fog = new THREE.Fog(0x9fb6c9, FOG_NEAR, FOG_FAR);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, CAMERA_FAR);
  camera.position.set(0, CAMERA_HEIGHT, CAMERA_DISTANCE);
  camera.lookAt(0, 0, 0);

  const sky = new THREE.HemisphereLight(0xcfe4f5, 0x4a5a6a, 1.1);
  scene.add(sky);
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(-12, 24, 8);
  scene.add(sun);

  // Day and night colours, blended by setDarkness(). Night never reaches full
  // black: the competition scores legibility, and a player who cannot see the
  // wolf that is eating their furnace has been given atmosphere instead of
  // information.
  const DAY_FOG = new THREE.Color(0x9fb6c9);
  const NIGHT_FOG = new THREE.Color(0x121d2e);
  const DAY_CLEAR = new THREE.Color(0x0d1b2a);
  const NIGHT_CLEAR = new THREE.Color(0x060b14);
  const scratch = new THREE.Color();

  /**
   * @param {number} t 0 = full day, 1 = deepest night.
   *
   * Lighting is floored at ~28% rather than zero so silhouettes survive. The
   * furnace glow and the wolves' eyes then read as the brightest things on
   * screen, which is exactly where the player's attention belongs.
   */
  function setDarkness(t) {
    const k = Math.max(0, Math.min(1, t));
    sky.intensity = 1.1 - 0.78 * k;
    sun.intensity = 1.0 - 0.72 * k;
    scene.fog.color.copy(scratch.copy(DAY_FOG).lerp(NIGHT_FOG, k));
    renderer.setClearColor(scratch.copy(DAY_CLEAR).lerp(NIGHT_CLEAR, k));
  }

  function resize() {
    // Read both the drawing-buffer size and the aspect ratio from the same
    // source: the canvas's own displayed CSS size. #game is `position: fixed;
    // inset: 0`, so clientWidth/clientHeight track the layout viewport that
    // the canvas is actually shown at. Deriving aspect from visualViewport
    // instead (a different, often-smaller box while the URL bar is showing or
    // the page is pinch-zoomed) would disagree with the drawing buffer's
    // aspect and stretch the whole scene non-uniformly.
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;

    // A vertical FOV specified as a fixed constant gets crushed horizontally
    // by a portrait aspect ratio (see constants.js CAMERA_TARGET_WIDTH for the
    // full story). Instead, derive the vertical FOV every resize from the
    // ground width that must be visible and the live aspect ratio, so the
    // heat ring is framed correctly regardless of device aspect.
    const hHalf = Math.atan((CAMERA_TARGET_WIDTH / 2) / CAMERA_TARGET_DIST);
    const vFov = 2 * Math.atan(Math.tan(hHalf) / camera.aspect);
    camera.fov = vFov * (180 / Math.PI);

    camera.updateProjectionMatrix();
  }

  resize();
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);

  // iOS Safari (and other mobile browsers under memory pressure) can discard
  // the WebGL context outright — e.g. after a phone call interrupts a
  // backgrounded tab. Without handling this, requestAnimationFrame keeps
  // ticking against a dead context: the canvas freezes with no rendering and
  // no indication anything went wrong. preventDefault() on the loss event is
  // required for the browser to even attempt restoring the context; on
  // restore, the honest minimum for a prototype is to ask the player to tap
  // to reload rather than trying to silently re-create every GPU resource.
  let resumeOverlay = null;

  function showResumeOverlay() {
    if (resumeOverlay) return;
    resumeOverlay = document.createElement('div');
    resumeOverlay.textContent = 'Display disconnected — tap to resume';
    Object.assign(resumeOverlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '4vmin',
      background: '#0d1b2a',
      color: '#eaf2fa',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '5vmin',
      cursor: 'pointer',
    });
    resumeOverlay.addEventListener('pointerdown', () => window.location.reload());
    document.body.appendChild(resumeOverlay);
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    showResumeOverlay();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    // Re-creating every GPU resource in place is out of scope for this
    // prototype; a full reload is the honest, reliable recovery path and the
    // overlay's tap target already does that, but also handle the browser
    // restoring the context on its own without a tap in between.
    showResumeOverlay();
  });

  return { scene, camera, renderer, resize, setDarkness, render: () => renderer.render(scene, camera) };
}
