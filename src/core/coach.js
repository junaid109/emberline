// src/core/coach.js
//
// What the player should be doing right now, in one short line.
//
// The first phone playtest ended with "you can't see what you're supposed to
// do... I got attacked by wolves and then the fire went down and then nothing,
// what do I do?" Every rule in this game was legible only to someone who had
// read the design document. This is the fix, and it is deliberately pure so the
// advice can be asserted in tests rather than eyeballed on a screenshot.
//
// One line at a time, always the most urgent thing. A list of five hints is a
// manual, and nobody reads a manual on a phone.
import { HEAT_MAX, CARRY_CAP } from './constants.js';

export const COACH = {
  DYING: 'THE FIRE IS DYING — GET WOOD IN IT',
  FEED: 'STAND ON THE FURNACE TO FEED IT',
  FULL: 'CARRY FULL — TAKE IT TO THE FURNACE',
  MINE: 'HOLD A TO MINE THE TREES',
  GATE: 'TAP A GLOWING GATE TO SEND YOUR GUARDS',
  NIGHT: 'SURVIVE THE NIGHT — KEEP THE FIRE FED',
  FEEDING: 'FEEDING THE FIRE',
};

/**
 * The single most useful sentence for this exact game state.
 *
 * Order is priority, not chronology: a dying fire outranks a full carry, which
 * outranks "go and mine", because the player who is about to lose needs to be
 * told the thing that stops them losing.
 *
 * @returns {string|null} the line to show, or null when nothing needs saying
 */
export function objective(world) {
  if (world.over) return null;

  const carrying = world.carry.items.length;
  const onPad = Math.hypot(world.player.x - world.pad.x, world.player.z - world.pad.z) <= world.pad.radius;

  // Standing on the pad with fuel: say what is happening, so the deposit reads
  // as the player's doing rather than as something the game did to them.
  if (onPad && carrying > 0) return COACH.FEEDING;

  // The emergency outranks everything. Below a fifth the ring has visibly
  // collapsed and the run is minutes from ending.
  if (world.heat < HEAT_MAX * 0.2) {
    return carrying > 0 ? COACH.FEED : COACH.DYING;
  }

  // Dusk is the one moment the game asks for a decision that is not gathering,
  // and the rally tap is the least discoverable control in the game.
  if (world.cycle.phase === 'dusk') return COACH.GATE;
  if (world.cycle.phase === 'night') return COACH.NIGHT;

  if (carrying >= CARRY_CAP) return COACH.FULL;
  if (carrying > 0) return COACH.FEED;
  return COACH.MINE;
}
