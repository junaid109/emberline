// src/core/constants.js
export const MAX_DPR = 2;              // capped: S24 Ultra reports 3.5, which is a fill-rate massacre

// CAMERA_FOV is only the bootstrap value used while constructing the camera
// object, before the first resize() runs. resize() overrides camera.fov every
// time from CAMERA_TARGET_WIDTH, CAMERA_HEIGHT, CAMERA_DISTANCE and the live
// aspect ratio (see src/render/scene.js), so this number has no effect on the
// actual framing the player sees.
export const CAMERA_FOV = 45;

// CAMERA_HEIGHT/CAMERA_DISTANCE set the camera-to-target distance and the
// tilt of the three-quarter view. They were raised from 26/20 so that, once
// resize() solves for the vertical FOV that fits CAMERA_TARGET_WIDTH
// horizontally, the result lands in a sane ~50-75deg range instead of
// requiring an extreme (distorting) FOV at close range. At 70/54 the
// camera-to-target distance is ~88.4 units and the elevation angle above the
// ground is atan(70/54) ~= 52deg — steep, diorama-style, but not straight down.
export const CAMERA_HEIGHT = 70;
export const CAMERA_DISTANCE = 54;     // behind the player, giving the tilted three-quarter view
export const WORLD_RADIUS = 24;        // playfield half-extent in world units

// Width of ground, in world units, that must be visible horizontally.
//
// Originally derived from the heat ring alone (2 * RING_MAX = 44, plus margin).
// That framed the ring correctly but put the three gates exactly on the frame
// edge, where a screenshot showed the dusk telegraph — the single piece of
// information the whole night decision rests on — reduced to a few red pixels
// half off screen.
//
// It is now derived from the gates instead, since they sit further out than the
// ring does: 2 * GATE_RING_RADIUS = 52, plus ~19% so a lit gate sits clearly
// inside the frame rather than on its boundary. The heat ring still dominates
// the view; it simply no longer sets the bound.
export const CAMERA_TARGET_WIDTH = 38;

export const HEAT_MAX = 100;

// The furnace starts nearly full and burns slowly by day. Both numbers are set
// by one rule: a player who touches nothing at all must live to SEE their first
// night. At the old 60/1.6 the fire went out after 37s of a 60s first day, so a
// new player lost before they had finished learning the stick — and the loss
// taught them nothing, because they had not yet been shown what the fire is for.
// At 78/1.1 the same player watches the ring close in for the whole day, reaches
// dusk on fumes, and dies IN the dark with wolves on screen. Same loss, but now
// it explains itself. Pinned by tests/economy.test.mjs.
export const HEAT_START = 78;
export const HEAT_DRAIN_DAY = 1.1;     // heat units per second
export const RING_MIN = 3;             // ring radius at zero heat
export const RING_MAX = 15;            // ring radius at full heat
export const RIM_BAND = 0.5;           // constant world-space width of the rim marking the ring boundary
export const HEAT_PER_WOOD = 6;        // heat units restored per wood log deposited into the furnace

export const PLAYER_SPEED = 9.8;       // world units per second

// Speed on ground the furnace has NOT thawed, as a fraction of PLAYER_SPEED.
//
// This is what makes "the furnace is the map" a mechanic rather than a picture.
// ringRadius() was for a long time consumed by exactly one line of the
// renderer, to set a texture parameter: the thawed circle was drawn, and the
// simulation ignored it completely. The player walked the frozen waste at full
// speed and the fire's only real job was not hitting zero.
//
// Now the ring is the ground you can move on. Deep snow outside it is crossable
// — deliberately, because a hard wall would trap a player whose fire burned
// low, with the nodes they need to refuel it stranded on the far side. Slow is
// a cost you can choose to pay; a wall is a death spiral with no counterplay.
export const FROZEN_SPEED_MULT = 0.62;
export const CARRY_CAP = 8;

export const DEPOSIT_INTERVAL = 0.09;  // seconds between items flying off the stack

export const NODE_COUNT = 10;          // number of harvestable nodes spawned at start
export const NODE_RING_BASE = 9;      // inner radius of the spawn ring band, in world units
export const NODE_RING_STEP = 3;       // radius step between the 3 interleaved spawn bands
export const NODE_AMOUNT = 6;          // items held by each spawned node

// Seconds for a harvested node to grow back one log, up to NODE_AMOUNT.
//
// This is the single most load-bearing number in the game, and for a long time
// it did not exist: nothing regrew, so the world held exactly 60 wood against a
// seven-night run costing 278, and EMBERLINE could not be won by any player at
// any skill level. Every test that reached night 7 had pinned heat to HEAT_MAX,
// so the fuel economy was never once exercised.
//
// 18s is chosen so that the whole forest regrows at very slightly LESS than the
// rate one player can carry it: the world can just barely keep up with perfect
// routing, and not at all with a player who camps a single clearing. That gap
// is where the skill lives. Pinned by tests/economy.test.mjs.
export const NODE_REGROW_SECONDS = 10;

export const WORLD_EDGE_MARGIN = 1;    // keeps the player this far inside WORLD_RADIUS

export const PAD_RADIUS = 3.2;         // furnace deposit pad radius; consumed by isOnPad, so it is gameplay

// Where the player is standing when the fire catches.
//
// Derived, not hand-picked. It was a hardcoded 8, which sat comfortably inside
// the old node ring at 14 — and when the world was pulled in for a phone, that
// same 8 put the player INSIDE the tree ring, auto-harvesting a trunk before
// they had touched the stick. Far enough out to be clear of the pad, far enough
// in to be clear of the nearest tree by more than SWING_RANGE.
// Pinned by tests/world.test.mjs.
export const PLAYER_START_Z = PAD_RADIUS + 2.3;

export const STICK_RADIUS = 60;        // pointer distance in CSS px at which the stick reads full deflection
export const STICK_ZONE_X_MAX = 0.6;   // stick activates only left of this fraction of viewport width
export const STICK_ZONE_Y_MIN = 0.45;  // stick activates only below this fraction of viewport height

// Largest simulation step accepted from the clock. Load-bearing, not hygiene:
// tickSwing fires at most one swing per call, so a step at or above
// SWING_COOLDOWN (0.34) would silently discard swings. Keeping this well
// below that bound is what makes both the pickaxe and tickDeposit safe.
export const MAX_FRAME_DT = 0.05;

// Distance from the camera to the point it looks at. Every depth-dependent
// setting below is derived from it, so moving the camera can never again leave
// fog or the far plane behind at their old values.
export const CAMERA_TARGET_DIST = Math.sqrt(CAMERA_HEIGHT * CAMERA_HEIGHT + CAMERA_DISTANCE * CAMERA_DISTANCE);

// Worst-case distance from the camera to a corner of the playfield: the ground
// edge directly opposite the camera, with the player at the origin.
export const CAMERA_MAX_SCENE_DIST = Math.sqrt(
  CAMERA_HEIGHT * CAMERA_HEIGHT + (CAMERA_DISTANCE + WORLD_RADIUS) * (CAMERA_DISTANCE + WORLD_RADIUS)
);

// Fog must START beyond the camera's target, or the player, the furnace, and
// the heat ring all sit inside it and the scene flattens into one grey wash.
// It must END beyond the far ground edge, or the back of the playfield
// dissolves entirely. Both bounds are asserted in tests/scene.test.mjs.
export const FOG_NEAR = CAMERA_TARGET_DIST + 12;
export const FOG_FAR = CAMERA_MAX_SCENE_DIST + 70;

// The far clip plane must clear the whole playfield with room to spare.
export const CAMERA_FAR = CAMERA_MAX_SCENE_DIST + 100;

// How far the snow is DRAWN, as opposed to how far the player may walk
// (WORLD_RADIUS). Drawing the snow at the walkable radius made the playfield
// read as a floating island in a void: a hard-edged ellipse with clear colour
// above and below it. The snowfield instead runs past the far clip distance
// and dissolves into fog, so the frame is filled and the edge of the world is
// communicated by the fog, not by a cliff.
export const GROUND_VISUAL_RADIUS = 220;

// --- Day/night cycle -------------------------------------------------------
// Seven nights, each a little longer and colder than the last. The whole arc is
// ~10 minutes, which is the session length the competition guidance asks for.
export const TOTAL_NIGHTS = 7;
export const DAY_SECONDS_FIRST = 60;
export const DAY_SECONDS_LAST = 45;    // days shorten as nights lengthen
export const DUSK_SECONDS = 5;         // the telegraph window: the rally decision
export const NIGHT_SECONDS_FIRST = 25;
export const NIGHT_SECONDS_LAST = 50;
export const DAWN_SECONDS = 3;         // tally card

// At night the furnace burns far faster, so surviving the dark costs the fuel
// you spent the day hauling. This is the pressure the whole loop hangs on.
export const HEAT_DRAIN_NIGHT_MULT = 2.5;

// --- Gates -----------------------------------------------------------------
// Three fixed approach lanes. Wolves only ever come down a gate, so the rally
// decision is always a choice between three known places, never a search.
export const GATE_COUNT = 3;
export const GATE_RING_RADIUS = 17;    // out at the treeline, outside RING_MAX

// --- Wolves ----------------------------------------------------------------
export const WOLF_SPEED = 4.4;         // slower than PLAYER_SPEED: you can always outrun them
export const WOLF_HP = 3;
export const WOLF_SPAWN_INTERVAL = 1.6;
export const WOLVES_FIRST_NIGHT = 3;
export const WOLVES_PER_NIGHT = 2;     // added per night thereafter

// A wolf that reaches the furnace mauls it: heat drains hard until it is
// killed. This is the fail state with a face on it, rather than a silent
// number ticking down.
export const WOLF_ATTACK_RADIUS = 3.0;
export const WOLF_HEAT_DAMAGE = 4.0;   // heat per second, per wolf, at the furnace

// --- Guard squad -----------------------------------------------------------
// One squad, moved between gates by tapping. Combat is fully automatic; the
// player never aims. Travel time is what makes a wrong rally cost something.
export const SQUAD_SPEED = 6.0;
export const SQUAD_RANGE = 4.5;
export const SQUAD_DPS = 2.2;

// --- Rally taps ------------------------------------------------------------
// A phone held in one hand wobbles, so a few pixels of drift is still a tap.
// Anything longer or further is a drag, which leaves room for future gestures
// without reinterpreting orders the player already gave.
export const TAP_MAX_SECONDS = 0.4;
export const TAP_MAX_DRIFT = 18;       // CSS pixels

// Wolves spread across the mouth of a gate instead of stacking on one point.
// Every wolf walks a straight line to the same furnace, so identical spawns
// produce a single-file column that reads as a queue rather than a pack.
// Kept well under the gap between gates, so a lane still reads as one lane.
export const WOLF_SPAWN_SPREAD = 3.2;

// --- Landscape scatter -----------------------------------------------------
// Decorative scenery: a winter forest around the camp. None of it is
// harvestable, which is exactly why placement has rules. A decorative conifer
// standing where a resource tree could stand would teach the player that
// walking into trees sometimes does nothing, and the harvest loop would start
// feeling broken rather than the scenery feeling wrong.
export const SCENERY_SEED = 20260825;

// Low scenery only — rocks, shrubs, drifts. Nothing tree-shaped, so a conifer
// silhouette always means "wood you can take".
export const CAMP_SCENERY_COUNT = 34;

// The treeline proper: a dense band of forest just beyond where the player can
// walk, which is what makes the playable circle read as a clearing.
export const TREELINE_INNER = 26;      // just outside WORLD_RADIUS
export const TREELINE_OUTER = 96;
export const TREELINE_COUNT = 320;

// Thinning forest running out to the fog, so the world has a horizon instead
// of an edge.
export const FARWOOD_OUTER = 190;
export const FARWOOD_COUNT = 240;

// Clearance rules, in world units.
export const SCENERY_GATE_CLEARANCE = 7;   // gates must stay readable
export const SCENERY_NODE_CLEARANCE = 4;   // never crowd a harvestable
// Nothing may stand on ground the furnace has thawed. Two reasons, and the
// second is the important one: the thawed circle is the whole playable area and
// it needs to stay uncluttered, and at night a static rock inside the ring
// reads exactly like an approaching wolf. Setting this above RING_MAX means the
// thawed ground is always clean worked earth and the frozen ground is where the
// snow-covered rubble lives — which is also just truer to the fiction.
export const SCENERY_CAMP_INNER = 16;      // RING_MAX (22) plus a margin

// --- Title card ------------------------------------------------------------
// The first gesture of the run is holding the screen until the furnace catches.
// A hold rather than a tap, for three reasons: it cannot be triggered by the
// accidental touch of picking a phone up, it puts a filling circle on screen —
// which is the game's own symbol before the game has explained anything — and
// it means the player's first action is lighting the fire the rest of the run
// is spent defending.
export const IGNITION_HOLD_SECONDS = 0.9;

// Letting go drains the hold rather than resetting it. A thumb slips on a
// moving train; losing 0.9s of progress to that would feel like the game
// blaming the player before the run has even started.
export const IGNITION_DECAY_MULT = 2.0;

// --- Procedural world generation -------------------------------------------
// Every run generated the same forest: the same ten trees at the same ten
// angles, the same scenery from one fixed seed. A second run taught the player
// nothing new, which is a direct cost to the reason anyone plays twice.
//
// The layout is now seeded per run. The BANDS stay fixed, because the
// relationships they encode are load-bearing — a full furnace thaws exactly to
// the outer band, and the run opens with that band out of reach — but which
// angle and which radius inside a band is rolled fresh each time.
export const WORLDGEN_SEED = 20260826;     // the default; play passes a live seed
export const NODE_ANGLE_JITTER = 0.42;     // radians either side of the even spacing
export const NODE_RADIUS_JITTER = 1.2;     // world units either side of the band

// Minimum gap between any two harvestables. The harvest loop takes the FIRST
// node in range and stops, so two trees inside each other make which one you
// are cutting depend on array order — invisible and unpredictable to the
// player. Jitter alone could not prevent it: NODE_RADIUS_JITTER either side of
// bands NODE_RING_STEP apart lets two adjacent bands come within 0.8 units.
export const NODE_MIN_SPACING = 3.4;

// --- Coal ------------------------------------------------------------------
// A second fuel, and the reason the frozen waste is worth entering. Coal burns
// far hotter than wood but every seam lies outside the thawed ring, on ground
// crossed at FROZEN_SPEED_MULT — so the better fuel always costs the walk.
// That is the thaw mechanic paying for itself rather than a new system beside
// it, which is why coal exists and a fifth resource does not.
export const HEAT_PER_COAL = 15;           // vs HEAT_PER_WOOD 6
export const COAL_SEAMS = 4;
export const COAL_AMOUNT = 4;              // lumps per seam, vs NODE_AMOUNT 6 for a tree
export const COAL_REGROW_SECONDS = 55;     // a seam is not a forest; it comes back slowly
export const COAL_INNER = 17;              // clear of RING_MAX (22): always on frozen ground
export const COAL_OUTER = 22;              // clear of WORLD_RADIUS (34) minus the edge margin

// --- Boulders --------------------------------------------------------------
// Blocking obstacles, so the shortest line between two points is not always
// available and routing is a decision rather than a straight line.
//
// They stand only on frozen ground, for the same reason scenery does: the
// thawed circle is the whole playable camp and must stay clean, and at night a
// static shape inside the ring reads exactly like an approaching wolf.
// Nine, not fourteen. The band boulders may occupy is narrow (24 to 30) and
// already carries the coal seams and three gate exclusion zones; asking for
// fourteen made the rejection sampler give up part-way on some seeds, so some
// runs quietly generated fewer obstacles than others.
export const BOULDER_COUNT = 6;
export const BOULDER_RADIUS = 1.5;         // collision radius, and roughly the drawn size
export const BOULDER_INNER = 17;
// Bounded so that ejecting the player from a boulder at the outer limit still
// leaves them inside the world: BOULDER_OUTER + BOULDER_RADIUS + body must stay
// under WORLD_RADIUS - WORLD_EDGE_MARGIN. Pinned in tests/worldgen.test.mjs.
export const BOULDER_OUTER = 20;
export const BOULDER_GATE_CLEARANCE = 4.2;   // a lane must stay walkable and readable
export const BOULDER_NODE_CLEARANCE = 3.2; // never wall a harvestable off

// --- Wildlife --------------------------------------------------------------
// Hares. They are the only meat in the world, and meat is the only thing that
// makes a night cheaper, so chasing one is a real trade: the daylight you spend
// on it is daylight you did not spend hauling fuel.
//
// They dart and freeze rather than flee steadily. A steady flee at any speed is
// either uncatchable or a formality; darting makes the chase something you read
// and time, and it is what a hare actually does.
export const HARE_COUNT = 4;               // alive at once
export const HARE_DART_SPEED = 10.4;
export const HARE_DART_SECONDS = 0.32;
export const HARE_STILL_SECONDS = 0.85;    // frozen, watching — this is your window
export const HARE_WANDER_SPEED = 1.6;
export const HARE_FLEE_RADIUS = 7.0;       // where it notices you
export const HARE_CATCH_RADIUS = 1.3;
export const HARE_RESPAWN_SECONDS = 22;
export const HARE_INNER = 16;              // the wilds, like the coal and the rock
export const HARE_OUTER = 22.5;

// Meat feeds the guard squad at dusk: one is eaten, and that night the squad
// fights harder. Automatic on purpose — no button, no inventory screen. The
// player's only decision is whether to spend the daylight catching one.
export const SQUAD_FED_DPS_MULT = 1.7;

// --- Weather ---------------------------------------------------------------
// One event rolled per day, so no two runs pressure the player in the same
// order. Never on day one: the first day is the only tutorial the game has, and
// a blizzard during it would teach the wrong lesson about what is normal.
export const BLIZZARD_DRAIN_MULT = 1.7;    // the furnace fights the wind
export const BLIZZARD_DARKNESS = 0.45;     // daylight dims, but never to night
export const CACHE_WOOD = 10;              // a supply drop, out in the wilds
export const CACHE_INNER = 17;
export const CACHE_OUTER = 21;

// --- the pickaxe and the sprint ---------------------------------------------
//
// Added after the first real playtest on a phone. Three findings drove them:
// the player moved too slowly, there was nothing to press, and being attacked
// by wolves offered no response at all beyond walking away.
//
// The pickaxe is one button doing the obvious thing to whatever is in front of
// you: a tree gives wood, a seam gives coal, a wolf takes the hit. One verb,
// two uses, no mode to learn.
export const SWING_COOLDOWN = 0.34;    // seconds between swings; the rhythm of gathering
export const SWING_RANGE = 3.0;        // a swing has reach; you need not stand in the trunk
export const SWING_DAMAGE = 1;         // wolves have WOLF_HP 3, so three connected swings

// Sprint is held, costs stamina, and refills when you let go. It exists so a
// player caught out at dusk has a way to get home that is a decision rather
// than a wait, and so the walk between trees is not the boring part.
export const SPRINT_MULT = 1.55;
export const SPRINT_SECONDS = 2.6;     // full-tank duration at full speed
export const SPRINT_REGEN = 0.55;      // stamina per second recovered when not sprinting
export const SPRINT_FLOOR = 0.25;      // must recover past this before sprint re-engages
