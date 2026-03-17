import { AIBehavior, AIContext, AIAction } from './base-behavior.js';

/**
 * 機會主義者（Opportunist）
 * 策略：
 * 1. 優先：觀察他人打架，等待機會撿漏
 * 2. 次要：狩獵被削弱的目標
 * 3. 預設：謹慎漫遊，找安全的地方
 */
export class OpportunistBehavior extends AIBehavior {
  think(ctx: AIContext): AIAction {
    // 優先：檢查是否有被削弱的小目標（比自己小一點的）
    const weakTarget = this.findWeakenedTarget(ctx);
    if (weakTarget) {
      return this.chase(weakTarget);
    }

    // 檢查是否在戰場區域附近
    const nearbyFight = this.detectNearbyFight(ctx);
    if (nearbyFight) {
      // 在戰場邊緣等候（保持距離）
      return this.orbitalPosition(nearbyFight, ctx);
    }

    // 次要：找可吃的小目標
    const eatable = this.findNearestEatableBlob(ctx);
    if (eatable && !this.isThreatNearby(ctx, 300)) {
      return this.chase(eatable);
    }

    // 預設：謹慎漫遊，避開威脅
    const threat = this.findNearestThreat(ctx);
    if (threat) {
      const threatDistance = this.getDistance(
        ctx.self.x,
        ctx.self.y,
        threat.x,
        threat.y
      );

      if (threatDistance < 250) {
        return this.fleeFromThreat(threat, ctx);
      }
    }

    // 吃食物
    const pellet = this.findNearestPellet(ctx);
    if (pellet) {
      return this.chase(pellet);
    }

    // 保守漫遊
    return this.cautiosRoam(ctx);
  }

  /**
   * 找到被削弱的目標（比自己小一點的）
   */
  private findWeakenedTarget(ctx: AIContext): { x: number; y: number } | null {
    let weakest: { x: number; y: number; mass: number } | null = null;

    for (const blob of ctx.nearbyBlobs) {
      if (blob.id === ctx.self.id || !blob.isAlive) continue;

      // 找比自己小但不太小的目標（0.8 到 1.0 倍質量）
      const massRatio = blob.mass / ctx.self.mass;
      if (massRatio < 0.8 || massRatio > 1.0) continue;

      if (!weakest || blob.mass < weakest.mass) {
        weakest = { x: blob.x, y: blob.y, mass: blob.mass };
      }
    }

    return weakest;
  }

  /**
   * 檢查附近是否有戰鬥發生（兩個或多個 blob 靠近）
   */
  private detectNearbyFight(ctx: AIContext): { x: number; y: number; radius: number } | null {
    // 簡單檢測：找到密集的 blob 區域
    const fights: Array<{ x: number; y: number; count: number }> = [];

    for (const blob1 of ctx.nearbyBlobs) {
      if (blob1.id === ctx.self.id || !blob1.isAlive) continue;

      let count = 0;
      let sumX = blob1.x;
      let sumY = blob1.y;

      for (const blob2 of ctx.nearbyBlobs) {
        if (blob2.id === blob1.id || !blob2.isAlive) continue;
        const dist = this.getDistance(blob1.x, blob1.y, blob2.x, blob2.y);
        if (dist < 200) {
          count++;
          sumX += blob2.x;
          sumY += blob2.y;
        }
      }

      if (count >= 2) {
        // 找到戰鬥區域
        return {
          x: sumX / (count + 1),
          y: sumY / (count + 1),
          radius: 200,
        };
      }
    }

    return null;
  }

  /**
   * 軌道位置 - 在目標周圍保持距離
   */
  private orbitalPosition(target: { x: number; y: number; radius: number }, ctx: AIContext): AIAction {
    // 計算與目標的角度
    const angle = this.getAngle(ctx.self.x, ctx.self.y, target.x, target.y);
    // 在戰鬥邊緣保持位置
    const orbitDistance = target.radius + 150;
    const orbitTarget = this.getTargetPosition(
      target.x,
      target.y,
      angle + Math.PI, // 反方向
      orbitDistance
    );

    return {
      targetX: Math.max(0, Math.min(3000, orbitTarget.x)),
      targetY: Math.max(0, Math.min(3000, orbitTarget.y)),
      shouldSplit: false,
      shouldEject: false,
    };
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
   * 從威脅逃跑
   */
  private fleeFromThreat(threat: { x: number; y: number }, ctx: AIContext): AIAction {
    const angle = this.getAngle(threat.x, threat.y, ctx.self.x, ctx.self.y);
    const target = this.getTargetPosition(
      ctx.self.x,
      ctx.self.y,
      angle,
      400
    );

    return {
      targetX: Math.max(0, Math.min(3000, target.x)),
      targetY: Math.max(0, Math.min(3000, target.y)),
      shouldSplit: false,
      shouldEject: false,
    };
  }

  /**
   * 謹慎漫遊
   */
  private cautiosRoam(ctx: AIContext): AIAction {
    const angle = Math.random() * Math.PI * 2;
    const range = 250;
    const target = this.getTargetPosition(
      ctx.self.x,
      ctx.self.y,
      angle,
      range
    );

    return {
      targetX: Math.max(0, Math.min(3000, target.x)),
      targetY: Math.max(0, Math.min(3000, target.y)),
      shouldSplit: false,
      shouldEject: false,
    };
  }
}
