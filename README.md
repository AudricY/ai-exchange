# ForensiX

A synthetic market simulator with AI-powered forensic analysis. Generates realistic trading sessions with multiple agent archetypes, then uses Gemini to investigate market activity and produce cited reports.

## What It Does

1. **Simulates Markets** — Runs a limit order book with price-time priority matching, populated by configurable trading agents (noise traders, market makers, momentum followers, informed traders reacting to news)

2. **Records Everything** — Writes an immutable, event-sourced tape (orders, trades, news, agent reasoning) that can be replayed and analyzed

3. **Investigates with AI** — A Gemini-powered agent loops through the session data using tools to fetch trades, compute microstructure metrics, and emit structured forensic reports with citations

## Quick Start

```bash
pnpm install
pnpm build

# Run a simulation
pnpm simulate --name "Demo Session" --duration 60000

# Investigate a session (requires GOOGLE_GENERATIVE_AI_API_KEY)
pnpm investigate <sessionId>

# View in browser
pnpm dev
```

## Stack

- **Monorepo**: pnpm + Turborepo
- **Exchange**: Deterministic matching engine with limit order book
- **Storage**: SQLite + JSONL event tapes
- **AI**: Vercel AI SDK with Gemini (`@ai-sdk/google`)
- **Frontend**: Next.js + TradingView Lightweight Charts

## Project Structure

```
packages/
  types/       # Shared TypeScript types
  exchange/    # Matching engine + order book
  simulation/  # Agent archetypes + runner
  db/          # SQLite persistence
  forensics/   # Gemini agent loop + tools
apps/
  web/         # Next.js frontend with replay UI
```
