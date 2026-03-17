// Room — Game room with lifecycle management

import { nanoid } from 'nanoid';
import { Player } from './Player.js';
import {
  MAX_PLAYERS_PER_ROOM,
  LOBBY_WAIT_SECONDS,
  MIN_PLAYERS_TO_START,
  AI_FILL_RATIO,
  SERVER_TPS,
  TICK_INTERVAL_MS,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  INITIAL_MASS,
  COUNTDOWN_DURATION,
} from '@blobverse/shared';

export type RoomState = 'lobby' | 'countdown' | 'playing' | 'postgame' | 'closed';

export interface RoomConfig {
  maxPlayers?: number;
  aiFillRatio?: number;
  lobbyWaitSeconds?: number;
  roundDuration?: number; // seconds
}

const AI_NAMES = [
  'Chompy', 'Blobby', 'Gloopy', 'Muncher', 'Slurp', 'Wobble', 'Nom', 'Gulp',
  'Squishy', 'Bouncy', 'Zippy', 'Bubbles', 'Floaty', 'Jiggly', 'Boing', 'Splat',
];

export class Room {
  readonly id: string;
  readonly createdAt: number;
  
  // Config
  private config: Required<RoomConfig>;
  
  // State
  state: RoomState = 'lobby';
  players: Map<string, Player> = new Map();
  
  // Timing
  private lobbyTimer: NodeJS.Timeout | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;
  private gameLoopInterval: NodeJS.Timeout | null = null;
  private roundStartTime: number = 0;
  private tickCount: number = 0;
  
  // Callbacks
  onStateChange?: (room: Room, state: RoomState) => void;
  onEmpty?: (room: Room) => void;
  
  constructor(config: RoomConfig = {}) {
    this.id = nanoid(8);
    this.createdAt = Date.now();
    
    this.config = {
      maxPlayers: config.maxPlayers ?? MAX_PLAYERS_PER_ROOM,
      aiFillRatio: config.aiFillRatio ?? AI_FILL_RATIO,
      lobbyWaitSeconds: config.lobbyWaitSeconds ?? LOBBY_WAIT_SECONDS,
      roundDuration: config.roundDuration ?? 120, // 2 minutes default
    };
  }
  
  // ===========================================================================
  // Player Management
  // ===========================================================================
  
  get playerCount(): number {
    return this.players.size;
  }
  
  get humanCount(): number {
    return Array.from(this.players.values()).filter(p => !p.isAI).length;
  }
  
  get aiCount(): number {
    return Array.from(this.players.values()).filter(p => p.isAI).length;
  }
  
  get isFull(): boolean {
    return this.playerCount >= this.config.maxPlayers;
  }
  
  get canJoin(): boolean {
    return this.state === 'lobby' && !this.isFull;
  }
  
  /**
   * Add a human player to the room
   */
  addPlayer(player: Player): boolean {
    if (!this.canJoin) return false;
    
    // Spawn at random position
    player.x = Math.random() * (WORLD_WIDTH - 200) + 100;
    player.y = Math.random() * (WORLD_HEIGHT - 200) + 100;
    player.mass = INITIAL_MASS;
    player.isAlive = true;
    
    this.players.set(player.id, player);
    
    // Notify player
    player.send({
      type: 'room_joined',
      roomId: this.id,
      playerId: player.id,
      state: this.state,
      players: this.getPlayerList(),
    });
    
    // Broadcast to others
    this.broadcast({
      type: 'player_joined',
      player: player.toJSON(),
    }, player.id);
    
    console.log(`[Room ${this.id}] Player joined: ${player.name} (${this.playerCount}/${this.config.maxPlayers})`);
    
    // Start lobby timer if enough players
    this.checkLobbyStart();
    
    return true;
  }
  
  /**
   * Remove a player from the room
   */
  removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;
    
    this.players.delete(playerId);
    
    // Broadcast removal
    this.broadcast({
      type: 'player_left',
      playerId,
    });
    
    console.log(`[Room ${this.id}] Player left: ${player.name} (${this.playerCount}/${this.config.maxPlayers})`);
    
    // Check if room is empty
    if (this.humanCount === 0) {
      this.onEmpty?.(this);
    }
  }
  
  /**
   * Add AI players to fill the room
   */
  fillWithAI(): void {
    const targetAICount = Math.floor(this.config.maxPlayers * this.config.aiFillRatio);
    const currentAICount = this.aiCount;
    const toAdd = Math.min(targetAICount - currentAICount, this.config.maxPlayers - this.playerCount);
    
    for (let i = 0; i < toAdd; i++) {
      const name = AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)];
      const aiPlayer = new Player(null, name, true);
      
      aiPlayer.x = Math.random() * (WORLD_WIDTH - 200) + 100;
      aiPlayer.y = Math.random() * (WORLD_HEIGHT - 200) + 100;
      aiPlayer.mass = INITIAL_MASS;
      
      this.players.set(aiPlayer.id, aiPlayer);
    }
    
    if (toAdd > 0) {
      console.log(`[Room ${this.id}] Added ${toAdd} AI players`);
    }
  }
  
  // ===========================================================================
  // Lobby & Countdown
  // ===========================================================================
  
  private checkLobbyStart(): void {
    if (this.state !== 'lobby') return;
    if (this.humanCount < MIN_PLAYERS_TO_START) return;
    if (this.lobbyTimer) return; // Already counting
    
    // Start lobby countdown
    console.log(`[Room ${this.id}] Starting lobby countdown (${this.config.lobbyWaitSeconds}s)`);
    
    this.broadcast({
      type: 'lobby_countdown_start',
      seconds: this.config.lobbyWaitSeconds,
    });
    
    this.lobbyTimer = setTimeout(() => {
      this.lobbyTimer = null;
      this.startCountdown();
    }, this.config.lobbyWaitSeconds * 1000);
  }
  
  private startCountdown(): void {
    if (this.state !== 'lobby') return;
    
    // Fill with AI before starting
    this.fillWithAI();
    
    this.setState('countdown');
    
    console.log(`[Room ${this.id}] Starting game countdown (${COUNTDOWN_DURATION}s)`);
    
    this.broadcast({
      type: 'game_countdown',
      seconds: COUNTDOWN_DURATION,
    });
    
    this.countdownTimer = setTimeout(() => {
      this.countdownTimer = null;
      this.startGame();
    }, COUNTDOWN_DURATION * 1000);
  }
  
  // ===========================================================================
  // Game Loop
  // ===========================================================================
  
  private startGame(): void {
    this.setState('playing');
    this.roundStartTime = Date.now();
    this.tickCount = 0;
    
    console.log(`[Room ${this.id}] Game started with ${this.playerCount} players`);
    
    this.broadcast({
      type: 'game_start',
      roundDuration: this.config.roundDuration,
      players: this.getPlayerList(),
    });
    
    // Start game loop
    this.gameLoopInterval = setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }
  
  private tick(): void {
    if (this.state !== 'playing') return;
    
    this.tickCount++;
    
    // Update AI inputs
    this.updateAI();
    
    // TODO: Update physics, collisions, etc.
    // This will be implemented in GameState class
    
    // Check round end
    const elapsed = (Date.now() - this.roundStartTime) / 1000;
    if (elapsed >= this.config.roundDuration) {
      this.endRound();
      return;
    }
    
    // Broadcast state periodically (every 50ms = 20 TPS)
    this.broadcastState();
  }
  
  private updateAI(): void {
    for (const player of this.players.values()) {
      if (!player.isAI || !player.isAlive) continue;
      
      // Simple AI: wander randomly
      if (this.tickCount % (SERVER_TPS * 2) === 0) {
        player.input.targetX = Math.random() * WORLD_WIDTH;
        player.input.targetY = Math.random() * WORLD_HEIGHT;
      }
    }
  }
  
  private broadcastState(): void {
    const state = {
      type: 'game_state',
      tick: this.tickCount,
      timeRemaining: Math.max(0, this.config.roundDuration - (Date.now() - this.roundStartTime) / 1000),
      players: this.getPlayerList(),
    };
    
    this.broadcast(state);
  }
  
  // ===========================================================================
  // Round End
  // ===========================================================================
  
  private endRound(): void {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
    
    this.setState('postgame');
    
    // Calculate rankings
    const rankings = Array.from(this.players.values())
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({
        rank: i + 1,
        ...p.toJSON(),
      }));
    
    console.log(`[Room ${this.id}] Round ended. Winner: ${rankings[0]?.name}`);
    
    this.broadcast({
      type: 'round_end',
      rankings,
    });
    
    // Close room after postgame
    setTimeout(() => {
      this.close();
    }, 10000); // 10 second postgame
  }
  
  // ===========================================================================
  // Room Lifecycle
  // ===========================================================================
  
  private setState(state: RoomState): void {
    const oldState = this.state;
    this.state = state;
    
    if (oldState !== state) {
      this.onStateChange?.(this, state);
    }
  }
  
  close(): void {
    if (this.state === 'closed') return;
    
    // Clear timers
    if (this.lobbyTimer) clearTimeout(this.lobbyTimer);
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);
    
    // Notify players
    this.broadcast({
      type: 'room_closed',
      roomId: this.id,
    });
    
    this.setState('closed');
    
    console.log(`[Room ${this.id}] Closed`);
  }
  
  // ===========================================================================
  // Helpers
  // ===========================================================================
  
  private getPlayerList(): object[] {
    return Array.from(this.players.values()).map(p => p.toJSON());
  }
  
  broadcast(message: object, excludePlayerId?: string): void {
    const data = JSON.stringify(message);
    
    for (const player of this.players.values()) {
      if (player.id === excludePlayerId) continue;
      if (player.isAI) continue;
      
      player.send(message);
    }
  }
  
  /**
   * Handle input from a player
   */
  handleInput(playerId: string, input: Partial<Player['input']>): void {
    const player = this.players.get(playerId);
    if (!player) return;
    
    player.updateInput(input);
  }
  
  toJSON() {
    return {
      id: this.id,
      state: this.state,
      playerCount: this.playerCount,
      humanCount: this.humanCount,
      aiCount: this.aiCount,
      maxPlayers: this.config.maxPlayers,
      createdAt: this.createdAt,
    };
  }
}
