# Blobverse — 開發手冊 (Development Handbook)

> **版本**: 1.0  
> **日期**: 2026 年 3 月  
> **用途**: 移交至 Claude Code 進行開發  
> **讀者**: 工程師團隊 / AI 開發代理

---

## 目錄

1. [專案總覽](#1-專案總覽)
2. [技術架構總覽](#2-技術架構總覽)
3. [專案結構](#3-專案結構)
4. [Phase 1：遊戲核心引擎](#4-phase-1遊戲核心引擎)
5. [Phase 2：三輪淘汰制](#5-phase-2三輪淘汰制)
6. [Phase 3：AI Agent 系統](#6-phase-3ai-agent-系統)
7. [Phase 4：UI / HUD 系統](#7-phase-4ui--hud-系統)
8. [Phase 5：多人連線架構](#8-phase-5多人連線架構)
9. [Phase 6：賽後系統與進度](#9-phase-6賽後系統與進度)
10. [資料模型與型別定義](#10-資料模型與型別定義)
11. [遊戲常數配置表](#11-遊戲常數配置表)
12. [視覺設計規範](#12-視覺設計規範)
13. [測試策略](#13-測試策略)
14. [部署與基礎設施](#14-部署與基礎設施)
15. [開發順序與里程碑](#15-開發順序與里程碑)

---

## 1. 專案總覽

### 1.1 一句話描述

Blobverse 是一款瀏覽器端 2D 俯視角 .io 風格大逃殺遊戲，人類玩家與 AI Agent 在 3 輪淘汰賽中共同競爭，每場約 90 秒。

### 1.2 核心遊戲循環

```
進入大廳 → 配對（人類 + AI 填滿） → 第一輪：搶食狂歡（30s）
→ 淘汰最小 40% → 第二輪：混亂區域（30s）→ 淘汰後 50%
→ 第三輪：最終決戰（30s）→ 最後存活者勝
→ 賽後揭曉 AI 身份 → 再來一局
```

### 1.3 關鍵設計原則

- **90 秒一局**：極低進入門檻，極高重玩性
- **人機無縫混合**：玩家永遠不知道對手是人還是 AI
- **簡單規則、湧現複雜度**：吃、成長、分裂、生存
- **失敗不痛苦**：被淘汰也有觀戰和互動機會

---

## 2. 技術架構總覽

### 2.1 技術選型

| 層級 | 技術 | 理由 |
|------|------|------|
| **前端渲染** | HTML5 Canvas + PixiJS v8 | 高效能 2D 渲染，支援 WebGL，行動裝置相容 |
| **前端框架** | TypeScript + Vite | 型別安全，快速 HMR 開發 |
| **UI 層** | React 18 + Tailwind CSS | HUD / 選單 / 賽後畫面（覆蓋在 Canvas 上方） |
| **遊戲伺服器** | Node.js + TypeScript | 與前端共享型別，WebSocket 原生支援 |
| **即時通訊** | ws (WebSocket) | 輕量、效能佳 |
| **AI Agent** | 伺服器端 TypeScript（規則式） → 後期 Python RL | Phase 1 用規則式，Phase 3 引入 RL |
| **物理引擎** | 自建輕量 2D 碰撞系統 | .io 遊戲不需要完整物理引擎 |
| **資料庫** | PostgreSQL + Redis | 玩家資料 / 即時遊戲狀態快取 |
| **部署** | Docker + Railway 或 Fly.io | 容器化，就近部署降低延遲 |

### 2.2 架構圖（文字版）

```
┌─────────────────────────────────────────────────────┐
│                     Client (Browser)                │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ PixiJS   │  │ React UI  │  │ Network Layer    │  │
│  │ Renderer │  │ (HUD/Menu)│  │ (WebSocket +     │  │
│  │          │  │           │  │  Client Predict) │  │
│  └────┬─────┘  └─────┬─────┘  └────────┬─────────┘  │
│       └──────────────┼─────────────────┘             │
│                      │                               │
└──────────────────────┼───────────────────────────────┘
                       │ WebSocket (JSON)
┌──────────────────────┼───────────────────────────────┐
│                Game Server (Node.js)                 │
│  ┌──────────┐  ┌─────┴─────┐  ┌──────────────────┐  │
│  │ Game     │  │ Room      │  │ AI Agent         │  │
│  │ Loop     │  │ Manager   │  │ Controller       │  │
│  │ (20 TPS) │  │           │  │                  │  │
│  └────┬─────┘  └───────────┘  └──────────────────┘  │
│       │                                              │
│  ┌────┴──────────────────────────────────────────┐   │
│  │ Physics Engine (Collision, Movement, Eating)  │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
                       │
            ┌──────────┼──────────┐
            │          │          │
        PostgreSQL   Redis    Matchmaking
        (玩家資料)  (遊戲狀態) (大廳管理)
```

### 2.3 Tick Rate 與網路模型

- **伺服器 Tick Rate**: 20 TPS（每 50ms 一次）
- **客戶端渲染**: 60 FPS（插值伺服器狀態）
- **網路模型**: 伺服器授權制（Server Authoritative）
  - 客戶端發送輸入（input），伺服器驗證並廣播狀態
  - 客戶端預測（Client-side Prediction）+ 伺服器回溯校正
  - 實體插值（Entity Interpolation）平滑其他玩家動畫

---

## 3. 專案結構

```
blobverse/
├── packages/
│   ├── shared/                  # 前後端共享程式碼
│   │   ├── src/
│   │   │   ├── types.ts         # 所有型別定義
│   │   │   ├── constants.ts     # 遊戲常數配置
│   │   │   ├── physics.ts       # 碰撞偵測（純函式）
│   │   │   └── protocol.ts      # WebSocket 訊息協議
│   │   └── package.json
│   │
│   ├── client/                  # 前端
│   │   ├── src/
│   │   │   ├── main.ts          # 進入點
│   │   │   ├── game/
│   │   │   │   ├── Game.ts      # 遊戲主類別
│   │   │   │   ├── Renderer.ts  # PixiJS 渲染器
│   │   │   │   ├── Camera.ts    # 鏡頭跟隨與縮放
│   │   │   │   ├── Input.ts     # 輸入管理（滑鼠/觸控/鍵盤）
│   │   │   │   └── Network.ts   # WebSocket 客戶端
│   │   │   ├── entities/
│   │   │   │   ├── BlobSprite.ts    # Blob 精靈（含表情）
│   │   │   │   ├── PelletSprite.ts  # 食物精靈
│   │   │   │   ├── HazardSprite.ts  # 障礙物精靈
│   │   │   │   └── EffectsManager.ts # 粒子特效
│   │   │   ├── ui/
│   │   │   │   ├── HUD.tsx          # 遊戲中 HUD（React）
│   │   │   │   ├── Leaderboard.tsx  # 排行榜
│   │   │   │   ├── Minimap.tsx      # 小地圖
│   │   │   │   ├── KillFeed.tsx     # 擊殺通知
│   │   │   │   ├── RoundTimer.tsx   # 倒數計時器
│   │   │   │   ├── PostGame.tsx     # 賽後畫面
│   │   │   │   └── Lobby.tsx        # 大廳 / 配對畫面
│   │   │   └── assets/              # 靜態資源
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── server/                  # 後端
│       ├── src/
│       │   ├── main.ts          # 進入點
│       │   ├── game/
│       │   │   ├── GameRoom.ts      # 單一遊戲房間邏輯
│       │   │   ├── GameLoop.ts      # 伺服器 tick loop
│       │   │   ├── RoundManager.ts  # 三輪淘汰管理
│       │   │   ├── PhysicsWorld.ts  # 伺服器端物理模擬
│       │   │   └── EntityManager.ts # 實體生命週期管理
│       │   ├── ai/
│       │   │   ├── AIController.ts  # AI 總控制器
│       │   │   ├── behaviors/
│       │   │   │   ├── Aggressor.ts
│       │   │   │   ├── Survivor.ts
│       │   │   │   ├── Opportunist.ts
│       │   │   │   ├── Trickster.ts
│       │   │   │   └── Herder.ts
│       │   │   └── BehaviorTree.ts  # 行為樹框架
│       │   ├── network/
│       │   │   ├── WebSocketServer.ts
│       │   │   ├── RoomManager.ts   # 房間生命週期
│       │   │   └── Matchmaker.ts    # 配對邏輯
│       │   └── data/
│       │       ├── PlayerStore.ts   # 玩家資料存取
│       │       └── MatchHistory.ts  # 比賽紀錄
│       └── package.json
│
├── package.json                 # Workspace 根
├── tsconfig.base.json
├── docker-compose.yml
└── README.md
```

---

## 4. Phase 1：遊戲核心引擎

> **目標**：實現基本的 Blob 移動、吃食物、吃其他 Blob、分裂。純前端單機版。

### 4.1 Blob 實體

```typescript
// packages/shared/src/types.ts

interface Blob {
  id: string;
  x: number;                    // 世界座標
  y: number;
  mass: number;                 // 質量（決定半徑和速度）
  radius: number;               // 由 mass 計算：Math.sqrt(mass) * RADIUS_FACTOR
  velocityX: number;
  velocityY: number;
  color: BlobColor;
  name: string;
  isAlive: boolean;
  expression: 'happy' | 'eating' | 'worried';
  splitCooldown: number;        // 分裂冷卻（tick 數）
  fragments: BlobFragment[];    // 分裂後的碎片
  type: 'human' | 'ai';
  aiPersonality?: AIPersonality;
}

interface BlobFragment {
  id: string;
  parentId: string;
  x: number;
  y: number;
  mass: number;
  radius: number;
  velocityX: number;
  velocityY: number;
  mergeTimer: number;           // 自動合併倒數（tick 數）
}

interface BlobColor {
  fill: string;       // 主色 hex
  glow: string;       // 發光色 rgba
  eye: string;        // 眼白色
}
```

### 4.2 移動系統

```typescript
// 移動公式
function updateBlobMovement(blob: Blob, targetX: number, targetY: number, dt: number): void {
  const dx = targetX - blob.x;
  const dy = targetY - blob.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < MIN_MOVE_THRESHOLD) return;

  // 速度隨質量遞減（核心平衡機制）
  const speed = BASE_SPEED / Math.pow(blob.mass, SPEED_DECAY_EXPONENT);

  // 歸一化方向向量
  const dirX = dx / distance;
  const dirY = dy / distance;

  // 平滑移動（lerp）
  blob.velocityX = lerp(blob.velocityX, dirX * speed, MOVEMENT_SMOOTHING);
  blob.velocityY = lerp(blob.velocityY, dirY * speed, MOVEMENT_SMOOTHING);

  blob.x += blob.velocityX * dt;
  blob.y += blob.velocityY * dt;

  // 邊界碰撞
  blob.x = clamp(blob.x, blob.radius, WORLD_WIDTH - blob.radius);
  blob.y = clamp(blob.y, blob.radius, WORLD_HEIGHT - blob.radius);
}
```

**關鍵常數**（見第 11 節完整表）:
- `BASE_SPEED`: 200（像素/秒）
- `SPEED_DECAY_EXPONENT`: 0.43
- `MOVEMENT_SMOOTHING`: 0.15
- `MIN_MOVE_THRESHOLD`: 5（像素）

### 4.3 吞噬系統

```typescript
function checkEating(blobA: Blob, blobB: Blob): 'a_eats_b' | 'b_eats_a' | 'none' {
  const dx = blobA.x - blobB.x;
  const dy = blobA.y - blobB.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // 必須有足夠的重疊（大球中心蓋過小球中心）
  const overlapRequired = Math.min(blobA.radius, blobB.radius) * OVERLAP_RATIO;

  if (distance > Math.max(blobA.radius, blobB.radius) - overlapRequired) {
    return 'none';
  }

  // 質量比門檻（必須大於對方的 EATING_MASS_RATIO 才能吃）
  if (blobA.mass > blobB.mass * EATING_MASS_RATIO) return 'a_eats_b';
  if (blobB.mass > blobA.mass * EATING_MASS_RATIO) return 'b_eats_a';

  return 'none';
}

function executeEating(eater: Blob, eaten: Blob): void {
  // 吃到的質量有損耗（防止無限成長）
  const gainedMass = eaten.mass * MASS_ABSORPTION_RATIO;
  eater.mass += gainedMass;
  eater.radius = calculateRadius(eater.mass);
  eater.expression = 'eating';

  eaten.isAlive = false;

  // 觸發特效事件
  emitEvent('blob_eaten', { eaterId: eater.id, eatenId: eaten.id, position: { x: eaten.x, y: eaten.y } });
}
```

**關鍵常數**:
- `EATING_MASS_RATIO`: 1.25（必須大於對方 25% 才能吃）
- `MASS_ABSORPTION_RATIO`: 0.8（吃到的質量打八折）
- `OVERLAP_RATIO`: 0.6（重疊 60% 才算吃到）

### 4.4 分裂系統

```typescript
function splitBlob(blob: Blob, directionX: number, directionY: number): BlobFragment | null {
  // 最小分裂質量
  if (blob.mass < MIN_SPLIT_MASS) return null;
  if (blob.splitCooldown > 0) return null;

  const halfMass = blob.mass / 2;

  // 本體縮小
  blob.mass = halfMass;
  blob.radius = calculateRadius(blob.mass);
  blob.splitCooldown = SPLIT_COOLDOWN_TICKS;

  // 產生碎片
  const fragment: BlobFragment = {
    id: generateId(),
    parentId: blob.id,
    x: blob.x,
    y: blob.y,
    mass: halfMass,
    radius: calculateRadius(halfMass),
    velocityX: directionX * SPLIT_LAUNCH_SPEED,
    velocityY: directionY * SPLIT_LAUNCH_SPEED,
    mergeTimer: MERGE_DELAY_TICKS,
  };

  blob.fragments.push(fragment);
  return fragment;
}
```

**關鍵常數**:
- `MIN_SPLIT_MASS`: 40
- `SPLIT_COOLDOWN_TICKS`: 20（1 秒 @20TPS）
- `SPLIT_LAUNCH_SPEED`: 500（像素/秒，然後快速衰減）
- `MERGE_DELAY_TICKS`: 160（8 秒 @20TPS）

### 4.5 射出質量系統

```typescript
function ejectMass(blob: Blob, dirX: number, dirY: number): Pellet | null {
  if (blob.mass < MIN_EJECT_MASS) return null;

  const ejectAmount = EJECT_MASS_AMOUNT;
  blob.mass -= ejectAmount;
  blob.radius = calculateRadius(blob.mass);

  return {
    id: generateId(),
    x: blob.x + dirX * (blob.radius + 10),
    y: blob.y + dirY * (blob.radius + 10),
    mass: ejectAmount,
    velocityX: dirX * EJECT_SPEED,
    velocityY: dirY * EJECT_SPEED,
    isGolden: false,
    type: 'ejected',
    decayTimer: EJECT_DECAY_TICKS,
  };
}
```

### 4.6 碰撞偵測

使用空間分割（Spatial Hash Grid）優化大量實體的碰撞偵測：

```typescript
class SpatialHashGrid {
  private cellSize: number;
  private grid: Map<string, Set<string>>;

  constructor(cellSize: number = 100) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  private hash(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
  }

  insert(entity: { id: string; x: number; y: number; radius: number }): void {
    // 插入實體到其覆蓋的所有格子
    const minX = Math.floor((entity.x - entity.radius) / this.cellSize);
    const maxX = Math.floor((entity.x + entity.radius) / this.cellSize);
    const minY = Math.floor((entity.y - entity.radius) / this.cellSize);
    const maxY = Math.floor((entity.y + entity.radius) / this.cellSize);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const key = `${x},${y}`;
        if (!this.grid.has(key)) this.grid.set(key, new Set());
        this.grid.get(key)!.add(entity.id);
      }
    }
  }

  query(x: number, y: number, radius: number): string[] {
    const candidates = new Set<string>();
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minY = Math.floor((y - radius) / this.cellSize);
    const maxY = Math.floor((y + radius) / this.cellSize);

    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const key = `${cx},${cy}`;
        const cell = this.grid.get(key);
        if (cell) cell.forEach(id => candidates.add(id));
      }
    }

    return Array.from(candidates);
  }

  clear(): void {
    this.grid.clear();
  }
}
```

### 4.7 半徑計算公式

```typescript
const RADIUS_FACTOR = 4.5;

function calculateRadius(mass: number): number {
  return Math.sqrt(mass) * RADIUS_FACTOR;
}

// 反向計算（從半徑求質量）
function calculateMass(radius: number): number {
  return (radius / RADIUS_FACTOR) ** 2;
}
```

**質量 → 半徑 參考表**:

| 質量 | 半徑 (px) | 對應大小 |
|------|-----------|----------|
| 10   | 14.2      | 初始大小 |
| 25   | 22.5      | 小型 |
| 50   | 31.8      | 中型 |
| 100  | 45.0      | 大型 |
| 200  | 63.6      | 超大型 |
| 500  | 100.6     | 巨型 |

---

## 5. Phase 2：三輪淘汰制

### 5.1 輪次管理器

```typescript
interface RoundConfig {
  roundNumber: 1 | 2 | 3;
  duration: number;              // 秒
  mapWidth: number;
  mapHeight: number;
  eliminationRule: EliminationRule;
  pelletDensity: number;         // 每 10000 平方像素的食物數
  hasHazards: boolean;
  hasPowerUps: boolean;
  hasShrinkingZone: boolean;
  shrinkRate?: number;           // 每秒縮小像素
  massDecayRate?: number;        // 每秒質量流失
  specialMechanics: string[];
}

type EliminationRule =
  | { type: 'bottom_percentage'; percentage: number }    // 最小 N% 淘汰
  | { type: 'last_standing' };                           // 最後存活

const ROUND_CONFIGS: RoundConfig[] = [
  {
    roundNumber: 1,
    duration: 30,
    mapWidth: 3000,
    mapHeight: 3000,
    eliminationRule: { type: 'bottom_percentage', percentage: 40 },
    pelletDensity: 12,
    hasHazards: false,
    hasPowerUps: false,
    hasShrinkingZone: false,
    specialMechanics: ['golden_pellet'],
  },
  {
    roundNumber: 2,
    duration: 30,
    mapWidth: 2000,
    mapHeight: 2000,
    eliminationRule: { type: 'bottom_percentage', percentage: 50 },
    pelletDensity: 6,
    hasHazards: true,
    hasPowerUps: true,
    hasShrinkingZone: true,
    shrinkRate: 30,
    specialMechanics: ['hazard_zones', 'power_ups', 'shrinking_safe_zone'],
  },
  {
    roundNumber: 3,
    duration: 30,
    mapWidth: 800,
    mapHeight: 800,
    eliminationRule: { type: 'last_standing' },
    pelletDensity: 3,
    hasHazards: false,
    hasPowerUps: false,
    hasShrinkingZone: true,
    shrinkRate: 15,
    massDecayRate: 0.5,
    specialMechanics: ['mass_decay', 'spectator_pellets', 'continuous_shrink'],
  },
];
```

### 5.2 輪次狀態機

```typescript
enum RoundState {
  WAITING = 'waiting',
  COUNTDOWN = 'countdown',       // 3-2-1 倒數
  PLAYING = 'playing',
  ELIMINATING = 'eliminating',   // 淘汰動畫
  TRANSITIONING = 'transitioning', // 過場
  FINISHED = 'finished',
}

class RoundManager {
  private state: RoundState = RoundState.WAITING;
  private currentRound: number = 0;
  private roundTimer: number = 0;
  private transitionTimer: number = 0;

  tick(dt: number): void {
    switch (this.state) {
      case RoundState.COUNTDOWN:
        this.roundTimer -= dt;
        if (this.roundTimer <= 0) {
          this.state = RoundState.PLAYING;
          this.roundTimer = ROUND_CONFIGS[this.currentRound].duration;
        }
        break;

      case RoundState.PLAYING:
        this.roundTimer -= dt;
        if (this.roundTimer <= 0) {
          this.state = RoundState.ELIMINATING;
          this.performElimination();
        }
        break;

      case RoundState.ELIMINATING:
        // 播放淘汰動畫（1.5 秒）
        this.transitionTimer -= dt;
        if (this.transitionTimer <= 0) {
          if (this.currentRound < 2) {
            this.state = RoundState.TRANSITIONING;
            this.transitionTimer = TRANSITION_DURATION;
          } else {
            this.state = RoundState.FINISHED;
          }
        }
        break;

      case RoundState.TRANSITIONING:
        this.transitionTimer -= dt;
        if (this.transitionTimer <= 0) {
          this.currentRound++;
          this.startRound();
        }
        break;
    }
  }

  private performElimination(): void {
    const config = ROUND_CONFIGS[this.currentRound];
    const rule = config.eliminationRule;

    if (rule.type === 'bottom_percentage') {
      const alivePlayers = this.getAlivePlayers().sort((a, b) => a.mass - b.mass);
      const eliminateCount = Math.floor(alivePlayers.length * (rule.percentage / 100));

      for (let i = 0; i < eliminateCount; i++) {
        this.eliminatePlayer(alivePlayers[i]);
      }
    }

    this.transitionTimer = ELIMINATION_ANIMATION_DURATION;
  }
}
```

### 5.3 第二輪特殊機制

#### 5.3.1 障礙物系統

```typescript
interface Hazard {
  id: string;
  type: 'spike_zone' | 'speed_boost' | 'gravity_well';
  x: number;
  y: number;
  radius: number;
  damage?: number;           // spike_zone：每 tick 損失的質量
  speedMultiplier?: number;  // speed_boost：速度倍率
  pullForce?: number;        // gravity_well：吸引力
}

const HAZARD_CONFIGS = {
  spike_zone: {
    radius: 80,
    damage: 2,               // 每 tick 損失 2 質量
    color: '#FF4444',
    warningPulse: true,
  },
  speed_boost: {
    radius: 60,
    speedMultiplier: 2.5,
    duration: 40,            // tick 數（2 秒）
    color: '#44FF44',
  },
  gravity_well: {
    radius: 120,
    pullForce: 50,           // 像素/秒
    color: '#8844FF',
  },
};
```

#### 5.3.2 道具系統

```typescript
type PowerUpType = 'shield' | 'dash' | 'magnet';

interface PowerUp {
  id: string;
  type: PowerUpType;
  x: number;
  y: number;
  isActive: boolean;
  respawnTimer: number;
}

interface ActivePowerUp {
  type: PowerUpType;
  remainingTicks: number;
}

const POWER_UP_CONFIGS = {
  shield: {
    duration: 100,           // 5 秒 @20TPS
    description: '擋住一次被吃攻擊',
    color: '#4488FF',
    icon: '🛡️',
  },
  dash: {
    duration: 20,            // 1 秒 @20TPS
    speedMultiplier: 4,
    description: '瞬間衝刺',
    color: '#FFAA00',
    icon: '⚡',
  },
  magnet: {
    duration: 80,            // 4 秒 @20TPS
    pullRadius: 150,
    description: '吸引附近食物',
    color: '#FF44AA',
    icon: '🧲',
  },
};
```

#### 5.3.3 縮小安全區

```typescript
interface SafeZone {
  centerX: number;
  centerY: number;
  currentRadius: number;
  targetRadius: number;
  shrinkRate: number;          // 像素/秒
  damageOutside: number;       // 圈外每 tick 損失質量
}

function updateSafeZone(zone: SafeZone, dt: number): void {
  if (zone.currentRadius > zone.targetRadius) {
    zone.currentRadius = Math.max(
      zone.targetRadius,
      zone.currentRadius - zone.shrinkRate * dt
    );
  }
}

function applyZoneDamage(blob: Blob, zone: SafeZone, dt: number): void {
  const dx = blob.x - zone.centerX;
  const dy = blob.y - zone.centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > zone.currentRadius) {
    blob.mass -= zone.damageOutside * dt;
    blob.mass = Math.max(MIN_BLOB_MASS, blob.mass);
    blob.radius = calculateRadius(blob.mass);
    blob.expression = 'worried';
  }
}
```

### 5.4 第三輪特殊機制

#### 5.4.1 質量衰減

```typescript
function applyMassDecay(blob: Blob, decayRate: number, dt: number): void {
  // 質量越大衰減越快（防止龜縮）
  const decayMultiplier = 1 + (blob.mass / 100) * 0.5;
  blob.mass -= decayRate * decayMultiplier * dt;
  blob.mass = Math.max(MIN_BLOB_MASS, blob.mass);
  blob.radius = calculateRadius(blob.mass);
}
```

#### 5.4.2 觀眾投食

```typescript
interface SpectatorPellet {
  id: string;
  x: number;
  y: number;
  mass: number;
  thrownBy: string;            // 投擲者 ID
  velocityX: number;
  velocityY: number;
}

function throwSpectatorPellet(
  spectatorId: string,
  targetX: number,
  targetY: number,
  arenaCenter: { x: number; y: number }
): SpectatorPellet {
  // 從競技場邊緣投入
  const angle = Math.atan2(targetY - arenaCenter.y, targetX - arenaCenter.x);
  const spawnRadius = ROUND_3_INITIAL_RADIUS + 50;

  return {
    id: generateId(),
    x: arenaCenter.x + Math.cos(angle + Math.PI) * spawnRadius,
    y: arenaCenter.y + Math.sin(angle + Math.PI) * spawnRadius,
    mass: SPECTATOR_PELLET_MASS,
    thrownBy: spectatorId,
    velocityX: Math.cos(angle) * SPECTATOR_THROW_SPEED,
    velocityY: Math.sin(angle) * SPECTATOR_THROW_SPEED,
  };
}
```

---

## 6. Phase 3：AI Agent 系統

### 6.1 架構概覽

AI Agent 在伺服器端運行，與人類玩家有完全相同的物理約束。每個 Agent 有一個「人格」決定其策略傾向。

```typescript
type AIPersonality = 'aggressor' | 'survivor' | 'opportunist' | 'trickster' | 'herder';

interface AIAgent {
  blobId: string;
  personality: AIPersonality;
  difficulty: number;           // 0.0 ~ 1.0
  reactionDelay: number;        // 模擬人類反應時間（tick 數）
  inputNoise: number;           // 輸入雜訊幅度（模擬不精確）
  decisionCooldown: number;     // 決策冷卻
  currentTarget: string | null;
  state: AIState;
  memory: AIMemory;
}

interface AIMemory {
  threatMap: Map<string, number>;       // 威脅等級
  lastPositions: Map<string, {x: number, y: number}>;
  recentlyEatenBy: string[];            // 記住誰吃過自己（用於復仇）
  discoveredPowerUps: Array<{x: number, y: number, type: PowerUpType}>;
}

type AIState =
  | 'roaming'          // 漫遊吃食物
  | 'hunting'          // 追殺目標
  | 'fleeing'          // 逃跑
  | 'ambushing'        // 埋伏
  | 'collecting_powerup' // 撿道具
  | 'zone_repositioning'; // 進入安全區
```

### 6.2 行為樹框架

```typescript
type BehaviorNode =
  | { type: 'selector'; children: BehaviorNode[] }      // 嘗試直到成功
  | { type: 'sequence'; children: BehaviorNode[] }       // 全部執行
  | { type: 'condition'; check: (ctx: AIContext) => boolean }
  | { type: 'action'; execute: (ctx: AIContext) => AIOutput };

interface AIContext {
  self: Blob;
  nearbyBlobs: Blob[];
  nearbyPellets: Pellet[];
  nearbyHazards: Hazard[];
  nearbyPowerUps: PowerUp[];
  safeZone: SafeZone | null;
  roundConfig: RoundConfig;
  timeLeft: number;
  memory: AIMemory;
  personality: AIPersonality;
  difficulty: number;
}

interface AIOutput {
  targetX: number;
  targetY: number;
  shouldSplit: boolean;
  shouldEject: boolean;
}
```

### 6.3 各人格行為定義

#### 攻擊者 (Aggressor)

```typescript
const aggressorTree: BehaviorNode = {
  type: 'selector',
  children: [
    // 優先：如果有比自己小的目標在附近，追殺
    {
      type: 'sequence',
      children: [
        { type: 'condition', check: (ctx) => hasEatableTarget(ctx, 200) },
        { type: 'action', execute: (ctx) => {
          const target = findBestTarget(ctx);
          const shouldSplit = canSplitKill(ctx, target) && ctx.difficulty > 0.5;
          return { targetX: target.x, targetY: target.y, shouldSplit, shouldEject: false };
        }},
      ],
    },
    // 次要：如果被更大的追，逃跑
    {
      type: 'sequence',
      children: [
        { type: 'condition', check: (ctx) => isBeingChased(ctx) },
        { type: 'action', execute: (ctx) => fleeFromThreat(ctx) },
      ],
    },
    // 預設：積極尋找食物和目標
    {
      type: 'action',
      execute: (ctx) => aggressiveRoam(ctx),
    },
  ],
};
```

#### 生存者 (Survivor)

```typescript
const survivorTree: BehaviorNode = {
  type: 'selector',
  children: [
    // 優先：如果在安全區外，進入安全區
    {
      type: 'sequence',
      children: [
        { type: 'condition', check: (ctx) => isOutsideSafeZone(ctx) },
        { type: 'action', execute: (ctx) => moveToSafeZone(ctx) },
      ],
    },
    // 次要：如果附近有威脅，逃跑（反應門檻低）
    {
      type: 'sequence',
      children: [
        { type: 'condition', check: (ctx) => hasThreatNearby(ctx, 300) },
        { type: 'action', execute: (ctx) => fleeFromThreat(ctx) },
      ],
    },
    // 預設：安全地吃食物，偏好地圖邊緣
    {
      type: 'action',
      execute: (ctx) => safeForage(ctx),
    },
  ],
};
```

#### 機會主義者 (Opportunist)

```typescript
const opportunistTree: BehaviorNode = {
  type: 'selector',
  children: [
    // 優先：如果附近有兩個 Blob 在打架，等他們打完
    {
      type: 'sequence',
      children: [
        { type: 'condition', check: (ctx) => detectFightNearby(ctx, 400) },
        { type: 'action', execute: (ctx) => {
          const fight = findNearestFight(ctx);
          // 保持在打架距離外，等一方被吃
          return orbitalPosition(ctx, fight.center, fight.radius + 100);
        }},
      ],
    },
    // 次要：如果有明顯弱小的目標（剛被打的、很小的），撿殺
    {
      type: 'sequence',
      children: [
        { type: 'condition', check: (ctx) => hasWeakenedTarget(ctx) },
        { type: 'action', execute: (ctx) => huntWeakened(ctx) },
      ],
    },
    // 預設：安靜吃食物，保持中等位置
    {
      type: 'action',
      execute: (ctx) => cautiousRoam(ctx),
    },
  ],
};
```

#### 騙局師 (Trickster)

```typescript
const tricksterTree: BehaviorNode = {
  type: 'selector',
  children: [
    // 使用佯攻：假裝逃跑然後突然轉向
    {
      type: 'sequence',
      children: [
        { type: 'condition', check: (ctx) => canExecuteFeint(ctx) },
        { type: 'action', execute: (ctx) => executeFeint(ctx) },
      ],
    },
    // 射出質量誘餌
    {
      type: 'sequence',
      children: [
        { type: 'condition', check: (ctx) => canBait(ctx) },
        { type: 'action', execute: (ctx) => baitTrap(ctx) },
      ],
    },
    // 突然變向
    {
      type: 'action',
      execute: (ctx) => unpredictableMovement(ctx),
    },
  ],
};
```

#### 圈套者 (Herder)

```typescript
const herderTree: BehaviorNode = {
  type: 'selector',
  children: [
    // 嘗試將目標逼向地圖邊緣或障礙物
    {
      type: 'sequence',
      children: [
        { type: 'condition', check: (ctx) => hasHerdableTarget(ctx) },
        { type: 'action', execute: (ctx) => {
          const target = findHerdableTarget(ctx);
          const wall = findNearestWall(target);
          // 計算切斷路線的位置
          return cutOffPosition(ctx, target, wall);
        }},
      ],
    },
    // 預設行為
    {
      type: 'action',
      execute: (ctx) => patrolPerimeter(ctx),
    },
  ],
};
```

### 6.4 反偵測系統（讓 AI 像人類）

```typescript
function humanizeAIOutput(output: AIOutput, agent: AIAgent): AIOutput {
  // 1. 反應延遲：不會立即做出最佳決策
  if (agent.decisionCooldown > 0) {
    return agent.lastOutput; // 延遲回應
  }

  // 2. 輸入雜訊：模擬人類操作的不精確
  const noise = agent.inputNoise;
  output.targetX += (Math.random() - 0.5) * noise;
  output.targetY += (Math.random() - 0.5) * noise;

  // 3. 偶爾犯錯（根據難度）
  if (Math.random() > agent.difficulty) {
    // 低難度 AI 有更高機率做出次優決策
    output.shouldSplit = false; // 錯過分裂時機
  }

  // 4. 模擬「猶豫」：在決策邊界時暫停
  if (agent.state === 'hunting' && Math.random() < 0.05) {
    output.targetX = agent.self.x; // 短暫停頓
    output.targetY = agent.self.y;
  }

  // 5. 模擬滑鼠移動路徑（不是直線到目標）
  output.targetX = lerp(agent.lastOutput.targetX, output.targetX, 0.3 + agent.difficulty * 0.5);
  output.targetY = lerp(agent.lastOutput.targetY, output.targetY, 0.3 + agent.difficulty * 0.5);

  agent.lastOutput = output;
  return output;
}
```

### 6.5 難度等級配置

| 參數 | 新手 (0.0-0.3) | 中級 (0.3-0.6) | 高級 (0.6-0.85) | 專家 (0.85-1.0) |
|------|----------------|----------------|-----------------|-----------------|
| 反應延遲 | 8-12 ticks | 4-8 ticks | 2-4 ticks | 1-2 ticks |
| 輸入雜訊 | 80 px | 40 px | 15 px | 5 px |
| 分裂精準度 | 30% | 55% | 80% | 95% |
| 視野利用 | 50% | 70% | 90% | 100% |
| 犯錯機率 | 20% | 10% | 3% | 0.5% |

---

## 7. Phase 4：UI / HUD 系統

### 7.1 HUD 佈局

```
┌─────────────────────────────────────────────────────────┐
│ [擊殺通知]                    [回合指示 ①②③] [倒數 0:23] │
│  ★ NomNom 吃掉了 Squishy                                │
│  ★ You 吃掉了 Bot_Alpha                                  │
│                                                         │
│                                                         │
│                                            ┌──────────┐ │
│                                            │ 排行榜   │ │
│                                            │ 1. You   │ │
│                                            │ 2. NomNom│ │
│                                            │ 3. Mochi │ │
│                                            │ 4. Jelly │ │
│                                            │ 5. Boba  │ │
│                                            └──────────┘ │
│                                                         │
│                                            ┌──────────┐ │
│                                            │ [小地圖] │ │
│ ┌──────────────┐                           │  ◉ = 你  │ │
│ │ 🔵 質量: 156 │  [🖱️移動 空白鍵分裂 W射出] │  · = 其他│ │
│ └──────────────┘                           └──────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 7.2 各 UI 組件規格

#### 排行榜 (Leaderboard)

```typescript
interface LeaderboardProps {
  entries: Array<{
    rank: number;
    name: string;
    mass: number;
    color: string;
    isPlayer: boolean;
  }>;
}

// 規格：
// - 位置：右上角，距邊 12px
// - 尺寸：寬 160px，高自適應
// - 背景：rgba(11,14,23,0.85) + backdrop-filter: blur(8px)
// - 邊框：1px solid rgba(255,255,255,0.08)
// - 圓角：10px
// - 更新頻率：每 500ms 更新排序（避免頻繁跳動）
// - 動畫：排名變動時 slide 過渡（300ms ease）
// - 最多顯示 5 名
// - 玩家自己的名字用金色高亮
```

#### 小地圖 (Minimap)

```typescript
// 規格：
// - 位置：右下角，距邊 12px
// - 尺寸：120x90px（保持地圖 4:3 比例）
// - 背景：rgba(11,14,23,0.85)
// - 玩家自己：金色閃爍圓點（半徑 4px，脈衝動畫）
// - 其他 Blob：對應顏色圓點（半徑 2px，透明度 50%）
// - 安全區：紅色虛線圓圈（第二輪起）
// - 不顯示食物（避免雜亂）
// - 更新頻率：與遊戲同步
```

#### 回合計時器 (Round Timer)

```typescript
// 規格：
// - 位置：頂部中右
// - 格式：「0:23」
// - 字體：Nunito 900，24px
// - 顏色：白色 → 當剩餘 ≤10s 變紅色 (#FF4D6D)
// - 動畫：≤5s 時加 pulse 縮放動畫
// - 旁邊顯示當前輪次名稱（搶食狂歡/混亂區域/最終決戰）
```

#### 回合指示器 (Round Indicator)

```typescript
// 規格：
// - 位置：頂部中央
// - 三個圓形按鈕：①②③
// - 當前輪：填滿對應顏色（R1: #4ECDC4, R2: #FF6B6B, R3: #FFE66D）+ glow
// - 已完成輪：灰色 + ✓
// - 未到輪：暗灰色
// - 圓形間有連接線
```

#### 擊殺通知 (Kill Feed)

```typescript
interface KillFeedEntry {
  id: string;
  killerName: string;
  killerColor: string;
  victimName: string;
  victimColor: string;
  timestamp: number;
}

// 規格：
// - 位置：左上角
// - 最多顯示 4 條
// - 新消息從上方 slide-in（300ms）
// - 舊消息 3 秒後 fade-out
// - 格式：「[殺手名] 吃掉了 [被吃者名]」
// - 如果涉及玩家自己，整條高亮
// - 字體：11px，半透明背景
```

#### 質量顯示 (Mass Display)

```typescript
// 規格：
// - 位置：左下角
// - 顯示：玩家顏色圓點 + 「質量」標籤 + 數值
// - 數值用金色顯示
// - 數值變化時有 count-up 動畫
```

### 7.3 賽後畫面 (Post-Game Screen)

```typescript
interface PostGameData {
  playerRank: number;
  totalPlayers: number;
  stats: {
    blobsEaten: number;
    maxMass: number;
    survivalTime: number;
    roundsSurvived: number;
  };
  players: Array<{
    id: string;
    name: string;
    color: BlobColor;
    rank: number;
    isAI: boolean;
    isRevealed: boolean;     // 是否已揭曉
  }>;
  xpGained: number;
  detectionBonus: number;    // 正確識別 AI 的獎勵
}

// 畫面流程：
// 1. 顯示排名（大字：「第 3 名」，1.5 秒）
// 2. 顯示個人數據卡片（吃了幾個、最大質量等，2 秒）
// 3. AI 揭曉環節：
//    - 列出所有玩家
//    - 每個名字旁邊有「人類？」「AI？」兩個按鈕
//    - 玩家點選後揭曉（有動畫）
//    - 正確得獎勵 XP
// 4. 「再來一局」按鈕
```

---

## 8. Phase 5：多人連線架構

### 8.1 WebSocket 訊息協議

```typescript
// === Client → Server ===

interface ClientMessage {
  type: ClientMessageType;
  seq: number;               // 序列號（用於校正）
  timestamp: number;
}

type ClientMessageType =
  | { kind: 'input'; x: number; y: number }              // 移動目標
  | { kind: 'split' }                                      // 分裂
  | { kind: 'eject' }                                      // 射出質量
  | { kind: 'join_lobby'; playerName: string }             // 加入大廳
  | { kind: 'spectator_throw'; x: number; y: number }     // 觀眾投食
  | { kind: 'ai_guess'; targetId: string; guess: 'human' | 'ai' } // AI 猜測

// === Server → Client ===

type ServerMessage =
  | { type: 'game_state'; state: GameStateSnapshot }       // 完整狀態（每秒一次）
  | { type: 'delta'; changes: StateDelta[] }               // 差量更新（每 tick）
  | { type: 'round_start'; round: number; config: RoundConfig }
  | { type: 'round_end'; eliminated: string[]; rankings: RankEntry[] }
  | { type: 'transition'; nextRound: number; countdown: number }
  | { type: 'kill'; killerId: string; victimId: string }
  | { type: 'power_up_collected'; playerId: string; type: PowerUpType }
  | { type: 'game_over'; finalRankings: FinalRanking[] }
  | { type: 'ai_reveal'; players: Array<{ id: string; isAI: boolean }> }
  | { type: 'lobby_update'; players: LobbyPlayer[]; countdown: number }
  | { type: 'error'; message: string };
```

### 8.2 狀態同步策略

```typescript
interface GameStateSnapshot {
  tick: number;
  timestamp: number;
  blobs: BlobSnapshot[];
  pellets: PelletSnapshot[];
  hazards: HazardSnapshot[];
  powerUps: PowerUpSnapshot[];
  safeZone: SafeZoneSnapshot | null;
  round: number;
  roundState: RoundState;
  timeLeft: number;
}

interface BlobSnapshot {
  id: string;
  x: number;
  y: number;
  radius: number;
  mass: number;              // 只傳整數
  color: number;             // 顏色索引（不傳完整 hex）
  name: string;
  expression: number;        // 0=happy, 1=eating, 2=worried
  isAlive: boolean;
  fragments: FragmentSnapshot[];
  activePowerUp: number;     // -1=none, 0=shield, 1=dash, 2=magnet
}

// 差量更新（只傳變化的部分）
interface StateDelta {
  entityId: string;
  changes: Partial<BlobSnapshot | PelletSnapshot>;
}
```

### 8.3 客戶端預測與校正

```typescript
class ClientPrediction {
  private pendingInputs: ClientInput[] = [];
  private serverState: BlobSnapshot | null = null;

  // 發送輸入時記錄
  sendInput(input: ClientInput): void {
    this.pendingInputs.push(input);
    this.applyInputLocally(input);      // 立即套用（預測）
    this.network.send(input);
  }

  // 收到伺服器狀態時校正
  onServerState(state: GameStateSnapshot): void {
    const myBlob = state.blobs.find(b => b.id === this.myId);
    if (!myBlob) return;

    this.serverState = myBlob;

    // 移除已確認的輸入
    this.pendingInputs = this.pendingInputs.filter(
      input => input.seq > state.lastProcessedSeq
    );

    // 重新套用尚未確認的輸入
    let predicted = { ...myBlob };
    for (const input of this.pendingInputs) {
      predicted = this.simulateInput(predicted, input);
    }

    // 平滑校正（避免突然跳位）
    const correctionSpeed = 0.2;
    this.displayX = lerp(this.displayX, predicted.x, correctionSpeed);
    this.displayY = lerp(this.displayY, predicted.y, correctionSpeed);
  }
}
```

### 8.4 實體插值（其他玩家的平滑顯示）

```typescript
class EntityInterpolation {
  private buffer: Array<{ timestamp: number; state: BlobSnapshot }> = [];
  private renderDelay: number = 100; // 100ms 延遲（2 個 server tick）

  addState(state: BlobSnapshot, timestamp: number): void {
    this.buffer.push({ timestamp, state });
    // 保留最近 1 秒的狀態
    const cutoff = timestamp - 1000;
    this.buffer = this.buffer.filter(s => s.timestamp > cutoff);
  }

  getInterpolatedState(currentTime: number): BlobSnapshot | null {
    const renderTime = currentTime - this.renderDelay;

    // 找到 renderTime 前後的兩個狀態
    let before = null;
    let after = null;

    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].timestamp <= renderTime &&
          this.buffer[i + 1].timestamp >= renderTime) {
        before = this.buffer[i];
        after = this.buffer[i + 1];
        break;
      }
    }

    if (!before || !after) return this.buffer[this.buffer.length - 1]?.state || null;

    const t = (renderTime - before.timestamp) / (after.timestamp - before.timestamp);

    return {
      ...after.state,
      x: lerp(before.state.x, after.state.x, t),
      y: lerp(before.state.y, after.state.y, t),
      radius: lerp(before.state.radius, after.state.radius, t),
    };
  }
}
```

### 8.5 房間與配對

```typescript
interface GameRoom {
  id: string;
  state: 'waiting' | 'countdown' | 'playing' | 'finished';
  maxPlayers: number;          // 30
  minHumans: number;           // 1（至少要有 1 個人類才開始）
  humanPlayers: Map<string, PlayerConnection>;
  aiAgents: Map<string, AIAgent>;
  gameLoop: GameLoop;
  roundManager: RoundManager;
  createdAt: number;
}

class Matchmaker {
  private waitingPlayers: PlayerConnection[] = [];
  private rooms: Map<string, GameRoom> = new Map();

  addPlayer(player: PlayerConnection): void {
    this.waitingPlayers.push(player);

    // 當等待人數 ≥ 8 或等待時間 > 10 秒時開房
    if (this.waitingPlayers.length >= 8 || this.hasLongWaiter()) {
      this.createRoom();
    }
  }

  private createRoom(): void {
    const room = new GameRoom();

    // 取出等待中的玩家（最多 15 個人類）
    const humans = this.waitingPlayers.splice(0, Math.min(15, this.waitingPlayers.length));
    humans.forEach(p => room.addHuman(p));

    // 用 AI 填滿到 30 人
    const aiCount = 30 - humans.length;
    for (let i = 0; i < aiCount; i++) {
      room.addAI(this.createAIAgent(room.averageSkillLevel));
    }

    // 5 秒倒數後開始
    room.startCountdown(5);
    this.rooms.set(room.id, room);
  }
}
```

---

## 9. Phase 6：賽後系統與進度

### 9.1 經驗值計算

```typescript
function calculateXP(result: MatchResult): XPBreakdown {
  return {
    placement: placementXP(result.rank, result.totalPlayers),
    blobsEaten: result.blobsEaten * XP_PER_BLOB_EATEN,
    massGained: Math.floor(result.maxMass / 10) * XP_PER_MASS_UNIT,
    survivalTime: result.survivalTime * XP_PER_SECOND_SURVIVED,
    roundsSurvived: result.roundsSurvived * XP_PER_ROUND,
    aiDetection: result.correctAIGuesses * XP_PER_CORRECT_GUESS,
    firstPlace: result.rank === 1 ? XP_FIRST_PLACE_BONUS : 0,
  };
}

function placementXP(rank: number, total: number): number {
  const percentile = 1 - (rank / total);
  return Math.floor(BASE_PLACEMENT_XP * (1 + percentile * 2));
}

// XP 常數
const XP_PER_BLOB_EATEN = 15;
const XP_PER_MASS_UNIT = 2;
const XP_PER_SECOND_SURVIVED = 1;
const XP_PER_ROUND = 25;
const XP_PER_CORRECT_GUESS = 30;
const XP_FIRST_PLACE_BONUS = 100;
const BASE_PLACEMENT_XP = 20;
```

### 9.2 偵測分數系統

```typescript
interface DetectionScore {
  totalGuesses: number;
  correctGuesses: number;
  accuracy: number;            // correctGuesses / totalGuesses
  streak: number;              // 連續正確次數
  bestStreak: number;
  rank: DetectionRank;
}

type DetectionRank = 'Novice' | 'Observer' | 'Detective' | 'Profiler' | 'Oracle';

function calculateDetectionRank(accuracy: number, totalGuesses: number): DetectionRank {
  if (totalGuesses < 20) return 'Novice';
  if (accuracy < 0.55) return 'Observer';
  if (accuracy < 0.65) return 'Detective';
  if (accuracy < 0.75) return 'Profiler';
  return 'Oracle';
}
```

### 9.3 資料庫 Schema

```sql
-- 玩家資料
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name VARCHAR(20) NOT NULL,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 進度
  level INTEGER DEFAULT 1,
  total_xp BIGINT DEFAULT 0,
  current_season_xp BIGINT DEFAULT 0,

  -- 統計
  matches_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  total_blobs_eaten INTEGER DEFAULT 0,
  total_mass_gained BIGINT DEFAULT 0,
  best_rank INTEGER DEFAULT 0,

  -- 偵測分數
  detection_total_guesses INTEGER DEFAULT 0,
  detection_correct_guesses INTEGER DEFAULT 0,
  detection_best_streak INTEGER DEFAULT 0,

  -- ELO
  skill_rating INTEGER DEFAULT 1000,

  -- 裝飾
  equipped_skin VARCHAR(50) DEFAULT 'default',
  equipped_face VARCHAR(50) DEFAULT 'default',
  equipped_trail VARCHAR(50) DEFAULT 'none',
  unlocked_items JSONB DEFAULT '[]'
);

-- 比賽紀錄
CREATE TABLE match_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL,
  total_players INTEGER NOT NULL,
  total_humans INTEGER NOT NULL,
  total_ai INTEGER NOT NULL,
  winner_id UUID REFERENCES players(id),
  game_mode VARCHAR(20) DEFAULT 'standard'
);

-- 比賽中玩家表現
CREATE TABLE match_players (
  match_id UUID REFERENCES match_history(id),
  player_id UUID REFERENCES players(id),
  final_rank INTEGER NOT NULL,
  blobs_eaten INTEGER DEFAULT 0,
  max_mass INTEGER DEFAULT 0,
  survival_time_seconds INTEGER DEFAULT 0,
  rounds_survived INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  ai_guesses_correct INTEGER DEFAULT 0,
  ai_guesses_total INTEGER DEFAULT 0,
  PRIMARY KEY (match_id, player_id)
);

-- 賽季排行榜
CREATE TABLE season_rankings (
  season_id INTEGER NOT NULL,
  player_id UUID REFERENCES players(id),
  rank_tier VARCHAR(20) NOT NULL,  -- Bronze/Silver/Gold/Platinum/Diamond
  rank_points INTEGER DEFAULT 0,
  PRIMARY KEY (season_id, player_id)
);
```

---

## 10. 資料模型與型別定義

### 10.1 完整型別總覽

```typescript
// ===== 核心實體 =====

interface Blob { /* 見 4.1 */ }
interface BlobFragment { /* 見 4.1 */ }
interface BlobColor { /* 見 4.1 */ }

interface Pellet {
  id: string;
  x: number;
  y: number;
  mass: number;
  type: 'normal' | 'golden' | 'ejected' | 'spectator';
  velocityX: number;
  velocityY: number;
  decayTimer: number;
}

interface Hazard { /* 見 5.3.1 */ }
interface PowerUp { /* 見 5.3.2 */ }
interface SafeZone { /* 見 5.3.3 */ }

// ===== 遊戲狀態 =====

interface GameState {
  tick: number;
  round: number;
  roundState: RoundState;
  timeLeft: number;
  worldWidth: number;
  worldHeight: number;
  blobs: Map<string, Blob>;
  pellets: Map<string, Pellet>;
  hazards: Map<string, Hazard>;
  powerUps: Map<string, PowerUp>;
  safeZone: SafeZone | null;
  killFeed: KillFeedEntry[];
  eliminatedPlayers: string[];
}

// ===== 網路 =====

interface PlayerConnection {
  id: string;
  socket: WebSocket;
  playerId: string;
  playerName: string;
  latency: number;
  lastInputSeq: number;
}

// ===== 事件 =====

type GameEvent =
  | { type: 'blob_eaten'; eaterId: string; eatenId: string; position: Vec2 }
  | { type: 'blob_split'; blobId: string; fragmentId: string }
  | { type: 'power_up_collected'; blobId: string; powerUpType: PowerUpType }
  | { type: 'round_start'; round: number }
  | { type: 'round_end'; round: number; eliminated: string[] }
  | { type: 'player_eliminated'; playerId: string; rank: number }
  | { type: 'game_over'; winner: string };

// ===== 工具型別 =====

interface Vec2 {
  x: number;
  y: number;
}
```

---

## 11. 遊戲常數配置表

所有遊戲常數集中在 `packages/shared/src/constants.ts`，方便調整平衡。

```typescript
export const GAME_CONSTANTS = {
  // ── 世界 ──
  WORLD_WIDTH: 3000,
  WORLD_HEIGHT: 3000,
  TICK_RATE: 20,                     // 伺服器每秒 tick 數
  CLIENT_FPS: 60,

  // ── Blob 物理 ──
  RADIUS_FACTOR: 4.5,               // 半徑 = sqrt(mass) * RADIUS_FACTOR
  BASE_SPEED: 200,                   // 基礎速度（像素/秒）
  SPEED_DECAY_EXPONENT: 0.43,       // 速度 = BASE_SPEED / mass^EXPONENT
  MOVEMENT_SMOOTHING: 0.15,         // 移動平滑係數
  MIN_MOVE_THRESHOLD: 5,            // 最小移動閾值（像素）
  MIN_BLOB_MASS: 10,                // 最小存活質量

  // ── 吞噬 ──
  EATING_MASS_RATIO: 1.25,          // 必須大於對方 25% 才能吃
  MASS_ABSORPTION_RATIO: 0.8,       // 吃到的質量打八折
  OVERLAP_RATIO: 0.6,               // 重疊 60% 才算吃到

  // ── 分裂 ──
  MIN_SPLIT_MASS: 40,               // 最小分裂質量
  SPLIT_COOLDOWN_TICKS: 20,         // 分裂冷卻（1 秒）
  SPLIT_LAUNCH_SPEED: 500,          // 分裂發射速度
  SPLIT_DECELERATION: 0.92,         // 分裂減速係數（每 tick）
  MERGE_DELAY_TICKS: 160,           // 自動合併延遲（8 秒）
  MAX_FRAGMENTS: 4,                  // 最多碎片數

  // ── 射出 ──
  MIN_EJECT_MASS: 20,               // 最小射出質量
  EJECT_MASS_AMOUNT: 14,            // 每次射出的質量
  EJECT_SPEED: 400,                  // 射出速度
  EJECT_DECAY_TICKS: 600,           // 射出物消失時間（30 秒）

  // ── 食物 ──
  PELLET_BASE_MASS: 1,              // 普通食物質量
  GOLDEN_PELLET_MASS: 15,           // 黃金食物質量
  PELLET_RESPAWN_TICKS: 40,         // 食物重生時間（2 秒）

  // ── 輪次 ──
  ROUND_DURATION: 30,               // 每輪秒數
  COUNTDOWN_DURATION: 3,            // 開始倒數秒數
  TRANSITION_DURATION: 2.5,         // 過場秒數
  ELIMINATION_ANIMATION_DURATION: 1.5, // 淘汰動畫秒數
  LOBBY_COUNTDOWN: 5,               // 大廳倒數秒數

  // ── 第二輪 ──
  R2_SAFE_ZONE_INITIAL_RADIUS: 900, // 安全區初始半徑
  R2_SAFE_ZONE_FINAL_RADIUS: 300,   // 安全區最終半徑
  R2_SHRINK_RATE: 30,               // 每秒縮小像素
  R2_ZONE_DAMAGE: 3,                // 圈外每秒損失質量
  R2_HAZARD_COUNT: 8,               // 障礙物數量
  R2_POWER_UP_COUNT: 5,             // 道具數量

  // ── 第三輪 ──
  R3_INITIAL_RADIUS: 400,           // 初始競技場半徑
  R3_FINAL_RADIUS: 100,             // 最終競技場半徑
  R3_SHRINK_RATE: 15,               // 每秒縮小像素
  R3_MASS_DECAY_RATE: 0.5,          // 每秒質量衰減
  SPECTATOR_PELLET_MASS: 5,         // 觀眾投食質量
  SPECTATOR_THROW_SPEED: 300,       // 投食速度
  SPECTATOR_COOLDOWN: 40,           // 投食冷卻（2 秒）

  // ── 配對 ──
  MAX_PLAYERS_PER_ROOM: 30,
  MIN_HUMANS_TO_START: 1,
  MAX_HUMANS_PER_ROOM: 15,
  MATCHMAKING_TIMEOUT: 10,          // 秒

  // ── AI ──
  AI_UPDATE_INTERVAL: 3,            // AI 每 3 tick 更新一次決策
  AI_VISION_RANGE: 500,             // AI 視野半徑

  // ── UI ──
  LEADERBOARD_UPDATE_INTERVAL: 500, // ms
  KILL_FEED_DISPLAY_TIME: 3000,     // ms
  KILL_FEED_MAX_ENTRIES: 4,

  // ── 進度 ──
  XP_PER_LEVEL: 500,                // 每級所需 XP（可能用曲線）
  SEASON_DURATION_DAYS: 90,
} as const;
```

---

## 12. 視覺設計規範

### 12.1 色彩系統

```typescript
export const THEME = {
  // 背景
  bg: '#0B0E17',
  bgGrid: 'rgba(255,255,255,0.03)',

  // 表面
  surface: 'rgba(255,255,255,0.06)',
  surfaceHover: 'rgba(255,255,255,0.1)',
  surfaceBorder: 'rgba(255,255,255,0.08)',

  // 文字
  textPrimary: '#E8ECF4',
  textMuted: 'rgba(232,236,244,0.5)',

  // 強調色
  accent: '#FF4D6D',
  accentGlow: 'rgba(255,77,109,0.3)',
  gold: '#FFD700',
  goldGlow: 'rgba(255,215,0,0.4)',

  // 輪次色
  round1: '#4ECDC4',
  round2: '#FF6B6B',
  round3: '#FFE66D',

  // 危險
  danger: '#FF4444',
  dangerGlow: 'rgba(255,68,68,0.2)',
};

// Blob 調色盤（8 色，可擴展）
export const BLOB_PALETTE = [
  { fill: '#FF6B9D', glow: 'rgba(255,107,157,0.4)', eye: '#fff' },  // 粉紅
  { fill: '#4ECDC4', glow: 'rgba(78,205,196,0.4)',  eye: '#fff' },  // 青綠
  { fill: '#45B7D1', glow: 'rgba(69,183,209,0.4)',  eye: '#fff' },  // 天藍
  { fill: '#96CEB4', glow: 'rgba(150,206,180,0.4)', eye: '#fff' },  // 薄荷
  { fill: '#FFEAA7', glow: 'rgba(255,234,167,0.4)', eye: '#333' },  // 檸檬（深色眼）
  { fill: '#DDA0DD', glow: 'rgba(221,160,221,0.4)', eye: '#fff' },  // 紫丁香
  { fill: '#FF8C42', glow: 'rgba(255,140,66,0.4)',  eye: '#fff' },  // 橘色
  { fill: '#98D8C8', glow: 'rgba(152,216,200,0.4)', eye: '#fff' },  // 嫩綠
];
```

### 12.2 Blob 視覺規格

```
[Blob 結構]

         ◠ 名字標籤（isPlayer ? 金色 : 白色，字體 9-13px）
        ╱
   ╭──────────╮  ← 發光層（半徑 + 4px, glow 色, blur filter）
  │  ╭────╮   │
  │  │ ◉◉ │   │  ← 眼睛：位於中心偏上，跟隨移動方向
  │  │  ‿  │   │  ← 嘴巴：happy=微笑弧線 / eating=橢圓 / worried=倒弧線
  │  ╰────╯   │
   ╰──────────╯  ← 主體（fill 色，opacity 0.92）
                  ← 高光（左上方橢圓，白色 25% 透明度）

[眼睛細節]
- 眼白：半徑 = blob半徑 × 0.18（最小 3px）
- 瞳孔：眼白 × 0.55
- 位置：中心左右偏移 ±0.22 × 半徑，上偏 0.08 × 半徑
- 瞳孔偏移：跟隨移動方向，最大偏移 = 眼白 × 0.25

[嘴巴細節]
- 位置：中心下方 0.22 × 半徑
- happy：二次貝茲曲線微笑
- eating：橢圓開口（rx=0.15r, ry=0.12r）
- worried：反向二次貝茲曲線

[尺寸閾值]
- 半徑 < 12px：不顯示表情
- 半徑 < 18px：不顯示名字
```

### 12.3 特效規格

```typescript
const EFFECTS = {
  // 吃到 Blob 時
  eat_blob: {
    screenShake: { intensity: 3, duration: 200 },        // 只有吃大 Blob 時
    particles: {
      count: 12,
      color: 'victim_color',
      speed: 100,
      lifetime: 500,
      shape: 'circle',
      size: { min: 2, max: 6 },
    },
    sound: 'eat_pop',
  },

  // 被淘汰時
  eliminated: {
    particles: {
      count: 24,
      color: 'self_color',
      speed: 200,
      lifetime: 800,
      shape: 'circle',
    },
    flash: { color: 'white', duration: 100 },
    sound: 'eliminated_burst',
  },

  // 分裂時
  split: {
    speedLines: { count: 6, length: 30, duration: 300 },
    sound: 'split_whoosh',
  },

  // 撿到道具時
  power_up: {
    ring: { color: 'power_up_color', radius: 40, duration: 500, expanding: true },
    sound: 'power_up_collect',
  },

  // 黃金食物
  golden_pellet: {
    glow: { radius: 16, pulse: { min: 12, max: 20, period: 2000 } },
    sparkles: { count: 3, lifetime: 1000 },
  },
};
```

### 12.4 鏡頭系統

```typescript
class Camera {
  x: number = 0;
  y: number = 0;
  zoom: number = 1;
  targetZoom: number = 1;

  update(playerBlob: Blob, dt: number): void {
    // 位置跟隨（帶延遲）
    const followSpeed = 0.08;
    this.x = lerp(this.x, playerBlob.x, followSpeed);
    this.y = lerp(this.y, playerBlob.y, followSpeed);

    // 縮放隨質量調整
    // 質量 10 → zoom 1.5（近景）
    // 質量 100 → zoom 0.8（中景）
    // 質量 500 → zoom 0.4（遠景）
    this.targetZoom = clamp(
      1.5 / Math.pow(playerBlob.mass / 10, 0.35),
      MIN_ZOOM,    // 0.3
      MAX_ZOOM     // 1.8
    );

    // 平滑縮放
    this.zoom = lerp(this.zoom, this.targetZoom, 0.05);
  }
}
```

---

## 13. 測試策略

### 13.1 單元測試

```typescript
// 測試覆蓋重點：
// 1. 物理引擎
describe('Physics', () => {
  test('吃的判定：大 Blob 可以吃小 Blob', () => {});
  test('吃的判定：質量差距不夠時不能吃', () => {});
  test('吃的判定：重疊不夠時不能吃', () => {});
  test('分裂：質量不夠時不能分裂', () => {});
  test('分裂：冷卻中不能分裂', () => {});
  test('分裂：碎片會自動合併', () => {});
  test('碰撞偵測：空間雜湊正確回傳鄰近實體', () => {});
  test('移動：速度隨質量遞減', () => {});
  test('邊界：Blob 不會超出地圖', () => {});
});

// 2. 輪次管理
describe('RoundManager', () => {
  test('第一輪淘汰最小 40%', () => {});
  test('第二輪淘汰剩餘的 50%', () => {});
  test('第三輪最後存活者勝', () => {});
  test('輪次過渡正確觸發', () => {});
  test('安全區正確縮小', () => {});
  test('質量衰減正確套用', () => {});
});

// 3. AI 行為
describe('AI', () => {
  test('攻擊者會追殺較小目標', () => {});
  test('生存者會逃離威脅', () => {});
  test('機會主義者會等待打架結果', () => {});
  test('AI 反應延遲有效', () => {});
  test('AI 輸入雜訊在合理範圍', () => {});
});
```

### 13.2 整合測試

```typescript
// 模擬完整比賽流程
describe('Full Match Integration', () => {
  test('30 個玩家的完整 3 輪比賽', async () => {
    const room = createTestRoom(5, 25); // 5 人類 + 25 AI
    await room.simulate(90); // 模擬 90 秒
    expect(room.state).toBe('finished');
    expect(room.getWinner()).toBeDefined();
    expect(room.getAllPlayers().filter(p => p.isAlive)).toHaveLength(1);
  });
});
```

### 13.3 效能測試

```
目標：
- 30 個 Blob + 200 個食物：伺服器 tick < 10ms
- 客戶端渲染 60 FPS（中階裝置）
- WebSocket 延遲 < 50ms（同區域）
- 記憶體使用 < 200MB（伺服器端每房間）
```

---

## 14. 部署與基礎設施

### 14.1 Docker Compose（開發環境）

```yaml
version: '3.8'
services:
  client:
    build: ./packages/client
    ports:
      - "3000:3000"
    volumes:
      - ./packages/client/src:/app/src
      - ./packages/shared/src:/shared/src

  server:
    build: ./packages/server
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgresql://blobverse:password@db:5432/blobverse
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./packages/server/src:/app/src
      - ./packages/shared/src:/shared/src
    depends_on:
      - db
      - redis

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: blobverse
      POSTGRES_USER: blobverse
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

### 14.2 生產環境架構

```
                    [CDN - CloudFlare]
                          │
                    [Load Balancer]
                    ╱            ╲
          [Game Server 1]   [Game Server 2]  ...  (auto-scale)
                │                │
          [Redis Cluster]   [PostgreSQL]
          (遊戲狀態快取)    (持久化資料)
```

**關鍵指標**:
- 每台 Game Server 可承載約 20 個房間（600 個 Blob）
- 自動擴展規則：CPU > 70% 或 房間數 > 15 時新增實例
- 區域部署：亞洲、北美、歐洲（降低延遲）

---

## 15. 開發順序與里程碑

### Phase 1：核心引擎（第 1-2 週）

```
✅ 完成標準：可在瀏覽器中移動 Blob、吃食物、吃其他 Blob、分裂
- [ ] 設置 monorepo（pnpm workspace）
- [ ] shared 套件：型別定義 + 常數配置
- [ ] PixiJS 渲染器：背景格線、Blob 精靈（含表情）、食物精靈
- [ ] 輸入系統：滑鼠/觸控跟隨
- [ ] 物理引擎：移動、碰撞偵測（空間雜湊）、吞噬、分裂
- [ ] 本地 AI Bot（簡單追食物）
- [ ] 鏡頭系統：跟隨 + 縮放
```

### Phase 2：三輪制 + 特效（第 3-4 週）

```
✅ 完成標準：可玩完整 3 輪比賽，有障礙物和道具
- [ ] RoundManager 狀態機
- [ ] 第二輪：安全區縮小、障礙物、道具系統
- [ ] 第三輪：質量衰減、極小競技場
- [ ] 輪次過渡動畫
- [ ] 淘汰動畫（粒子爆破）
- [ ] 螢幕震動、速度線等特效
- [ ] 音效系統
```

### Phase 3：AI 行為（第 5-6 週）

```
✅ 完成標準：5 種 AI 人格可正常運作，行為自然
- [ ] 行為樹框架
- [ ] 5 種人格實作
- [ ] 反偵測系統（延遲、雜訊、犯錯）
- [ ] 難度縮放
- [ ] AI 在三輪中的策略差異
```

### Phase 4：UI / HUD（第 7-8 週）

```
✅ 完成標準：所有 HUD 元素到位，賽後畫面完整
- [ ] 排行榜（即時更新 + 排名動畫）
- [ ] 小地圖
- [ ] 回合計時器 + 輪次指示器
- [ ] 擊殺通知
- [ ] 質量顯示
- [ ] 賽後畫面 + AI 揭曉
- [ ] 大廳 / 配對畫面
- [ ] 行動裝置 UI 適配
```

### Phase 5：多人連線（第 9-12 週）

```
✅ 完成標準：多人可在同一房間即時對戰
- [ ] WebSocket 伺服器
- [ ] 訊息協議實作
- [ ] 伺服器授權物理
- [ ] 客戶端預測 + 校正
- [ ] 實體插值
- [ ] 房間管理 + 配對系統
- [ ] 觀戰模式 + 觀眾投食
- [ ] 斷線重連
```

### Phase 6：進度 + 上線（第 13-16 週）

```
✅ 完成標準：可公開上線，有基本進度系統
- [ ] 資料庫建表
- [ ] 經驗值 / 等級系統
- [ ] 偵測分數系統
- [ ] 基本裝飾系統
- [ ] Docker 部署
- [ ] 效能優化 + 壓力測試
- [ ] 軟上線 + 數據收集
```

---

## 附錄 A：常用工具函式

```typescript
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function normalize(x: number, y: number): { x: number; y: number } {
  const len = Math.sqrt(x * x + y * y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
```

---

## 附錄 B：Claude Code 開發指引

### 開發時請注意：

1. **先建 shared 套件**：所有型別和常數都從 shared 引入，確保前後端一致
2. **先做單機版**：Phase 1-4 完全不需要伺服器，在瀏覽器中用本地 AI Bot 測試
3. **物理引擎是核心**：花時間確保碰撞和吞噬手感正確，這是整個遊戲的基礎
4. **AI 要自然**：寧可讓 AI 弱一點也不要讓它看起來像機器人
5. **效能很重要**：30 個 Blob + 200 食物的場景必須保持 60 FPS
6. **行動裝置**：從一開始就考慮觸控輸入和小螢幕 UI
7. **常數可調**：所有遊戲數值都在 constants.ts，方便後期平衡調整

### 程式碼風格：

- TypeScript strict mode
- ESLint + Prettier
- 函式優先（純函式 > 類別方法）
- 事件驅動架構（遊戲事件用 EventEmitter）
- 有意義的命名，不要縮寫

---

*文件結束。祝開發順利！🎮*
