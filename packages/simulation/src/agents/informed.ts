import type { OrderRequest, NewsEvent, AgentConfig } from '@ai-exchange/types';
import { BaseAgent, MarketState, AgentAction } from './base-agent.js';

/**
 * Informed trader - reacts to news events
 * Trades aggressively on positive/negative news
 */
export class InformedTrader extends BaseAgent {
  private orderSize: number;
  private reactionStrength: number;
  private processedNewsIds: Set<string> = new Set();
  private cooldown: number = 0;
  private cooldownPeriod: number;

  constructor(config: AgentConfig, rng: () => number) {
    super(config, rng);
    this.orderSize = (config.params.orderSize as number) ?? 100;
    this.reactionStrength = (config.params.reactionStrength as number) ?? 1.0;
    this.cooldownPeriod = (config.params.cooldownPeriod as number) ?? 3;
  }

  tick(timestamp: number, state: MarketState): AgentAction[] {
    const actions: AgentAction[] = [];

    // Decrement cooldown
    if (this.cooldown > 0) {
      this.cooldown--;
      return actions;
    }

    // Look for new news to react to
    for (const news of state.recentNews) {
      // Skip already processed news
      if (this.processedNewsIds.has(news.id)) continue;
      this.processedNewsIds.add(news.id);

      // Skip news without sentiment (forensics tape) or neutral news
      if (!news.sentiment || news.sentiment === 'neutral') continue;

      const currentPrice = state.midPrice ?? state.lastTradePrice;
      if (currentPrice === null) continue;

      // Determine trade direction based on sentiment
      const side = news.sentiment === 'positive' ? 'buy' : 'sell';

      // Scale order size by reaction strength
      const size = Math.round(this.orderSize * this.reactionStrength);

      // Use aggressive limit order slightly through the market
      const priceAdjust = side === 'buy' ? 0.5 : -0.5;
      const price = currentPrice + priceAdjust;

      const orderRequest: OrderRequest = {
        agentId: this.id,
        side,
        type: 'limit',
        price: Math.round(price * 100) / 100,
        quantity: size,
      };

      actions.push({
        type: 'place_order',
        orderRequest,
        thought: `Reacting to ${news.sentiment} news: "${news.headline}"`,
      });

      // Enter cooldown after reacting
      this.cooldown = this.cooldownPeriod;
      break; // Only react to one news item per tick
    }

    return actions;
  }
}
