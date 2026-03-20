// ArenaManager — Schedules arena matches, handles betting, and exposes REST API data
// Runs a new match every MATCH_INTERVAL_MS, keeps history of last N matches.

import { ArenaMatch, MatchResult, AgentMeta } from './ArenaMatch.js';
import { escrowManager } from '../wallet/index.js';
import { nanoid } from 'nanoid';

const MATCH_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes between matches
const MAX_HISTORY = 10;

// ===========================================================================
// Betting Types
// ===========================================================================

export interface Bet {
  betId: string;
  matchId: string;
  agentId: string;
  agentName: string;
  amount: number;
  odds: number;
  timestamp: number;
  settled: boolean;
  won?: boolean;
  payout?: number;
}

export interface BetResult {
  bet: Bet;
  winnerName: string;
  winnerAgentId: string;
}

// ===========================================================================
// ArenaManager
// ===========================================================================

export class ArenaManager {
  private currentMatch: MatchResult | null = null;
  private matchHistory: MatchResult[] = [];
  private isRunning = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private matchInProgress = false;

  // Betting state
  private bets = new Map<string, Bet>(); // betId → Bet

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[Arena] ArenaManager started');
    // Run first match immediately
    this.scheduleNextMatch(0);
  }

  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[Arena] ArenaManager stopped');
  }

  // ===========================================================================
  // Match Scheduling
  // ===========================================================================

  private scheduleNextMatch(delayMs: number): void {
    this.timer = setTimeout(() => {
      this.runMatch();
    }, delayMs);
  }

  private runMatch(): void {
    if (this.matchInProgress) return;
    this.matchInProgress = true;

    console.log('[Arena] Starting new match...');

    // Run in next tick to avoid blocking the event loop for too long
    setImmediate(() => {
      try {
        const match = new ArenaMatch();
        const result = match.run();
        this.onMatchComplete(result);
      } catch (err) {
        console.error('[Arena] Match simulation error:', err);
      } finally {
        this.matchInProgress = false;
        if (this.isRunning) {
          this.scheduleNextMatch(MATCH_INTERVAL_MS);
        }
      }
    });
  }

  private onMatchComplete(result: MatchResult): void {
    this.currentMatch = result;
    this.matchHistory.unshift(result);
    if (this.matchHistory.length > MAX_HISTORY) {
      this.matchHistory.pop();
    }
    console.log(`[Arena] Match ${result.matchId} complete. Winner: ${result.winner.name} (${result.winner.personality})`);

    // WDK Settlement — collect fees and distribute prizes asynchronously
    this.settleMatch(result).catch(err => {
      console.error(`[Arena] Settlement failed for ${result.matchId}:`, err);
    });
  }

  private async settleMatch(result: MatchResult): Promise<void> {
    const agentIds = result.agents.map(a => a.id);

    // Collect entry fees
    await escrowManager.collectMatchFees(result.matchId, agentIds);

    // Distribute prizes based on rankings
    const rankings = result.rankings.map(r => ({
      agentId: r.agentId,
      rank: r.rank,
    }));
    const settlement = await escrowManager.settleMatch(result.matchId, rankings);

    if (settlement) {
      // Attach settlement info to match result for API consumers
      result.settlement = escrowManager.getSettlementSummary(result.matchId) as MatchResult['settlement'];
    }
  }

  // ===========================================================================
  // Betting
  // ===========================================================================

  /** Place a bet on an agent for the upcoming match */
  placeBet(agentName: string, amount: number): Bet | null {
    // Find agent info from current match
    const currentAgents = this.currentMatch?.agents;
    if (!currentAgents) return null;

    const agent = currentAgents.find(a => a.name === agentName);
    if (!agent) return null;

    const bet: Bet = {
      betId: `bet-${nanoid(8)}`,
      matchId: this.currentMatch!.matchId,
      agentId: agent.id,
      agentName: agent.name,
      amount,
      odds: agent.odds,
      timestamp: Date.now(),
      settled: false,
    };

    this.bets.set(bet.betId, bet);
    console.log(`[Arena] Bet placed: ${bet.betId} — $${amount} on ${agent.name} @ ${agent.odds}x`);
    return bet;
  }

  /** Settle a bet based on the current match winner */
  settleBet(betId: string): BetResult | null {
    const bet = this.bets.get(betId);
    if (!bet || bet.settled) return null;

    const match = this.getMatchById(bet.matchId);
    if (!match) return null;

    const won = match.winner.name === bet.agentName;
    bet.settled = true;
    bet.won = won;
    bet.payout = won ? bet.amount * bet.odds : 0;

    console.log(`[Arena] Bet ${betId} settled: ${won ? 'WON' : 'LOST'} — payout: $${bet.payout.toFixed(2)}`);

    return {
      bet,
      winnerName: match.winner.name,
      winnerAgentId: match.winner.id,
    };
  }

  getBet(betId: string): Bet | undefined {
    return this.bets.get(betId);
  }

  /** Get agents info with odds for betting UI */
  getAgentsForBetting(): AgentMeta[] {
    if (!this.currentMatch) return [];
    return this.currentMatch.agents;
  }

  // ===========================================================================
  // REST API Data
  // ===========================================================================

  getCurrentMatch(): MatchResult | null {
    return this.currentMatch;
  }

  getMatchHistory(): MatchResult[] {
    return this.matchHistory;
  }

  getMatchById(matchId: string): MatchResult | undefined {
    if (this.currentMatch?.matchId === matchId) return this.currentMatch;
    return this.matchHistory.find(m => m.matchId === matchId);
  }

  getStatus(): object {
    return {
      isRunning: this.isRunning,
      matchInProgress: this.matchInProgress,
      currentMatchId: this.currentMatch?.matchId ?? null,
      historyCount: this.matchHistory.length,
      nextMatchIn: this.matchInProgress ? null : MATCH_INTERVAL_MS,
    };
  }
}

// Singleton
export const arenaManager = new ArenaManager();
