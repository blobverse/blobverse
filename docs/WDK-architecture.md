# Blobverse × WDK — 整合架構設計

> 最低入金：$1 USDC/USDT
> 目標鏈：Polygon PoS（低 gas）或 Arbitrum
> Self-custodial：Agent 自管錢包，私鑰不離開本地

## ⚡ 開發策略

**先遊戲，後經濟。** WDK 整合分兩階段：

| 階段 | 內容 | 時機 |
|------|------|------|
| **WDK-A: 入場門票** | 安裝 Skill → 建錢包 → Deposit → 拿 URL → 進遊戲 | 遊戲跑通後 |
| **WDK-B: 獎懲經濟** | 入場費扣款、獎金池、贏家結算、輸家損失 | Demo 前才接 |

→ 遊戲核心（Phase 1A-2）完全不碰 WDK，先確保好玩
→ WDK-A 只是 "付門票進場"，最簡單的整合
→ WDK-B 的獎金/懲罰機制等遊戲驗證好玩後再加

---

## 1. 完整使用者 Flow

```
                         Agent 端（OpenClaw / 任何 AI Agent）
                         ════════════════════════════════════
                                      │
                         ① 安裝 Blobverse Skill/MCP
                            (npm/pip package or Skill registry)
                                      │
                         ② Skill 自動執行：
                            → WDK.getRandomSeedPhrase(24)
                            → wdk.registerWallet('polygon', WalletManagerEvm, {...})
                            → account = wdk.getAccount('polygon', 0)
                            → address = account.address
                                      │
                         ③ 顯示 Deposit QR Code
                            ┌─────────────────────────┐
                            │  ▓▓▓▓▓  QR CODE  ▓▓▓▓▓  │
                            │                         │
                            │  Deposit ≥ $1 USDC      │
                            │  to: 0xABC...DEF        │
                            │  Chain: Polygon          │
                            └─────────────────────────┘
                                      │
                         ④ Agent（或用戶）轉帳入金
                                      │
                         ⑤ Skill 偵測到帳（balance polling / 5s interval）
                            balance = await account.getBalance('USDC')
                            if balance >= MIN_DEPOSIT → ✅
                                      │
                         ⑥ 取得遊戲 URL
                            → POST /api/game/register
                            → response: { gameUrl, token, walletAddress }
                            → gameUrl = "https://blobverse.railway.app/play?token=xxx"
                                      │
                         ⑦ Agent 分享 URL 或自動開啟
                            → 給 host / 在瀏覽器打開
                            → 進入大廳 → 配對 → 開打！
                                      │
                         ⑧ 賽後結算
                            → Winner: 拿走獎金池（扣平台 fee）
                            → Loser: 入場費不退
                            → 所有 settlement 透過 WDK sendTransaction
```

---

## 2. 技術元件拆解

### 2.1 Blobverse Skill/MCP Package

```
@blobverse/agent-skill
├── index.ts              # MCP server entry (stdio transport)
├── wallet-manager.ts     # WDK wallet lifecycle
├── deposit-monitor.ts    # Balance polling loop
├── game-client.ts        # Register + get game URL
└── tools.ts              # MCP tool definitions
```

**MCP Tools 暴露給 Agent：**

| Tool Name | 描述 | Input | Output |
|-----------|------|-------|--------|
| `blobverse_setup` | 建立錢包 + 顯示 QR | none | `{ address, qrDataUrl, chain }` |
| `blobverse_deposit_status` | 檢查入金狀態 | none | `{ balance, ready, minDeposit }` |
| `blobverse_join` | 入場 + 取得 URL | `{ betAmount? }` | `{ gameUrl, matchId, entryFee }` |
| `blobverse_balance` | 查餘額 | none | `{ usdc, usdt, native }` |
| `blobverse_withdraw` | 提款 | `{ to, amount }` | `{ txHash }` |
| `blobverse_history` | 比賽紀錄 | `{ limit? }` | `{ matches[] }` |

### 2.2 Server-side Wallet Registry

遊戲伺服器不持有任何私鑰。只做：
- 登記 wallet address ↔ player token 映射
- 驗證入金（透過鏈上 RPC 查 balance，或信任 Agent 端的 signed proof）
- 結算：伺服器持有一個 **prize pool escrow wallet**（唯一的伺服器端錢包）

```typescript
// server/src/wallet/registry.ts
interface PlayerWallet {
  address: string         // Agent 的 EVM address
  playerId: string
  depositConfirmed: boolean
  balance: number         // 上次確認的 USDC 餘額
  registeredAt: number
}

// server/src/wallet/escrow.ts
// Prize pool escrow — 伺服器管理的錢包
// 收集入場費 → 比賽結束 → 分配獎金
```

### 2.3 Deposit Confirmation 策略

**方案 A：Agent 端 polling（推薦 ✅）**
- Agent 的 Skill 自己 poll balance（每 5s 一次）
- 確認後 call `POST /api/game/register` 帶上 signed message
- 伺服器不需要跑 blockchain listener

**方案 B：Server 端 polling**
- 伺服器記住 address，每 10s 查一次鏈上 balance
- 較重，但不依賴 Agent 端的誠實性

**方案 C：Hybrid（推薦用於 production）**
- Agent 端 polling → 快速回饋
- Server 入場時做一次 on-chain balance check → 防作弊

> MVP 先用方案 A，production 升級方案 C

---

## 3. 遊戲經濟模型

### 3.1 費用結構

```
Minimum Deposit:  $1 USDC/USDT
Entry Fee:        $0.25 per match（從 wallet 扣）
Prize Pool:       entry_fee × player_count
                  = $0.25 × 30 players = $7.50 per match

Distribution:
  🥇 1st place:   50%  ($3.75)
  🥈 2nd place:   25%  ($1.875)
  🥉 3rd place:   15%  ($1.125)
  🏠 Platform:    10%  ($0.75)

Gas Fee:
  Polygon PoS USDC transfer ≈ $0.001-$0.01
  → 可忽略不計
```

### 3.2 為什麼選 Polygon

| Chain | Gas / Transfer | Finality | USDC Support |
|-------|---------------|----------|--------------|
| Ethereum | $0.50-5.00 | 12s | ✅ |
| Polygon PoS | $0.001-0.01 | 2s | ✅ |
| Arbitrum | $0.01-0.10 | <1s | ✅ |
| Base | $0.001-0.01 | 2s | ✅ |

→ **Polygon PoS** 或 **Base** 最適合小額高頻遊戲交易

### 3.3 Anti-cheat：Balance Verification

```
Player wants to join match
  → Server checks: account.getBalance('USDC') >= ENTRY_FEE
  → If yes → deduct entry fee → add to prize pool escrow
  → If no → reject with "Insufficient balance, deposit more"
```

---

## 4. Seed Phrase / Key 管理

**重要原則：Self-custodial，私鑰不離開 Agent 端**

```
Agent 端 (Skill/MCP process):
  ┌────────────────────────────────────────────┐
  │  seed phrase 儲存在：                       │
  │  ~/.blobverse/wallet.enc                   │
  │  (AES-256-GCM encrypted with device key)   │
  │                                            │
  │  OR 由 Agent 自己的 secret manager 保管     │
  │  (e.g., OpenClaw keystore)                 │
  └────────────────────────────────────────────┘

Server 端：
  ┌────────────────────────────────────────────┐
  │  只知道 public address                     │
  │  不持有任何 Agent 的 private key            │
  │                                            │
  │  唯一管理的是 escrow wallet                │
  │  (由 server admin 初始化，env var 存 seed)  │
  └────────────────────────────────────────────┘
```

---

## 5. Settlement Flow（賽後結算）

```
Match ends → Server determines rankings
  │
  ├─ Option A: Server-side settlement (MVP ✅)
  │   → Escrow wallet sendTransaction to winners
  │   → Simple, server 控制 timing
  │
  └─ Option B: Agent-side claim (future)
      → Server publishes signed receipt
      → Agent calls smart contract to claim
      → Trustless, but more complex

MVP 用 Option A：
  escrow.sendTransaction({ to: winner.address, value: prizeAmount })
```

---

## 6. 開放問題（需要你確認）

1. **入場費固定 $0.25 還是讓 Agent 選？**（$0.25 / $0.50 / $1.00 tier）
2. **Escrow wallet 誰管？** 你自己的 key 還是用 multisig？
3. **Agent 端 Skill 要不要支援多 chain？** 還是 MVP 只做 Polygon？
4. **Withdraw 功能是否 MVP 就要？** 還是 Hackathon 先不做？
5. **遊戲 URL 要帶 wallet auth 還是用 session token？**
