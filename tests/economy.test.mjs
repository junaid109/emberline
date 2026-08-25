// The fuel economy: can this game actually be won by playing it?
//
// Every other test that reaches night 7 gets there by setting heat = HEAT_MAX
// on every tick, which is exactly why the economy went unexamined for so long.
// The world held a fixed 60 wood against a run costing 278 heat-worth of it,
// and EMBERLINE was unwinnable at every skill level with nothing to show for it
// — no crash, no failure, just a fire that always went out.
//
// So these tests drive an actual player. The bot is deliberately mediocre:
// nearest-node greed, no route planning, no anticipation of night. If a clumsy
// bot can win, a human can; if a clumsy bot dies, the tuning is too tight
// rather than the human being bad.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createWorld, tickWorld } from '../src/core/world.js';
import { carryTotal, carryIsFull } from '../src/core/carry.js';
import { phaseDuration } from '../src/core/cycle.js';
import {
  MAX_FRAME_DT, HEAT_START, HEAT_MAX, HEAT_DRAIN_DAY, HEAT_DRAIN_NIGHT_MULT,
  HEAT_PER_WOOD, NODE_COUNT, NODE_AMOUNT, NODE_REGROW_SECONDS, TOTAL_NIGHTS,
  HARVEST_RANGE, PAD_RADIUS, CARRY_CAP, HARVEST_SECONDS, PLAYER_SPEED,
} from '../src/core/constants.js';

const STEP = MAX_FRAME_DT;

/** Total heat the whole run burns, if the furnace is never mauled. */
function runDemand() {
  let dayish = 0;
  let night = 0;
  for (let n = 1; n <= TOTAL_NIGHTS; n++) {
    dayish += phaseDuration('day', n) + phaseDuration('dusk', n) + phaseDuration('dawn', n);
    night += phaseDuration('night', n);
  }
  return {
    seconds: dayish + night,
    heat: dayish * HEAT_DRAIN_DAY + night * HEAT_DRAIN_DAY * HEAT_DRAIN_NIGHT_MULT,
  };
}

function nearestLiveNode(world) {
  let best = null;
  let bestDist = Infinity;
  for (const n of world.nodes) {
    if (n.depleted) continue;
    const d = Math.hypot(n.x - world.player.x, n.z - world.player.z);
    if (d < bestDist) { bestDist = d; best = n; }
  }
  return best ? { x: best.x, z: best.z, range: HARVEST_RANGE * 0.7 } : null;
}

/**
 * A greedy hauler. Full carry means walk to the furnace; otherwise walk to the
 * nearest node holding anything. Returns a unit direction, or zero to stand
 * still — which is what harvesting and depositing both look like.
 */
function greedyStep(world) {
  const { player } = world;
  const nothingLeft = world.nodes.every((n) => n.depleted);
  const goHome = carryIsFull(world.carry) || (carryTotal(world.carry) > 0 && nothingLeft);
  const goal = goHome
    ? { x: world.pad.x, z: world.pad.z, range: PAD_RADIUS * 0.5 }
    : nearestLiveNode(world);

  if (!goal) return { x: 0, z: 0 };

  const dx = goal.x - player.x;
  const dz = goal.z - player.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= goal.range) return { x: 0, z: 0 };      // in range: stand and work
  return { x: dx / dist, z: dz / dist };
}

/** Plays a whole run with the greedy bot and no wolves. Returns the world. */
function playFuelOnly(seconds) {
  const world = createWorld(() => 0.5);
  for (let t = 0; t < seconds / STEP && !world.over; t++) {
    world.wolves.length = 0;                 // isolate the FUEL economy from combat
    const dir = greedyStep(world);
    tickWorld(world, STEP, dir.x, dir.z);
  }
  return world;
}

test('a run that is never refuelled cannot possibly be survived', () => {
  // The baseline the whole loop depends on: a full furnace must not coast.
  const { seconds, heat } = runDemand();
  assert.ok(heat > HEAT_MAX, 'a full furnace alone would coast through the entire run');
  assert.ok(seconds > 300, 'the run is shorter than the competition asks a session to be');
});

test('a new player who touches nothing still lives to SEE their first night', () => {
  // The learnability floor. At the old 60 heat / 1.6 per second the fire went
  // out 37s into a 60s first day: the player lost before finishing the tutorial
  // they were giving themselves, and the loss taught them nothing, because the
  // wolves it was warning them about had not appeared yet.
  const idleSeconds = HEAT_START / HEAT_DRAIN_DAY;
  const beforeNight = phaseDuration('day', 1) + phaseDuration('dusk', 1);
  assert.ok(idleSeconds > beforeNight,
    `an idle player dies after ${idleSeconds.toFixed(1)}s, `
    + `but night 1 does not begin until ${beforeNight}s`);
});

test('and that player still dies, so the fire is never decoration', () => {
  // The mirror. Generous is not the same as free: doing nothing must lose, or
  // the resource management this is entered as does not exist.
  const world = createWorld(() => 0.5);
  for (let t = 0; t < 200 / STEP && !world.over; t++) {
    world.wolves.length = 0;
    tickWorld(world, STEP, 0, 0);
  }
  assert.equal(world.over, 'lost', 'a player who never moved survived');
  assert.ok(world.cycle.night >= 1);
});

test('the forest regrows a node that was stripped bare', () => {
  const world = createWorld(() => 0.5);
  const node = world.nodes[0];
  node.remaining = 0;
  node.depleted = true;

  let revived = 0;
  for (let t = 0; t < (NODE_REGROW_SECONDS + 1) / STEP; t++) {
    world.heat = HEAT_MAX;
    revived += tickWorld(world, STEP, 0, 0).revivedNodes.length;
  }
  assert.equal(node.depleted, false, 'a stripped node never came back');
  assert.equal(node.remaining, 1, 'regrowth should return one log, not a full node');
  assert.equal(revived, 1, 'the renderer was told exactly once to show the tree again');
});

test('regrowth stops at a full node rather than overflowing it', () => {
  const world = createWorld(() => 0.5);
  for (let t = 0; t < (NODE_REGROW_SECONDS * 4) / STEP; t++) {
    world.heat = HEAT_MAX;
    tickWorld(world, STEP, 0, 0);
  }
  for (const n of world.nodes) assert.equal(n.remaining, NODE_AMOUNT);
});

test('the forest regrows slower than one player can carry it away', () => {
  // Where the skill lives. If the world out-produced the player, routing would
  // not matter and the map would be scenery; if it produced far less, no play
  // would be good enough. It has to sit just under.
  const worldRate = NODE_COUNT / NODE_REGROW_SECONDS;                 // logs per second

  // A round trip: fill the carry, walk it in. Distances come from the real node
  // ring rather than being guessed.
  const world = createWorld(() => 0.5);
  const meanRadius = world.nodes.reduce((s, n) => s + Math.hypot(n.x, n.z), 0) / world.nodes.length;
  const travel = (meanRadius * 2) / PLAYER_SPEED;
  const playerRate = CARRY_CAP / (CARRY_CAP * HARVEST_SECONDS + travel);

  assert.ok(worldRate < playerRate,
    `the forest (${worldRate.toFixed(2)}/s) out-produces the player `
    + `(${playerRate.toFixed(2)}/s), so hauling is never the constraint`);
  assert.ok(worldRate > playerRate * 0.6,
    `the forest (${worldRate.toFixed(2)}/s) is so far behind the player `
    + `(${playerRate.toFixed(2)}/s) that good play cannot close the gap`);
});

test('an ordinary player can survive all seven nights on fuel alone', () => {
  // The test whose absence let the game sit unwinnable. No pinned heat and no
  // infinite fuel: a mediocre bot hauls wood, and the fire has to hold.
  const world = playFuelOnly(runDemand().seconds + 30);
  assert.equal(world.over, 'won',
    `the run ended as ${world.over ?? 'unfinished'} on night ${world.cycle.night} `
    + `with ${world.heat.toFixed(1)} heat left`);
});

test('winning is not a formality — the fire gets genuinely low', () => {
  // A win the bot coasts to would mean the resource pressure is cosmetic, which
  // is the same failure as an unwinnable run wearing the opposite mask.
  const world = createWorld(() => 0.5);
  let lowest = HEAT_MAX;
  for (let t = 0; t < (runDemand().seconds + 30) / STEP && !world.over; t++) {
    world.wolves.length = 0;
    const dir = greedyStep(world);
    tickWorld(world, STEP, dir.x, dir.z);
    if (world.cycle.night > 1) lowest = Math.min(lowest, world.heat);
  }
  assert.ok(lowest < HEAT_MAX * 0.75,
    `the furnace never dropped below ${lowest.toFixed(1)}; there is no pressure`);
});

test('the wood standing in the ground is far less than a run costs', () => {
  // Regrowth, not a big pile, has to be what feeds the fire — otherwise the
  // player strip-mines the map in the first two minutes and then waits.
  const standing = NODE_COUNT * NODE_AMOUNT * HEAT_PER_WOOD;
  assert.ok(standing + HEAT_START < runDemand().heat * 0.5,
    'the starting forest alone covers half the run; the map is a stockpile');
});
