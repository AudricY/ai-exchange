import type { OrderRequest, NewsEvent, AgentConfig } from '@ai-exchange/types';
import { BaseAgent, MarketState, AgentAction } from './base-agent.js';

interface PendingNewsReaction {
  news: NewsEvent;
  reactAt: number; // timestamp when we should react
}

/**
 * Fundamentals trader - trades based on fair value estimates
 * Updates fair value based on news with a reaction lag
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

  // Magnitude to fair value change mapping
  private readonly magnitudeMultipliers = {
    high: 0.08, // 8% fair value change
    medium: 0.04, // 4% fair value change
    low: 0.02, // 2% fair value change
  };

  constructor(config: AgentConfig, rng: () => number) {
    super(config, rng);
    this.reactionLagMs = (config.params.reactionLagMs as number) ?? 5000; // 5 second default lag
    this.deviationThreshold = (config.params.deviationThreshold as number) ?? 0.03; // 3% deviation to trade
    this.baseOrderSize = (config.params.orderSize as number) ?? 50;
    this.maxPosition = (config.params.maxPosition as number) ?? 300;
  }

  tick(timestamp: number, state: MarketState): AgentAction[] {
    const actions: AgentAction[] = [];
    const currentPrice = state.midPrice ?? state.lastTradePrice;

    if (currentPrice === null) return actions;

    // Initialize fair value on first observation
    if (this.fairValue === null) {
      this.fairValue = currentPrice;
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
    const magnitude = (news as unknown as { magnitude?: 'low' | 'medium' | 'high' }).magnitude ?? 'medium';
    const multiplier = this.magnitudeMultipliers[magnitude];

    // Apply change based on sentiment
    if (news.sentiment === 'positive') {
      this.fairValue *= 1 + multiplier;
    } else if (news.sentiment === 'negative') {
      this.fairValue *= 1 - multiplier;
    }
  }
}
