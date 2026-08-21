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
  const r = validateZipContents(['index.html'], 1000, 'fetch("./data/levels.json")');
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
    ['index.html'],
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

    const r = validateZipContents(entries, 1000, '<html></html>');
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

test('listZipEntries throws on a nonexistent zip path rather than returning an empty list', () => {
  const dir = mkdtempSync(join(tmpdir(), 'emberline-pkg-test-'));
  try {
    const missingPath = join(dir, 'does-not-exist.zip');
    assert.throws(() => listZipEntries(missingPath));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
