// src/core/constants.js
export const MAX_DPR = 2;              // capped: S24 Ultra reports 3.5, which is a fill-rate massacre
export const CAMERA_FOV = 45;
export const CAMERA_HEIGHT = 26;
export const CAMERA_DISTANCE = 20;     // behind the player, giving the tilted three-quarter view
export const WORLD_RADIUS = 34;        // playfield half-extent in world units

export const HEAT_MAX = 100;
export const HEAT_START = 60;
export const HEAT_DRAIN_DAY = 1.6;     // heat units per second
export const RING_MIN = 6;             // ring radius at zero heat
export const RING_MAX = 22;            // ring radius at full heat
export const RIM_BAND = 0.5;           // constant world-space width of the rim marking the ring boundary

export const PLAYER_SPEED = 7.5;       // world units per second
export const CARRY_CAP = 8;

export const HARVEST_SECONDS = 0.7;    // per item pulled from a node
export const HARVEST_RANGE = 2.2;
export const DEPOSIT_INTERVAL = 0.09;  // seconds between items flying off the stack

export const STICK_RADIUS = 60;        // pointer distance in CSS px at which the stick reads full deflection
export const STICK_ZONE_X_MAX = 0.6;   // stick activates only left of this fraction of viewport width
export const STICK_ZONE_Y_MIN = 0.45;  // stick activates only below this fraction of viewport height
