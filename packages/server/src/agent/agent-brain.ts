import { AIPersonality } from '@blobverse/shared';
import type { WDKManager } from '../wallet/wdk-manager.js';

/**
 * Agent Brain — AI Agent 的經濟決策系統
 * 用於決定：
 * 1. 是否加入比賽（基於真實錢包餘額、勝率、入場費）
 * 2. 選擇哪個人格（基於對手歷史）
 * 3. 是否調整策略（基於最近成績）
 */

export interface AgentStats {
  totalMatches: number;
  wins: number;
  losses: number;
  totalEarnings: number;
  currentBalance: number; // 本地追蹤，用於歷史記錄
}

export interface AgentMemory {
  lastMatches: Array<{
    timestamp: number;
    opponents: string[];
    personality: AIPersonality;
    result: 'win' | 'loss';
    earnings: number;
  }>;
  personalityWinRates: Record<AIPersonality, number>; // 各人格勝率
}

export class AgentBrain {
  private agentId: string;
  private wdkManager: WDKManager | null = null;
  private stats: AgentStats;
  private memory: AgentMemory;

  constructor(agentId: string, wdkManager?: WDKManager, initialBalance: number = 1.0) {
    this.agentId = agentId;
    this.wdkManager = wdkManager || null;
    this.stats = {
      totalMatches: 0,
      wins: 0,
      losses: 0,
      totalEarnings: 0,
      currentBalance: initialBalance,
    };

    this.memory = {
      lastMatches: [],
      personalityWinRates: {
        aggressor: 0.5,
        survivor: 0.5,
        opportunist: 0.5,
        trickster: 0.5,
        herder: 0.5,
      },
    };
  }

  /**
   * 決定是否加入比賽
   * 規則：
   * - 錢包餘額 > 入場費 × 2（確保有至少一場備用費）
   * - 連輸會變保守（只有勝率 > 50% 才加入）
   * - 連贏會變積極（任何時候都加入）
   *
   * @param entryFeeUnits USDC base units (6 decimals). 例如 $0.25 = 250_000n
   */
  async shouldJoinMatch(entryFeeUnits: bigint): Promise<boolean> {
    // 取得真實錢包餘額
    let balance: bigint;
    if (this.wdkManager) {
      try {
        balance = await this.wdkManager.getAgentBalance(this.agentId);
      } catch (err) {
        console.warn(`[AgentBrain] Failed to get wallet balance for ${this.agentId}`, err);
        // Fallback to local balance (converted to base units)
        balance = BigInt(Math.floor(this.stats.currentBalance * 1_000_000));
      }
    } else {
      // 無 WDK manager 時，使用本地餘額
      balance = BigInt(Math.floor(this.stats.currentBalance * 1_000_000));
    }

    // 資金檢查：需要至少 2 倍入場費
    if (balance < entryFeeUnits * 2n) {
      return false;
    }

    // 近期戰績檢查
    const recentMatches = this.memory.lastMatches.slice(-5);
    if (recentMatches.length === 0) {
      // 首次參賽，積極加入
      return true;
    }

    // 計算近期勝率
    const recentWins = recentMatches.filter(m => m.result === 'win').length;
    const recentWinRate = recentWins / recentMatches.length;

    // 連輸3場：變保守，只有高勝率才加入
    const recentLosses = recentMatches.filter(m => m.result === 'loss').length;
    if (recentLosses >= 3) {
      return recentWinRate > 0.5;
    }

    // 正常情況：勝率 > 40% 就加入
    return recentWinRate > 0.4;
  }

  /**
   * 選擇人格
   * 規則：
   * - 優先選擇勝率最高的人格
   * - 如果有多個人格勝率相近，隨機選擇
   * - 如果連輸，嘗試新人格
   */
  choosePersonality(): AIPersonality {
    // 檢查連輸情況
    const recentMatches = this.memory.lastMatches.slice(-3);
    const allLosses = recentMatches.every(m => m.result === 'loss');

    if (allLosses && recentMatches.length >= 3) {
      // 連輸3場，嘗試從未用過或少用的人格
      const personalities: AIPersonality[] = ['aggressor', 'survivor', 'opportunist', 'trickster', 'herder'];
      const leastUsed = personalities.reduce((least, personality) => {
        const usageCount = this.memory.lastMatches.filter(m => m.personality === personality).length;
        const leastCount = this.memory.lastMatches.filter(m => m.personality === least).length;
        return usageCount < leastCount ? personality : least;
      });
      return leastUsed;
    }

    // 正常情況：選擇勝率最高的人格
    const personalities: AIPersonality[] = ['aggressor', 'survivor', 'opportunist', 'trickster', 'herder'];
    return personalities.reduce((best, current) => {
      const bestRate = this.memory.personalityWinRates[best] || 0.5;
      const currentRate = this.memory.personalityWinRates[current] || 0.5;
      return currentRate > bestRate ? current : best;
    });
  }

  /**
   * 記錄比賽結果並更新數據
   */
  recordMatch(
    opponents: string[],
    personality: AIPersonality,
    result: 'win' | 'loss',
    earnings: number
  ): void {
    // 更新基本統計
    this.stats.totalMatches++;
    if (result === 'win') {
      this.stats.wins++;
      this.stats.totalEarnings += earnings;
      this.stats.currentBalance += earnings;
    } else {
      this.stats.losses++;
      this.stats.currentBalance -= 0.25; // 損失入場費（demo 假設為 $0.25）
    }

    // 更新人格勝率
    const totalMatches = this.memory.lastMatches.filter(m => m.personality === personality).length + 1;
    const winsWithPersonality = this.memory.lastMatches.filter(
      m => m.personality === personality && m.result === 'win'
    ).length + (result === 'win' ? 1 : 0);
    this.memory.personalityWinRates[personality] = winsWithPersonality / totalMatches;

    // 記錄到最近比賽
    this.memory.lastMatches.push({
      timestamp: Date.now(),
      opponents,
      personality,
      result,
      earnings,
    });

    // 保留最近 20 場比賽
    if (this.memory.lastMatches.length > 20) {
      this.memory.lastMatches = this.memory.lastMatches.slice(-20);
    }
  }

  /**
   * 取得 Agent 的公開資料（用於顯示在 UI）
   */
  getPublicProfile() {
    return {
      stats: {
        totalMatches: this.stats.totalMatches,
        wins: this.stats.wins,
        winRate: this.stats.totalMatches === 0 ? 0 : this.stats.wins / this.stats.totalMatches,
        totalEarnings: this.stats.totalEarnings,
        currentBalance: this.stats.currentBalance,
      },
      recentPersonalities: this.memory.lastMatches.slice(-5).map(m => m.personality),
      mostSuccessfulPersonality: Object.entries(this.memory.personalityWinRates).reduce(
        (best, [personality, rate]) =>
          rate > (this.memory.personalityWinRates[best as AIPersonality] || 0)
            ? (personality as AIPersonality)
            : best,
        'aggressor' as AIPersonality
      ),
    };
  }

  /**
   * 取得原始數據（用於持久化）
   */
  serialize() {
    return {
      stats: this.stats,
      memory: this.memory,
    };
  }

  /**
   * 取得 Agent ID
   */
  getId(): string {
    return this.agentId;
  }

  /**
   * 從數據恢復
   */
  static deserialize(
    agentId: string,
    data: { stats: AgentStats; memory: AgentMemory },
    wdkManager?: WDKManager
  ): AgentBrain {
    const brain = new AgentBrain(agentId, wdkManager, data.stats.currentBalance);
    brain['stats'] = data.stats;
    brain['memory'] = data.memory;
    return brain;
  }
}
