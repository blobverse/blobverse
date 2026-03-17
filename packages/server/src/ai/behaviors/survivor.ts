import { AIBehavior, AIContext, AIAction } from './base-behavior.js';

/**
 * 生存者（Survivor）
 * 策略：
 * 1. 優先：遠離所有威脅（比自己大的 blob）
 * 2. 次要：安全地吃食物（邊緣區域）
 * 3. 預設：保守漫遊，找安全的地方
 */
export class SurvivorBehavior extends AIBehavior {
  think(ctx: AIContext): AIAction {
    // 優先：檢查是否有近距離威脅
    const threat = this.findNearestThreat(ctx);
    if (threat) {
      const threatDistance = this.getDistance(
        ctx.self.x,
        ctx.self.y,
        threat.x,
        threat.y
      );

      // 如果威脅在 250 px 以內，立即逃跑
      if (threatDistance < 250) {
        return this.fleeFromAllThreats(ctx);
      }
    }

    // 次要：安全地吃食物
    const pellet = this.findNearestPellet(ctx);
    if (pellet && !this.isThreatNearby(ctx, 300)) {
      return this.chase(pellet);
    }

    // 預設：保守漫遊，傾向於地圖邊緣
    return this.conservativeRoam(ctx);
  }

  /**
   * 從所有威脅逃跑
   */
  private fleeFromAllThreats(ctx: AIContext): AIAction {
    // 計算平均威脅方向
    let threatX = 0;
    let threatY = 0;
    let threatCount = 0;

    for (const blob of ctx.nearbyBlobs) {
      if (blob.id === ctx.self.id || !blob.isAlive) continue;
      if (!this.canEat(blob.mass, ctx.self.mass)) continue; // 找到威脅

      const dist = this.getDistance(
        ctx.self.x,
        ctx.self.y,
        blob.x,
        blob.y
      );

      if (dist < 300) {
        threatX += blob.x;
        threatY += blob.y;
        threatCount++;
      }
    }

    // 如果有威脅，計算逃離方向
    if (threatCount > 0) {
      const avgThreatX = threatX / threatCount;
      const avgThreatY = threatY / threatCount;
      const angle = this.getAngle(avgThreatX, avgThreatY, ctx.self.x, ctx.self.y);
      const target = this.getTargetPosition(
        ctx.self.x,
        ctx.self.y,
        angle,
        500 // 逃跑距離
      );

      return {
        targetX: Math.max(0, Math.min(3000, target.x)),
        targetY: Math.max(0, Math.min(3000, target.y)),
        shouldSplit: false,
        shouldEject: false,
      };
    }

    // 沒有威脅，保守漫遊
    return this.conservativeRoam(ctx);
  }

  /**
   * 檢查是否有威脅在附近
   */
  private isThreatNearby(ctx: AIContext, radius: number): boolean {
    for (const blob of ctx.nearbyBlobs) {
      if (blob.id === ctx.self.id || !blob.isAlive) continue;
      if (this.canEat(blob.mass, ctx.self.mass)) {
        const dist = this.getDistance(
          ctx.self.x,
          ctx.self.y,
          blob.x,
          blob.y
        );
        if (dist < radius) return true;
      }
    }
    return false;
  }

  /**
   * 保守漫遊 - 傾向於地圖邊緣（更安全）
   */
  private conservativeRoam(ctx: AIContext): AIAction {
    // 計算到地圖邊緣的距離
    const distToLeft = ctx.self.x;
    const distToRight = 3000 - ctx.self.x;
    const distToTop = ctx.self.y;
    const distToBottom = 3000 - ctx.self.y;

    // 找到最近的邊緣
    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

    // 有 60% 機率朝向邊緣移動（保守）
    let targetX = ctx.self.x;
    let targetY = ctx.self.y;

    if (Math.random() < 0.6) {
      if (minDist === distToLeft) {
        targetX = Math.max(200, ctx.self.x - 300);
      } else if (minDist === distToRight) {
        targetX = Math.min(2800, ctx.self.x + 300);
      } else if (minDist === distToTop) {
        targetY = Math.max(200, ctx.self.y - 300);
      } else {
        targetY = Math.min(2800, ctx.self.y + 300);
      }
    } else {
      // 隨機漫遊
      const angle = Math.random() * Math.PI * 2;
      const target = this.getTargetPosition(
        ctx.self.x,
        ctx.self.y,
        angle,
        250 // 保守移動距離
      );
      targetX = target.x;
      targetY = target.y;
    }

    return {
      targetX: Math.max(0, Math.min(3000, targetX)),
      targetY: Math.max(0, Math.min(3000, targetY)),
      shouldSplit: false,
      shouldEject: false,
    };
  }
}
