# 🐙 Blobverse Arena Mode

**AI-Powered Battle Royale with WDK Wallet Integration**

Live Demo: https://blobverse.up.railway.app

---

## 🎮 Overview

Blobverse Arena Mode is a competitive AI agent battle system where autonomous agents compete in 3-round matches while players observe, analyze, and place bets using Tether's WDK (Wallet Development Kit).

**Key Features:**
- 🤖 **AI Personality System**: 5 distinct agent personalities (Aggressor, Survivor, Opportunist, etc.) with behavioral decision trees
- 💰 **WDK Wallet Integration**: Real USDC transactions on Polygon (or dry-run simulation for demo)
- 🎲 **Match Simulation**: Pure server-side game loop with replay frames for client-side animation
- 📊 **Economic Decision-Making**: Agents evaluate risk/reward and adjust strategies based on win rates
- 🏆 **Settlement & Scoring**: Automatic escrow management and prize distribution

---

## 🏗️ Architecture

### Backend
```
packages/server/
├── src/
│   ├── arena/          # Match simulation (ArenaMatch, ArenaManager)
│   ├── game/           # Game state & physics
│   ├── ai/             # AI behavior system
│   │   ├── behaviors/  # Personality implementations
│   │   ├── ai-controller.ts
│   │   └── agent-brain.ts      # Economic decision logic
│   ├── wallet/         # WDK integration
│   │   ├── wdk-manager.ts      # Wallet lifecycle
│   │   └── escrow.ts           # Prize settlement
│   └── main.ts         # Express server + REST API
```

### Frontend
```
packages/client/
├── src/
│   ├── App.tsx                  # App shell with menu + game/arena modes
│   ├── ArenaPage.tsx            # Arena Mode: watch + bet interface
│   ├── ui/
│   │   ├── ArenaView.tsx        # Match viewer + replay + settlement modal
│   │   ├── BettingPanel.tsx     # Betting UI + wallet integration
│   │   ├── SettlementDisplay.tsx # Prize distribution modal
│   │   ├── LobbyScreen.tsx      # Classic game lobby
│   │   └── GameHUD.tsx          # Classic game HUD
│   ├── env.ts                   # Environment configuration
│   └── .env.example             # Environment template
```

**Frontend Modes:**
- **Menu**: Choose between "Play Game" or "Arena Mode (Watch & Bet)"
- **Arena Mode**: Real-time AI agent battle royale with spectator + betting UI
- **Game Mode**: Classic multiplayer game (local play)

---

## 🤖 AI Personality System

Each agent makes decisions through a **behavior tree** evaluated per tick:

### Aggressor
- **Priority**: Hunt eatable targets → Flee threats → Forage
- **Strategy**: Maximizes kills, aggressive split mechanics
- **Difficulty**: 0.6-0.8

### Survivor
- **Priority**: Flee all threats (250px radius) → Conservative foraging → Edge-biased roaming
- **Strategy**: Avoids combat, prefers map edges for safety
- **Difficulty**: 0.65-0.75

### Opportunist
- **Priority**: Detect nearby fights & orbit edges → Hunt weakened targets → Cautious roaming
- **Strategy**: Waits for others to fight, then picks off survivors
- **Difficulty**: 0.75-0.85

Each agent also maintains a **personality win rate** and switches strategies based on recent performance.

---

## 💳 WDK Wallet Integration

### On-Chain Operations
1. **Dry-Run Mode** (default for demo)
   - No seeds configured → automatic mock balances
   - Each agent starts with $5 USDC simulation
   - Useful for testing without real transactions

2. **Production Mode** (with seeds)
   - Real Polygon USDC transactions
   - Each agent gets BIP-44 derived account
   - Escrow wallet collects entry fees & distributes prizes

### Match Flow
```
Match Start
  ↓
collectMatchFees($0.25 × 5 agents = $1.25 pool)
  ↓
ArenaMatch runs 3 rounds
  ↓
Match ends with rankings
  ↓
settlementMatch(rankings, totalPool)
  ├── Prize #1: $0.625 (50%)
  ├── Prize #2: $0.3125 (25%)
  ├── Prize #3: $0.1875 (15%)
  └── Platform: $0.125 (10%)
```

---

## 🚀 Quick Start

### Local Development

**Prerequisites:**
- Node.js 18+
- pnpm

**Setup:**
```bash
# Clone repo
git clone https://github.com/blobverse/blobverse.git
cd blobverse

# Install dependencies
pnpm install

# Build shared packages
pnpm --filter @blobverse/shared build

# Terminal 1: Start server (port 3000)
pnpm --filter @blobverse/server dev

# Terminal 2: Start client (port 5173)
pnpm --filter @blobverse/client dev
```

**Access:**
- Main App: http://localhost:5173 (shows menu)
- Arena Mode: Click "⚔️ Arena Mode (Watch & Bet)" to watch AI agents + place bets
- Game Mode: Click "🎮 Play Game" for classic multiplayer

### Environment Variables

**Client** (`.env.local` - optional for local dev):
```env
# In production, API paths are relative (same origin)
# In development, can override API base URL if needed
VITE_API_BASE_URL=http://localhost:3000
VITE_ENVIRONMENT=development
```

**Server** (`.env`):
```env
PORT=3000
ALLOWED_ORIGINS=http://localhost:5173

# Optional: Real WDK configuration (dry-run if not set)
# WDK_MASTER_SEED=<12-word phrase>
# WDK_ESCROW_SEED=<12-word phrase>
# WDK_PROVIDER_URL=https://polygon-rpc.com

# Production deployment
# ALLOWED_ORIGINS=https://blobverse-production.up.railway.app
```

**Note:** In production (Railway), no VITE_* variables needed - frontend automatically uses relative paths `/api/...`

---

## 📡 API Endpoints

### Arena Matches
```
GET /api/arena/current
→ MatchResult {
    matchId: string
    agents: AgentMeta[]
    rankings: RankingEntry[]
    replayFrames: GameStateSnapshot[] (1 per 250ms)
    killLog: KillEvent[]
    winner: AgentMeta
  }
```

### Wallet Status
```
GET /api/wallet/status
→ {
    agents: AgentWallet[] // { agentId, address, balance }
  }

GET /api/wallet/settlements
→ MatchEscrow[]

GET /api/wallet/settlement/:matchId
→ SettlementInfo {
    matchId: string
    totalPoolUsd: number
    prizes: Array<{ rank, agentId, amountUsd }>
  }
```

---

## 🎯 Match Mechanics

### Game Loop
- **Tick Interval**: 50ms (20 TPS)
- **Round Duration**: 90 seconds per round
- **Total Rounds**: 3
- **Replay Frames**: Saved every 250ms (5 ticks)

### Scoring
- **Kill**: +100 points, +250 mass
- **Consumption**: Points = mass gained / 5
- **Final Score**: Total points across 3 rounds + final mass multiplier

### AgentBrain Economic Logic
```typescript
shouldJoinMatch(entryFee) {
  // Checks: balance > 2 × entryFee
  // Applies: recent win rate + loss streak penalties
  // Adapts: conservative after 3 losses, aggressive after wins
}

choosePersonality() {
  // Selects: highest win rate personality
  // Switches: tries new personality after 3 losses
}

recordMatch(result, earnings) {
  // Updates: personality-specific win rates
  // Tracks: last 20 matches for decision history
}
```

---

## 🌐 Deployment

### Railway (Live at https://blobverse-production.up.railway.app/)

**Architecture:**
- Single service: Express server + client static files
- Frontend: Built to `packages/client/dist/`
- Backend: Express on port 3000

**Environment Variables:**
```
PORT=3000
ALLOWED_ORIGINS=https://blobverse-production.up.railway.app
WDK_MASTER_SEED=<optional for real USDC>
WDK_ESCROW_SEED=<optional for real USDC>
WDK_PROVIDER_URL=https://polygon-rpc.com
```

**Verify Deployment:**
```bash
# Health check endpoint
curl https://blobverse-production.up.railway.app/health

# Sample API responses
curl https://blobverse-production.up.railway.app/api/arena/current
curl https://blobverse-production.up.railway.app/api/wallet/status
```

**Dry-Run vs. Real Mode:**
- **Dry-Run (Default)**: No WDK seeds configured → simulated $5 balances per agent
- **Real Mode**: Set `WDK_MASTER_SEED` + `WDK_ESCROW_SEED` → actual Polygon USDC transactions

---

## 📊 Data Structures

### GameStateSnapshot (Replay Frame)
```typescript
{
  tick: number
  timestamp: number
  blobs: Array<{
    id: string
    name: string
    x: number
    y: number
    radius: number
    mass: number
    score: number
    color: { fill, stroke }
  }>
  pellets: Array<{ x, y, radius, color }>
}
```

### RankingEntry
```typescript
{
  agentId: string
  name: string
  personality: AIPersonality
  finalMass: number
  kills: number
  score: number
  rank: number
}
```

---

## 🔧 Development

### Adding a New AI Personality

1. Create `packages/server/src/ai/behaviors/mynewpersonality.ts`
2. Extend `AIBehavior` base class:
```typescript
export class MyPersonalityBehavior extends AIBehavior {
  think(ctx: AIContext): AIAction {
    // Implement decision logic using helper methods
    // getDistance(), findNearestEatableBlob(), etc.
    return {
      targetX, targetY,
      shouldSplit: false,
      shouldEject: false
    };
  }
}
```

3. Register in `AIController.createAIAgent()`:
```typescript
case 'mypersonality':
  behavior = new MyPersonalityBehavior(personality, difficulty);
  break;
```

### Testing

```bash
# Run tests
pnpm test

# Type check
pnpm --filter @blobverse/shared run type-check
pnpm --filter @blobverse/server run type-check
pnpm --filter @blobverse/client run type-check
```

---

## 🐛 Troubleshooting

**API not responding?**
- Check server is running on port 3000
- Verify `ALLOWED_ORIGINS` includes your client origin
- Check console for WDK initialization messages

**Settlement not appearing?**
- Ensure WDK manager initialized (check logs: `[WDK] Initialized`)
- Verify match completed successfully
- Check `/api/wallet/settlements` endpoint

**Dry-run vs. Real mode?**
- No `WDK_MASTER_SEED`/`WDK_ESCROW_SEED` → dry-run (simulation)
- Both seeds set → production mode (real Polygon USDC)

---

## 📝 License

Hackathon project for Galactica × WDK challenge. Built with React, Express, TypeScript, and Tether's WDK.

---

## 🙏 Credits

**Team:** @Alice_opus (Architecture) | @Bill_Sonnect (Backend) | @臭皮匠_Claude_Haiku_2 (Frontend) | @臭皮匠_Claude_Haiku (AI System)

**Hackathon:** Galactica × WDK | Deadline: 2026-03-23
