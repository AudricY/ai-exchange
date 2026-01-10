# Implementation Plan: Enhancing Market Transparency

This plan outlines the high-level steps to make the "invisible" simulation data visible in the Web UI, providing a richer experience for understanding market dynamics before running a forensic investigation.

## 1. News & Information Feed
Display the stream of external information that influences agent behavior.
- **Component**: `NewsFeed.tsx`
- **Features**:
    - Real-time display of News events (Headlines, Content, Source).
    - Display of Rumors and Chat messages.
    - Sentiment indicators (Positive/Negative/Neutral).
    - Synchronized with the replay scrubber.

## 2. Agent Rationale (Thoughts) Panel
Expose the "internal monologue" of the trading agents.
- **Component**: `AgentThoughts.tsx`
- **Features**:
    - Filterable list of agent thoughts (`agent_thought` events).
    - Group by Agent ID to see individual logic.
    - Highlight causal links (e.g., "Placed order because...")
    - Auto-scroll to most recent thought during playback.

## 3. Order Lifecycle Feed
Show the high-frequency "chatter" of the market that doesn't always result in trades.
- **Component**: `OrderFeed.tsx`
- **Features**:
    - Display `order_placed` and `order_cancelled` events.
    - Show order types (Limit/Market), side (Buy/Sell), price, and quantity.
    - Distinguish between "Seed" liquidity and Agent-driven orders.

## 4. UI Integration & Layout
Reorganize the `SessionPage` to accommodate new information streams.
- **Layout Changes**:
    - Side-by-side tabs for "Trades", "Orders", and "News".
    - Dedicated "Agent Log" section near the Investigation panel.
    - Improved visual cues for events on the main Price Chart (e.g., news markers).

## 5. Data Flow Improvements
- Update `fetchEvents` to efficiently handle larger tape slices.
- Implement client-side caching/filtering for smoother scrubbing performance.
- Ensure all new components respect the `currentTime` from the `ReplayScrubber`.
