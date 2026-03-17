// GameState — Server-authoritative game state with physics

import {
  Blob,
  Pellet,
  HazardZone,
  RoundState,
  GameStateSnapshot,
  BlobSnapshot,
  PelletSnapshot,
  LeaderboardEntry,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  SERVER_TPS,
  TICK_INTERVAL_MS,
  BASE_SPEED,
  SPEED_DECAY_EXPONENT,
  MIN_SPLIT_MASS,
  SPLIT_COOLDOWN_TICKS,
  SPLIT_LAUNCH_SPEED,
  MERGE_DELAY_TICKS,
  MIN_EJECT_MASS,
  EJECT_MASS_AMOUNT,
  EJECT_SPEED,
  MASS_ABSORPTION_RATIO,
  calculateRadius,
  checkEating,
  distance,
  clamp,
} from '@blobverse/shared';
import { EntityManager, ServerBlob, ServerPellet } from './EntityManager.js';

// =============================================================================
// Types
// =============================================================================

export interface GameStateConfig {
  worldWidth?: number;
  worldHeight?: number;
  pelletCount?: number;
  pelletRespawnRate?: number; // pellets per second
}

export interface KillEvent {
  killerId: string;
  killedId: string;
  killerName: string;
  killedName: string;
}

// =============================================================================
// GameState Class
// =============================================================================

export class GameState {
  private entityManager: EntityManager;
  private config: Required<GameStateConfig>;
  
  // State
  private tick = 0;
  private roundState: RoundState = RoundState.WAITING;
  private currentRound = 1;
  private roundTimer = 0;
  private roundDuration = 120; // seconds
  
  // Safe zone (for shrinking zone mechanic)
  private safeZone = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, radius: WORLD_WIDTH / 2 };
  
  // Events
  private killEvents: KillEvent[] = [];
  
  // Callbacks
  onKill?: (event: KillEvent) => void;
  onBlobEliminated?: (blobId: string) => void;
  
  constructor(config: GameStateConfig = {}) {
    this.config = {
      worldWidth: config.worldWidth ?? WORLD_WIDTH,
      worldHeight: config.worldHeight ?? WORLD_HEIGHT,
      pelletCount: config.pelletCount ?? 500,
      pelletRespawnRate: config.pelletRespawnRate ?? 2,
    };
    
    this.entityManager = new EntityManager(this.config.worldWidth, this.config.worldHeight);
  }
  
  // ===========================================================================
  // Initialization
  // ===========================================================================
  
  initialize(): void {
    this.tick = 0;
    this.roundState = RoundState.WAITING;
    this.killEvents = [];
    
    // Clear existing entities
    this.entityManager.clear();
    
    // Spawn initial pellets
    this.entityManager.spawnPellets(this.config.pelletCount);
  }
  
  // ===========================================================================
  // Game Loop (called at SERVER_TPS)
  // ===========================================================================
  
  update(): void {
    this.tick++;
    
    if (this.roundState !== RoundState.PLAYING) return;
    
    const dt = TICK_INTERVAL_MS / 1000; // Delta time in seconds
    
    // Clear events from last tick
    this.killEvents = [];
    
    // Update all blobs
    this.updateBlobs(dt);
    
    // Update all pellets
    this.updatePellets(dt);
    
    // Check blob-blob collisions
    this.checkBlobCollisions();
    
    // Check blob-pellet collisions
    this.checkPelletCollisions();
    
    // Check hazard damage
    this.checkHazards();
    
    // Update round timer
    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.endRound();
    }
    
    // Respawn pellets
    this.respawnPellets();
  }
  
  // ===========================================================================
  // Blob Updates
  // ===========================================================================
  
  private updateBlobs(dt: number): void {
    for (const blob of this.entityManager.getAliveBlobs()) {
      const oldX = blob.x;
      const oldY = blob.y;
      const oldRadius = blob.radius;
      
      // Update cooldowns
      if (blob.splitCooldown > 0) {
        blob.splitCooldown--;
      }
      
      // Calculate speed based on mass
      const speed = this.calculateSpeed(blob.mass);
      
      // Move towards target
      const dx = blob.lastInputX - blob.x;
      const dy = blob.lastInputY - blob.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 5) { // Dead zone
        const moveX = (dx / dist) * speed * dt;
        const moveY = (dy / dist) * speed * dt;
        
        blob.x = clamp(blob.x + moveX, blob.radius, this.config.worldWidth - blob.radius);
        blob.y = clamp(blob.y + moveY, blob.radius, this.config.worldHeight - blob.radius);
        
        // Update expression
        blob.expression = dist > 100 ? 'happy' : 'eating';
      }
      
      // Update fragments
      this.updateFragments(blob, dt);
      
      // Update spatial hash if position changed significantly
      if (Math.abs(blob.x - oldX) > 1 || Math.abs(blob.y - oldY) > 1) {
        this.entityManager.updateBlobPosition(blob, oldX, oldY, oldRadius);
      }
    }
  }
  
  private updateFragments(blob: ServerBlob, dt: number): void {
    for (let i = blob.fragments.length - 1; i >= 0; i--) {
      const frag = blob.fragments[i];
      
      // Apply velocity with friction
      frag.x += frag.velocityX * dt;
      frag.y += frag.velocityY * dt;
      frag.velocityX *= 0.95;
      frag.velocityY *= 0.95;
      
      // Clamp to world bounds
      frag.x = clamp(frag.x, frag.radius, this.config.worldWidth - frag.radius);
      frag.y = clamp(frag.y, frag.radius, this.config.worldHeight - frag.radius);
      
      // Update merge timer
      frag.mergeTimer--;
      
      // Check for merge
      if (frag.mergeTimer <= 0) {
        const dist = distance(blob.x, blob.y, frag.x, frag.y);
        if (dist < blob.radius + frag.radius) {
          // Merge fragment back into main blob
          blob.mass += frag.mass;
          blob.radius = calculateRadius(blob.mass);
          blob.fragments.splice(i, 1);
        }
      }
    }
  }
  
  private calculateSpeed(mass: number): number {
    // Speed decreases with mass
    return BASE_SPEED * Math.pow(mass / 10, -SPEED_DECAY_EXPONENT);
  }
  
  // ===========================================================================
  // Pellet Updates
  // ===========================================================================
  
  private updatePellets(dt: number): void {
    const toRemove: string[] = [];
    
    for (const pellet of this.entityManager.getAllPellets()) {
      // Update ejected pellets
      if (pellet.type === 'ejected') {
        const oldX = pellet.x;
        const oldY = pellet.y;
        
        // Apply velocity
        pellet.x += pellet.velocityX * dt;
        pellet.y += pellet.velocityY * dt;
        pellet.velocityX *= 0.92;
        pellet.velocityY *= 0.92;
        
        // Clamp to world
        pellet.x = clamp(pellet.x, 0, this.config.worldWidth);
        pellet.y = clamp(pellet.y, 0, this.config.worldHeight);
        
        // Update decay timer
        if (pellet.decayTimer !== undefined) {
          pellet.decayTimer--;
          if (pellet.decayTimer <= 0) {
            toRemove.push(pellet.id);
          }
        }
        
        this.entityManager.updatePelletPosition(pellet, oldX, oldY);
      }
    }
    
    // Remove decayed pellets
    for (const id of toRemove) {
      this.entityManager.removePellet(id);
    }
  }
  
  private respawnPellets(): void {
    const currentCount = this.entityManager.getAllPellets().length;
    const targetCount = this.config.pelletCount;
    
    if (currentCount < targetCount) {
      // Respawn a few pellets per tick
      const toSpawn = Math.min(
        Math.ceil(this.config.pelletRespawnRate / SERVER_TPS),
        targetCount - currentCount
      );
      
      this.entityManager.spawnPellets(toSpawn);
    }
  }
  
  // ===========================================================================
  // Collision Detection
  // ===========================================================================
  
  private checkBlobCollisions(): void {
    const aliveBlobs = this.entityManager.getAliveBlobs();
    const processed = new Set<string>();
    
    for (const blob of aliveBlobs) {
      if (!blob.isAlive) continue;
      
      const nearby = this.entityManager.getNearbyBlobs(blob);
      
      for (const other of nearby) {
        if (!other.isAlive) continue;
        if (processed.has(`${blob.id}-${other.id}`)) continue;
        
        processed.add(`${blob.id}-${other.id}`);
        processed.add(`${other.id}-${blob.id}`);
        
        const result = checkEating(
          blob.mass, blob.x, blob.y, blob.radius,
          other.mass, other.x, other.y, other.radius
        );
        
        if (result === 'a_eats_b') {
          this.consumeBlob(blob, other);
        } else if (result === 'b_eats_a') {
          this.consumeBlob(other, blob);
        }
      }
    }
  }
  
  private consumeBlob(eater: ServerBlob, eaten: ServerBlob): void {
    // Transfer mass
    const massGain = eaten.mass * MASS_ABSORPTION_RATIO;
    eater.mass += massGain;
    eater.radius = calculateRadius(eater.mass);
    eater.score += Math.floor(massGain);
    eater.kills++;
    
    // Kill the eaten blob
    eaten.isAlive = false;
    
    // Emit kill event
    const killEvent: KillEvent = {
      killerId: eater.id,
      killedId: eaten.id,
      killerName: eater.name,
      killedName: eaten.name,
    };
    
    this.killEvents.push(killEvent);
    this.onKill?.(killEvent);
    this.onBlobEliminated?.(eaten.id);
    
    // Update expression
    eater.expression = 'eating';
  }
  
  private checkPelletCollisions(): void {
    for (const blob of this.entityManager.getAliveBlobs()) {
      const nearby = this.entityManager.getNearbyPellets(blob.x, blob.y, blob.radius + 20);
      
      for (const pellet of nearby) {
        const dist = distance(blob.x, blob.y, pellet.x, pellet.y);
        
        // Blob eats pellet if center is inside blob
        if (dist < blob.radius) {
          blob.mass += pellet.mass;
          blob.radius = calculateRadius(blob.mass);
          blob.score += Math.floor(pellet.mass);
          
          // Golden pellets give bonus
          if (pellet.isGolden) {
            blob.score += 50;
          }
          
          this.entityManager.removePellet(pellet.id);
        }
      }
      
      // Also check fragments
      for (const frag of blob.fragments) {
        const fragNearby = this.entityManager.getNearbyPellets(frag.x, frag.y, frag.radius + 20);
        
        for (const pellet of fragNearby) {
          const dist = distance(frag.x, frag.y, pellet.x, pellet.y);
          
          if (dist < frag.radius) {
            frag.mass += pellet.mass;
            frag.radius = calculateRadius(frag.mass);
            blob.score += Math.floor(pellet.mass);
            
            this.entityManager.removePellet(pellet.id);
          }
        }
      }
    }
  }
  
  private checkHazards(): void {
    for (const hazard of this.entityManager.getAllHazards()) {
      for (const blob of this.entityManager.getAliveBlobs()) {
        const dist = distance(blob.x, blob.y, hazard.x, hazard.y);
        
        if (dist < hazard.radius + blob.radius) {
          // Apply damage
          blob.mass -= hazard.damagePerTick;
          blob.radius = calculateRadius(blob.mass);
          blob.expression = 'worried';
          
          // Kill if too small
          if (blob.mass <= 5) {
            blob.isAlive = false;
            this.onBlobEliminated?.(blob.id);
          }
        }
      }
    }
  }
  
  // ===========================================================================
  // Player Actions
  // ===========================================================================
  
  setPlayerInput(playerId: string, targetX: number, targetY: number): void {
    const blob = this.entityManager.getBlob(playerId);
    if (blob && blob.isAlive) {
      blob.lastInputX = clamp(targetX, 0, this.config.worldWidth);
      blob.lastInputY = clamp(targetY, 0, this.config.worldHeight);
    }
  }
  
  playerSplit(playerId: string, dirX: number, dirY: number): boolean {
    const blob = this.entityManager.getBlob(playerId);
    if (!blob || !blob.isAlive) return false;
    
    // Check cooldown and mass
    if (blob.splitCooldown > 0) return false;
    if (blob.mass < MIN_SPLIT_MASS) return false;
    
    // Normalize direction
    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    if (len < 0.1) return false;
    
    const nx = dirX / len;
    const ny = dirY / len;
    
    // Split mass
    const splitMass = blob.mass / 2;
    blob.mass = splitMass;
    blob.radius = calculateRadius(blob.mass);
    
    // Create fragment
    this.entityManager.createFragment(blob, nx, ny, splitMass);
    
    // Set cooldown
    blob.splitCooldown = SPLIT_COOLDOWN_TICKS;
    
    return true;
  }
  
  playerEject(playerId: string, dirX: number, dirY: number): boolean {
    const blob = this.entityManager.getBlob(playerId);
    if (!blob || !blob.isAlive) return false;
    
    if (blob.mass < MIN_EJECT_MASS) return false;
    
    // Normalize direction
    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    if (len < 0.1) return false;
    
    const nx = dirX / len;
    const ny = dirY / len;
    
    // Reduce blob mass
    blob.mass -= EJECT_MASS_AMOUNT;
    blob.radius = calculateRadius(blob.mass);
    
    // Create ejected pellet
    this.entityManager.createPellet(
      blob.x + nx * blob.radius,
      blob.y + ny * blob.radius,
      'ejected',
      EJECT_MASS_AMOUNT,
      nx * EJECT_SPEED,
      ny * EJECT_SPEED
    );
    
    return true;
  }
  
  // ===========================================================================
  // Round Management
  // ===========================================================================
  
  startRound(duration: number = 120): void {
    this.roundState = RoundState.PLAYING;
    this.roundTimer = duration;
    this.roundDuration = duration;
  }
  
  endRound(): void {
    this.roundState = RoundState.ELIMINATING;
    // Elimination logic would go here
    // For now, just transition to finished
    this.roundState = RoundState.FINISHED;
  }
  
  nextRound(): void {
    this.currentRound++;
    this.roundState = RoundState.WAITING;
  }
  
  // ===========================================================================
  // Player Management (delegates to EntityManager)
  // ===========================================================================
  
  addPlayer(name: string, socket: WebSocket | null, isAI: boolean): ServerBlob {
    return this.entityManager.createBlob(
      name,
      socket,
      isAI ? 'ai' : 'human',
      isAI ? 'opportunist' : undefined
    );
  }
  
  removePlayer(playerId: string): void {
    this.entityManager.removeBlob(playerId);
  }
  
  getPlayer(playerId: string): ServerBlob | undefined {
    return this.entityManager.getBlob(playerId);
  }
  
  // ===========================================================================
  // Snapshot Generation
  // ===========================================================================
  
  getSnapshot(): GameStateSnapshot {
    const blobs = this.entityManager.getAliveBlobs();
    
    return {
      tick: this.tick,
      roundState: this.roundState,
      currentRound: this.currentRound,
      roundTimer: this.roundTimer,
      blobs: blobs.map(b => this.blobToSnapshot(b)),
      pellets: this.entityManager.getAllPellets().map(p => this.pelletToSnapshot(p)),
      leaderboard: this.getLeaderboard(),
    };
  }
  
  private blobToSnapshot(blob: ServerBlob): BlobSnapshot {
    return {
      id: blob.id,
      x: Math.round(blob.x * 10) / 10,
      y: Math.round(blob.y * 10) / 10,
      radius: Math.round(blob.radius * 10) / 10,
      color: blob.color.fill,
      name: blob.name,
      expression: blob.expression,
      fragments: blob.fragments.map(f => ({
        id: f.id,
        x: Math.round(f.x * 10) / 10,
        y: Math.round(f.y * 10) / 10,
        radius: Math.round(f.radius * 10) / 10,
      })),
    };
  }
  
  private pelletToSnapshot(pellet: ServerPellet): PelletSnapshot {
    return {
      id: pellet.id,
      x: Math.round(pellet.x),
      y: Math.round(pellet.y),
      mass: pellet.mass,
      type: pellet.type,
    };
  }
  
  getLeaderboard(): LeaderboardEntry[] {
    return this.entityManager.getAliveBlobs()
      .sort((a, b) => b.mass - a.mass)
      .slice(0, 10)
      .map((blob, index) => ({
        id: blob.id,
        name: blob.name,
        mass: Math.floor(blob.mass),
        rank: index + 1,
      }));
  }
  
  getKillEvents(): KillEvent[] {
    return this.killEvents;
  }
  
  // ===========================================================================
  // Getters
  // ===========================================================================
  
  getTick(): number {
    return this.tick;
  }
  
  getRoundState(): RoundState {
    return this.roundState;
  }
  
  getCurrentRound(): number {
    return this.currentRound;
  }
  
  getRoundTimer(): number {
    return this.roundTimer;
  }
  
  getEntityManager(): EntityManager {
    return this.entityManager;
  }
}
