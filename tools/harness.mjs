// tools/harness.mjs
//
// DEV ONLY. Never part of the packaged zip — see the guard test in
// tests/package.test.mjs, which fails if any of this reaches index.html.
//
// Why this exists: an automated browser can evaluate JavaScript in the page
// without the page being composited to screen, and when it is not compositing,
// requestAnimationFrame never fires. The game loop simply does not run, so
// nothing can be observed and no screenshot can be taken.
//
// The fix is to take the clock away from the browser. This injects a shim that
// replaces requestAnimationFrame with a queue the caller pumps by hand, so
// frames advance on demand, deterministically, with an exact dt. A WebGL
// canvas can then be read back with toDataURL in the same turn as the render,
// and posted to the dev server to be written out as a real image file.
//
// The side benefit is that this is a far better testing instrument than a live
// preview: frames are reproducible, and "advance exactly 12 seconds" is one
// call rather than a wall-clock wait.

export const SHOT_ROUTE = '/__shot';
export const HARNESS_ROUTE = '/index.harness.html';

/**
 * The shim, as a string to be injected ahead of the game's own script.
 *
 * Exposes on window:
 *   __step(dtMs)      run exactly one frame
 *   __run(ms, dtMs)   run many frames, advancing the clock by dtMs each
 *   __shoot(width)    capture the canvas, downscaled, as a JPEG data URL
 *   __save(name, w)   capture and POST it to the dev server to be written out
 */
export const SHIM = `
<script>
(() => {
  const queued = [];
  let clock = 0;

  // The game calls requestAnimationFrame(frame) once at startup and re-arms it
  // at the end of every frame, so draining the queue each step keeps exactly
  // one callback in flight, just as the real scheduler would.
  window.requestAnimationFrame = (cb) => { queued.push(cb); return queued.length; };
  window.cancelAnimationFrame = () => {};

  window.__step = (dtMs = 16.7) => {
    clock += dtMs;
    const batch = queued.splice(0, queued.length);
    for (const cb of batch) cb(clock);
    return clock;
  };

  window.__run = (ms, dtMs = 16.7) => {
    const steps = Math.max(1, Math.round(ms / dtMs));
    for (let i = 0; i < steps; i++) window.__step(dtMs);
    return { clock, steps };
  };

  // preserveDrawingBuffer is false, so the WebGL buffer is only valid inside
  // the turn that drew it. Stepping one frame immediately before reading back
  // guarantees there is something to read.
  window.__shoot = (width = 375) => {
    window.__step();
    const src = document.getElementById('game');
    const scale = width / src.width;
    const out = document.createElement('canvas');
    out.width = Math.round(src.width * scale);
    out.height = Math.round(src.height * scale);
    out.getContext('2d').drawImage(src, 0, 0, out.width, out.height);
    return out.toDataURL('image/jpeg', 0.82);
  };

  window.__save = async (name = 'shot', width = 375) => {
    const dataUrl = window.__shoot(width);
    const res = await fetch(${JSON.stringify(SHOT_ROUTE)}, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: name + '\\n' + dataUrl,
    });
    return res.ok ? await res.text() : 'FAILED ' + res.status;
  };
})();
</script>
`;

/**
 * Injects the shim immediately before the game's inline script.
 *
 * Anchoring on the vendor script tag means the shim is installed after Three.js
 * is available but before a single line of game code runs, which is the only
 * window in which requestAnimationFrame can still be swapped out.
 */
export function injectShim(html) {
  const anchor = '<script src="./vendor/three.js"></script>';
  if (!html.includes(anchor)) {
    throw new Error('harness: could not find the vendor script tag to anchor the shim to');
  }
  return html.replace(anchor, anchor + SHIM);
}

/** Parses a `name\ndata:image/jpeg;base64,...` body into a filename and bytes. */
export function parseShot(body) {
  const cut = body.indexOf('\n');
  if (cut === -1) throw new Error('harness: malformed shot body');

  const rawName = body.slice(0, cut).trim();
  // The name becomes a filename, so allow nothing that could escape a directory.
  const name = rawName.replace(/[^a-zA-Z0-9._-]/g, '') || 'shot';

  const dataUrl = body.slice(cut + 1).trim();
  const marker = ';base64,';
  const at = dataUrl.indexOf(marker);
  if (!dataUrl.startsWith('data:image/') || at === -1) {
    throw new Error('harness: body is not a base64 image data URL');
  }

  const ext = dataUrl.slice('data:image/'.length, at).split(';')[0] === 'png' ? 'png' : 'jpg';
  return { name: `${name}.${ext}`, bytes: Buffer.from(dataUrl.slice(at + marker.length), 'base64') };
}
