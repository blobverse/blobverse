// Blobverse — Game Class
// Main game loop + player blob + AI blobs + pellet + eating + split/eject

import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  INITIAL_MASS,
  BASE_SPEED,
  SPEED_DECAY_EXPONENT,
  MOVEMENT_SMOOTHING,
  MIN_MOVE_THRESHOLD,
  PELLET_MASS_MIN,
  PELLET_MASS_MAX,
  MASS_ABSORPTION_RATIO,
  MIN_SPLIT_MASS,
  SPLIT_COOLDOWN_TICKS,
  SPLIT_LAUNCH_SPEED,
  MERGE_DELAY_TICKS,
  MIN_EJECT_MASS,
  EJECT_MASS_AMOUNT,
  EJECT_SPEED,
  SERVER_TPS,
  lerp,
  clamp,
  calculateRadius,
  distance,
  checkEating,
  SpatialHashGrid,
  SpatialEntity,
  GameStateSnapshot,
  LeaderboardEntry,
} from '@blobverse/shared';
import { Renderer } from './Renderer';
import { Camera } from './Camera';
import { Input } from './Input';
import { KillFeed } from './KillFeed';
import { BlobSprite, BLOB_PALETTE } from '../entities/BlobSprite';
import { PelletSprite } from '../entities/PelletSprite';
import { ParticleSystem } from '../entities/ParticleSystem';

// Config
const INITIAL_PELLET_COUNT = 500;
const MAX_PELLETS = 800;
const PELLET_SPAWN_RATE = 5;
const GOLDEN_PELLET_CHANCE = 0.02;
const GOLDEN_MASS_MULTIPLIER = 5;
const EATING_EXPRESSION_DURATION = 300;

// AI Config
const INITIAL_AI_COUNT = 10;
const AI_WANDER_SPEED = 0.8;
const AI_TARGET_CHANGE_INTERVAL = 2000;
const ROUND_DURATION_SECONDS = 30;
const TOTAL_ROUNDS = 3;
const SHRINK_START_DELAY_SECONDS = 10;
const FINAL_ZONE_SCALE = 0.38;

// Convert ticks to ms
const SPLIT_COOLDOWN_MS = (SPLIT_COOLDOWN_TICKS / SERVER_TPS) * 1000; // 1 second
const MERGE_DELAY_MS = (MERGE_DELAY_TICKS / SERVER_TPS) * 1000; // 8 seconds

// Blob entity for spatial hash
interface BlobEntity extends SpatialEntity {
  sprite: BlobSprite;
  velocityX: number;
  velocityY: number;
  mass: number;
  name: string;
  isPlayer: boolean;
  isAlive: boolean;
  colorIndex: number;
  // Split state
  splitCooldown: number; // ms remaining
  parentId?: string; // If this is a fragment
  mergeTimer?: number; // ms until can merge (fragments only)
  // AI state
  targetX?: number;
  targetY?: number;
  targetChangeTime?: number;
}

// Pellet entity for spatial hash
interface PelletEntity extends SpatialEntity {
  sprite: PelletSprite;
  velocityX?: number;
  velocityY?: number;
  isEjected?: boolean;
}

interface ZoneBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface LocalGameOverPayload {
  playerRank: number;
  totalPlayers: number;
  playerName: string;
  rankings: Array<{ rank: number; name: string; mass: number; isPlayer: boolean }>;
  stats: { blobsEaten: number; maxMass: number; survivalTime: number };
}

export class Game {
  private renderer: Renderer;
  private camera: Camera;
  private input: Input;

  // Game loop
  private running: boolean = false;
  private gameEnded: boolean = false;
  private lastTime: number = 0;
  private startTimeMs: number = 0;
  private blobsEatenByPlayer: number = 0;
  private maxPlayerMass: number = 0;
  private currentZone: ZoneBounds = { left: 0, top: 0, right: WORLD_WIDTH, bottom: WORLD_HEIGHT };

  // Blobs (including player and fragments)
  private blobs: Map<string, BlobEntity> = new Map();
  private playerBlobIds: Set<string> = new Set(); // All player-controlled blobs
  private playerId: string = 'player_0';
  private blobIdCounter: number = 0;
  private eatingExpressionTimers: Map<string, number> = new Map();

  // Pellets
  private pellets: Map<string, PelletEntity> = new Map();
  private pelletIdCounter: number = 0;
  private pelletSpawnAccumulator: number = 0;

  // Spatial hashes
  private blobSpatialHash: SpatialHashGrid<BlobEntity>;
  private pelletSpatialHash: SpatialHashGrid<PelletEntity>;

  // Effects
  private particleSystem: ParticleSystem;
  private killFeed: KillFeed;

  // Camera
  private cameraFollowsPlayer: boolean = true;
  private stateListeners: Set<(state: GameStateSnapshot) => void> = new Set();
  private gameOverListeners: Set<(payload: LocalGameOverPayload) => void> = new Set();

  private constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.camera = renderer.camera;
    this.input = new Input(renderer.getCanvas(), this.camera);
    this.blobSpatialHash = new SpatialHashGrid<BlobEntity>();
    this.pelletSpatialHash = new SpatialHashGrid<PelletEntity>();

    // Create particle system
    this.particleSystem = new ParticleSystem();
    renderer.entityContainer.addChild(this.particleSystem);

    // Create kill feed
    this.killFeed = new KillFeed();
    this.killFeed.position.set(renderer.app.screen.width - 10, 50);
    renderer.app.stage.addChild(this.killFeed);

    // Create player blob
    this.createPlayerBlob();

    // Create AI blobs
    for (let i = 0; i < INITIAL_AI_COUNT; i++) {
      this.spawnAIBlob();
    }

    // Spawn initial pellets
    this.spawnInitialPellets();

    // Input callbacks
    this.input.onSplit = () => this.handleSplit();
    this.input.onEject = () => this.handleEject();
  }

  static async create(): Promise<Game> {
    const renderer = await Renderer.create();
    const target =
      document.getElementById('canvas-container') ??
      document.getElementById('root');
    if (target) {
      target.innerHTML = '';
      target.appendChild(renderer.getCanvas());
    }

    const game = new Game(renderer);

    window.addEventListener('keydown', (e) => {
      switch (e.key.toLowerCase()) {
        case 'c':
          game.cameraFollowsPlayer = !game.cameraFollowsPlayer;
          break;
        case 'r':
          game.resetPlayer();
          break;
        case '+':
        case '=':
          game.addPlayerMass(20);
          break;
        case '-':
          game.addPlayerMass(-20);
          break;
      }
    });

    return game;
  }

  // --- Blob Management ---

  private generateBlobId(): string {
    return `blob_${this.blobIdCounter++}`;
  }

  private createPlayerBlob(): void {
    const id = this.playerId;
    const mass = INITIAL_MASS * 5; // Start bigger for testing split
    const x = WORLD_WIDTH / 2;
    const y = WORLD_HEIGHT / 2;

    const sprite = new BlobSprite(mass, {
      color: BLOB_PALETTE[1],
      name: 'Player',
      isPlayer: true,
    });
    sprite.position.set(x, y);
    this.renderer.entityContainer.addChild(sprite);

    const entity: BlobEntity = {
      id,
      x,
      y,
      radius: calculateRadius(mass),
      sprite,
      velocityX: 0,
      velocityY: 0,
      mass,
      name: 'Player',
      isPlayer: true,
      isAlive: true,
      colorIndex: 1,
      splitCooldown: 0,
    };

    this.blobs.set(id, entity);
    this.playerBlobIds.add(id);
    this.blobSpatialHash.insert(entity);
  }

  private createFragment(parent: BlobEntity, dirX: number, dirY: number): BlobEntity {
    const id = this.generateBlobId();
    const mass = parent.mass / 2;

    // Reduce parent mass
    parent.mass = mass;
    parent.radius = calculateRadius(mass);
    parent.sprite.mass = mass;
    parent.splitCooldown = SPLIT_COOLDOWN_MS;

    // Create fragment sprite
    const sprite = new BlobSprite(mass, {
      color: BLOB_PALETTE[parent.colorIndex],
      name: parent.name,
      isPlayer: parent.isPlayer,
    });
    sprite.position.set(parent.x, parent.y);
    this.renderer.entityContainer.addChild(sprite);

    // Launch fragment
    const entity: BlobEntity = {
      id,
      x: parent.x,
      y: parent.y,
      radius: calculateRadius(mass),
      sprite,
      velocityX: dirX * SPLIT_LAUNCH_SPEED,
      velocityY: dirY * SPLIT_LAUNCH_SPEED,
      mass,
      name: parent.name,
      isPlayer: parent.isPlayer,
      isAlive: true,
      colorIndex: parent.colorIndex,
      splitCooldown: SPLIT_COOLDOWN_MS,
      parentId: parent.id,
      mergeTimer: MERGE_DELAY_MS,
    };

    this.blobs.set(id, entity);
    if (parent.isPlayer) {
      this.playerBlobIds.add(id);
    }
    this.blobSpatialHash.insert(entity);

    console.log(`🔪 Split! Mass: ${mass.toFixed(1)} each`);
    return entity;
  }

  private spawnAIBlob(): void {
    const id = this.generateBlobId();
    const mass = INITIAL_MASS + Math.random() * 30;
    const spawnBounds = this.getInsetZone(this.currentZone, 50);
    const x = this.randomInRange(spawnBounds.left, spawnBounds.right);
    const y = this.randomInRange(spawnBounds.top, spawnBounds.bottom);
    const colorIndex = Math.floor(Math.random() * BLOB_PALETTE.length);
    const names = ['Chompy', 'Blobby', 'Gloopy', 'Muncher', 'Slurp', 'Wobble', 'Nom', 'Gulp'];
    const name = names[Math.floor(Math.random() * names.length)];

    const sprite = new BlobSprite(mass, {
      color: BLOB_PALETTE[colorIndex],
      name,
      isPlayer: false,
    });
    sprite.position.set(x, y);
    this.renderer.entityContainer.addChild(sprite);

    const entity: BlobEntity = {
      id,
      x,
      y,
      radius: calculateRadius(mass),
      sprite,
      velocityX: 0,
      velocityY: 0,
      mass,
      name,
      isPlayer: false,
      isAlive: true,
      colorIndex,
      splitCooldown: 0,
      targetX: x,
      targetY: y,
      targetChangeTime: 0,
    };

    this.blobs.set(id, entity);
    this.blobSpatialHash.insert(entity);
  }

  private killBlob(entity: BlobEntity, killer: BlobEntity): void {
    if (!entity.isAlive) return;
    entity.isAlive = false;

    const colorHex = parseInt(BLOB_PALETTE[entity.colorIndex].fill.replace('#', ''), 16);
    this.particleSystem.spawnDeathParticles(entity.x, entity.y, colorHex, 16);
    this.killFeed.addKill(killer.name, entity.name);

    this.blobSpatialHash.remove(entity);
    this.renderer.entityContainer.removeChild(entity.sprite);
    entity.sprite.destroy();
    this.blobs.delete(entity.id);
    this.playerBlobIds.delete(entity.id);

    if (!entity.isPlayer) {
      setTimeout(() => this.spawnAIBlob(), 3000);
    }
  }

  private mergeBlobs(a: BlobEntity, b: BlobEntity): void {
    // Merge b into a
    a.mass += b.mass;
    a.radius = calculateRadius(a.mass);
    a.sprite.mass = a.mass;

    // Remove b
    this.blobSpatialHash.remove(b);
    this.renderer.entityContainer.removeChild(b.sprite);
    b.sprite.destroy();
    this.blobs.delete(b.id);
    this.playerBlobIds.delete(b.id);

    console.log(`🔗 Merged! New mass: ${a.mass.toFixed(1)}`);
  }

  // --- Pellet Management ---

  private generatePelletId(): string {
    return `pellet_${this.pelletIdCounter++}`;
  }

  private spawnInitialPellets(): void {
    for (let i = 0; i < INITIAL_PELLET_COUNT; i++) {
      this.spawnPellet();
    }
  }

  private spawnPellet(): void {
    if (this.pellets.size >= MAX_PELLETS) return;

    const id = this.generatePelletId();
    const spawnBounds = this.getInsetZone(this.currentZone, 20);
    const x = this.randomInRange(spawnBounds.left, spawnBounds.right);
    const y = this.randomInRange(spawnBounds.top, spawnBounds.bottom);
    const isGolden = Math.random() < GOLDEN_PELLET_CHANCE;
    const baseMass = PELLET_MASS_MIN + Math.random() * (PELLET_MASS_MAX - PELLET_MASS_MIN);
    const mass = isGolden ? baseMass * GOLDEN_MASS_MULTIPLIER : baseMass;

    const sprite = new PelletSprite(id, x, y, mass, isGolden);
    const entity: PelletEntity = { id, x, y, radius: sprite.radius, sprite };

    this.pellets.set(id, entity);
    this.pelletSpatialHash.insert(entity);
    this.renderer.entityContainer.addChild(sprite);
  }

  private spawnEjectedPellet(blob: BlobEntity, dirX: number, dirY: number): void {
    const id = this.generatePelletId();
    const mass = EJECT_MASS_AMOUNT;
    const x = blob.x + dirX * (blob.radius + 10);
    const y = blob.y + dirY * (blob.radius + 10);

    const sprite = new PelletSprite(id, x, y, mass, false);
    const entity: PelletEntity = {
      id,
      x,
      y,
      radius: sprite.radius,
      sprite,
      velocityX: dirX * EJECT_SPEED,
      velocityY: dirY * EJECT_SPEED,
      isEjected: true,
    };

    this.pellets.set(id, entity);
    this.pelletSpatialHash.insert(entity);
    this.renderer.entityContainer.addChild(sprite);
  }

  private removePellet(entity: PelletEntity): void {
    this.pelletSpatialHash.remove(entity);
    this.renderer.entityContainer.removeChild(entity.sprite);
    entity.sprite.destroy();
    this.pellets.delete(entity.id);
  }

  // --- Player Actions ---

  private handleSplit(): void {
    const look = this.input.getLookDirection();
    const playerBlobs = Array.from(this.playerBlobIds)
      .map(id => this.blobs.get(id))
      .filter((b): b is BlobEntity => b !== undefined && b.isAlive);

    for (const blob of playerBlobs) {
      if (blob.mass >= MIN_SPLIT_MASS && blob.splitCooldown <= 0) {
        this.createFragment(blob, look.x, look.y);
      }
    }
  }

  private handleEject(): void {
    const look = this.input.getLookDirection();
    const playerBlobs = Array.from(this.playerBlobIds)
      .map(id => this.blobs.get(id))
      .filter((b): b is BlobEntity => b !== undefined && b.isAlive);

    for (const blob of playerBlobs) {
      if (blob.mass >= MIN_EJECT_MASS) {
        blob.mass -= EJECT_MASS_AMOUNT;
        blob.radius = calculateRadius(blob.mass);
        blob.sprite.mass = blob.mass;
        this.spawnEjectedPellet(blob, look.x, look.y);
      }
    }
  }

  private resetPlayer(): void {
    // Kill all player blobs and create fresh
    for (const id of this.playerBlobIds) {
      const blob = this.blobs.get(id);
      if (blob) {
        this.blobSpatialHash.remove(blob);
        this.renderer.entityContainer.removeChild(blob.sprite);
        blob.sprite.destroy();
        this.blobs.delete(id);
      }
    }
    this.playerBlobIds.clear();
    this.createPlayerBlob();
  }

  private addPlayerMass(delta: number): void {
    for (const id of this.playerBlobIds) {
      const blob = this.blobs.get(id);
      if (blob) {
        blob.mass = Math.max(5, blob.mass + delta);
        blob.radius = calculateRadius(blob.mass);
        blob.sprite.mass = blob.mass;
      }
    }
  }

  // --- Game Loop ---

  start(): void {
    if (this.running) return;
    this.running = true;
    this.gameEnded = false;
    this.lastTime = performance.now();
    this.startTimeMs = this.lastTime;
    this.currentZone = { left: 0, top: 0, right: WORLD_WIDTH, bottom: WORLD_HEIGHT };
    this.blobsEatenByPlayer = 0;
    this.maxPlayerMass = this.getPlayerTotalMass();
    requestAnimationFrame((t) => this.gameLoop(t));
    console.log('🎮 Game started');
    console.log('   SPACE = Split, W/E/Right-click = Eject');
  }

  stop(): void {
    this.running = false;
  }

  private gameLoop(currentTime: number): void {
    if (!this.running) return;

    const dt = currentTime - this.lastTime;
    this.lastTime = currentTime;

    this.update(dt / 1000, dt);
    this.renderer.render(dt);

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  private update(dtSeconds: number, dtMs: number): void {
    const elapsedSec = (performance.now() - this.startTimeMs) / 1000;
    const zoneProgress = this.getZoneProgress(elapsedSec);
    this.currentZone = this.getZoneBounds(zoneProgress);
    this.renderer.setShrinkingZone(this.currentZone, zoneProgress);

    // Update player blobs
    const target = this.input.getTargetPosition();
    for (const id of this.playerBlobIds) {
      const blob = this.blobs.get(id);
      if (blob && blob.isAlive) {
        this.updateBlobMovement(blob, target.x, target.y, dtSeconds);
        blob.splitCooldown = Math.max(0, blob.splitCooldown - dtMs);
      }
    }

    // Update AI blobs
    for (const blob of this.blobs.values()) {
      if (!blob.isPlayer && blob.isAlive) {
        this.updateAIBehavior(blob, dtMs);
        if (blob.targetX !== undefined && blob.targetY !== undefined) {
          this.updateBlobMovement(blob, blob.targetX, blob.targetY, dtSeconds);
        }
      }
    }

    // Update fragment merge timers + check merging
    this.updateFragmentMerging(dtMs);

    // Update ejected pellets
    this.updateEjectedPellets(dtSeconds);

    // Rebuild spatial hashes
    this.rebuildSpatialHashes();

    // Collisions
    this.checkBlobCollisions();
    this.checkPelletCollisions();

    // Spawn pellets
    this.pelletSpawnAccumulator += dtSeconds * PELLET_SPAWN_RATE;
    while (this.pelletSpawnAccumulator >= 1) {
      this.spawnPellet();
      this.pelletSpawnAccumulator -= 1;
    }

    // Update sprites and effects
    this.updateSprites(dtMs);
    this.particleSystem.update(dtMs);
    this.killFeed.update();

    // Update camera (follow center of player blobs)
    if (this.cameraFollowsPlayer && this.playerBlobIds.size > 0) {
      const center = this.getPlayerCenter();
      const totalMass = this.getPlayerTotalMass();
      this.camera.update({ x: center.x, y: center.y, mass: totalMass }, dtSeconds);
    }

    // Debug
    this.renderer.setDebugData('Mass', this.getPlayerTotalMass());
    this.renderer.setDebugData('Blobs', this.blobs.size);
    this.renderer.setDebugData('Fragments', this.playerBlobIds.size);
    this.renderer.setDebugData('Zone', `${Math.round((1 - zoneProgress) * 100)}%`);

    this.maxPlayerMass = Math.max(this.maxPlayerMass, this.getPlayerTotalMass());
    this.emitState();
    this.checkGameEnd();
  }

  private getPlayerCenter(): { x: number; y: number } {
    let totalX = 0, totalY = 0, totalMass = 0;
    for (const id of this.playerBlobIds) {
      const blob = this.blobs.get(id);
      if (blob && blob.isAlive) {
        totalX += blob.x * blob.mass;
        totalY += blob.y * blob.mass;
        totalMass += blob.mass;
      }
    }
    return totalMass > 0
      ? { x: totalX / totalMass, y: totalY / totalMass }
      : { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
  }

  private getPlayerTotalMass(): number {
    let total = 0;
    for (const id of this.playerBlobIds) {
      const blob = this.blobs.get(id);
      if (blob && blob.isAlive) total += blob.mass;
    }
    return total;
  }

  private updateFragmentMerging(dtMs: number): void {
    const playerBlobs = Array.from(this.playerBlobIds)
      .map(id => this.blobs.get(id))
      .filter((b): b is BlobEntity => b !== undefined && b.isAlive);

    // Update merge timers
    for (const blob of playerBlobs) {
      if (blob.mergeTimer !== undefined) {
        blob.mergeTimer = Math.max(0, blob.mergeTimer - dtMs);
      }
    }

    // Check for merge opportunities
    for (let i = 0; i < playerBlobs.length; i++) {
      for (let j = i + 1; j < playerBlobs.length; j++) {
        const a = playerBlobs[i];
        const b = playerBlobs[j];

        // Both must have expired merge timer (or no timer = main blob)
        const aCanMerge = a.mergeTimer === undefined || a.mergeTimer <= 0;
        const bCanMerge = b.mergeTimer === undefined || b.mergeTimer <= 0;

        if (aCanMerge && bCanMerge) {
          const dist = distance(a.x, a.y, b.x, b.y);
          const mergeDistance = Math.max(a.radius, b.radius) * 0.5;

          if (dist < mergeDistance) {
            // Merge smaller into larger
            if (a.mass >= b.mass) {
              this.mergeBlobs(a, b);
            } else {
              this.mergeBlobs(b, a);
            }
            return; // One merge per frame
          }
        }
      }
    }
  }

  private updateEjectedPellets(dtSeconds: number): void {
    for (const pellet of this.pellets.values()) {
      if (pellet.isEjected && pellet.velocityX !== undefined && pellet.velocityY !== undefined) {
        // Move
        pellet.x += pellet.velocityX * dtSeconds;
        pellet.y += pellet.velocityY * dtSeconds;
        pellet.sprite.position.set(pellet.x, pellet.y);

        // Friction
        pellet.velocityX *= 0.95;
        pellet.velocityY *= 0.95;

        // Clamp to world
        pellet.x = clamp(pellet.x, this.currentZone.left + 10, this.currentZone.right - 10);
        pellet.y = clamp(pellet.y, this.currentZone.top + 10, this.currentZone.bottom - 10);

        // Stop if slow enough
        const speed = Math.sqrt(pellet.velocityX ** 2 + pellet.velocityY ** 2);
        if (speed < 5) {
          pellet.velocityX = 0;
          pellet.velocityY = 0;
          pellet.isEjected = false;
        }
      }
    }
  }

  private updateAIBehavior(blob: BlobEntity, dtMs: number): void {
    blob.targetChangeTime = (blob.targetChangeTime || 0) - dtMs;
    if (blob.targetChangeTime <= 0) {
      const targetBounds = this.getInsetZone(this.currentZone, blob.radius + 10);
      blob.targetX = this.randomInRange(targetBounds.left, targetBounds.right);
      blob.targetY = this.randomInRange(targetBounds.top, targetBounds.bottom);
      blob.targetChangeTime = AI_TARGET_CHANGE_INTERVAL + Math.random() * 1000;
    }
  }

  private updateBlobMovement(blob: BlobEntity, targetX: number, targetY: number, dt: number): void {
    const dx = targetX - blob.x;
    const dy = targetY - blob.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const speedMult = blob.isPlayer ? 1 : AI_WANDER_SPEED;

    // Fragment launch velocity decays
    if (blob.parentId && (Math.abs(blob.velocityX) > 100 || Math.abs(blob.velocityY) > 100)) {
      blob.velocityX *= 0.92;
      blob.velocityY *= 0.92;
    } else if (dist < MIN_MOVE_THRESHOLD) {
      blob.velocityX = lerp(blob.velocityX, 0, MOVEMENT_SMOOTHING);
      blob.velocityY = lerp(blob.velocityY, 0, MOVEMENT_SMOOTHING);
    } else {
      const maxSpeed = (BASE_SPEED / Math.pow(blob.mass, SPEED_DECAY_EXPONENT)) * speedMult;
      const dirX = dx / dist;
      const dirY = dy / dist;
      blob.velocityX = lerp(blob.velocityX, dirX * maxSpeed, MOVEMENT_SMOOTHING);
      blob.velocityY = lerp(blob.velocityY, dirY * maxSpeed, MOVEMENT_SMOOTHING);
    }

    blob.x += blob.velocityX * dt;
    blob.y += blob.velocityY * dt;
    blob.x = clamp(blob.x, this.currentZone.left + blob.radius, this.currentZone.right - blob.radius);
    blob.y = clamp(blob.y, this.currentZone.top + blob.radius, this.currentZone.bottom - blob.radius);
  }

  private getZoneProgress(elapsedSec: number): number {
    const matchDuration = ROUND_DURATION_SECONDS * TOTAL_ROUNDS;
    const shrinkDuration = Math.max(1, matchDuration - SHRINK_START_DELAY_SECONDS);
    return clamp((elapsedSec - SHRINK_START_DELAY_SECONDS) / shrinkDuration, 0, 1);
  }

  private getZoneBounds(progress: number): ZoneBounds {
    const scale = lerp(1, FINAL_ZONE_SCALE, progress);
    const width = WORLD_WIDTH * scale;
    const height = WORLD_HEIGHT * scale;
    const centerX = WORLD_WIDTH / 2;
    const centerY = WORLD_HEIGHT / 2;
    return {
      left: centerX - width / 2,
      top: centerY - height / 2,
      right: centerX + width / 2,
      bottom: centerY + height / 2,
    };
  }

  private getInsetZone(zone: ZoneBounds, padding: number): ZoneBounds {
    const maxPadding = Math.max(0, Math.min((zone.right - zone.left) / 2 - 2, (zone.bottom - zone.top) / 2 - 2));
    const p = Math.min(padding, maxPadding);
    return {
      left: zone.left + p,
      top: zone.top + p,
      right: zone.right - p,
      bottom: zone.bottom - p,
    };
  }

  private randomInRange(min: number, max: number): number {
    if (max <= min) return min;
    return min + Math.random() * (max - min);
  }

  private rebuildSpatialHashes(): void {
    this.blobSpatialHash.clear();
    for (const blob of this.blobs.values()) {
      if (blob.isAlive) this.blobSpatialHash.insert(blob);
    }
    this.pelletSpatialHash.clear();
    for (const pellet of this.pellets.values()) {
      this.pelletSpatialHash.insert(pellet);
    }
  }

  private checkBlobCollisions(): void {
    for (const blob of this.blobs.values()) {
      if (!blob.isAlive) continue;

      const candidates = this.blobSpatialHash.query(blob.x, blob.y, blob.radius + 50);

      for (const other of candidates) {
        if (other.id === blob.id || !other.isAlive) continue;
        // Skip same-owner fragments
        if (blob.isPlayer && other.isPlayer) continue;

        const result = checkEating(
          blob.mass, blob.x, blob.y, blob.radius,
          other.mass, other.x, other.y, other.radius
        );

        if (result === 'a_eats_b') {
          this.executeEating(blob, other);
        } else if (result === 'b_eats_a') {
          this.executeEating(other, blob);
        }
      }
    }
  }

  private executeEating(eater: BlobEntity, eaten: BlobEntity): void {
    const massGain = eaten.mass * MASS_ABSORPTION_RATIO;
    eater.mass += massGain;
    eater.radius = calculateRadius(eater.mass);
    eater.sprite.mass = eater.mass;

    eater.sprite.expression = 'eating';
    this.eatingExpressionTimers.set(eater.id, EATING_EXPRESSION_DURATION);

    if (eater.isPlayer && !eaten.isPlayer) {
      this.blobsEatenByPlayer += 1;
    }

    const colorHex = parseInt(BLOB_PALETTE[eaten.colorIndex].fill.replace('#', ''), 16);
    this.particleSystem.spawnEatParticles(eaten.x, eaten.y, colorHex, 8);

    this.killBlob(eaten, eater);
  }

  private checkPelletCollisions(): void {
    for (const blob of this.blobs.values()) {
      if (!blob.isAlive) continue;

      const candidates = this.pelletSpatialHash.query(blob.x, blob.y, blob.radius + 10);

      for (const pellet of candidates) {
        const dist = distance(blob.x, blob.y, pellet.x, pellet.y);
        if (dist < blob.radius) {
          this.eatPellet(blob, pellet);
        }
      }
    }
  }

  private eatPellet(blob: BlobEntity, pellet: PelletEntity): void {
    blob.mass += pellet.sprite.mass;
    blob.radius = calculateRadius(blob.mass);
    blob.sprite.mass = blob.mass;

    blob.sprite.expression = 'eating';
    this.eatingExpressionTimers.set(blob.id, EATING_EXPRESSION_DURATION);

    this.removePellet(pellet);
  }

  private updateSprites(dtMs: number): void {
    const look = this.input.getLookDirection();

    for (const blob of this.blobs.values()) {
      if (!blob.isAlive) continue;

      blob.sprite.position.set(blob.x, blob.y);

      if (blob.isPlayer) {
        blob.sprite.setLookDirection(look.x, look.y);
      } else {
        blob.sprite.setLookDirection(blob.velocityX, blob.velocityY);
      }
      blob.sprite.updateEyes(dtMs / 1000);

      const timer = this.eatingExpressionTimers.get(blob.id);
      if (timer !== undefined && timer > 0) {
        this.eatingExpressionTimers.set(blob.id, timer - dtMs);
        if (timer - dtMs <= 0) blob.sprite.expression = 'happy';
      }
    }

    for (const pellet of this.pellets.values()) {
      pellet.sprite.update(dtMs);
    }
  }

  destroy(): void {
    this.stop();
    this.input.destroy();
    for (const blob of this.blobs.values()) blob.sprite.destroy();
    for (const pellet of this.pellets.values()) pellet.sprite.destroy();
    this.particleSystem.destroy();
    this.killFeed.destroy();
    this.renderer.destroy();
  }

  onStateChange(listener: (state: GameStateSnapshot) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.buildSnapshot());
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  onGameOver(listener: (payload: LocalGameOverPayload) => void): () => void {
    this.gameOverListeners.add(listener);
    return () => {
      this.gameOverListeners.delete(listener);
    };
  }

  private emitState(): void {
    if (this.stateListeners.size === 0) return;
    const snapshot = this.buildSnapshot();
    for (const listener of this.stateListeners) {
      listener(snapshot);
    }
  }

  private buildSnapshot(): GameStateSnapshot {
    const elapsedSec = (performance.now() - this.startTimeMs) / 1000;
    const currentRound = Math.min(
      TOTAL_ROUNDS,
      Math.floor(elapsedSec / ROUND_DURATION_SECONDS) + 1
    );
    const roundEnd = currentRound * ROUND_DURATION_SECONDS;
    const roundTimer = Math.max(0, roundEnd - elapsedSec);

    const leaderboard = Array.from(this.blobs.values())
      .filter((b) => b.isAlive)
      .sort((a, b) => b.mass - a.mass)
      .slice(0, 10)
      .map((b, idx) => ({
        id: b.id,
        name: b.name,
        mass: Math.round(b.mass),
        rank: idx + 1,
      }));

    return {
      tick: Math.floor(elapsedSec * SERVER_TPS),
      roundState: this.running ? 'playing' : 'finished',
      currentRound,
      roundTimer,
      blobs: Array.from(this.blobs.values())
        .filter((b) => b.isAlive)
        .map((b) => ({
          id: b.id,
          x: b.x,
          y: b.y,
          radius: b.radius,
          color: BLOB_PALETTE[b.colorIndex].fill,
          name: b.name,
          expression: b.sprite.expression,
          fragments: [],
        })),
      pellets: Array.from(this.pellets.values()).map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        mass: p.sprite.mass,
        type: p.isEjected ? 'ejected' : 'normal',
      })),
      leaderboard,
    };
  }

  private checkGameEnd(): void {
    if (!this.running || this.gameEnded) return;

    const elapsedSec = (performance.now() - this.startTimeMs) / 1000;
    const playerAlive = Array.from(this.playerBlobIds).some((id) => this.blobs.get(id)?.isAlive);
    const timeUp = elapsedSec >= ROUND_DURATION_SECONDS * TOTAL_ROUNDS;

    if (!playerAlive || timeUp) {
      this.gameEnded = true;
      this.running = false;
      const finalRankings = Array.from(this.blobs.values())
        .filter((b) => b.isAlive)
        .sort((a, b) => b.mass - a.mass)
        .map((b, idx) => ({
          rank: idx + 1,
          name: b.name,
          mass: Math.round(b.mass),
          isPlayer: b.isPlayer,
        }));
      const playerRank = finalRankings.find((r) => r.isPlayer)?.rank ?? finalRankings.length + 1;

      const payload: LocalGameOverPayload = {
        playerRank,
        totalPlayers: finalRankings.length,
        playerName: 'Player',
        rankings: finalRankings,
        stats: {
          blobsEaten: this.blobsEatenByPlayer,
          maxMass: Math.round(this.maxPlayerMass),
          survivalTime: Math.round(elapsedSec),
        },
      };

      for (const listener of this.gameOverListeners) {
        listener(payload);
      }
    }
  }
}
