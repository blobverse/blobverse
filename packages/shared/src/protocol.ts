// Blobverse — WebSocket Protocol Messages

// Client → Server
export type ClientMessage =
  | { type: 'join'; payload: { name: string } }
  | { type: 'input'; payload: { targetX: number; targetY: number } }
  | { type: 'split'; payload: { dirX: number; dirY: number } }
  | { type: 'eject'; payload: { dirX: number; dirY: number } }
  | { type: 'spectate_pellet'; payload: { targetX: number; targetY: number } }
  | { type: 'ping'; payload: { timestamp: number } };

// Server → Client
export type ServerMessage =
  | { type: 'welcome'; payload: { playerId: string; roomId: string } }
  | { type: 'state'; payload: GameStateSnapshot }
  | { type: 'round_start'; payload: { round: number; duration: number } }
  | { type: 'round_end'; payload: { round: number; eliminated: string[] } }
  | { type: 'game_over'; payload: GameOverPayload }
  | { type: 'kill_feed'; payload: { killerId: string; killedId: string } }
  | { type: 'pong'; payload: { timestamp: number; serverTime: number } };

export interface GameStateSnapshot {
  tick: number;
  roundState: string;
  currentRound: number;
  roundTimer: number;
  blobs: BlobSnapshot[];
  pellets: PelletSnapshot[];
  leaderboard: LeaderboardEntry[];
}

export interface BlobSnapshot {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  name: string;
  expression: string;
  fragments: { id: string; x: number; y: number; radius: number }[];
}

export interface PelletSnapshot {
  id: string;
  x: number;
  y: number;
  mass: number;
  type: string;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  mass: number;
  rank: number;
}

export interface GameOverPayload {
  winnerId: string;
  winnerName: string;
  rankings: { id: string; name: string; type: 'human' | 'ai'; finalMass: number; rank: number }[];
  aiReveal: { id: string; name: string; personality: string }[];
  stats: { totalPelletsEaten: number; totalKills: number; matchDuration: number };
}
