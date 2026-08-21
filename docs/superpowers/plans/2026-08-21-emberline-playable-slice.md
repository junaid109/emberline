# EMBERLINE Playable Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the vertical slice that proves the core verb — joystick out to a tree, auto-harvest with logs visibly stacking on the player's back, haul back, stand on the furnace pad, watch them drain in and the heat ring physically grow.

**Architecture:** All game logic lives in pure ES modules under `src/core/` with zero Three.js dependency, so it is unit-testable headlessly with `node --test`. Rendering, input, and UI are separate layers under `src/render/`, `src/input/`, and `src/ui/` that consume the core. A build step bundles `src/` into a single readable IIFE and injects it into `index.html`, while Three.js is bundled separately into `vendor/three.js` as a global. This satisfies the competition packaging rules by construction rather than by cleanup at the end.

**Tech Stack:** Three.js (vendored, global `THREE`), vanilla ES2022 modules, esbuild for bundling only, `node --test` for unit tests. No framework, no runtime dependencies.

## Global Constraints

Every task's requirements implicitly include this section. Values copied verbatim from the spec and the competition rules.

- Single `.zip`, **no larger than 35MB**, with `index.html` **at the top level of the .zip and not inside a folder**.
- The submitted `index.html` must contain **all of your own game code, in readable, unminified form**.
- Third-party libraries **must be included in the .zip inside a folder named `vendor`, and referenced with relative paths**. Do not embed them in `index.html`.
- All assets, fonts, images, audio and data must be included in the .zip and **referenced with relative paths**.
- **The build must not make any external network request while it is running.** Builds that load resources from external URLs, including CDNs, will fail validation.
- **Portrait orientation**, and the orientation must not change during play.
- **Single-player only.**
- Reference layout viewport: **393 × 852 CSS pixels** (iPhone 16, the tighter of the two test devices). Must also work at ~412 × 883 (Galaxy S24 Ultra).
- **Device pixel ratio capped at 2**, regardless of what the device reports.
- Safe-area insets honoured via `env(safe-area-inset-*)` from the first commit.
- No model files, no audio files, no external fonts in this milestone. All geometry procedural.
- Never prompt an image generator for, or reproduce, an existing game's IP — the rules state the prototype "may not replicate an existing game."

---

## File Structure

| Path | Responsibility |
|---|---|
| `package.json` | Scripts and dev dependencies. `type: module`. |
| `tools/vendor.mjs` | Bundles Three.js into `vendor/three.js` as an IIFE global. Run once, and on version bumps. |
| `tools/build.mjs` | Bundles `src/main.js` into a readable IIFE and injects it into `index.html`. |
| `tools/index.template.html` | The HTML shell with the `/*__GAME_CODE__*/` injection marker. |
| `tools/serve.mjs` | Zero-dependency static server for local offline testing. |
| `tools/package.mjs` | Produces the submission zip **and validates it** against the auto-fail rules. |
| `src/main.js` | Entry point. Wires core, render, input, and UI together; owns the frame loop. |
| `src/core/constants.js` | Tuning values in one place. Every magic number lives here. |
| `src/core/carry.js` | Pure carry-stack model: capacity, push, pop, counts. |
| `src/core/store.js` | Pure resource bank: the four resources, add and spend. |
| `src/core/heat.js` | Pure heat model: fuel drain, and the fuel-to-ring-radius mapping. |
| `src/core/nodes.js` | Pure resource-node model: harvest timing and depletion. |
| `src/core/world.js` | Pure world state container and the fixed-step tick that advances it. |
| `src/render/scene.js` | Renderer, camera, lights, resize handling, DPR cap. |
| `src/render/ground.js` | Ground plane, snow, and the visible heat ring. |
| `src/render/actors.js` | Procedural low-poly player, furnace, trees, and the carried stack. |
| `src/input/joystick.js` | Virtual joystick: pointer events to a normalised direction vector. |
| `src/ui/hud.js` | Resource counters and the fuel readout, safe-area aware. |
| `tests/*.test.mjs` | Unit tests for the pure core modules. |

Files that change together live together. `src/core/` never imports from `src/render/`; the dependency only points one way, which is what keeps the core testable.

---

## Task 1: Scaffold, build pipeline, and packaging validator

Build the packaging infrastructure first. The competition has three silent auto-fail conditions — a CDN reference, `index.html` nested inside a folder, and an oversized zip. Catching those on day 1 with a validator is far cheaper than discovering one on day 17.

**Files:**
- Create: `package.json`
- Create: `tools/vendor.mjs`
- Create: `tools/index.template.html`
- Create: `tools/build.mjs`
- Create: `tools/serve.mjs`
- Create: `tools/package.mjs`
- Create: `src/main.js`
- Test: `tests/package.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run vendor`, `npm run build`, `npm run serve`, `npm run package`, `npm test`. A global `THREE` available to all `src/` code. `validateZipContents(fileNames, totalBytes, indexHtmlText)` exported from `tools/package.mjs`, returning `{ ok: boolean, errors: string[] }`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "emberline",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "vendor": "node tools/vendor.mjs",
    "build": "node tools/build.mjs",
    "serve": "node tools/serve.mjs",
    "package": "node tools/package.mjs",
    "test": "node --test tests/"
  },
  "devDependencies": {
    "esbuild": "^0.25.0",
    "three": "^0.180.0"
  }
}
```

- [ ] **Step 2: Install dev dependencies**

Run: `npm install`
Expected: `node_modules/` created, `esbuild` and `three` present. Both are **dev**-only — they never ship as npm packages, only as the bundled `vendor/three.js`.

- [ ] **Step 3: Write the failing packaging-validator test**

The validator is pure and takes plain data, so it can be tested without ever building a zip.

```js
// tests/package.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateZipContents } from '../tools/package.mjs';

test('accepts a well-formed package', () => {
  const r = validateZipContents(
    ['index.html', 'vendor/three.js'],
    5_000_000,
    '<script src="./vendor/three.js"></script>'
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
});

test('rejects index.html nested in a folder', () => {
  const r = validateZipContents(['game/index.html', 'vendor/three.js'], 1000, '');
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('top level')));
});

test('rejects a zip over 35MB', () => {
  const r = validateZipContents(['index.html'], 36 * 1024 * 1024, '');
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('35MB')));
});

test('rejects an external URL in index.html', () => {
  const r = validateZipContents(
    ['index.html'],
    1000,
    '<script src="https://cdn.example.com/three.js"></script>'
  );
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('external URL')));
});

test('does not flag a relative vendor path as external', () => {
  const r = validateZipContents(['index.html'], 1000, 'fetch("./data/levels.json")');
  assert.equal(r.ok, true);
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../tools/package.mjs'`.

- [ ] **Step 5: Write `tools/package.mjs`**

```js
// tools/package.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

export const MAX_BYTES = 35 * 1024 * 1024;

/**
 * Pure validator. Takes plain data so it is testable without building a zip.
 * @param {string[]} fileNames  paths inside the zip, forward-slashed
 * @param {number} totalBytes   size of the zip on disk
 * @param {string} indexHtmlText  full text of index.html
 */
export function validateZipContents(fileNames, totalBytes, indexHtmlText) {
  const errors = [];

  if (!fileNames.includes('index.html')) {
    errors.push('index.html must be at the top level of the .zip, not inside a folder');
  }
  if (totalBytes > MAX_BYTES) {
    errors.push(`zip is ${(totalBytes / 1048576).toFixed(1)}MB, over the 35MB limit`);
  }
  const external = indexHtmlText.match(/["'(]\s*https?:\/\/[^"')\s]+/g);
  if (external) {
    errors.push(`index.html references an external URL: ${external[0].slice(0, 80)}`);
  }
  return { ok: errors.length === 0, errors };
}

function listFiles(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? listFiles(p, base) : [relative(base, p).replaceAll('\\', '/')];
  });
}

function main() {
  const root = process.cwd();
  const out = join(root, 'emberline.zip');
  if (existsSync(out)) rmSync(out);

  const parts = ['index.html', 'vendor'].filter((p) => existsSync(join(root, p)));
  if (existsSync(join(root, 'assets'))) parts.push('assets');

  if (process.platform === 'win32') {
    execFileSync('powershell', [
      '-NoProfile', '-Command',
      `Compress-Archive -Path ${parts.map((p) => `'${p}'`).join(',')} -DestinationPath 'emberline.zip' -Force`,
    ], { cwd: root, stdio: 'inherit' });
  } else {
    execFileSync('zip', ['-r', '-q', 'emberline.zip', ...parts], { cwd: root, stdio: 'inherit' });
  }

  const names = ['index.html', ...(existsSync(join(root, 'vendor')) ? listFiles(join(root, 'vendor')).map((f) => `vendor/${f}`) : [])];
  const result = validateZipContents(names, statSync(out).size, readFileSync(join(root, 'index.html'), 'utf8'));

  if (!result.ok) {
    console.error('PACKAGE VALIDATION FAILED:');
    for (const e of result.errors) console.error('  - ' + e);
    process.exit(1);
  }
  console.log(`OK  emberline.zip  ${(statSync(out).size / 1048576).toFixed(2)}MB`);
}

if (import.meta.url === `file://${process.argv[1].replaceAll('\\', '/')}`) main();
```

Note: `Compress-Archive` places `index.html` at the archive root when passed as a top-level path, which is exactly what the rules require.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test`
Expected: PASS, 5 tests.

- [ ] **Step 7: Write `tools/vendor.mjs`**

Three.js ships ESM only. Bundling it to an IIFE global means `index.html` needs no import map, which keeps the page working even if a judge opens it directly rather than through a server.

```js
// tools/vendor.mjs
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('vendor', { recursive: true });

await build({
  entryPoints: ['node_modules/three/build/three.module.js'],
  bundle: true,
  format: 'iife',
  globalName: 'THREE',
  minify: false,
  target: 'es2022',
  outfile: 'vendor/three.js',
});

console.log('vendored three -> vendor/three.js');
```

- [ ] **Step 8: Run it and confirm the vendor file exists**

Run: `npm run vendor`
Expected: `vendored three -> vendor/three.js`. Confirm with `node -e "console.log((require('fs').statSync('vendor/three.js').size/1048576).toFixed(2)+'MB')"` — expect roughly 1–3MB, comfortably inside budget.

If `node_modules/three/build/three.module.js` does not exist in the installed version, use `node_modules/three/src/Three.js` as the entry point instead; the rest of the config is unchanged.

- [ ] **Step 9: Write `tools/index.template.html`**

`user-scalable=no` and `touch-action: none` stop the browser from stealing joystick drags as page scroll. `100dvh` avoids the iOS Safari `100vh` bug, with `100vh` as the fallback for older engines.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#0d1b2a">
<title>Emberline</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 100%; height: 100vh; height: 100dvh;
    overflow: hidden; background: #0d1b2a;
    font-family: system-ui, -apple-system, sans-serif;
    -webkit-user-select: none; user-select: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: none; overscroll-behavior: none;
  }
  #game { position: fixed; inset: 0; display: block; }
  #ui {
    position: fixed; inset: 0; pointer-events: none;
    padding: env(safe-area-inset-top) env(safe-area-inset-right)
             env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
</style>
</head>
<body>
<canvas id="game"></canvas>
<div id="ui"></div>
<script src="./vendor/three.js"></script>
<script>
/*__GAME_CODE__*/
</script>
</body>
</html>
```

- [ ] **Step 10: Write `tools/build.mjs`**

```js
// tools/build.mjs
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  minify: false,          // rules require readable, unminified game code
  target: 'es2022',
  write: false,
  legalComments: 'inline',
});

const code = result.outputFiles[0].text;
const template = readFileSync('tools/index.template.html', 'utf8');

if (!template.includes('/*__GAME_CODE__*/')) {
  throw new Error('injection marker missing from tools/index.template.html');
}

// Function replacer avoids `$&` and friends being treated as replacement patterns.
writeFileSync('index.html', template.replace('/*__GAME_CODE__*/', () => code));
console.log(`built index.html  ${(code.length / 1024).toFixed(1)}KB of game code`);
```

- [ ] **Step 11: Write a placeholder `src/main.js` so the build has an entry point**

```js
// src/main.js
/* global THREE */
console.log('emberline boot', THREE.REVISION);
```

- [ ] **Step 12: Write `tools/serve.mjs`**

```js
// tools/serve.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
};
const ROOT = process.cwd();

createServer(async (req, res) => {
  const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([/\\])+/, '');
  const path = join(ROOT, rel === '' ? 'index.html' : rel);
  if (!path.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(8080, () => console.log('http://localhost:8080'));
```

- [ ] **Step 13: Build, serve, and verify end to end**

Run: `npm run vendor && npm run build && npm run serve`
Then open `http://localhost:8080` and check the browser console.
Expected: `emberline boot 180` (or whatever revision installed). **Open the Network tab and confirm every request is same-origin** — this is the check that protects us from the CDN auto-fail, and it should be repeated at every milestone.

- [ ] **Step 14: Verify the packaging path works**

Run: `npm run package`
Expected: `OK  emberline.zip  N.NNMb`. If it prints a validation failure instead, fix the cause rather than the validator.

- [ ] **Step 15: Commit**

```bash
git add package.json package-lock.json tools src .gitignore
git commit -m "build: scaffold pipeline, vendored three, packaging validator"
```

`vendor/`, `index.html`, and `*.zip` are build outputs. Add `vendor/` and `/index.html` to `.gitignore` in this step so the repo tracks sources only.

---

## Task 2: Portrait renderer shell

**Files:**
- Create: `src/render/scene.js`
- Create: `src/core/constants.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: global `THREE`.
- Produces: `createScene(canvas)` returning `{ scene, camera, renderer, resize(), render() }`. `resize()` recalculates size and DPR; `render()` draws one frame.

- [ ] **Step 1: Write `src/core/constants.js`**

Every tunable number lives here from the start, because day 12 is a tuning pass and hunting magic numbers across ten files wastes it.

```js
// src/core/constants.js
export const MAX_DPR = 2;              // capped: S24 Ultra reports 3.5, which is a fill-rate massacre
export const CAMERA_FOV = 45;
export const CAMERA_HEIGHT = 26;
export const CAMERA_DISTANCE = 20;     // behind the player, giving the tilted three-quarter view
export const WORLD_RADIUS = 34;        // playfield half-extent in world units

export const HEAT_MAX = 100;
export const HEAT_START = 60;
export const HEAT_DRAIN_DAY = 1.6;     // heat units per second
export const RING_MIN = 6;             // ring radius at zero heat
export const RING_MAX = 22;            // ring radius at full heat

export const PLAYER_SPEED = 7.5;       // world units per second
export const CARRY_CAP = 8;

export const HARVEST_SECONDS = 0.7;    // per item pulled from a node
export const HARVEST_RANGE = 2.2;
export const DEPOSIT_INTERVAL = 0.09;  // seconds between items flying off the stack
```

- [ ] **Step 2: Write `src/render/scene.js`**

```js
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
```

- [ ] **Step 3: Wire it into `src/main.js`**

```js
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
```

- [ ] **Step 4: Build and verify on desktop**

Run: `npm run build` then reload `http://localhost:8080`.
Expected: a solid dark blue canvas filling the viewport, no console errors, no scrollbars, and no rubber-band scrolling when you drag on it.

- [ ] **Step 5: Verify on the Galaxy S24 Ultra**

Connect over USB, enable USB debugging, open `chrome://inspect` on the desktop, and forward port 8080. Load the page on the phone.
Expected: fills the screen in portrait with no scroll. In the console, run `renderer.getPixelRatio()` — expect **2**, not 3.5. If it reports 3.5, the DPR cap is not applied and framerate will suffer later.

- [ ] **Step 6: Commit**

```bash
git add src tools
git commit -m "feat: portrait renderer shell with DPR cap and visual-viewport resize"
```

---

## Task 3: Virtual joystick and player movement

**Files:**
- Create: `src/input/joystick.js`
- Create: `src/render/actors.js`
- Modify: `src/main.js`
- Test: `tests/joystick.test.mjs`

**Interfaces:**
- Consumes: `PLAYER_SPEED`, `WORLD_RADIUS` from `src/core/constants.js`.
- Produces: `stickVector(originX, originY, pointerX, pointerY, radius)` returning `{ x, y }` with magnitude clamped to 1, exported from `src/input/joystick.js`. `createJoystick(element)` returning `{ dir: {x, y}, active: boolean, destroy() }`. `createPlayer()` returning a `THREE.Group` from `src/render/actors.js`.

- [ ] **Step 1: Write the failing joystick test**

The vector maths is pure, so it gets real tests. The DOM wiring around it does not.

```js
// tests/joystick.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stickVector } from '../src/input/joystick.js';

test('returns zero at the origin', () => {
  assert.deepEqual(stickVector(100, 100, 100, 100, 50), { x: 0, y: 0 });
});

test('returns a unit vector at the rim', () => {
  const v = stickVector(100, 100, 150, 100, 50);
  assert.equal(v.x, 1);
  assert.equal(v.y, 0);
});

test('clamps magnitude to 1 beyond the rim', () => {
  const v = stickVector(100, 100, 400, 100, 50);
  assert.equal(v.x, 1);
});

test('scales linearly inside the rim', () => {
  const v = stickVector(100, 100, 125, 100, 50);
  assert.equal(v.x, 0.5);
});

test('normalises diagonals so they are not faster', () => {
  const v = stickVector(0, 0, 100, 100, 50);
  assert.ok(Math.abs(Math.hypot(v.x, v.y) - 1) < 1e-9);
});
```

That last test matters: an unnormalised diagonal makes the player move 41% faster on the diagonal, which feels broken and is a classic joystick bug.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/input/joystick.js'`.

- [ ] **Step 3: Write `src/input/joystick.js`**

```js
// src/input/joystick.js

/**
 * Pure: converts a pointer position into a direction vector clamped to unit length.
 * Returns screen-space {x, y}; y is positive downward, as in DOM coordinates.
 */
export function stickVector(originX, originY, pointerX, pointerY, radius) {
  const dx = pointerX - originX;
  const dy = pointerY - originY;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: 0, y: 0 };
  const scale = Math.min(len, radius) / radius / len;
  return { x: dx * scale, y: dy * scale };
}

const RADIUS = 60;

/**
 * Floating joystick: the stick origin is wherever the thumb first lands in the
 * lower-left region, rather than a fixed spot. Far more forgiving on a phone.
 */
export function createJoystick(element) {
  const state = { dir: { x: 0, y: 0 }, active: false };
  let pointerId = null;
  let origin = { x: 0, y: 0 };

  function onDown(e) {
    if (pointerId !== null) return;
    if (e.clientX > window.innerWidth * 0.6) return;   // right side reserved for taps
    pointerId = e.pointerId;
    origin = { x: e.clientX, y: e.clientY };
    state.active = true;
    element.setPointerCapture(e.pointerId);
  }

  function onMove(e) {
    if (e.pointerId !== pointerId) return;
    state.dir = stickVector(origin.x, origin.y, e.clientX, e.clientY, RADIUS);
  }

  function onUp(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    state.active = false;
    state.dir = { x: 0, y: 0 };
  }

  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerup', onUp);
  element.addEventListener('pointercancel', onUp);

  state.destroy = () => {
    element.removeEventListener('pointerdown', onDown);
    element.removeEventListener('pointermove', onMove);
    element.removeEventListener('pointerup', onUp);
    element.removeEventListener('pointercancel', onUp);
  };
  return state;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS, 10 tests total.

- [ ] **Step 5: Write `src/render/actors.js` with the player**

```js
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
```

- [ ] **Step 6: Wire movement into `src/main.js`**

Screen-space stick `y` maps to world `z` because the camera looks down the negative-z axis. Rotating the player toward the movement direction costs two lines and does most of the work of making the character feel alive.

```js
// src/main.js
/* global THREE */
import { createScene } from './render/scene.js';
import { createPlayer } from './render/actors.js';
import { createJoystick } from './input/joystick.js';
import { PLAYER_SPEED, WORLD_RADIUS, CAMERA_HEIGHT, CAMERA_DISTANCE } from './core/constants.js';

const view = createScene(document.getElementById('game'));
const stick = createJoystick(document.getElementById('game'));

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(WORLD_RADIUS, 48),
  new THREE.MeshLambertMaterial({ color: 0xe8eef4 })
);
ground.rotation.x = -Math.PI / 2;
view.scene.add(ground);

const player = createPlayer();
view.scene.add(player);

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  const { x, y } = stick.dir;
  if (x !== 0 || y !== 0) {
    player.position.x += x * PLAYER_SPEED * dt;
    player.position.z += y * PLAYER_SPEED * dt;
    const limit = WORLD_RADIUS - 1;
    if (player.position.length() > limit) player.position.setLength(limit);
    player.rotation.y = Math.atan2(x, y);
  }

  view.camera.position.set(player.position.x, CAMERA_HEIGHT, player.position.z + CAMERA_DISTANCE);
  view.camera.lookAt(player.position.x, 0, player.position.z);

  view.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- [ ] **Step 7: Build and verify movement on both phones**

Run: `npm run build`, reload on the S24 Ultra and the iPhone 16.
Expected: dragging anywhere in the lower-left moves the survivor smoothly, diagonals are not faster than the cardinals, the character turns to face travel, the page never scrolls, and releasing stops movement immediately.

On the iPhone specifically, confirm dragging near the bottom edge does not trigger the home-indicator gesture or a page swipe. If it does, the `touch-action: none` rule is not reaching that element.

- [ ] **Step 8: Commit**

```bash
git add src tests
git commit -m "feat: floating virtual joystick and player movement"
```

---

## Task 4: Heat model and the visible heat ring

This is the signature mechanic. Heat is not a bar — it is the radius of usable world.

**Files:**
- Create: `src/core/heat.js`
- Create: `src/render/ground.js`
- Modify: `src/main.js`
- Test: `tests/heat.test.mjs`

**Interfaces:**
- Consumes: `HEAT_MAX`, `HEAT_START`, `HEAT_DRAIN_DAY`, `RING_MIN`, `RING_MAX`, `WORLD_RADIUS` from constants.
- Produces: `ringRadius(heat)`, `drainHeat(heat, dt, rate)`, `addFuel(heat, amount)` from `src/core/heat.js`. `createGround(scene)` returning `{ setRingRadius(r) }` from `src/render/ground.js`.

- [ ] **Step 1: Write the failing heat test**

```js
// tests/heat.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ringRadius, drainHeat, addFuel } from '../src/core/heat.js';
import { HEAT_MAX, RING_MIN, RING_MAX } from '../src/core/constants.js';

test('zero heat gives the minimum ring', () => {
  assert.equal(ringRadius(0), RING_MIN);
});

test('full heat gives the maximum ring', () => {
  assert.equal(ringRadius(HEAT_MAX), RING_MAX);
});

test('half heat gives the midpoint ring', () => {
  assert.equal(ringRadius(HEAT_MAX / 2), (RING_MIN + RING_MAX) / 2);
});

test('ring radius never goes below the minimum even for negative heat', () => {
  assert.equal(ringRadius(-50), RING_MIN);
});

test('drain reduces heat by rate times dt', () => {
  assert.equal(drainHeat(50, 2, 1.5), 47);
});

test('drain never goes below zero', () => {
  assert.equal(drainHeat(1, 10, 5), 0);
});

test('fuel is clamped at the maximum', () => {
  assert.equal(addFuel(95, 20), HEAT_MAX);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/core/heat.js'`.

- [ ] **Step 3: Write `src/core/heat.js`**

```js
// src/core/heat.js
import { HEAT_MAX, RING_MIN, RING_MAX } from './constants.js';

/** Maps fuel to the physical radius of thawed ground. The whole game is this function. */
export function ringRadius(heat) {
  const t = Math.max(0, Math.min(1, heat / HEAT_MAX));
  return RING_MIN + (RING_MAX - RING_MIN) * t;
}

export function drainHeat(heat, dt, rate) {
  return Math.max(0, heat - rate * dt);
}

export function addFuel(heat, amount) {
  return Math.min(HEAT_MAX, heat + amount);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS, 17 tests total.

- [ ] **Step 5: Write `src/render/ground.js`**

Two stacked discs: frozen ground everywhere, thawed ground scaled to the ring radius on top, plus an emissive rim so the boundary is unmistakable at a glance. Legibility is the one visual property that is scored.

```js
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
```

- [ ] **Step 6: Wire heat into `src/main.js`**

Replace the inline `ground` mesh created in Task 3 with `createGround`, and add the heat state.

```js
// in src/main.js, replacing the inline ground mesh
import { createGround } from './render/ground.js';
import { ringRadius, drainHeat } from './core/heat.js';
import { HEAT_START, HEAT_DRAIN_DAY } from './core/constants.js';

const groundView = createGround(view.scene);

const state = { heat: HEAT_START };

// inside frame(), before view.render():
state.heat = drainHeat(state.heat, dt, HEAT_DRAIN_DAY);
groundView.setRingRadius(ringRadius(state.heat));
```

- [ ] **Step 7: Build and verify the ring shrinks**

Run: `npm run build` and reload.
Expected: a brown thawed disc with a warm rim, visibly shrinking as heat drains. From `HEAT_START` of 60 it should reach zero in roughly 37 seconds, and the disc should contract smoothly rather than stepping. Confirm the contraction is perceptible without staring — if it is not, `HEAT_DRAIN_DAY` needs raising, and that is a `constants.js` edit only.

- [ ] **Step 8: Commit**

```bash
git add src tests
git commit -m "feat: heat model driving a visible thawed-ground radius"
```

---

## Task 5: Resource nodes, harvesting, and the carry stack

**Files:**
- Create: `src/core/carry.js`
- Create: `src/core/nodes.js`
- Modify: `src/render/actors.js`
- Modify: `src/main.js`
- Test: `tests/carry.test.mjs`
- Test: `tests/nodes.test.mjs`

**Interfaces:**
- Consumes: `CARRY_CAP`, `HARVEST_SECONDS`, `HARVEST_RANGE` from constants.
- Produces: `createCarry(cap)`, `carryAdd(c, kind)`, `carryPop(c)`, `carryTotal(c)`, `carryCountOf(c, kind)`, `carryIsFull(c)` from `src/core/carry.js`. `createNode(kind, x, z, amount)` and `tickHarvest(node, dt)` from `src/core/nodes.js`. `createTree(x, z)` and `updateStack(anchor, items)` from `src/render/actors.js`.

- [ ] **Step 1: Write the failing carry test**

```js
// tests/carry.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCarry, carryAdd, carryPop, carryTotal, carryCountOf, carryIsFull } from '../src/core/carry.js';

test('a new carry is empty', () => {
  assert.equal(carryTotal(createCarry(8)), 0);
});

test('adding returns true and increases the total', () => {
  const c = createCarry(2);
  assert.equal(carryAdd(c, 'wood'), true);
  assert.equal(carryTotal(c), 1);
});

test('adding beyond capacity returns false and does not grow', () => {
  const c = createCarry(1);
  carryAdd(c, 'wood');
  assert.equal(carryAdd(c, 'wood'), false);
  assert.equal(carryTotal(c), 1);
});

test('reports full at capacity', () => {
  const c = createCarry(1);
  carryAdd(c, 'wood');
  assert.equal(carryIsFull(c), true);
});

test('pop returns items last-in-first-out', () => {
  const c = createCarry(4);
  carryAdd(c, 'wood');
  carryAdd(c, 'stone');
  assert.equal(carryPop(c), 'stone');
  assert.equal(carryPop(c), 'wood');
});

test('pop on an empty carry returns null', () => {
  assert.equal(carryPop(createCarry(4)), null);
});

test('counts by kind', () => {
  const c = createCarry(8);
  carryAdd(c, 'wood');
  carryAdd(c, 'wood');
  carryAdd(c, 'stone');
  assert.equal(carryCountOf(c, 'wood'), 2);
  assert.equal(carryCountOf(c, 'meat'), 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/core/carry.js'`.

- [ ] **Step 3: Write `src/core/carry.js`**

```js
// src/core/carry.js

export function createCarry(cap) {
  return { cap, items: [] };
}

export function carryTotal(c) {
  return c.items.length;
}

export function carryIsFull(c) {
  return c.items.length >= c.cap;
}

export function carryAdd(c, kind) {
  if (carryIsFull(c)) return false;
  c.items.push(kind);
  return true;
}

export function carryPop(c) {
  return c.items.length === 0 ? null : c.items.pop();
}

export function carryCountOf(c, kind) {
  let n = 0;
  for (const k of c.items) if (k === kind) n++;
  return n;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS, 24 tests total.

- [ ] **Step 5: Write the failing nodes test**

```js
// tests/nodes.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, tickHarvest } from '../src/core/nodes.js';
import { HARVEST_SECONDS } from '../src/core/constants.js';

test('a new node holds its full amount and is not depleted', () => {
  const n = createNode('wood', 5, 5, 3);
  assert.equal(n.remaining, 3);
  assert.equal(n.depleted, false);
});

test('ticking below the harvest time yields nothing', () => {
  const n = createNode('wood', 0, 0, 3);
  assert.equal(tickHarvest(n, HARVEST_SECONDS * 0.5).yielded, false);
});

test('ticking past the harvest time yields one item', () => {
  const n = createNode('wood', 0, 0, 3);
  const r = tickHarvest(n, HARVEST_SECONDS + 0.01);
  assert.equal(r.yielded, true);
  assert.equal(r.kind, 'wood');
  assert.equal(n.remaining, 2);
});

test('progress carries over rather than resetting', () => {
  const n = createNode('wood', 0, 0, 3);
  tickHarvest(n, HARVEST_SECONDS * 0.6);
  assert.equal(tickHarvest(n, HARVEST_SECONDS * 0.6).yielded, true);
});

test('a node depletes and then yields nothing further', () => {
  const n = createNode('wood', 0, 0, 1);
  tickHarvest(n, HARVEST_SECONDS + 0.01);
  assert.equal(n.depleted, true);
  assert.equal(tickHarvest(n, HARVEST_SECONDS + 0.01).yielded, false);
});
```

That fourth test is the one that matters for feel: resetting progress on each frame boundary would make harvesting stutter unpredictably.

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/core/nodes.js'`.

- [ ] **Step 7: Write `src/core/nodes.js`**

```js
// src/core/nodes.js
import { HARVEST_SECONDS } from './constants.js';

export function createNode(kind, x, z, amount) {
  return { kind, x, z, remaining: amount, progress: 0, depleted: false };
}

/** Advances harvest progress. Returns { yielded, kind } for the caller to push into a carry. */
export function tickHarvest(node, dt) {
  if (node.depleted) return { yielded: false, kind: null };

  node.progress += dt;
  if (node.progress < HARVEST_SECONDS) return { yielded: false, kind: null };

  node.progress -= HARVEST_SECONDS;    // carry the remainder over, do not reset
  node.remaining -= 1;
  if (node.remaining <= 0) node.depleted = true;
  return { yielded: true, kind: node.kind };
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test`
Expected: PASS, 29 tests total.

- [ ] **Step 9: Add the tree and the carried stack to `src/render/actors.js`**

The visible stack is the single most important piece of feedback in the slice. It is the reason hauling feels good.

```js
// append to src/render/actors.js
/* global THREE */

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
```

- [ ] **Step 10: Wire harvesting into `src/main.js`**

```js
// additions to src/main.js
import { createTree, updateStack } from './render/actors.js';
import { createNode, tickHarvest } from './core/nodes.js';
import { createCarry, carryAdd, carryTotal, carryIsFull } from './core/carry.js';
import { CARRY_CAP, HARVEST_RANGE } from './core/constants.js';

const carry = createCarry(CARRY_CAP);
const nodes = [];

for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2;
  const r = 14 + (i % 3) * 4;
  const node = createNode('wood', Math.cos(a) * r, Math.sin(a) * r, 6);
  node.mesh = createTree(node.x, node.z);
  view.scene.add(node.mesh);
  nodes.push(node);
}

let lastStackCount = 0;

// inside frame(), after movement:
if (!carryIsFull(carry)) {
  for (const node of nodes) {
    if (node.depleted) continue;
    const dx = node.x - player.position.x;
    const dz = node.z - player.position.z;
    if (dx * dx + dz * dz > HARVEST_RANGE * HARVEST_RANGE) continue;

    const { yielded, kind } = tickHarvest(node, dt);
    if (yielded) {
      carryAdd(carry, kind);
      if (node.depleted) node.mesh.visible = false;
    }
    break;   // harvest one node at a time
  }
}

if (carryTotal(carry) !== lastStackCount) {
  updateStack(player.userData.stackAnchor, carry.items);
  lastStackCount = carryTotal(carry);
}
```

- [ ] **Step 11: Build and verify the core verb**

Run: `npm run build` and reload on the S24 Ultra.
Expected: walking into a tree starts producing logs roughly every 0.7s, each one visibly appearing on the survivor's back as the stack grows; the stack stops at 8; the tree disappears after 6 logs. **This is the moment to judge whether the verb feels good.** If it does not feel satisfying here, adjust `HARVEST_SECONDS` and `CARRY_CAP` in `constants.js` before building anything on top of it.

- [ ] **Step 12: Commit**

```bash
git add src tests
git commit -m "feat: resource nodes, proximity harvesting, and the visible carry stack"
```

---

## Task 6: Furnace, walk-in deposit pad, and the HUD

**Files:**
- Create: `src/core/store.js`
- Create: `src/ui/hud.js`
- Modify: `src/render/actors.js`
- Modify: `src/main.js`
- Test: `tests/store.test.mjs`

**Interfaces:**
- Consumes: `carryPop` from `src/core/carry.js`, `addFuel` from `src/core/heat.js`, `DEPOSIT_INTERVAL` from constants.
- Produces: `RESOURCES`, `createStore()`, `storeAdd(s, kind, n)`, `storeSpend(s, kind, n)` from `src/core/store.js`. `createFurnace()` returning a `THREE.Group` with `userData.setFlame(t)` from `src/render/actors.js`. `createHud(root)` returning `{ update(store, heat) }` from `src/ui/hud.js`.

- [ ] **Step 1: Write the failing store test**

```js
// tests/store.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RESOURCES, createStore, storeAdd, storeSpend } from '../src/core/store.js';

test('the four resources are wood, meat, water and stone', () => {
  assert.deepEqual(RESOURCES, ['wood', 'meat', 'water', 'stone']);
});

test('a new store has every resource at zero', () => {
  const s = createStore();
  for (const r of RESOURCES) assert.equal(s[r], 0);
});

test('adding increases the named resource only', () => {
  const s = createStore();
  storeAdd(s, 'wood', 3);
  assert.equal(s.wood, 3);
  assert.equal(s.stone, 0);
});

test('spending succeeds when affordable and deducts', () => {
  const s = createStore();
  storeAdd(s, 'wood', 5);
  assert.equal(storeSpend(s, 'wood', 3), true);
  assert.equal(s.wood, 2);
});

test('spending fails when unaffordable and does not deduct', () => {
  const s = createStore();
  storeAdd(s, 'wood', 2);
  assert.equal(storeSpend(s, 'wood', 3), false);
  assert.equal(s.wood, 2);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/core/store.js'`.

- [ ] **Step 3: Write `src/core/store.js`**

```js
// src/core/store.js

export const RESOURCES = ['wood', 'meat', 'water', 'stone'];

export function createStore() {
  return { wood: 0, meat: 0, water: 0, stone: 0 };
}

export function storeAdd(store, kind, n = 1) {
  store[kind] += n;
  return store[kind];
}

export function storeSpend(store, kind, n) {
  if (store[kind] < n) return false;
  store[kind] -= n;
  return true;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS, 34 tests total.

- [ ] **Step 5: Add the furnace to `src/render/actors.js`**

Flame height maps to fuel, which is the readout the player actually uses. The number in the HUD is the backup, not the primary.

```js
// append to src/render/actors.js
/* global THREE */

export function createFurnace() {
  const g = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.8, 2.2, 8),
    new THREE.MeshLambertMaterial({ color: 0x5a5a5f })
  );
  base.position.y = 1.1;
  g.add(base);

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 2.0, 6),
    new THREE.MeshBasicMaterial({ color: 0xff8c1a })
  );
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
  const pad = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd36e, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.03;
  g.add(pad);
  g.userData.padRadius = 3.2;

  return g;
}
```

- [ ] **Step 6: Write `src/ui/hud.js`**

DOM overlay rather than in-canvas text: crisper, cheaper, and trivially safe-area aware. `pointer-events: none` keeps it from eating joystick drags.

```js
// src/ui/hud.js
import { RESOURCES } from '../core/store.js';
import { HEAT_MAX } from '../core/constants.js';

const ICONS = { wood: '🪵', meat: '🥩', water: '💧', stone: '🪨' };

export function createHud(root) {
  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:absolute', 'top:12px', 'right:12px',
    'display:flex', 'flex-direction:column', 'gap:6px',
    'font:600 15px system-ui', 'color:#fff',
    'text-shadow:0 1px 3px rgba(0,0,0,.6)', 'pointer-events:none',
  ].join(';');

  const rows = {};
  for (const r of RESOURCES) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;background:rgba(0,0,0,.35);border-radius:14px;padding:3px 10px 3px 6px;min-width:76px';
    row.innerHTML = `<span style="font-size:17px">${ICONS[r]}</span><span data-v>0</span>`;
    panel.appendChild(row);
    rows[r] = row.querySelector('[data-v]');
  }

  const fuel = document.createElement('div');
  fuel.style.cssText = [
    'position:absolute', 'top:12px', 'left:12px',
    'font:700 15px system-ui', 'color:#ffd36e',
    'background:rgba(0,0,0,.35)', 'border-radius:14px', 'padding:4px 12px',
    'text-shadow:0 1px 3px rgba(0,0,0,.6)', 'pointer-events:none',
  ].join(';');

  root.appendChild(panel);
  root.appendChild(fuel);

  return {
    update(store, heat) {
      for (const r of RESOURCES) rows[r].textContent = String(store[r]);
      fuel.textContent = `🔥 ${Math.ceil((heat / HEAT_MAX) * 100)}%`;
    },
  };
}
```

The `#ui` element already carries `env(safe-area-inset-*)` padding from the template, so these absolute offsets sit inside the Dynamic Island and the punch-hole camera automatically.

- [ ] **Step 7: Wire the deposit pad into `src/main.js`**

Items leave the stack one at a time on a timer rather than all at once. The staccato drain is the payoff for the haul, and dumping the whole stack instantly throws that away.

```js
// additions to src/main.js
import { createFurnace } from './render/actors.js';
import { createStore, storeAdd } from './core/store.js';
import { createHud } from './ui/hud.js';
import { carryPop } from './core/carry.js';
import { addFuel } from './core/heat.js';
import { DEPOSIT_INTERVAL, HEAT_MAX } from './core/constants.js';

const furnace = createFurnace();
view.scene.add(furnace);

const store = createStore();
const hud = createHud(document.getElementById('ui'));

let depositTimer = 0;

// inside frame(), after harvesting:
const pdx = player.position.x - furnace.position.x;
const pdz = player.position.z - furnace.position.z;
const onPad = pdx * pdx + pdz * pdz <= furnace.userData.padRadius ** 2;

if (onPad && carryTotal(carry) > 0) {
  depositTimer += dt;
  while (depositTimer >= DEPOSIT_INTERVAL && carryTotal(carry) > 0) {
    depositTimer -= DEPOSIT_INTERVAL;
    const kind = carryPop(carry);
    storeAdd(store, kind, 1);
    if (kind === 'wood') state.heat = addFuel(state.heat, 6);
  }
} else {
  depositTimer = 0;
}

furnace.userData.setFlame(state.heat / HEAT_MAX);
hud.update(store, state.heat);
```

- [ ] **Step 8: Build and verify the full loop**

Run: `npm run build` and reload on both phones.
Expected, end to end: joystick out to a tree, logs stack visibly on the back, haul back to the furnace, step onto the glowing pad, logs drain off one at a time with the wood counter ticking up, the flame visibly grows, and **the thawed ring physically expands outward**. Step off mid-deposit and it pauses; step back on and it resumes.

Confirm on the iPhone that the resource counters clear the Dynamic Island and the fuel readout is not clipped.

- [ ] **Step 9: Run the full test suite and package**

Run: `npm test && npm run build && npm run package`
Expected: 34 tests passing, then `OK  emberline.zip  N.NNMb`.

- [ ] **Step 10: Verify the packaged build offline**

Extract `emberline.zip` to a fresh directory, serve it from there, and load it with the browser's network throttling set to **Offline**.
Expected: the game runs completely. Any failed request in the Network tab is a submission-blocking bug and must be fixed now, not later.

- [ ] **Step 11: Update the build log and commit**

Append a Session 002 entry to `BUILD_LOG.md` following the established format — decisions locked, what was prompted, what the AI produced and whether it worked first time, any hand edits and why, how it was verified.

```bash
git add src tests BUILD_LOG.md
git commit -m "feat: furnace deposit pad, resource store, and safe-area HUD"
git push
```

---

## Milestone Exit Criteria

The slice is done when all of these hold on **both** the Galaxy S24 Ultra and the iPhone 16:

- [ ] A player can complete the full loop unaided: move, harvest, haul, deposit, and see the ring grow.
- [ ] The joystick works from anywhere in the lower-left, diagonals are not faster than cardinals, and the page never scrolls or rubber-bands.
- [ ] The carried stack is visible and its height tracks the carried count.
- [ ] Deposit is staccato, one item at a time, and pauses when stepping off the pad.
- [ ] The heat ring visibly grows on deposit and visibly shrinks over time.
- [ ] The HUD clears the Dynamic Island and the punch-hole camera.
- [ ] `renderer.getPixelRatio()` returns 2 on the S24 Ultra.
- [ ] `npm test` passes.
- [ ] `npm run package` passes validation and the extracted zip runs fully offline.

---

## Subsequent Milestone Plans

Written after this slice ships, so each is informed by what the previous one taught. Each produces working software on its own.

| Plan | Days | Scope |
|---|---|---|
| 2 — Cycle and threat | 3–5 | Day/night cycle, dusk telegraph, three gates, wolves, guard squad, rally taps |
| 3 — Full economy | 6–8 | Meat, water and stone nodes, ghost-build plots, walk-in pads, rescue and survivor assignment |
| 4 — Session arc | 9–11 | Escalation curve, bear, whiteout finale, win/lose, tally, restart |
| 5 — Tuning | 12–14 | Balance pass, game feel, hitstop, screenshake, WebAudio SFX |
| 6 — Presentation | 15–16 | Generated HUD icons and textures, legibility pass, mobile performance |
| 7 — Submission | 17–18 | Final packaging, offline validation, Design-Intent Document, build log finalisation |
