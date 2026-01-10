## Everything doc: Market Black Box Agent (Tier 2, Track 1)

### What you’re building

A **double-auction mini exchange** (limit order book + matching engine) that generates a full “market session” with **messy, real-world-like information streams** (order flow, trades, news, rumors/chat, long research docs, agent rationales).
**Gemini runs in an agentic loop** to ingest the whole session (huge context) and produce a **cited forensics report**: what happened, hypotheses, evidence tests, causal chain, and final timeline.

### Why it cleanly fits Track 1

It is a **high-fidelity fact extraction + reasoning engine** over large, messy, multi-channel data. The “product” is the **market replay + explanation with evidence**, not “an LLM trading bot.”

---

## Definitive tech stack (high level)

### App framework

* **Next.js (TypeScript) + Vercel**
* **Vercel AI SDK Agents** for the tool-calling loop (`stopWhen`, `prepareStep`) ([Vercel][1])

### Model provider

* **Gemini via AI SDK Google provider** (`@ai-sdk/google`) ([AI SDK][2])

### UI

* Trading-style replay UI:

  * price/volume chart (TradingView Lightweight Charts)
  * order book depth + recent trades
  * replay scrubber + “investigation” panel (hypotheses, evidence links)

### Backend services (can be one codebase, logically separated)

1. **Exchange Engine**

   * deterministic limit order book
   * matching engine (price-time priority)
2. **Simulation Runner**

   * agent archetypes generate orders
   * inject news, rumors, and documents over time
   * seeded RNG for reproducibility
3. **Forensics Agent Service**

   * runs the **Gemini agent loop**
   * calls tools to fetch tape slices and compute metrics
   * outputs structured report + citations

### Data architecture (this is the backbone)

* **Immutable event-sourced tape** (append-only), with stable IDs for citations:

  * orders, cancels, trades, snapshots
  * news posts, chat messages
  * doc ingests and agent “thoughts”
* **Postgres** for session metadata + indexes + aggregates (OHLCV, snapshots pointers)
* **Tape stored as JSONL** (file/object storage) referenced by session id
* **Doc store**: long docs chunked into `doc_id + chunk_id` for stable citations

---

## Gemini agentic loop (how it works)

Gemini runs as a **forensics investigator**, not a trader.

**Loop steps**

1. **Observe**: fetch session manifest, recent tape slices, key aggregates
2. **Hypothesize**: propose a small set of candidate explanations (liquidity shock, rumor cascade, momentum feedback, manipulation-like patterns)
3. **Test via tools**: request precise evidence windows and compute microstructure stats
4. **Update beliefs**: keep only hypotheses supported by evidence
5. **Emit artifacts**: timeline, causal chain, anomaly flags, who influenced whom, all with citations

**Loop controls**

* `stopWhen`: stop on confidence threshold or no new evidence ([Vercel][1])
* `prepareStep`: vary context packing and tool availability per step (triage vs final synthesis) ([Vercel][1])

**Core tools exposed to the agent**

* `get_session_manifest(sessionId)`
* `fetch_tape(window)` / `fetch_by_event_id(range)`
* `get_book_snapshots(window)` / `get_ohlcv(resolution)`
* `compute_microstructure_metrics(window)` (spread, depth, imbalance, volatility bursts)
* `search_docs(query)` + `fetch_doc_chunks(doc_id, chunk_ids)`
* `emit_report(structured_output)` (store final artifacts)

---

## “Credit-expensive” in a way that looks intentional

* Many-step loop (6 to 12 steps) focused on **evidence gathering and verification**
* Large-context final synthesis step that ingests:

  * the key tape windows found during the loop
  * doc chunks actually cited
  * aggregates and snapshots for grounding
* Heavy structured output (timeline + causal chain + anomaly table) to show rigor

---

## Demo flow (what judges see)

1. Run a session (or pick a saved one)
2. Replay chart moves and order book dynamics
3. Click “Investigate”
4. Watch the agent loop: hypotheses → tool-based evidence pulls → refined conclusion
5. Final report: **timeline + causal chain + citations to event IDs and doc chunks**

---

## Safety boundary

* Fully **sandboxed synthetic market**, no real tickers, no broker connectivity, no “how to trade IRL” instructions
* Output is framed as **analysis of a simulation**, with transparent citations to the tape and docs

If you want, I can compress this into a one-page submission blurb (problem, solution, why Gemini, why Track 1, demo, evaluation).

[1]: https://vercel.com/blog/ai-sdk-5?utm_source=chatgpt.com "AI SDK 5"
[2]: https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai?utm_source=chatgpt.com "Google Generative AI Provider"
