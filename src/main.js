// src/main.js
/* global THREE */
import { createScene } from './render/scene.js';

const view = createScene(document.getElementById('game'));

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);  // clamp: a backgrounded tab must not produce a huge step
  last = now;
  view.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
