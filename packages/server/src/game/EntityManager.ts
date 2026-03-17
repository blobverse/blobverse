// EntityManager — Manages entity lifecycle (blobs, pellets, hazards)

import { nanoid } from 'nanoid';
import {
  Blob,
  BlobFragment,
  Pellet,
  HazardZone,
  PowerUp,
  BlobColor,
  BlobExpression,
  AIPersonality,
  SpatialHashGrid,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  INITIAL_MASS,
  PELLET_MASS_MIN,
  PELLET_MASS_MAX,
  EJECT_DECAY_TICKS,
  calculateRadius,
} from '@blobverse/shared';

// =============================================================================
// Types
// =============================================================================

export interface ServerBlob extends Blob {
  socket: WebSocket | null; // null for AI
  lastInputX: number;
  lastInputY: number;
  score: number;
  kills: number;
}

export interface ServerPellet extends Pellet {
  radius: number; // Required for SpatialHashGrid
}

// =============================================================================
// Color Palettes
// =============================================================================

const BLOB_COLORS: BlobColor[] = [
  { fill: '#FF6B6B', glow: '#FF8E8E', eye: '#FFFFFF' },
  { fill: '#4ECDC4', glow: '#7EDDD6', eye: '#FFFFFF' },
  { fill: '#45B7D1', glow: '#6FC7DB', eye: '#FFFFFF' },
  { fill: '#96CEB4', glow: '#B0D9C5', eye: '#FFFFFF' },
  { fill: '#FFEAA7', glow: '#FFF0BD', eye: '#333333' },
  { fill: '#DDA0DD', glow: '#E8B8E8', eye: '#FFFFFF' },
  { fill: '#98D8C8', glow: '#B2E3D6', eye: '#FFFFFF' },
  { fill: '#F7DC6F', glow: '#F9E48A', eye: '#333333' },
  { fill: '#BB8FCE', glow: '#CBA6D8', eye: '#FFFFFF' },
  { fill: '#85C1E9', glow: '#A0CFED', eye: '#FFFFFF' },
];

// =============================================================================
// EntityManager Class
// =============================================================================

export class EntityManager {
  // Entity collections
  private blobs: Map<string, ServerBlob> = new Map();
  private pellets: Map<string, ServerPellet> = new Map();
  private hazards: Map<string, HazardZone> = new Map();
  private powerUps: Map<string, PowerUp> = new Map();
  
  // Spatial hash for collision optimization
  private blobGrid: SpatialHashGrid<ServerBlob>;
  private pelletGrid: SpatialHashGrid<ServerPellet>;
  
  // World bounds
  private worldWidth: number;
  private worldHeight: number;
  
  // Counters for unique IDs
  private colorIndex = 0;
  
  constructor(worldWidth = WORLD_WIDTH, worldHeight = WORLD_HEIGHT) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    
    this.blobGrid = new SpatialHashGrid<ServerBlob>();
    this.pelletGrid = new SpatialHashGrid<ServerPellet>();
  }
  
  // ===========================================================================
  // Blob Management
  // ===========================================================================
  
  createBlob(
    name: string,
    socket: WebSocket | null,
    type: 'human' | 'ai',
    aiPersonality?: AIPersonality
  ): ServerBlob {
    const id = nanoid(12);
    const color = this.getNextColor();
    const radius = calculateRadius(INITIAL_MASS);
    
    // Random spawn position (with padding)
    const padding = radius * 2;
    const x = padding + Math.random() * (this.worldWidth - padding * 2);
    const y = padding + Math.random() * (this.worldHeight - padding * 2);
    
    const blob: ServerBlob = {
      id,
      x,
      y,
      mass: INITIAL_MASS,
      radius,
      velocityX: 0,
      velocityY: 0,
      color,
      name,
      isAlive: true,
      expression: 'happy',
      splitCooldown: 0,
      fragments: [],
      type,
      aiPersonality,
      socket,
      lastInputX: x,
      lastInputY: y,
      score: 0,
      kills: 0,
    };
    
    this.blobs.set(id, blob);
    this.blobGrid.insert(blob);
    
    return blob;
  }
  
  removeBlob(id: string): boolean {
    const blob = this.blobs.get(id);
    if (!blob) return false;
    
    this.blobGrid.remove(blob);
    this.blobs.delete(id);
    
    return true;
  }
  
  getBlob(id: string): ServerBlob | undefined {
    return this.blobs.get(id);
  }
  
  getAllBlobs(): ServerBlob[] {
    return Array.from(this.blobs.values());
  }
  
  getAliveBlobs(): ServerBlob[] {
    return this.getAllBlobs().filter(b => b.isAlive);
  }
  
  updateBlobPosition(blob: ServerBlob, oldX: number, oldY: number, oldRadius: number): void {
    this.blobGrid.update(blob, oldX, oldY, oldRadius);
  }
  
  getNearbyBlobs(blob: ServerBlob): ServerBlob[] {
    return this.blobGrid.queryNearby(blob);
  }
  
  // ===========================================================================
  // Fragment Management
  // ===========================================================================
  
  createFragment(parent: ServerBlob, dirX: number, dirY: number, mass: number): BlobFragment {
    const id = nanoid(8);
    const radius = calculateRadius(mass);
    
    const fragment: BlobFragment = {
      id,
      parentId: parent.id,
      x: parent.x + dirX * parent.radius,
      y: parent.y + dirY * parent.radius,
      mass,
      radius,
      velocityX: dirX * 500, // Initial launch velocity
      velocityY: dirY * 500,
      mergeTimer: 160, // MERGE_DELAY_TICKS
    };
    
    parent.fragments.push(fragment);
    
    return fragment;
  }
  
  removeFragment(parent: ServerBlob, fragmentId: string): boolean {
    const index = parent.fragments.findIndex(f => f.id === fragmentId);
    if (index === -1) return false;
    
    parent.fragments.splice(index, 1);
    return true;
  }
  
  // ===========================================================================
  // Pellet Management
  // ===========================================================================
  
  createPellet(
    x: number,
    y: number,
    type: 'normal' | 'ejected' | 'golden' = 'normal',
    mass?: number,
    velocityX = 0,
    velocityY = 0
  ): ServerPellet {
    const id = nanoid(8);
    const pelletMass = mass ?? (PELLET_MASS_MIN + Math.random() * (PELLET_MASS_MAX - PELLET_MASS_MIN));
    
    const pellet: ServerPellet = {
      id,
      x,
      y,
      mass: pelletMass,
      radius: Math.sqrt(pelletMass) * 2, // Small radius for pellets
      velocityX,
      velocityY,
      isGolden: type === 'golden',
      type,
      decayTimer: type === 'ejected' ? EJECT_DECAY_TICKS : undefined,
    };
    
    this.pellets.set(id, pellet);
    this.pelletGrid.insert(pellet);
    
    return pellet;
  }
  
  removePellet(id: string): boolean {
    const pellet = this.pellets.get(id);
    if (!pellet) return false;
    
    this.pelletGrid.remove(pellet);
    this.pellets.delete(id);
    
    return true;
  }
  
  getPellet(id: string): ServerPellet | undefined {
    return this.pellets.get(id);
  }
  
  getAllPellets(): ServerPellet[] {
    return Array.from(this.pellets.values());
  }
  
  getNearbyPellets(x: number, y: number, radius: number): ServerPellet[] {
    return this.pelletGrid.query(x, y, radius);
  }
  
  updatePelletPosition(pellet: ServerPellet, oldX: number, oldY: number): void {
    this.pelletGrid.update(pellet, oldX, oldY, pellet.radius);
  }
  
  /**
   * Spawn pellets across the map
   */
  spawnPellets(count: number, goldenChance = 0.02): void {
    for (let i = 0; i < count; i++) {
      const x = Math.random() * this.worldWidth;
      const y = Math.random() * this.worldHeight;
      const type = Math.random() < goldenChance ? 'golden' : 'normal';
      this.createPellet(x, y, type);
    }
  }
  
  // ===========================================================================
  // Hazard Management
  // ===========================================================================
  
  createHazard(x: number, y: number, radius: number, damagePerTick: number): HazardZone {
    const id = nanoid(8);
    
    const hazard: HazardZone = {
      id,
      x,
      y,
      radius,
      damagePerTick,
    };
    
    this.hazards.set(id, hazard);
    
    return hazard;
  }
  
  removeHazard(id: string): boolean {
    return this.hazards.delete(id);
  }
  
  getAllHazards(): HazardZone[] {
    return Array.from(this.hazards.values());
  }
  
  // ===========================================================================
  // Power-Up Management
  // ===========================================================================
  
  createPowerUp(x: number, y: number, type: PowerUp['type'], duration: number): PowerUp {
    const id = nanoid(8);
    
    const powerUp: PowerUp = {
      id,
      x,
      y,
      type,
      duration,
    };
    
    this.powerUps.set(id, powerUp);
    
    return powerUp;
  }
  
  removePowerUp(id: string): boolean {
    return this.powerUps.delete(id);
  }
  
  getAllPowerUps(): PowerUp[] {
    return Array.from(this.powerUps.values());
  }
  
  // ===========================================================================
  // Utility
  // ===========================================================================
  
  private getNextColor(): BlobColor {
    const color = BLOB_COLORS[this.colorIndex % BLOB_COLORS.length];
    this.colorIndex++;
    return color;
  }
  
  clear(): void {
    this.blobs.clear();
    this.pellets.clear();
    this.hazards.clear();
    this.powerUps.clear();
    this.blobGrid.clear();
    this.pelletGrid.clear();
  }
  
  getStats() {
    return {
      blobs: this.blobs.size,
      aliveBlobs: this.getAliveBlobs().length,
      pellets: this.pellets.size,
      hazards: this.hazards.size,
      powerUps: this.powerUps.size,
    };
  }
}
