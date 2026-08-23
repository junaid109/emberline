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
