import { Blob, AIPersonality } from '@blobverse/shared';
import { AIBehavior, AIContext, AIAction } from './behaviors/index.js';
import { AggressorBehavior } from './behaviors/aggressor.js';
import { SurvivorBehavior } from './behaviors/survivor.js';
import { OpportunistBehavior } from './behaviors/opportunist.js';

/**
 * AI 控制器
 * 為每個 AI bot 管理其行為樹決策
 */
export class AIController {
  private behaviors: Map<string, AIBehavior> = new Map();
  private lastActions: Map<string, AIAction> = new Map();

  /**
   * 為某個 blob 建立 AI 行為
   */
  createAIAgent(
    blobId: string,
    personality: AIPersonality,
    difficulty: number = 0.5
  ): AIBehavior {
    let behavior: AIBehavior;

    switch (personality) {
      case 'aggressor':
        behavior = new AggressorBehavior(personality, difficulty);
        break;
      case 'survivor':
        behavior = new SurvivorBehavior(personality, difficulty);
        break;
      case 'opportunist':
        behavior = new OpportunistBehavior(personality, difficulty);
        break;
      // TODO: trickster, herder
      default:
        // 預設為 aggressor
        behavior = new AggressorBehavior('aggressor', difficulty);
    }

    this.behaviors.set(blobId, behavior);
    return behavior;
  }

  /**
   * 移除 AI agent
   */
  removeAIAgent(blobId: string): void {
    this.behaviors.delete(blobId);
    this.lastActions.delete(blobId);
  }

  /**
   * 每 tick 做決策 - 返回所有 AI 的 action
   */
  tick(
    allBlobs: Blob[],
    nearbyBlobsMap: Map<string, Blob[]>, // blobId → nearby blobs
    nearbyPelletsMap: Map<string, any[]>, // blobId → nearby pellets
    timeLeft: number
  ): Map<string, AIAction> {
    const actions = new Map<string, AIAction>();

    for (const [blobId, behavior] of this.behaviors) {
      const selfBlob = allBlobs.find(b => b.id === blobId);
      if (!selfBlob || !selfBlob.isAlive) continue;

      // 構建 AI 決策上下文
      const ctx: AIContext = {
        self: selfBlob,
        allBlobs,
        nearbyBlobs: nearbyBlobsMap.get(blobId) || [],
        nearbyPellets: nearbyPelletsMap.get(blobId) || [],
        timeLeft,
        difficulty: (selfBlob as any).difficulty || 0.5, // 假設 Blob 有 difficulty 屬性
      };

      // 做決策
      const action = behavior.think(ctx);
      actions.set(blobId, action);
      this.lastActions.set(blobId, action);
    }

    return actions;
  }

  /**
   * 轉換 AIAction 成輸入命令
   * (供 GameState/Room 消費)
   */
  static actionToInput(action: AIAction): {
    targetX: number;
    targetY: number;
    split: boolean;
    eject: boolean;
  } {
    return {
      targetX: action.targetX,
      targetY: action.targetY,
      split: action.shouldSplit,
      eject: action.shouldEject,
    };
  }

  /**
   * 是否有某個 blob 是 AI
   */
  hasAI(blobId: string): boolean {
    return this.behaviors.has(blobId);
  }

  /**
   * 獲取所有 AI blob IDs
   */
  getAIBlobIds(): string[] {
    return Array.from(this.behaviors.keys());
  }
}
