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
