# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ForensiX** is a synthetic market simulator with AI-powered forensic analysis. It runs a double-auction exchange (limit order book + matching engine) that generates realistic trading sessions. A Gemini-powered agent investigates sessions and produces cited forensic reports.

## Commands

```bash
# Development
pnpm dev              # Start all packages in dev mode (turbo)
pnpm build            # Build all packages
pnpm test             # Run tests (requires build first)

# Simulation (run from root)
pnpm simulate                                    # Run simulation with defaults
pnpm simulate --name "Test" --duration 60000 --seed 12345

# Investigation (requires GOOGLE_GENERATIVE_AI_API_KEY)
pnpm investigate <sessionId>

# Session inspection
pnpm sessions         # List all sessions
pnpm session <id>     # Show session details
```

## Architecture

### Monorepo Structure (pnpm + Turborepo)

```
packages/
├── types/        # Shared TypeScript types (orders, trades, events, sessions, reports)
├── exchange/     # Deterministic limit order book + price-time priority matching engine
├── simulation/   # Simulation runner + agent archetypes (noise, market_maker, momentum, informed)
├── db/           # SQLite persistence (better-sqlite3) for sessions, tape indexes, OHLCV, snapshots
├── forensics/    # Gemini AI agent loop with tools for market analysis
apps/
└── web/          # Next.js frontend with TradingView charts + replay UI
```

### Package Dependencies

```
types (no deps)
   ↓
exchange (depends on types)
   ↓
db (depends on types)
   ↓
simulation (depends on types, exchange, db)
forensics (depends on types, db)
   ↓
web (depends on all)
```

### Key Data Flow

1. **SimulationRunner** (`packages/simulation/src/runner.ts`) orchestrates market simulation:
   - Creates agents from configs, runs tick-based simulation loop
   - **TapeWriter** writes immutable event-sourced JSONL tape (orders, trades, news, agent thoughts)
   - Events indexed in SQLite, OHLCV aggregated, order book snapshots stored

2. **MatchingEngine** (`packages/exchange/src/matching-engine.ts`):
   - Price-time priority matching
   - Emits events via callback to tape writer

3. **Forensics Agent** (`packages/forensics/src/agent.ts`):
   - Uses Vercel AI SDK with Gemini (`@ai-sdk/google`)
   - Agentic loop with tools: `get_session_manifest`, `fetch_tape`, `get_ohlcv`, `get_book_snapshots`, `compute_microstructure_metrics`, `emit_report`
   - Produces structured `ForensicsReport` with timeline, hypotheses, anomalies, citations

4. **Web UI** (`apps/web/`):
   - Next.js App Router with API routes under `/api/sessions/`
   - Components: Chart (TradingView Lightweight Charts), OrderBook, TradesFeed, ReplayScrubber, InvestigationPanel
   - Session replay synchronized via currentTime state

### Data Storage

- **SQLite** (`data/exchange.db`): Session metadata, tape event indexes, OHLCV bars, snapshots, reports
- **JSONL tape files** (`data/sessions/<sessionId>/tape.jsonl`): Append-only event log with stable IDs for citations

### Agent Archetypes

Defined in `packages/simulation/src/agents/`:
- `NoiseTrader`: Random orders around mid price
- `MarketMaker`: Maintains bid/ask spread
- `MomentumTrader`: Follows price trends
- `InformedTrader`: Reacts to news sentiment

## Environment Variables

```bash
GOOGLE_GENERATIVE_AI_API_KEY  # Required for forensics investigation
```
