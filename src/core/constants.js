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
export const WORLD_RADIUS = 34;        // playfield half-extent in world units

// Width of ground, in world units, that must be visible horizontally so the
// heat ring (the game's signature mechanic) is actually legible on screen.
// Derived from the ring's full diameter at max heat (2 * RING_MAX = 44) plus
// ~18% margin so the ring doesn't touch the screen edges: 44 * 1.18 ~= 52.
export const CAMERA_TARGET_WIDTH = 52;

export const HEAT_MAX = 100;
export const HEAT_START = 60;
export const HEAT_DRAIN_DAY = 1.6;     // heat units per second
export const RING_MIN = 6;             // ring radius at zero heat
export const RING_MAX = 22;            // ring radius at full heat
export const RIM_BAND = 0.5;           // constant world-space width of the rim marking the ring boundary
export const HEAT_PER_WOOD = 6;        // heat units restored per wood log deposited into the furnace

export const PLAYER_SPEED = 7.5;       // world units per second
export const CARRY_CAP = 8;

export const HARVEST_SECONDS = 0.7;    // per item pulled from a node
export const HARVEST_RANGE = 2.2;
export const DEPOSIT_INTERVAL = 0.09;  // seconds between items flying off the stack

export const NODE_COUNT = 10;          // number of harvestable nodes spawned at start
export const NODE_RING_BASE = 14;      // inner radius of the spawn ring band, in world units
export const NODE_RING_STEP = 4;       // radius step between the 3 interleaved spawn bands
export const NODE_AMOUNT = 6;          // items held by each spawned node

export const WORLD_EDGE_MARGIN = 1;    // keeps the player this far inside WORLD_RADIUS

export const PAD_RADIUS = 3.2;         // furnace deposit pad radius; consumed by isOnPad, so it is gameplay

export const STICK_RADIUS = 60;        // pointer distance in CSS px at which the stick reads full deflection
export const STICK_ZONE_X_MAX = 0.6;   // stick activates only left of this fraction of viewport width
export const STICK_ZONE_Y_MIN = 0.45;  // stick activates only below this fraction of viewport height

// Largest simulation step accepted from the clock. Load-bearing, not hygiene:
// tickHarvest yields at most one item per call, so a step at or above
// HARVEST_SECONDS (0.7) would silently discard harvest progress. Keeping this
// well below that bound is what makes both tickHarvest and tickDeposit safe.
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
export const GATE_RING_RADIUS = 26;    // out at the treeline, outside RING_MAX

// --- Wolves ----------------------------------------------------------------
export const WOLF_SPEED = 3.4;         // slower than PLAYER_SPEED: you can always outrun them
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
