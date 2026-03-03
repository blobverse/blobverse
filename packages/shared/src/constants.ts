// Blobverse — Game Constants

// World
export const WORLD_WIDTH = 3000;
export const WORLD_HEIGHT = 3000;

// Tick
export const SERVER_TPS = 20;
export const TICK_INTERVAL_MS = 1000 / SERVER_TPS;

// Movement
export const BASE_SPEED = 200;
export const SPEED_DECAY_EXPONENT = 0.43;
export const MOVEMENT_SMOOTHING = 0.15;
export const MIN_MOVE_THRESHOLD = 5;

// Radius
export const RADIUS_FACTOR = 4.5;

// Eating
export const EATING_MASS_RATIO = 1.25;
export const MASS_ABSORPTION_RATIO = 0.8;
export const OVERLAP_RATIO = 0.6;

// Splitting
export const MIN_SPLIT_MASS = 40;
export const SPLIT_COOLDOWN_TICKS = 20;
export const SPLIT_LAUNCH_SPEED = 500;
export const MERGE_DELAY_TICKS = 160;

// Mass Ejection
export const MIN_EJECT_MASS = 30;
export const EJECT_MASS_AMOUNT = 12;
export const EJECT_SPEED = 400;
export const EJECT_DECAY_TICKS = 200;

// Spawn
export const INITIAL_MASS = 10;
export const PELLET_MASS_MIN = 1;
export const PELLET_MASS_MAX = 3;

// Round Timing
export const COUNTDOWN_DURATION = 3;
export const TRANSITION_DURATION = 3;
export const ELIMINATION_ANIMATION_DURATION = 1.5;

// Lobby
export const MIN_PLAYERS_TO_START = 4;
export const MAX_PLAYERS_PER_ROOM = 30;
export const AI_FILL_RATIO = 0.6;
export const LOBBY_WAIT_SECONDS = 15;

// Spatial Hash
export const SPATIAL_HASH_CELL_SIZE = 100;
