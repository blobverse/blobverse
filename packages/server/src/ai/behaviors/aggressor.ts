import { AIBehavior, AIContext, AIAction } from './base-behavior.js';

/**
 * 攻擊者（Aggressor）
 * 策略：
 * 1. 優先：追殺最近的可吃目標
 * 2. 次要：逃跑（如果被追）
 * 3. 預設：積極漫遊，尋找食物和目標
 */
export class AggressorBehavior extends AIBehavior {
  think(ctx: AIContext): AIAction {
    // 優先：找可吃的目標
    const eatable = this.findNearestEatableBlob(ctx);
    if (eatable) {
      // 追殺
      const action = this.chase(eatable);

      // 高難度時考慮分裂殺
      if (this.difficulty > 0.6 && ctx.self.mass > 40) {
        action.shouldSplit = Math.random() < 0.3;
      }

      return action;
    }

    // 次要：檢查是否被威脅
    const threat = this.findNearestThreat(ctx);
    if (threat) {
      const threatDistance = this.getDistance(
        ctx.self.x,
        ctx.self.y,
        threat.x,
        threat.y
      );

      // 如果威脅太近，逃跑
      if (threatDistance < 200) {
        return this.fleeFromThreat(threat, ctx);
      }
    }

    // 預設：積極尋找食物
    const pellet = this.findNearestPellet(ctx);
    if (pellet) {
      return this.chase(pellet);
    }

    // 如果沒有目標，漫遊
    return this.roam(ctx);
  }

  /**
   * 從威脅逃跑
   */
  private fleeFromThreat(threat: { x: number; y: number }, ctx: AIContext): AIAction {
    // 計算逃離方向（背對威脅）
    const angle = this.getAngle(threat.x, threat.y, ctx.self.x, ctx.self.y);
    const target = this.getTargetPosition(
      ctx.self.x,
      ctx.self.y,
      angle,
      400 // 逃跑距離
    );

    return {
      targetX: Math.max(0, Math.min(3000, target.x)),
      targetY: Math.max(0, Math.min(3000, target.y)),
      shouldSplit: false,
      shouldEject: false,
    };
  }
}
