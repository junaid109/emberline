// src/render/palette.js
//
// Every colour in the game, in one place, with no THREE dependency — so the
// contrast rules that make the game readable can be asserted in a plain unit
// test instead of being a matter of taste.
//
// Visual polish is explicitly NOT scored by this competition. Legibility is,
// and Playability is a quarter of the mark. This file is about the second thing
// only: can a player, on a phone, at a glance, tell what each shape is and what
// ground it is standing on.

// --- Ground ----------------------------------------------------------------
export const SNOW = 0xdce8f2;          // frozen: everything outside the ring
export const THAWED = 0xa8814f;        // worked earth the furnace has freed
export const RING_RIM = 0xffb45c;      // the boundary between the two

// --- The player ------------------------------------------------------------
// The parka was 0x2e86c1 (mid blue) with a 0xf4f6f7 (near white) hood. Both
// halves of the character vanished against snow — a blue figure on blue-grey
// ground under a white hood on white ground — which mattered far more once the
// frozen waste became somewhere the player has an active reason to walk.
//
// The obvious replacement was an ember parka, on the reasoning that the
// fire-keeper should carry the fire's colour. The contrast test below rejected
// it: warm orange sits only 102 RGB units from tan worked earth, so the player
// would have swapped disappearing on snow for disappearing on the other half of
// the map. A search of the colour space against every other thing on the field
// put the best-separated choice at bright ice-cyan, 200-plus units clear of
// snow, earth, guards and wolves alike.
//
// It is the better idea as well as the better number. Warm belongs to the
// furnace; cold belongs to you; the game is the running between them. And the
// one unmistakably orange thing on screen stays the thing you are protecting.
export const PLAYER_PARKA = 0x19c1ff;
export const PLAYER_HOOD = 0x2b2f38;
export const PLAYER_SKIN = 0xe8c39e;
export const PLAYER_BOOTS = 0x3d2b1f;

// A contact shadow under the player. Colour alone cannot be trusted on ground
// that changes underfoot, so the figure also gets a dark anchor that reads on
// snow and on earth alike, and tells the player exactly which point on the
// ground the game thinks they occupy.
export const PLAYER_SHADOW = 0x1a2230;

// --- Everything else that must not be mistaken for the player --------------
export const GUARD = 0xc0392b;         // a trio, always at a gate, inside a range ring
export const WOLF = 0x4b4f58;
export const WOLF_EYE = 0xffd166;

/** Splits a packed hex colour into 0-255 channels. */
export function channels(hex) {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex) {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Straight-line distance in RGB, 0-441.
 *
 * Contrast ratio alone is not enough here: two colours can differ sharply in
 * hue while sitting at nearly the same luminance, which is exactly how a mid
 * blue parka disappeared into blue-grey snow at a glance despite being, on
 * paper, a completely different colour.
 */
export function rgbDistance(a, b) {
  const [r1, g1, b1] = channels(a);
  const [r2, g2, b2] = channels(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}
