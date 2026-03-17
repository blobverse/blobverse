// ArenaMatch — Pure server-side AI vs AI match simulation
// No WebSocket needed. Produces a MatchResult with replay frames for the client.

import { AIPersonality, GameStateSnapshot, TICK_INTERVAL_MS } from '@blobverse/shared';
import { GameState, KillEvent } from '../game/GameState.js';
import { AIController } from '../ai/ai-controller.js';
import { nanoid } from 'nanoid';

// =============================================================================
// Constants
// =============================================================================

const ROUND_DURATION_SECONDS = 90;
const TOTAL_ROUNDS = 3;
const REPLAY_FRAME_INTERVAL_MS = 250; // save 1 frame per 250ms
const REPLAY_FRAME_EVERY_N_TICKS = Math.round(REPLAY_FRAME_INTERVAL_MS / TICK_INTERVAL_MS); // 5

const AGENT_CONFIG: { name: string; personality: AIPersonality; difficulty: number }[] = [
  { name: 'APEX',    personality: 'aggressor',   difficulty: 0.8 },
  { name: 'GHOST',   personality: 'survivor',    difficulty: 0.7 },
  { name: 'ROGUE',   personality: 'opportunist', difficulty: 0.75 },
  { name: 'TITAN',   personality: 'aggressor',   difficulty: 0.6 },
  { name: 'SPECTER', personality: 'survivor',    difficulty: 0.65 },
];

// =============================================================================
// Types
// =============================================================================

export interface AgentMeta {
  id: string;
  name: string;
  personality: AIPersonality;
  walletAddress: string; // placeholder until WDK integration
  winRate: number;
  totalEarnings: number;
  color: string;
}

export interface RankingEntry {
  agentId: string;
  name: string;
  personality: AIPersonality;
  finalMass: number;
  kills: number;
  score: number;
  rank: number;
}

export interface SettlementInfo {
  matchId: string;
  agentCount: number;
  totalPoolUsd: number;
  entryFeeUsd: number;
  settled: boolean;
  prizes: Array<{ rank: number; agentId: string; amountUsd: number; txHash: string }>;
  distribution: { first: number; second: number; third: number; platform: number };
}

export interface MatchResult {
  matchId: string;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  agents: AgentMeta[];
  rankings: RankingEntry[];
  killLog: KillEvent[];
  replayFrames: GameStateSnapshot[];
  winner: AgentMeta;
  settlement?: SettlementInfo;
}

// =============================================================================
// ArenaMatch
// =============================================================================

export class ArenaMatch {
  readonly matchId: string;
  readonly startedAt: number;

  private gameState: GameState;
  private aiController: AIController;
  private agents: AgentMeta[] = [];
  private killLog: KillEvent[] = [];
  private replayFrames: GameStateSnapshot[] = [];

  // Track per-agent score across rounds
  private agentScores: Map<string, { score: number; kills: number; mass: number }> = new Map();

  constructor() {
    this.matchId = `arena-${nanoid(8)}`;
    this.startedAt = Date.now();
    this.gameState = new GameState({ pelletCount: 300 });
    this.aiController = new AIController();
  }

  run(): MatchResult {
    this.gameState.initialize();

    // Collect kill events
    this.gameState.onKill = (event) => {
      this.killLog.push(event);
    };

    // Add 5 AI agents
    for (let i = 0; i < AGENT_CONFIG.length; i++) {
      const cfg = AGENT_CONFIG[i];
      const blob = this.gameState.addPlayer(cfg.name, null, true);

      // Override the default personality assigned by addPlayer
      blob.aiPersonality = cfg.personality;

      // Register with AI controller
      this.aiController.createAIAgent(blob.id, cfg.personality, cfg.difficulty);

      // Track agent metadata
      this.agents.push({
        id: blob.id,
        name: cfg.name,
        personality: cfg.personality,
        walletAddress: `0x${blob.id.replace(/-/g, '').padEnd(40, '0').slice(0, 40)}`,
        winRate: 0.5,
        totalEarnings: 0,
        color: blob.color.fill,
      });

      this.agentScores.set(blob.id, { score: 0, kills: 0, mass: 0 });
    }

    // Save initial frame
    this.replayFrames.push(this.gameState.getSnapshot());

    // Run 3 rounds
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      this.runRound(round);
    }

    // Build final result
    return this.buildResult();
  }

  // ===========================================================================
  // Round Simulation
  // ===========================================================================

  private runRound(round: number): void {
    this.gameState.startRound(ROUND_DURATION_SECONDS);

    const ticksPerRound = ROUND_DURATION_SECONDS * (1000 / TICK_INTERVAL_MS); // 1800 at 20 TPS

    for (let tick = 0; tick < ticksPerRound; tick++) {
      const timeLeft = ROUND_DURATION_SECONDS - (tick * TICK_INTERVAL_MS) / 1000;

      this.tickAI(timeLeft);
      this.gameState.update();

      // Store replay frame periodically
      if (tick % REPLAY_FRAME_EVERY_N_TICKS === 0) {
        this.replayFrames.push(this.gameState.getSnapshot());
      }

      // Early exit if only one blob alive
      const alive = this.gameState.getEntityManager().getAliveBlobs();
      if (alive.length <= 1) break;
    }

    // Accumulate scores before round ends
    this.accumulateRoundScores();

    this.gameState.endRound();

    if (round < TOTAL_ROUNDS) {
      this.gameState.nextRound();
      // Re-spawn dead agents for next round
      this.respawnDeadAgents();
    }
  }

  private tickAI(timeLeft: number): void {
    const entityManager = this.gameState.getEntityManager();
    const aliveBlobs = entityManager.getAliveBlobs();

    // Build nearby maps for each AI blob
    const nearbyBlobsMap = new Map<string, any[]>();
    const nearbyPelletsMap = new Map<string, any[]>();

    for (const blob of aliveBlobs) {
      if (!this.aiController.hasAI(blob.id)) continue;
      nearbyBlobsMap.set(blob.id, entityManager.getNearbyBlobs(blob));
      nearbyPelletsMap.set(blob.id, entityManager.getNearbyPellets(blob.x, blob.y, blob.radius * 12 + 200));
    }

    // Get AI decisions
    const actions = this.aiController.tick(aliveBlobs, nearbyBlobsMap, nearbyPelletsMap, timeLeft);

    // Apply actions
    for (const [blobId, action] of actions) {
      this.gameState.setPlayerInput(blobId, action.targetX, action.targetY);

      if (action.shouldSplit) {
        const blob = this.gameState.getPlayer(blobId);
        if (blob) {
          const dx = action.targetX - blob.x;
          const dy = action.targetY - blob.y;
          this.gameState.playerSplit(blobId, dx, dy);
        }
      }

      if (action.shouldEject) {
        const blob = this.gameState.getPlayer(blobId);
        if (blob) {
          const dx = action.targetX - blob.x;
          const dy = action.targetY - blob.y;
          this.gameState.playerEject(blobId, dx, dy);
        }
      }
    }
  }

  private accumulateRoundScores(): void {
    const entityManager = this.gameState.getEntityManager();
    for (const blob of entityManager.getAliveBlobs()) {
      const existing = this.agentScores.get(blob.id);
      if (existing) {
        existing.score += blob.score;
        existing.kills += blob.kills;
        existing.mass = Math.max(existing.mass, Math.floor(blob.mass));
      }
    }
  }

  private respawnDeadAgents(): void {
    const entityManager = this.gameState.getEntityManager();
    const aliveIds = new Set(entityManager.getAliveBlobs().map(b => b.id));

    for (const agent of this.agents) {
      if (!aliveIds.has(agent.id)) {
        // Re-add the agent with the same name/personality
        const cfg = AGENT_CONFIG.find(c => c.name === agent.name)!;
        const newBlob = this.gameState.addPlayer(agent.name, null, true);
        newBlob.aiPersonality = cfg.personality;

        // Update agent's tracked ID
        const oldId = agent.id;
        agent.id = newBlob.id;

        // Move accumulated score to new id
        const oldScore = this.agentScores.get(oldId) || { score: 0, kills: 0, mass: 0 };
        this.agentScores.delete(oldId);
        this.agentScores.set(newBlob.id, oldScore);

        // Register new AI agent
        this.aiController.removeAIAgent(oldId);
        this.aiController.createAIAgent(newBlob.id, cfg.personality, cfg.difficulty);
      }
    }
  }

  // ===========================================================================
  // Result Building
  // ===========================================================================

  private buildResult(): MatchResult {
    const rankings: RankingEntry[] = this.agents.map(agent => {
      const scores = this.agentScores.get(agent.id) || { score: 0, kills: 0, mass: 0 };
      return {
        agentId: agent.id,
        name: agent.name,
        personality: agent.personality,
        finalMass: scores.mass,
        kills: scores.kills,
        score: scores.score,
        rank: 0, // filled below
      };
    });

    // Sort by score descending
    rankings.sort((a, b) => b.score - a.score);
    rankings.forEach((r, i) => { r.rank = i + 1; });

    const winner = this.agents.find(a => a.name === rankings[0].name)!;

    return {
      matchId: this.matchId,
      startedAt: this.startedAt,
      finishedAt: Date.now(),
      durationMs: Date.now() - this.startedAt,
      agents: this.agents,
      rankings,
      killLog: this.killLog,
      replayFrames: this.replayFrames,
      winner,
    };
  }
}
