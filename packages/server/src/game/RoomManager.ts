// RoomManager — Manages all game rooms

import { Room, RoomConfig, RoomState } from './Room.js';
import { Player } from './Player.js';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  
  // Stats
  private totalRoomsCreated: number = 0;
  private totalPlayersServed: number = 0;
  
  /**
   * Create a new room
   */
  createRoom(config?: RoomConfig): Room {
    const room = new Room(config);
    
    // Setup callbacks
    room.onStateChange = (r, state) => this.handleRoomStateChange(r, state);
    room.onEmpty = (r) => this.handleRoomEmpty(r);
    
    this.rooms.set(room.id, room);
    this.totalRoomsCreated++;
    
    console.log(`[RoomManager] Room created: ${room.id} (total: ${this.rooms.size})`);
    
    return room;
  }
  
  /**
   * Get a room by ID
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }
  
  /**
   * Get all active rooms
   */
  getRooms(): Room[] {
    return Array.from(this.rooms.values());
  }
  
  /**
   * Get rooms that players can join
   */
  getJoinableRooms(): Room[] {
    return this.getRooms().filter(r => r.canJoin);
  }
  
  /**
   * Find a room for a player to join, or create one
   */
  findOrCreateRoom(): Room {
    // Try to find an existing room with space
    const joinable = this.getJoinableRooms()
      .sort((a, b) => b.playerCount - a.playerCount); // Prefer fuller rooms
    
    if (joinable.length > 0) {
      return joinable[0];
    }
    
    // Create a new room
    return this.createRoom();
  }
  
  /**
   * Destroy a room
   */
  destroyRoom(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    
    room.close();
    this.rooms.delete(roomId);
    
    console.log(`[RoomManager] Room destroyed: ${roomId} (total: ${this.rooms.size})`);
    
    return true;
  }
  
  /**
   * Get a player from any room
   */
  findPlayer(playerId: string): { room: Room; player: Player } | undefined {
    for (const room of this.rooms.values()) {
      const player = room.players.get(playerId);
      if (player) {
        return { room, player };
      }
    }
    return undefined;
  }
  
  /**
   * Remove a player from all rooms
   */
  removePlayer(playerId: string): void {
    for (const room of this.rooms.values()) {
      room.removePlayer(playerId);
    }
  }
  
  // ===========================================================================
  // Callbacks
  // ===========================================================================
  
  private handleRoomStateChange(room: Room, state: RoomState): void {
    console.log(`[RoomManager] Room ${room.id} state: ${state}`);
    
    if (state === 'closed') {
      this.rooms.delete(room.id);
    }
  }
  
  private handleRoomEmpty(room: Room): void {
    console.log(`[RoomManager] Room ${room.id} is empty`);
    
    // Keep room open in lobby state for new players
    if (room.state === 'lobby') {
      return;
    }
    
    // Close playing/postgame rooms that become empty
    room.close();
  }
  
  // ===========================================================================
  // Stats
  // ===========================================================================
  
  getStats() {
    const rooms = this.getRooms();
    
    return {
      totalRooms: rooms.length,
      totalRoomsCreated: this.totalRoomsCreated,
      totalPlayers: rooms.reduce((sum, r) => sum + r.playerCount, 0),
      totalHumans: rooms.reduce((sum, r) => sum + r.humanCount, 0),
      totalAI: rooms.reduce((sum, r) => sum + r.aiCount, 0),
      roomsByState: {
        lobby: rooms.filter(r => r.state === 'lobby').length,
        countdown: rooms.filter(r => r.state === 'countdown').length,
        playing: rooms.filter(r => r.state === 'playing').length,
        postgame: rooms.filter(r => r.state === 'postgame').length,
      },
    };
  }
  
  /**
   * Get room list for clients
   */
  getRoomList() {
    return this.getRooms()
      .filter(r => r.state !== 'closed')
      .map(r => r.toJSON());
  }
}
