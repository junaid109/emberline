// Legibility rules for the palette.
//
// Visual polish is explicitly not scored by this competition; legibility is,
// and Playability carries a quarter of the mark. These tests are about one
// question only: on a phone, at a glance, can you tell what each shape is and
// which ground it is standing on?
//
// They exist because a real failure got all the way to a screenshot. The player
// wore a mid-blue parka under a near-white hood, and stood on blue-grey snow:
// on paper three different colours, in practice one shape you had to hunt for.
// It only became urgent once the frozen waste turned into somewhere the player
// has an active reason to go.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SNOW, THAWED, RING_RIM,
  PLAYER_PARKA, PLAYER_HOOD, PLAYER_SHADOW,
  GUARD, WOLF, WOLF_EYE,
  contrast, rgbDistance, luminance,
} from '../src/render/palette.js';

/** Both grounds the player can stand on, and must be visible against. */
const GROUNDS = [['snow', SNOW], ['thawed earth', THAWED]];

test('the player reads against BOTH grounds, not just one', () => {
  // The bug this file exists for. Passing on one ground is not enough: the
  // player crosses the ring constantly, and the ring itself moves.
  for (const [name, ground] of GROUNDS) {
    assert.ok(rgbDistance(PLAYER_PARKA, ground) > 120,
      `the parka is only ${rgbDistance(PLAYER_PARKA, ground).toFixed(0)} away from ${name}`);
    assert.ok(contrast(PLAYER_PARKA, ground) > 1.6,
      `the parka has ${contrast(PLAYER_PARKA, ground).toFixed(2)}:1 contrast on ${name}`);
  }
});

test('the hood is not the same colour as the snow it stands on', () => {
  // The old hood was 0xf4f6f7 and the snow is 0xdce8f2: a white head on a white
  // field, which erased the top third of the character exactly where the
  // silhouette does the most work.
  assert.ok(rgbDistance(PLAYER_HOOD, SNOW) > 150,
    'the hood vanishes into the snow');
  assert.ok(luminance(PLAYER_HOOD) < luminance(SNOW),
    'the hood should read as a dark silhouette against a bright field');
});

test('the contact shadow anchors the player on either ground', () => {
  // Colour alone cannot be trusted on ground that changes underfoot, so the
  // figure carries its own dark anchor.
  for (const [name, ground] of GROUNDS) {
    assert.ok(luminance(PLAYER_SHADOW) < luminance(ground),
      `the shadow is not darker than ${name}`);
    assert.ok(contrast(PLAYER_SHADOW, ground) > 2,
      `the shadow only manages ${contrast(PLAYER_SHADOW, ground).toFixed(2)}:1 on ${name}`);
  }
});

test('the player cannot be mistaken for a guard at a glance', () => {
  // Both are warm and both are small. The guards appear as a trio inside a
  // range ring at a gate, which carries most of the distinction — but the
  // colours must not do the opposite and actively merge.
  assert.ok(rgbDistance(PLAYER_PARKA, GUARD) > 90,
    `parka and guard are only ${rgbDistance(PLAYER_PARKA, GUARD).toFixed(0)} apart`);
});

test('the player cannot be mistaken for a wolf', () => {
  // The one confusion that would actually cost a run, since it would be read at
  // night, in a hurry, while deciding whether to rally.
  assert.ok(rgbDistance(PLAYER_PARKA, WOLF) > 150,
    'the player and a wolf are too close in colour');
  assert.ok(luminance(PLAYER_PARKA) > luminance(WOLF) * 2,
    'the player must be the bright thing and the wolf the dark thing');
});

test('wolves read as dark shapes against the snow they cross', () => {
  assert.ok(luminance(WOLF) < luminance(SNOW) / 3,
    'wolves are not dark enough to be seen coming across a snowfield');
  assert.ok(contrast(WOLF_EYE, WOLF) > 3,
    'wolf eyes do not stand out from the wolf, so a wolf has no facing');
});

test('the ring rim is distinct from both grounds it divides', () => {
  // The rim is the single most important line on the screen: it is the border
  // of the map. If it blends into either side, the mechanic has no edge.
  assert.ok(rgbDistance(RING_RIM, SNOW) > 90, 'the rim blends into the snow');
  assert.ok(rgbDistance(RING_RIM, THAWED) > 90, 'the rim blends into the thawed earth');
});

test('the two grounds are obviously different from each other', () => {
  // If snow and thawed earth looked alike, the player could not see the map
  // their own furnace is drawing, and the whole idea would be invisible.
  assert.ok(rgbDistance(SNOW, THAWED) > 150,
    'thawed ground does not read as different from frozen ground');
  assert.ok(contrast(SNOW, THAWED) > 2,
    'the two grounds are too close in brightness to separate at a glance');
});

test('every actor colour is a valid 24-bit value', () => {
  for (const c of [SNOW, THAWED, RING_RIM, PLAYER_PARKA, PLAYER_HOOD,
    PLAYER_SHADOW, GUARD, WOLF, WOLF_EYE]) {
    assert.ok(Number.isInteger(c) && c >= 0 && c <= 0xffffff, `bad colour ${c}`);
  }
});
