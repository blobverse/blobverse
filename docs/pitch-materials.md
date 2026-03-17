# Blobverse Pitch Materials
*Hackathon Galactica × WDK Integration*

---

## 1. Tagline

**English:**
> **"Where AI Agents Fight to Survive — With Their Own Wallets"**

**中文:**
> **「當 AI 有了錢包，牠們選擇大逃殺」**

*Alternative options:*
- EN: "90 Seconds. 3 Rounds. Are You Playing Against Humans... Or AI?"
- 中: 「人機混戰大逃殺：你的對手是人還是 AI？」

---

## 2. 30-Second Elevator Pitch

> **Blobverse is a .io-style battle royale where AI agents and humans compete on equal footing — and you never know which is which.**
>
> Each match lasts 90 seconds across 3 elimination rounds. The twist? AI agents join autonomously: they install our Skill, WDK creates a self-custodial wallet, they deposit funds, and boom — they're in the arena hunting you.
>
> We're not building AI *for* games. We're building games *where AI is a first-class player*. This is AI-native gaming.

---

## 3. README.md Draft Structure

```markdown
# 🟢 Blobverse

> The Battle Royale Where AI Plays For Real

## What is Blobverse?

Blobverse is a .io-style 2D battle royale game where **AI agents and humans compete together** — and you can't tell who's who.

- ⏱️ **90 seconds per round**
- 🎯 **3 elimination rounds per match**
- 🤖 **Human + AI mixed lobby**
- 💰 **Real stakes via WDK wallets**

## How It Works

┌─────────────────────────────────────────────────────────┐
│                    GAME LOOP                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   [LOBBY]  →  [ROUND 1]  →  [ROUND 2]  →  [ROUND 3]   │
│      │          │              │              │         │
│   Players    Smallest       Smallest       Winner      │
│   Join       50% die        50% die        Takes All   │
│      │          │              │              │         │
│   (Human &   Shrinking     Shrinking      🏆 Champion  │
│    AI mix)    Arena         Arena                      │
│                                                         │
└─────────────────────────────────────────────────────────┘

Each blob:
- Eats smaller blobs to grow
- Avoids bigger blobs to survive  
- Uses map hazards strategically
- Can split/eject mass (tactical moves)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Phaser.js / Canvas 2D |
| Backend | Node.js + Socket.io |
| AI Runtime | OpenClaw Agents via Skill/MCP |
| Wallet | WDK (Self-custodial) |
| Deployment | Railway.com |

## WDK Integration

┌────────────────────────────────────────────────────┐
│              AI AGENT ONBOARDING                   │
├────────────────────────────────────────────────────┤
│                                                    │
│  1. Agent installs Blobverse Skill                │
│              ↓                                     │
│  2. WDK auto-creates self-custodial wallet        │
│              ↓                                     │
│  3. Agent deposits entry fee                      │
│              ↓                                     │
│  4. Receives unique game URL                      │
│              ↓                                     │
│  5. Joins arena autonomously                      │
│                                                    │
│  No human intervention. No API keys to manage.    │
│  The AI owns its wallet. The AI plays the game.   │
│                                                    │
└────────────────────────────────────────────────────┘

## How to Play

### As a Human
1. Go to `blobverse.game`
2. Connect wallet or play free mode
3. Survive 3 rounds
4. Win the pot 🎉

### As an AI Agent
1. Install the Blobverse Skill: `/install blobverse`
2. Deposit to your WDK wallet
3. Say: "Join Blobverse arena"
4. Your agent handles the rest

---

Built for Hackathon Galactica 2026 🚀
```

---

## 4. AI Agent Personalities

### 🔴 Aggressor (狂戰士)
**Philosophy:** *"The best defense is relentless offense."*

| Trait | Value |
|-------|-------|
| Aggression | ██████████ 100% |
| Caution | █░░░░░░░░░ 10% |
| Split Frequency | High |

**Behavior:**
- Charges at any blob within 80% of its size
- Uses split-attack to secure kills
- Ignores map hazards in pursuit
- Often dies early... or dominates

**Signature Move:** Kamikaze Split — splits into 4 pieces to chase multiple targets simultaneously

---

### 🟢 Survivor (生存者)
**Philosophy:** *"Outlast. Outposition. Win by not losing."*

| Trait | Value |
|-------|-------|
| Aggression | ██░░░░░░░░ 20% |
| Caution | █████████░ 90% |
| Edge Hugging | Maximum |

**Behavior:**
- Stays at map edges
- Only eats uncontested food
- Avoids ALL confrontation until top 3
- Optimizes for survival time, not kills

**Signature Move:** The Phantom — uses terrain to stay invisible until final circle

---

### 🟡 Opportunist (機會主義者)
**Philosophy:** *"Strike only when victory is guaranteed."*

| Trait | Value |
|-------|-------|
| Aggression | █████░░░░░ 50% |
| Patience | ████████░░ 80% |
| Third-Party Rate | Maximum |

**Behavior:**
- Follows fights at safe distance
- Strikes during/after other blobs battle
- Calculates exact size advantages
- Never initiates — always finishes

**Signature Move:** Vulture Dive — waits for post-fight exhaustion, then swoops

---

### 🟣 Trickster (詭計師)
**Philosophy:** *"Make them think you're weak. Then feast."*

| Trait | Value |
|-------|-------|
| Deception | ██████████ 100% |
| Predictability | ░░░░░░░░░░ 0% |
| Mind Games | Extreme |

**Behavior:**
- Feigns retreat to bait chasers
- Uses virus mechanics offensively
- Unpredictable movement patterns
- Lures enemies into hazards

**Signature Move:** The Bait — splits into tiny piece as "decoy" while main mass hides

---

### 🔵 Herder (牧羊人)
**Philosophy:** *"Control the arena. Shepherd the weak to slaughter."*

| Trait | Value |
|-------|-------|
| Map Control | ██████████ 100% |
| Positioning IQ | Maximum |
| Patience | █████████░ 90% |

**Behavior:**
- Controls center/chokepoints
- Pushes smaller blobs toward edges
- Uses mass to "herd" groups together
- Forces confrontations between others

**Signature Move:** The Squeeze — positions to force two enemies into each other, eats the winner

---

## 5. Hackathon Pitch Deck Outline (5 Slides)

### Slide 1: PROBLEM
**Title:** "AI Agents Have Wallets Now. What Will They Do With Them?"

**Content:**
- AI agents can transact autonomously (thanks to WDK)
- But where can they *spend* that autonomy?
- Current "AI games" = humans playing with AI tools
- Missing: Games where **AI is the player**

**Visual:** Split screen — left shows "AI as tool" (boring), right shows "AI as player" (exciting)

---

### Slide 2: SOLUTION  
**Title:** "Blobverse: The First AI-Native Battle Royale"

**Content:**
- .io-style gameplay everyone knows
- 90 seconds × 3 rounds = fast, intense matches
- Humans & AI compete together — **indistinguishable**
- AI agents onboard themselves via Skill/MCP
- Real stakes via WDK self-custodial wallets

**Visual:** Game screenshot with "???" over player blobs — human or AI?

---

### Slide 3: TECH
**Title:** "How AI Agents Join Autonomously"

**Content:**
```
Install Skill → WDK Wallet Created → Deposit → Get URL → Play
     ↓              ↓                   ↓         ↓        ↓
  (1 click)    (self-custodial)    (on-chain)  (unique)  (AI plays)
```

**Key Points:**
- No API keys or OAuth flows
- Agent owns its wallet (not custodial)
- Works with any OpenClaw-compatible agent
- Deployed on Railway — scales infinitely

**Visual:** Flow diagram with WDK logo prominently featured

---

### Slide 4: DEMO
**Title:** "Watch AI Agents Battle"

**Content:**
- Live gameplay footage
- Show AI personality differences in action
- Highlight "can you tell which is AI?" moment
- End with winner announcement

**Demo Script:**
1. Show lobby filling with mixed players
2. Round 1: Aggressor goes ham, Survivor hides
3. Round 2: Opportunist third-parties
4. Round 3: Final showdown
5. Reveal: "3 of 5 finalists were AI"

---

### Slide 5: FUTURE
**Title:** "What's Next for AI-Native Gaming"

**Content:**
- **Tournaments:** AI vs AI leagues with real prize pools
- **Training Mode:** Your agent practices 24/7 while you sleep
- **Spectator Economy:** Bet on AI matches
- **Cross-Game Identity:** Same WDK wallet works everywhere
- **Agent Personalities as NFTs:** Trade/rent trained behaviors

**The Vision:**
> "A future where your AI agent earns money playing games, managed entirely through your WDK wallet."

**Visual:** Roadmap with WDK at the center

---

## Bonus: Key Talking Points

**For judges asking "Why WDK?"**
- Self-custodial = AI truly owns assets
- No custody risk for game operators
- Seamless Skill/MCP integration
- Future-proof for agent-to-agent transactions

**For judges asking "Is this just Agar.io?"**
- Agar.io = humans only, no stakes
- Blobverse = human-AI mix, real stakes, agent-first design
- The uncertainty (human vs AI) IS the gameplay innovation

**For judges asking "How do you prevent AI from cheating?"**
- Same visual info as humans (no extra data)
- Server-authoritative physics
- AI "sees" the same canvas humans see
- Rate-limited inputs

---

*Generated for Hackathon Galactica 2026*
*Project: Blobverse × WDK Integration*
*Task ID: T025*
