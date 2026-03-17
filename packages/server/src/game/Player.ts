// Player — Server-side player entity

import { WebSocket } from 'ws';
import { nanoid } from 'nanoid';

export interface PlayerInput {
  targetX: number;
  targetY: number;
  split: boolean;
  eject: boolean;
}

export class Player {
  readonly id: string;
  readonly isAI: boolean;
  
  // Connection (null for AI)
  socket: WebSocket | null;
  
  // Identity
  name: string;
  
  // State
  x: number = 0;
  y: number = 0;
  mass: number = 10;
  isAlive: boolean = true;
  
  // Input
  input: PlayerInput = {
    targetX: 0,
    targetY: 0,
    split: false,
    eject: false,
  };
  
  // Stats
  score: number = 0;
  kills: number = 0;
  peakMass: number = 10;
  
  // Timing
  joinedAt: number = Date.now();
  lastInputAt: number = Date.now();
  
  constructor(
    socket: WebSocket | null,
    name: string,
    isAI: boolean = false
  ) {
    this.id = nanoid(12);
    this.socket = socket;
    this.name = name;
    this.isAI = isAI;
  }
  
  /**
   * Send message to this player (no-op for AI)
   */
  send(message: object): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }
  
  /**
   * Update input from client
   */
  updateInput(input: Partial<PlayerInput>): void {
    Object.assign(this.input, input);
    this.lastInputAt = Date.now();
  }
  
  /**
   * Serialize for network transmission
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      mass: this.mass,
      isAlive: this.isAlive,
      isAI: this.isAI,
      score: this.score,
      kills: this.kills,
    };
  }
}
