// tests/package.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateZipContents, listZipEntries } from '../tools/package.mjs';

// Builds a real zip on disk under a fresh temp directory, using the same
// platform-conditional approach tools/package.mjs uses to build emberline.zip
// (PowerShell Compress-Archive on win32, `zip` elsewhere). Returns the zip
// path and a cleanup function that removes the whole temp directory.
function makeZipFixture(build) {
  const dir = mkdtempSync(join(tmpdir(), 'emberline-pkg-test-'));
  const srcDir = join(dir, 'src');
  mkdirSync(srcDir, { recursive: true });
  build(srcDir);

  const zipPath = join(dir, 'fixture.zip');
  if (process.platform === 'win32') {
    execFileSync('powershell', [
      '-NoProfile', '-Command',
      `Compress-Archive -Path '${join(srcDir, '*')}' -DestinationPath '${zipPath}' -Force`,
    ], { stdio: 'pipe' });
  } else {
    execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: srcDir, stdio: 'pipe' });
  }

  const cleanup = () => rmSync(dir, { recursive: true, force: true });
  return { zipPath, cleanup };
}

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
  const r = validateZipContents(
    ['index.html', 'vendor/three.js'],
    1000,
    '<script src="./vendor/three.js"></script>\nfetch("./data/levels.json")'
  );
  assert.equal(r.ok, true);
});

test('rejects a template-literal (backtick) external URL', () => {
  const r = validateZipContents(
    ['index.html'],
    1000,
    'fetch(`https://cdn.example.com/three.js`)'
  );
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('external URL')));
});

test('does not flag relative paths as false positives', () => {
  const r = validateZipContents(
    ['index.html', 'vendor/three.js'],
    1000,
    '<script src="./vendor/three.js"></script>\nfetch("./data/levels.json")'
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
});

test('rejects a nested index.html read from a real zip entry list', () => {
  const r = validateZipContents(['game/index.html', 'game/vendor/three.js'], 1000, '');
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('top level')));
});

test('listZipEntries on a real zip with index.html at the top level reports it at the top level', () => {
  const { zipPath, cleanup } = makeZipFixture((srcDir) => {
    writeFileSync(join(srcDir, 'index.html'), '<html></html>');
    mkdirSync(join(srcDir, 'vendor'));
    writeFileSync(join(srcDir, 'vendor', 'three.js'), '// vendor');
  });
  try {
    const entries = listZipEntries(zipPath);
    assert.ok(entries.includes('index.html'), `expected top-level index.html, got: ${entries.join(', ')}`);
    assert.ok(!entries.some((e) => e !== 'index.html' && e.endsWith('/index.html')));

    const r = validateZipContents(entries, 1000, '<script src="./vendor/three.js"></script>');
    assert.equal(r.ok, true);
    assert.deepEqual(r.errors, []);
  } finally {
    cleanup();
  }
});

// This is the regression test for the original bug: the old packaging script
// fabricated its file list from the source tree with 'index.html' hardcoded,
// so it could never see that index.html actually landed inside a subfolder of
// the real zip. listZipEntries reads the archive itself, so it must surface
// the nesting.
test('listZipEntries on a real zip with index.html nested in a folder reports the nesting, and validation fails', () => {
  const { zipPath, cleanup } = makeZipFixture((srcDir) => {
    mkdirSync(join(srcDir, 'game'));
    writeFileSync(join(srcDir, 'game', 'index.html'), '<html></html>');
    mkdirSync(join(srcDir, 'game', 'vendor'));
    writeFileSync(join(srcDir, 'game', 'vendor', 'three.js'), '// vendor');
  });
  try {
    const entries = listZipEntries(zipPath);
    assert.ok(
      entries.some((e) => e === 'game/index.html'),
      `expected a nested game/index.html entry, got: ${entries.join(', ')}`
    );
    assert.ok(!entries.includes('index.html'));

    const r = validateZipContents(entries, 1000, '<html></html>');
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes('top level')));
  } finally {
    cleanup();
  }
});

// --- new rules: catch a package built without `npm run vendor`, or with Three.js inlined ---

test('rejects a zip with no vendor/ entry at all (npm run vendor never ran)', () => {
  const r = validateZipContents(
    ['index.html'],
    1000,
    '<script src="./vendor/three.js"></script>'
  );
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('vendor')));
});

test('accepts a vendor/ entry that is not exactly vendor/three.js, as long as the directory is present', () => {
  const r = validateZipContents(
    ['index.html', 'vendor/', 'vendor/three.js'],
    1000,
    '<script src="./vendor/three.js"></script>'
  );
  assert.equal(r.ok, true);
});

test('rejects index.html that does not load Three.js via a relative ./vendor/three.js script tag', () => {
  const r = validateZipContents(
    ['index.html', 'vendor/three.js'],
    1000,
    '<html><body>no script tag here</body></html>'
  );
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('./vendor/three.js')));
});

test('rejects a root-absolute script src', () => {
  const r = validateZipContents(
    ['index.html', 'vendor/three.js'],
    1000,
    '<script src="./vendor/three.js"></script><script src="/vendor/other.js"></script>'
  );
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('non-relative')));
});

test('rejects a drive-absolute script src', () => {
  const r = validateZipContents(
    ['index.html', 'vendor/three.js'],
    1000,
    '<script src="./vendor/three.js"></script><link href="C:\\Users\\dev\\styles.css">'
  );
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('non-relative')));
});

test('does not flag a protocol-relative-looking or query-string relative path as absolute', () => {
  const r = validateZipContents(
    ['index.html', 'vendor/three.js'],
    1000,
    '<script src="./vendor/three.js"></script><link rel="preload" href="./data/levels.json?v=2">'
  );
  assert.equal(r.ok, true);
});

test('rejects index.html over the 400KB size ceiling, as a signal Three.js may be embedded', () => {
  const bloated = '<script src="./vendor/three.js"></script>' + 'x'.repeat(401 * 1024);
  const r = validateZipContents(['index.html', 'vendor/three.js'], 1000, bloated);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('400KB')));
});

test('rejects index.html containing an internal Three.js marker, meaning the library was inlined', () => {
  const embedded = '<script src="./vendor/three.js"></script><script>const ShaderChunk = {};</script>';
  const r = validateZipContents(['index.html', 'vendor/three.js'], 1000, embedded);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('ShaderChunk')));
});

test('a small, well-formed index.html referencing THREE.* APIs (but not embedding the library) passes', () => {
  const legit = '<script src="./vendor/three.js"></script><script>const r = new THREE.WebGLRenderer({});</script>';
  const r = validateZipContents(['index.html', 'vendor/three.js'], 1000, legit);
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
});

test('listZipEntries throws on a nonexistent zip path rather than returning an empty list', () => {
  const dir = mkdtempSync(join(tmpdir(), 'emberline-pkg-test-'));
  try {
    const missingPath = join(dir, 'does-not-exist.zip');
    assert.throws(() => listZipEntries(missingPath));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Regression: the module used to call pathToFileURL(process.argv[1]) unguarded at
// import time, so importing it where argv[1] is undefined threw ERR_INVALID_ARG_TYPE.
test('the module can be imported when process.argv[1] is undefined', async () => {
  const saved = process.argv[1];
  try {
    process.argv[1] = undefined;
    const mod = await import(`../tools/package.mjs?guard=${saved ? 1 : 0}`);
    assert.equal(typeof mod.validateZipContents, 'function');
  } finally {
    process.argv[1] = saved;
  }
});
