# Blobverse — Claude Code Development Guide

## Project Overview

Browser-based 2D top-down .io battle royale game. Humans vs AI agents, 90 seconds per match, 3 elimination rounds.

## Monorepo Structure

```
blobverse/
├── packages/
│   ├── shared/    → Types, constants, physics, protocol (both client & server import this)
│   ├── client/    → PixiJS v8 + React 18 + Vite (port 5174)
│   └── server/    → Node.js + ws game server (port 3200)
├── docs/          → Dev handbook, WDK notes, pitch materials
└── CLAUDE.md      → This file
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Rendering | PixiJS v8 (WebGL Canvas) |
| UI Overlay | React 18 + Tailwind CSS |
| Frontend Build | Vite + TypeScript |
| Game Server | Node.js + ws (WebSocket) |
| Shared Code | `@blobverse/shared` workspace package |
| Deployment | Railway.com |

## Key Design Decisions

- **Server-authoritative**: Server runs game loop at 20 TPS, clients predict + interpolate
- **Shared package**: Types, physics, constants, protocol all in `packages/shared/`
- **Mass-based speed**: `BASE_SPEED / Math.pow(mass, 0.43)` — bigger = slower
- **Eating requires**: 1.25x mass ratio + 60% overlap
- **3-round elimination**: R1 (3000×3000, 40% cull) → R2 (2000×2000, hazards, 50% cull) → R3 (800×800, last standing)

## Development Commands

```bash
npm install              # Install all workspace dependencies
npm run dev:client       # Start client dev server (port 5174)
npm run dev:server       # Start game server (port 3200)
npm run dev              # Start both
npm run build            # Build all packages
npm run typecheck        # TypeScript check all packages
npm run test             # Run vitest (when configured)
```

## Critical Files

- `packages/shared/src/constants.ts` — All game balance numbers (DO NOT change without understanding impact)
- `packages/shared/src/types.ts` — Core interfaces: Blob, Pellet, RoundConfig, GameState
- `packages/shared/src/physics.ts` — Pure functions: calculateRadius, checkEating, lerp, clamp, distance
- `packages/shared/src/protocol.ts` — WebSocket message types (ClientMessage, ServerMessage)
- `packages/client/src/game/Game.ts` — Client game loop, player movement
- `packages/client/src/entities/BlobSprite.ts` — Blob visual rendering (glow, eyes, expressions)
- `docs/Blobverse_開發手冊_v1.md` — Full spec (MUST READ before making game logic changes)

## Coding Conventions

- TypeScript strict mode
- Use `@blobverse/shared` imports — never duplicate physics/constants locally
- Pure functions for physics (no side effects, easy to test)
- Game entities as PixiJS Container subclasses
- Factory pattern for async init: `static async create(): Promise<T>`

## Game Constants Reference (from shared/constants.ts)

| Constant | Value | Note |
|----------|-------|------|
| WORLD_WIDTH/HEIGHT | 3000 | R1 map size |
| SERVER_TPS | 20 | Server tick rate |
| BASE_SPEED | 200 | px/s at mass=1 |
| INITIAL_MASS | 10 | Starting mass |
| EATING_MASS_RATIO | 1.25 | Must be 25% bigger to eat |
| MASS_ABSORPTION_RATIO | 0.8 | Gain 80% of eaten mass |
| MIN_SPLIT_MASS | 40 | Can't split below this |

## Nexus Dashboard Project

This project is tracked at: `http://localhost:5173/projects/Hackathon-Galactica-WDK`
Tasks follow format T001-T025, milestones M001-M007.

## WDK Integration (Phase 5 — after game works)

Tether WDK wallet integration comes AFTER the game is fun and playable.
- Phase WDK-A: Wallet + deposit + game entry gate
- Phase WDK-B: Prize pool + settlement (deferred)
- See `docs/WDK-architecture.md` for full design
