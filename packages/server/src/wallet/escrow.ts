// Escrow — Match-level prize pool management
// Connects WDK wallet operations with ArenaMatch lifecycle.

import { wdkManager, ENTRY_FEE_UNITS, ENTRY_FEE_USD, PRIZE_DISTRIBUTION } from './wdk-manager.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MatchEscrow {
  matchId: string;
  agentIds: string[];
  entryFees: Map<string, string>; // agentId → txHash
  totalPool: bigint;
  settled: boolean;
  settlements: Array<{ agentId: string; rank: number; amount: bigint; txHash: string }>;
}

// ---------------------------------------------------------------------------
// EscrowManager
// ---------------------------------------------------------------------------

export class EscrowManager {
  private activeEscrows = new Map<string, MatchEscrow>();
  private settledEscrows: MatchEscrow[] = [];

  /**
   * Collect entry fees from all agents before a match starts.
   * Returns the escrow record. In dry-run mode, fees are simulated.
   */
  async collectMatchFees(
    matchId: string,
    agentIds: string[],
  ): Promise<MatchEscrow> {
    const escrow: MatchEscrow = {
      matchId,
      agentIds,
      entryFees: new Map(),
      totalPool: 0n,
      settled: false,
      settlements: [],
    };

    // Ensure all agents have wallets
    for (const agentId of agentIds) {
      await wdkManager.getOrCreateAgentWallet(agentId);
    }

    // Collect entry fees
    const results = await Promise.allSettled(
      agentIds.map(async (agentId) => {
        const txHash = await wdkManager.collectEntryFee(agentId);
        return { agentId, txHash };
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        escrow.entryFees.set(result.value.agentId, result.value.txHash);
        escrow.totalPool += ENTRY_FEE_UNITS;
      } else {
        console.error(`[Escrow] Failed to collect fee:`, result.reason);
      }
    }

    this.activeEscrows.set(matchId, escrow);
    const poolUsd = Number(escrow.totalPool) / 1_000_000;
    console.log(`[Escrow] Match ${matchId}: collected $${poolUsd.toFixed(2)} from ${escrow.entryFees.size}/${agentIds.length} agents`);

    return escrow;
  }

  /**
   * Settle a match — distribute prizes to top 3 winners.
   */
  async settleMatch(
    matchId: string,
    rankings: Array<{ agentId: string; rank: number }>,
  ): Promise<MatchEscrow | null> {
    const escrow = this.activeEscrows.get(matchId);
    if (!escrow) {
      console.warn(`[Escrow] No escrow found for match ${matchId}`);
      return null;
    }

    if (escrow.settled) {
      console.warn(`[Escrow] Match ${matchId} already settled`);
      return escrow;
    }

    // Distribute prizes
    const prizeResults = await wdkManager.distributePrizes(rankings, escrow.totalPool);

    escrow.settlements = prizeResults.map(r => ({
      agentId: r.agentId,
      rank: rankings.find(rk => rk.agentId === r.agentId)?.rank ?? 0,
      amount: r.amount,
      txHash: r.txHash,
    }));
    escrow.settled = true;

    // Move to settled history
    this.activeEscrows.delete(matchId);
    this.settledEscrows.unshift(escrow);
    if (this.settledEscrows.length > 50) {
      this.settledEscrows.pop();
    }

    console.log(`[Escrow] Match ${matchId} settled. ${escrow.settlements.length} prizes distributed.`);
    return escrow;
  }

  /**
   * Get settlement summary for API response.
   */
  getSettlementSummary(matchId: string): object | null {
    const escrow = this.settledEscrows.find(e => e.matchId === matchId)
      || this.activeEscrows.get(matchId);

    if (!escrow) return null;

    return {
      matchId: escrow.matchId,
      agentCount: escrow.agentIds.length,
      totalPoolUsd: Number(escrow.totalPool) / 1_000_000,
      entryFeeUsd: ENTRY_FEE_USD,
      settled: escrow.settled,
      prizes: escrow.settlements.map(s => ({
        rank: s.rank,
        agentId: s.agentId,
        amountUsd: Number(s.amount) / 1_000_000,
        txHash: s.txHash,
      })),
      distribution: PRIZE_DISTRIBUTION,
    };
  }

  /**
   * Get recent settlement history for the API.
   */
  getRecentSettlements(limit: number = 10): object[] {
    return this.settledEscrows.slice(0, limit).map(e => this.getSettlementSummary(e.matchId)!);
  }
}

// Singleton
export const escrowManager = new EscrowManager();
