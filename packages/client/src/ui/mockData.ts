import type { GameStateSnapshot, BlobSnapshot, LeaderboardEntry } from '@blobverse/shared';
import { AIAgentInfo } from './ArenaView';

// Mock AI Agents
export const MOCK_AGENTS: AIAgentInfo[] = [
  {
    id: 'ai_aggressor_1',
    name: 'Goblin',
    personality: 'aggressor',
    walletAddress: '0x1234...5678',
    walletBalance: 2.5,
    winRate: 0.42,
    totalEarnings: 3.75,
    color: '#FF6B6B',
  },
  {
    id: 'ai_survivor_1',
    name: 'Tortoise',
    personality: 'survivor',
    walletAddress: '0x8765...4321',
    walletBalance: 1.8,
    winRate: 0.55,
    totalEarnings: 5.20,
    color: '#4ECDC4',
  },
  {
    id: 'ai_opportunist_1',
    name: 'Coyote',
    personality: 'opportunist',
    walletAddress: '0xabcd...efgh',
    walletBalance: 2.2,
    winRate: 0.38,
    totalEarnings: 2.10,
    color: '#FFE66D',
  },
  {
    id: 'ai_trickster_1',
    name: 'Raven',
    personality: 'trickster',
    walletAddress: '0xijkl...mnop',
    walletBalance: 1.5,
    winRate: 0.31,
    totalEarnings: 1.50,
    color: '#95E1D3',
  },
  {
    id: 'ai_herder_1',
    name: 'Shepherd',
    personality: 'herder',
    walletAddress: '0xqrst...uvwx',
    walletBalance: 2.0,
    winRate: 0.48,
    totalEarnings: 4.00,
    color: '#C7CEEA',
  },
];

/**
 * Generate mock GameStateSnapshot frames for replay
 * Simulates a 90-second 3-round match with AI battles
 */
export function generateMockReplayFrames(): GameStateSnapshot[] {
  const frames: GameStateSnapshot[] = [];
  const totalFrames = 1800; // 90 seconds * 20 FPS
  const framesPerRound = 600; // 30 seconds per round

  for (let frame = 0; frame < totalFrames; frame++) {
    const timeInRound = frame % framesPerRound;
    const roundNumber = Math.floor(frame / framesPerRound) + 1;
    const progress = timeInRound / framesPerRound;

    // Simulate blob positions and masses with some variation
    const blobs: BlobSnapshot[] = MOCK_AGENTS.map((agent, idx) => {
      // Simulate survival rate - some agents get eliminated
      const survivalChance = 1 - (progress * (idx > 2 ? 0.8 : 0.3));
      const isAlive = Math.random() < survivalChance;

      if (!isAlive && frame > framesPerRound) {
        return null; // Agent is eliminated
      }

      // Simulate mass changes (eating, splitting)
      const baseMass = 100;
      const massVariation = Math.sin(frame / 100 + idx) * 30;
      const mass = baseMass + massVariation + progress * 50;

      return {
        id: agent.id,
        x: 100 + idx * 200 + Math.sin(frame / 20 + idx) * 100,
        y: 100 + idx * 150 + Math.cos(frame / 25 + idx) * 80,
        radius: Math.sqrt(mass / 3.14) * 4.5,
        color: agent.color,
        name: agent.name,
        expression: Math.random() > 0.7 ? 'eating' : 'happy',
        fragments: [],
      };
    }).filter((b) => b !== null) as BlobSnapshot[];

    // Generate leaderboard based on blob masses
    const leaderboard: LeaderboardEntry[] = blobs
      .sort((a, b) => {
        const massA = (a.radius / 4.5) ** 2;
        const massB = (b.radius / 4.5) ** 2;
        return massB - massA;
      })
      .map((blob, idx) => ({
        id: blob.id,
        name: blob.name,
        mass: Math.round((blob.radius / 4.5) ** 2),
        rank: idx + 1,
      }));

    frames.push({
      tick: frame,
      roundState: 'playing',
      currentRound: roundNumber,
      roundTimer: Math.max(0, 30 - timeInRound / 20),
      blobs,
      pellets: [], // Simplified - not showing pellets in replay
      leaderboard,
    });
  }

  return frames;
}

/**
 * Generate mock match result with rankings
 */
export function generateMockMatchResult() {
  return {
    rankings: [
      { rank: 1, name: 'Goblin', personality: 'aggressor', finalMass: 450 },
      { rank: 2, name: 'Coyote', personality: 'opportunist', finalMass: 380 },
      { rank: 3, name: 'Tortoise', personality: 'survivor', finalMass: 320 },
      { rank: 4, name: 'Shepherd', personality: 'herder', finalMass: 250 },
      { rank: 5, name: 'Raven', personality: 'trickster', finalMass: 180 },
    ],
    killLog: [
      { timestamp: 15, killer: 'Goblin', killed: 'Raven' },
      { timestamp: 45, killer: 'Coyote', killed: 'Shepherd' },
      { timestamp: 60, killer: 'Goblin', killed: 'Coyote' },
    ],
  };
}
