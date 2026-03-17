import { Blob, Pellet, AIPersonality } from '@blobverse/shared';

/**
 * AI 決策的輸出
 */
export interface AIAction {
  targetX: number;           // 目標 X 座標
  targetY: number;           // 目標 Y 座標
  shouldSplit: boolean;      // 是否分裂
  shouldEject: boolean;      // 是否噴射質量
}

/**
 * AI 決策時的上下文
 */
export interface AIContext {
  self: Blob;
  allBlobs: Blob[];         // 所有 blob（包括自己）
  nearbyBlobs: Blob[];      // 附近的 blob（根據距離篩選）
  nearbyPellets: Pellet[];  // 附近的食物
  timeLeft: number;          // 這輪剩餘時間（秒）
  difficulty: number;        // 難度 0-1
}

/**
 * 基礎行為類別
 */
export abstract class AIBehavior {
  protected personality: AIPersonality;
  protected difficulty: number;

  constructor(personality: AIPersonality, difficulty: number = 0.5) {
    this.personality = personality;
    this.difficulty = Math.max(0, Math.min(1, difficulty));
  }

  /**
   * 主決策函式 - 子類需要實作
   */
  abstract think(ctx: AIContext): AIAction;

  /**
   * 計算兩個 blob 之間的距離
   */
  protected getDistance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 計算方向（角度）
   */
  protected getAngle(x1: number, y1: number, x2: number, y2: number): number {
    return Math.atan2(y2 - y1, x2 - x1);
  }

  /**
   * 根據角度和距離計算目標座標
   */
  protected getTargetPosition(
    fromX: number,
    fromY: number,
    angle: number,
    distance: number
  ): { x: number; y: number } {
    return {
      x: fromX + Math.cos(angle) * distance,
      y: fromY + Math.sin(angle) * distance,
    };
  }

  /**
   * 檢查是否可以吃掉某個 blob（需要質量比 1.25 倍以上）
   */
  protected canEat(selfMass: number, targetMass: number): boolean {
    return selfMass > targetMass * 1.25;
  }

  /**
   * 找到最近的可吃目標
   */
  protected findNearestEatableBlob(ctx: AIContext): Blob | null {
    let nearest: Blob | null = null;
    let minDistance = Infinity;

    for (const blob of ctx.nearbyBlobs) {
      if (blob.id === ctx.self.id || !blob.isAlive) continue;
      if (!this.canEat(ctx.self.mass, blob.mass)) continue;

      const dist = this.getDistance(
        ctx.self.x,
        ctx.self.y,
        blob.x,
        blob.y
      );

      if (dist < minDistance) {
        minDistance = dist;
        nearest = blob;
      }
    }

    return nearest;
  }

  /**
   * 找到最近的威脅（比自己大的 blob）
   */
  protected findNearestThreat(ctx: AIContext): Blob | null {
    let nearest: Blob | null = null;
    let minDistance = Infinity;

    for (const blob of ctx.nearbyBlobs) {
      if (blob.id === ctx.self.id || !blob.isAlive) continue;
      if (!this.canEat(blob.mass, ctx.self.mass)) continue;

      const dist = this.getDistance(
        ctx.self.x,
        ctx.self.y,
        blob.x,
        blob.y
      );

      if (dist < minDistance) {
        minDistance = dist;
        nearest = blob;
      }
    }

    return nearest;
  }

  /**
   * 找到最近的食物
   */
  protected findNearestPellet(ctx: AIContext): Pellet | null {
    if (ctx.nearbyPellets.length === 0) return null;

    let nearest = ctx.nearbyPellets[0];
    let minDistance = this.getDistance(
      ctx.self.x,
      ctx.self.y,
      nearest.x,
      nearest.y
    );

    for (let i = 1; i < ctx.nearbyPellets.length; i++) {
      const pellet = ctx.nearbyPellets[i];
      const dist = this.getDistance(
        ctx.self.x,
        ctx.self.y,
        pellet.x,
        pellet.y
      );

      if (dist < minDistance) {
        minDistance = dist;
        nearest = pellet;
      }
    }

    return nearest;
  }

  /**
   * 逃跑：背對威脅移動
   */
  protected flee(threat: { x: number; y: number }): AIAction {
    const angle = this.getAngle(threat.x, threat.y, this.personality === 'survivor' ? this.difficulty * 500 : 300, 300);
    const target = this.getTargetPosition(this.personality === 'survivor' ? 1500 : 1500, 1500, angle, 500);

    return {
      targetX: target.x,
      targetY: target.y,
      shouldSplit: false,
      shouldEject: false,
    };
  }

  /**
   * 追殺：朝向目標移動
   */
  protected chase(target: { x: number; y: number }): AIAction {
    return {
      targetX: target.x,
      targetY: target.y,
      shouldSplit: false,
      shouldEject: false,
    };
  }

  /**
   * 隨機漫遊
   */
  protected roam(ctx: AIContext): AIAction {
    const angle = Math.random() * Math.PI * 2;
    const range = 300;
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
