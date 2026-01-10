import type { OrderRequest, NewsEvent, AgentConfig } from '@ai-exchange/types';
import { BaseAgent, MarketState, AgentAction } from './base-agent.js';

interface PendingNewsReaction {
  news: NewsEvent;
  reactAt: number; // timestamp when we should react
}

/**
 * Fundamentals trader - trades based on fair value estimates
 * Fair value drifts over time (random walk with drift) enabling long-term trends
 * Updates fair value based on news with reaction lag
 * Provides mean-reversion pressure when price deviates from fair value
 */
export class FundamentalsTrader extends BaseAgent {
  private fairValue: number | null = null;
  private reactionLagMs: number;
  private deviationThreshold: number;
  private baseOrderSize: number;
  private maxPosition: number;
  private processedNewsIds: Set<string> = new Set();
  private pendingReactions: PendingNewsReaction[] = [];

  // Fair value drift parameters
  private driftPerTick: number;
  private volatilityPerTick: number;
  private driftUpdateInterval: number;
  private lastDriftUpdate: number = 0;

  // News-driven drift shock
  private pendingDriftShock: number = 0;
  private newsDriftDecay: number;

  // Magnitude to fair value change mapping
  private readonly magnitudeMultipliers = {
    high: 0.08, // 8% fair value change
    medium: 0.04, // 4% fair value change
    low: 0.02, // 2% fair value change
  };

  constructor(config: AgentConfig, rng: () => number) {
    super(config, rng);
    this.reactionLagMs = (config.params.reactionLagMs as number) ?? 5000;
    this.deviationThreshold = (config.params.deviationThreshold as number) ?? 0.03;
    this.baseOrderSize = (config.params.orderSize as number) ?? 50;
    this.maxPosition = (config.params.maxPosition as number) ?? 300;

    // Drift parameters - enable long-term trends
    this.driftPerTick = (config.params.driftPerTick as number) ?? 0.0001; // 0.01% per tick
    this.volatilityPerTick = (config.params.volatilityPerTick as number) ?? 0.0002; // 0.02% std dev
    this.driftUpdateInterval = (config.params.driftUpdateInterval as number) ?? 500; // Update every 500ms
    this.newsDriftDecay = (config.params.newsDriftDecay as number) ?? 0.1; // 10% decay per update
  }

  tick(timestamp: number, state: MarketState): AgentAction[] {
    const actions: AgentAction[] = [];
    const currentPrice = state.midPrice ?? state.lastTradePrice;

    if (currentPrice === null) return actions;

    // Initialize fair value on first observation
    if (this.fairValue === null) {
      this.fairValue = currentPrice;
      this.lastDriftUpdate = timestamp;
    }

    // Apply fair value drift (random walk with drift)
    if (timestamp - this.lastDriftUpdate >= this.driftUpdateInterval) {
      const ticksElapsed = Math.floor(
        (timestamp - this.lastDriftUpdate) / this.driftUpdateInterval
      );
      for (let i = 0; i < ticksElapsed; i++) {
        // Random walk: base drift + news shock + random volatility
        const shock = (this.rng() - 0.5) * 2 * this.volatilityPerTick;
        const totalDrift = this.driftPerTick + this.pendingDriftShock + shock;
        this.fairValue *= 1 + totalDrift;

        // Decay the news-driven shock
        this.pendingDriftShock *= 1 - this.newsDriftDecay;
      }
      this.lastDriftUpdate = timestamp;
    }

    // Queue new news for later reaction (with lag)
    for (const news of state.recentNews) {
      if (this.processedNewsIds.has(news.id)) continue;
      this.processedNewsIds.add(news.id);

      // Only react to news with sentiment (material news)
      if (!news.sentiment || news.sentiment === 'neutral') continue;

      // Queue this news for reaction after the lag
      this.pendingReactions.push({
        news,
        reactAt: timestamp + this.reactionLagMs,
      });
    }

    // Process any pending reactions that are ready
    const readyReactions = this.pendingReactions.filter((r) => r.reactAt <= timestamp);
    this.pendingReactions = this.pendingReactions.filter((r) => r.reactAt > timestamp);

    for (const reaction of readyReactions) {
      this.updateFairValue(reaction.news);

      // Log the fair value update
      actions.push({
        type: 'place_order',
        thought: `Updated fair value to $${this.fairValue!.toFixed(2)} after analyzing: "${reaction.news.headline}"`,
      } as AgentAction);
    }

    // Calculate deviation from fair value
    const deviation = (currentPrice - this.fairValue) / this.fairValue;
    const position = state.position ?? 0;

    // Trade if price has deviated significantly from fair value
    if (Math.abs(deviation) >= this.deviationThreshold) {
      // Scale order size with conviction (larger deviation = bigger order)
      const convictionMultiplier = Math.min(3, Math.abs(deviation) / this.deviationThreshold);
      const orderSize = Math.round(this.baseOrderSize * convictionMultiplier);

      if (deviation > 0 && position > -this.maxPosition) {
        // Price above fair value - sell
        const sellSize = Math.min(orderSize, position + this.maxPosition);
        if (sellSize > 0) {
          const orderRequest: OrderRequest = {
            agentId: this.id,
            side: 'sell',
            type: 'limit',
            price: currentPrice - 0.5, // Slightly aggressive
            quantity: sellSize,
          };

          actions.push({
            type: 'place_order',
            orderRequest,
            thought: `Selling: price $${currentPrice.toFixed(2)} is ${(deviation * 100).toFixed(1)}% above fair value $${this.fairValue.toFixed(2)}`,
          });
        }
      } else if (deviation < 0 && position < this.maxPosition) {
        // Price below fair value - buy
        const buySize = Math.min(orderSize, this.maxPosition - position);
        if (buySize > 0) {
          const orderRequest: OrderRequest = {
            agentId: this.id,
            side: 'buy',
            type: 'limit',
            price: currentPrice + 0.5, // Slightly aggressive
            quantity: buySize,
          };

          actions.push({
            type: 'place_order',
            orderRequest,
            thought: `Buying: price $${currentPrice.toFixed(2)} is ${(Math.abs(deviation) * 100).toFixed(1)}% below fair value $${this.fairValue.toFixed(2)}`,
          });
        }
      }
    }

    return actions;
  }

  private updateFairValue(news: NewsEvent): void {
    if (this.fairValue === null) return;

    // Determine magnitude (default to medium if not specified)
    const magnitude =
      (news as unknown as { magnitude?: 'low' | 'medium' | 'high' }).magnitude ?? 'medium';
    const multiplier = this.magnitudeMultipliers[magnitude];

    // Apply immediate fair value change
    if (news.sentiment === 'positive') {
      this.fairValue *= 1 + multiplier;
      // High-magnitude positive news adds persistent upward drift
      if (magnitude === 'high') {
        this.pendingDriftShock += 0.0005;
      }
    } else if (news.sentiment === 'negative') {
      this.fairValue *= 1 - multiplier;
      // High-magnitude negative news adds persistent downward drift
      if (magnitude === 'high') {
        this.pendingDriftShock -= 0.0005;
      }
    }
  }
}
