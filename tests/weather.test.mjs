// One event per day, and what each of them costs.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  EVENTS, EVENT_LABEL, createWeather, rollEvent, drainMultiplier, cacheSite,
} from '../src/core/weather.js';
import { createWorld, tickWorld } from '../src/core/world.js';
import { carryCountOf } from '../src/core/carry.js';
import {
  MAX_FRAME_DT, HEAT_MAX, HEAT_DRAIN_DAY, BLIZZARD_DRAIN_MULT,
  CACHE_INNER, CACHE_OUTER, CACHE_WOOD, RING_MAX, TOTAL_NIGHTS,
  SQUAD_FED_DPS_MULT, WORLD_RADIUS,
} from '../src/core/constants.js';

const STEP = MAX_FRAME_DT;
const SEEDS = Array.from({ length: 200 }, (_, i) => 500 + i * 3571);

test('day one is calm on every seed there is', () => {
  // Not politeness. The first day is the only tutorial this game has: it is
  // where a player learns what a normal burn feels like and that the outer
  // trees are out of reach. A blizzard during it would teach them that the
  // normal state of the world is emergency, and every judgement they made
  // afterwards would be calibrated against a lie.
  for (const seed of SEEDS) {
    assert.equal(rollEvent(createWeather(seed), 1), 'calm', `seed ${seed} broke day one`);
  }
});

test('across a run, every event actually happens', () => {
  // An event table that only ever rolls one value is a table nobody needed.
  const seen = new Set();
  for (const seed of SEEDS) {
    const w = createWeather(seed);
    for (let day = 1; day <= TOTAL_NIGHTS; day++) seen.add(rollEvent(w, day));
  }
  for (const e of EVENTS) assert.ok(seen.has(e), `${e} never rolled in 200 runs`);
});

test('most days are ordinary, so an event still means something', () => {
  let calm = 0;
  let total = 0;
  for (const seed of SEEDS) {
    const w = createWeather(seed);
    for (let day = 2; day <= TOTAL_NIGHTS; day++) {
      if (rollEvent(w, day) === 'calm') calm++;
      total++;
    }
  }
  const share = calm / total;
  assert.ok(share > 0.3, `only ${(share * 100).toFixed(0)}% of days are calm; every day is an emergency`);
  assert.ok(share < 0.8, `${(share * 100).toFixed(0)}% of days are calm; events barely happen`);
});

test('the same seed always rolls the same weather', () => {
  for (const seed of SEEDS.slice(0, 20)) {
    const a = createWeather(seed);
    const b = createWeather(seed);
    for (let day = 1; day <= TOTAL_NIGHTS; day++) {
      assert.equal(rollEvent(a, day), rollEvent(b, day));
    }
  }
});

test('different seeds give different weather', () => {
  const runs = new Set(SEEDS.slice(0, 60).map((seed) => {
    const w = createWeather(seed);
    return Array.from({ length: TOTAL_NIGHTS }, (_, i) => rollEvent(w, i + 1)).join(',');
  }));
  assert.ok(runs.size > 10, `only ${runs.size} distinct weather runs out of 60 seeds`);
});

test('a blizzard makes the furnace burn faster, and nothing else does', () => {
  const w = createWeather(1);
  w.event = 'blizzard';
  assert.equal(drainMultiplier(w), BLIZZARD_DRAIN_MULT);
  assert.ok(BLIZZARD_DRAIN_MULT > 1.2, 'a blizzard the player cannot feel is not an event');

  for (const event of ['calm', 'cache']) {
    w.event = event;
    assert.equal(drainMultiplier(w), 1, `${event} should not touch the burn rate`);
  }
});

test('a cache always lands out in the wilds', () => {
  // A reward standing inside the camp is not a reward, it is a delay.
  const w = createWeather(1);
  w.event = 'cache';
  let roll = 0.03;
  const next = () => { roll = (roll * 9301 + 0.49297) % 1; return roll; };

  for (let i = 0; i < 200; i++) {
    const site = cacheSite(w, next);
    const r = Math.hypot(site.x, site.z);
    assert.ok(r > RING_MAX, `a cache landed at radius ${r.toFixed(1)}, on thawable ground`);
    assert.ok(r >= CACHE_INNER - 1e-9 && r <= CACHE_OUTER + 1e-9);
    assert.ok(r < WORLD_RADIUS, 'a cache landed where the player cannot reach it');
    assert.equal(site.amount, CACHE_WOOD);
  }
});

test('no cache on a day that did not roll one', () => {
  for (const event of ['calm', 'blizzard']) {
    const w = createWeather(1);
    w.event = event;
    assert.equal(cacheSite(w, () => 0.5), null);
  }
});

test('every event has a label the HUD can show, or is deliberately silent', () => {
  // A missing entry would put the string "undefined" across the top of the
  // screen at the exact moment the player is being told something matters.
  for (const e of EVENTS) {
    assert.ok(e in EVENT_LABEL, `${e} has no label entry at all`);
    const label = EVENT_LABEL[e];
    assert.ok(label === null || (typeof label === 'string' && label.length > 0));
  }
  assert.equal(EVENT_LABEL.calm, null, 'an ordinary day should not announce itself');
});

// --- how the world actually feels it ---------------------------------------

test('a blizzard really does drain the furnace faster in play', () => {
  const calm = createWorld(() => 0.5);
  calm.heat = HEAT_MAX;
  tickWorld(calm, STEP, 0, 0);
  const calmLoss = HEAT_MAX - calm.heat;

  const storm = createWorld(() => 0.5);
  storm.weather.event = 'blizzard';
  storm.heat = HEAT_MAX;
  tickWorld(storm, STEP, 0, 0);
  const stormLoss = HEAT_MAX - storm.heat;

  assert.ok(stormLoss > calmLoss, 'a blizzard cost the player nothing');
  assert.ok(Math.abs(stormLoss - HEAT_DRAIN_DAY * BLIZZARD_DRAIN_MULT * STEP) < 1e-9);
});

test('walking into a cache picks it up, without having to stand and chop', () => {
  // A windfall. Making the player harvest it would turn a gift into an errand.
  const w = createWorld(() => 0.5);
  w.heat = HEAT_MAX;
  w.cache = { x: 26, z: 0, amount: CACHE_WOOD };
  w.player.x = 26;
  w.player.z = 0;

  const ev = tickWorld(w, STEP, 0, 0);
  assert.equal(ev.cacheTaken, true);
  assert.equal(w.cache, null, 'the cache was taken twice');
  assert.ok(carryCountOf(w.carry, 'wood') > 0);
});

test('a cache never overfills the carry', () => {
  const w = createWorld(() => 0.5);
  w.heat = HEAT_MAX;
  w.cache = { x: 26, z: 0, amount: 999 };
  w.player.x = 26;
  w.player.z = 0;
  tickWorld(w, STEP, 0, 0);
  assert.ok(w.carry.items.length <= w.carry.cap, 'the carry overflowed');
});

test('the squad eats at dusk, and only when there is meat', () => {
  const fed = createWorld(() => 0.5);
  fed.store.meat = 2;
  fed.heat = HEAT_MAX;
  for (let i = 0; i < 200000 && fed.cycle.phase !== 'dusk'; i++) {
    fed.heat = HEAT_MAX;
    tickWorld(fed, STEP, 0, 0);
  }
  assert.equal(fed.squadFed, true, 'the squad did not eat');
  assert.equal(fed.store.meat, 1, 'the squad ate more or less than one');

  const hungry = createWorld(() => 0.5);
  hungry.store.meat = 0;
  for (let i = 0; i < 200000 && hungry.cycle.phase !== 'dusk'; i++) {
    hungry.heat = HEAT_MAX;
    tickWorld(hungry, STEP, 0, 0);
  }
  assert.equal(hungry.squadFed, false);
});

test('a fed squad is worth catching a hare for', () => {
  // If the bonus were not measurable the trade would be a lie: the daylight
  // spent chasing a hare is daylight not spent hauling fuel.
  assert.ok(SQUAD_FED_DPS_MULT > 1.3,
    `a fed squad hits ${SQUAD_FED_DPS_MULT}x, which nobody would notice`);
});
