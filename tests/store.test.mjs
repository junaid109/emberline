// tests/store.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RESOURCES, createStore, storeAdd, storeSpend } from '../src/core/store.js';

test('the three resources are wood, coal and meat', () => {
  assert.deepEqual(RESOURCES, ['wood', 'coal', 'meat']);
});

test('every resource the HUD shows can actually be obtained', () => {
  // The test that was missing. RESOURCES drives the HUD directly, so anything
  // listed here gets a counter on screen whether or not the game can ever award
  // it — and 'water' sat there as a permanent zero for weeks precisely because
  // the old test asserted the LIST rather than the list's truth.
  //
  // The submission checklist requires that nothing is "half-finished or left in
  // as a stub", and a counter that can never move is the clearest possible
  // example. So: every resource must be reachable, and the proof is that the
  // simulation names it at a point where it enters the player's hands.
  const core = ['world.js', 'worldgen.js', 'nodes.js']
    .map((f) => readFileSync(new URL(`../src/core/${f}`, import.meta.url), 'utf8'))
    .join('\n');

  for (const kind of RESOURCES) {
    const awarded = new RegExp(`carryAdd\\([^)]*['"]${kind}['"]`).test(core);
    const grows = new RegExp(`createNode\\(\\s*['"]${kind}['"]`).test(core);
    assert.ok(
      awarded || grows,
      `'${kind}' has a HUD counter but nothing in the simulation ever grants it`
    );
  }
});

test('a new store has every resource at zero', () => {
  const s = createStore();
  for (const r of RESOURCES) assert.equal(s[r], 0);
});

test('adding increases the named resource only', () => {
  const s = createStore();
  storeAdd(s, 'wood', 3);
  assert.equal(s.wood, 3);
  assert.equal(s.coal, 0);
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
