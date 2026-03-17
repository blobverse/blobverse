// Matchmaker — Queue-based matchmaking with AI fill

import { WebSocket } from 'ws';
import { RoomManager } from './RoomManager.js';
import { Player } from './Player.js';
import { Room } from './Room.js';
import { MIN_PLAYERS_TO_START } from '@blobverse/shared';

interface QueueEntry {
  player: Player;
  joinedAt: number;
  preferredMode?: string;
}

export class Matchmaker {
  private roomManager: RoomManager;
  private queue: Map<string, QueueEntry> = new Map();
  private matchInterval: NodeJS.Timeout | null = null;
  
  // Config
  private matchIntervalMs: number = 1000; // Check queue every second
  private maxQueueTime: number = 30000; // Force match after 30s
  
  constructor(roomManager: RoomManager) {
    this.roomManager = roomManager;
    this.startMatchmaking();
  }
  
  /**
   * Add a player to the matchmaking queue
   */
  joinQueue(socket: WebSocket, name: string, preferredMode?: string): Player {
    const player = new Player(socket, name, false);
    
    this.queue.set(player.id, {
      player,
      joinedAt: Date.now(),
      preferredMode,
    });
    
    console.log(`[Matchmaker] Player queued: ${name} (queue size: ${this.queue.size})`);
    
    // Notify player they're in queue
    player.send({
      type: 'queue_joined',
      playerId: player.id,
      position: this.queue.size,
      estimatedWait: this.estimateWaitTime(),
    });
    
    // Try immediate match
    this.tryMatch();
    
    return player;
  }
  
  /**
   * Remove a player from the queue
   */
  leaveQueue(playerId: string): boolean {
    const entry = this.queue.get(playerId);
    if (!entry) return false;
    
    this.queue.delete(playerId);
    
    console.log(`[Matchmaker] Player left queue: ${entry.player.name}`);
    
    return true;
  }
  
  /**
   * Get queue status for a player
   */
  getQueueStatus(playerId: string): object | null {
    const entry = this.queue.get(playerId);
    if (!entry) return null;
    
    const position = Array.from(this.queue.keys()).indexOf(playerId) + 1;
    
    return {
      position,
      queueSize: this.queue.size,
      waitTime: Date.now() - entry.joinedAt,
      estimatedWait: this.estimateWaitTime(),
    };
  }
  
  // ===========================================================================
  // Matchmaking Logic
  // ===========================================================================
  
  private startMatchmaking(): void {
    this.matchInterval = setInterval(() => {
      this.tryMatch();
      this.updateQueuePositions();
    }, this.matchIntervalMs);
  }
  
  stopMatchmaking(): void {
    if (this.matchInterval) {
      clearInterval(this.matchInterval);
      this.matchInterval = null;
    }
  }
  
  private tryMatch(): void {
    if (this.queue.size === 0) return;
    
    // Get available rooms
    const rooms = this.roomManager.getJoinableRooms();
    
    // Process queue entries
    const toRemove: string[] = [];
    
    for (const [playerId, entry] of this.queue) {
      const { player } = entry;
      
      // Check if player socket is still open
      if (!player.socket || player.socket.readyState !== WebSocket.OPEN) {
        toRemove.push(playerId);
        continue;
      }
      
      // Find or create room
      let room: Room | undefined;
      
      // First, try to join existing room
      for (const r of rooms) {
        if (r.canJoin) {
          room = r;
          break;
        }
      }
      
      // If no room available, check if we should create one
      if (!room) {
        // Create room if:
        // 1. Queue has enough players
        // 2. Player has been waiting too long
        const queuedPlayers = this.queue.size;
        const waitTime = Date.now() - entry.joinedAt;
        
        if (queuedPlayers >= MIN_PLAYERS_TO_START || waitTime > this.maxQueueTime) {
          room = this.roomManager.createRoom();
        }
      }
      
      // Add player to room if found
      if (room) {
        if (room.addPlayer(player)) {
          toRemove.push(playerId);
        }
      }
    }
    
    // Remove matched players from queue
    for (const id of toRemove) {
      this.queue.delete(id);
    }
  }
  
  private updateQueuePositions(): void {
    let position = 1;
    for (const [_, entry] of this.queue) {
      entry.player.send({
        type: 'queue_update',
        position,
        queueSize: this.queue.size,
        estimatedWait: this.estimateWaitTime(),
      });
      position++;
    }
  }
  
  private estimateWaitTime(): number {
    // Simple estimate: assume a match happens every 10 seconds
    // Real implementation would use historical data
    const avgMatchTime = 10000;
    const position = this.queue.size;
    return Math.ceil(position * avgMatchTime / MIN_PLAYERS_TO_START);
  }
  
  // ===========================================================================
  // Quick Join
  // ===========================================================================
  
  /**
   * Instantly join an available room (skip queue)
   */
  quickJoin(socket: WebSocket, name: string): { room: Room; player: Player } | null {
    const room = this.roomManager.findOrCreateRoom();
    const player = new Player(socket, name, false);
    
    if (room.addPlayer(player)) {
      return { room, player };
    }
    
    return null;
  }
  
  // ===========================================================================
  // Stats
  // ===========================================================================
  
  getStats() {
    return {
      queueSize: this.queue.size,
      averageWaitTime: this.calculateAverageWaitTime(),
      ...this.roomManager.getStats(),
    };
  }
  
  private calculateAverageWaitTime(): number {
    if (this.queue.size === 0) return 0;
    
    const now = Date.now();
    let totalWait = 0;
    
    for (const [_, entry] of this.queue) {
      totalWait += now - entry.joinedAt;
    }
    
    return Math.round(totalWait / this.queue.size);
  }
}
