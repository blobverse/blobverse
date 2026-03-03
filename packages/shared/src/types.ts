// Blobverse — Shared Type Definitions

export interface BlobColor {
  fill: string;
  glow: string;
  eye: string;
}

export type BlobExpression = 'happy' | 'eating' | 'worried';
export type AIPersonality = 'aggressor' | 'survivor' | 'opportunist' | 'trickster' | 'herder';

export interface Blob {
  id: string;
  x: number;
  y: number;
  mass: number;
  radius: number;
  velocityX: number;
  velocityY: number;
  color: BlobColor;
  name: string;
  isAlive: boolean;
  expression: BlobExpression;
  splitCooldown: number;
  fragments: BlobFragment[];
  type: 'human' | 'ai';
  aiPersonality?: AIPersonality;
}

export interface BlobFragment {
  id: string;
  parentId: string;
  x: number;
  y: number;
  mass: number;
  radius: number;
  velocityX: number;
  velocityY: number;
  mergeTimer: number;
}

export interface Pellet {
  id: string;
  x: number;
  y: number;
  mass: number;
  velocityX: number;
  velocityY: number;
  isGolden: boolean;
  type: 'normal' | 'ejected' | 'golden';
  decayTimer?: number;
}

export type EliminationRule =
  | { type: 'bottom_percentage'; percentage: number }
  | { type: 'last_standing' };

export interface RoundConfig {
  roundNumber: 1 | 2 | 3;
  duration: number;
  mapWidth: number;
  mapHeight: number;
  eliminationRule: EliminationRule;
  pelletDensity: number;
  hasHazards: boolean;
  hasPowerUps: boolean;
  hasShrinkingZone: boolean;
  shrinkRate?: number;
  massDecayRate?: number;
  specialMechanics: string[];
}

export enum RoundState {
  WAITING = 'waiting',
  COUNTDOWN = 'countdown',
  PLAYING = 'playing',
  ELIMINATING = 'eliminating',
  TRANSITIONING = 'transitioning',
  FINISHED = 'finished',
}

export type PowerUpType = 'speed_boost' | 'shield' | 'magnet' | 'ghost';

export interface PowerUp {
  id: string;
  x: number;
  y: number;
  type: PowerUpType;
  duration: number;
}

export interface HazardZone {
  id: string;
  x: number;
  y: number;
  radius: number;
  damagePerTick: number;
}

export interface GameState {
  tick: number;
  roundState: RoundState;
  currentRound: number;
  roundTimer: number;
  blobs: Blob[];
  pellets: Pellet[];
  hazards: HazardZone[];
  powerUps: PowerUp[];
  safeZone: { x: number; y: number; radius: number };
}
