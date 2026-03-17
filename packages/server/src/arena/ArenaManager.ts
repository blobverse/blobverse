// ArenaManager — Schedules arena matches and exposes REST API data
// Runs a new match every MATCH_INTERVAL_MS, keeps history of last N matches.

import { ArenaMatch, MatchResult } from './ArenaMatch.js';

const MATCH_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes between matches
const MAX_HISTORY = 10;

export class ArenaManager {
  private currentMatch: MatchResult | null = null;
  private matchHistory: MatchResult[] = [];
  private isRunning = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private matchInProgress = false;

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
