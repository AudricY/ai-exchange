import type { OrderRequest, NewsEvent, AgentConfig } from '@ai-exchange/types';
import { BaseAgent, MarketState, AgentAction } from './base-agent.js';

/**
 * Informed trader - reacts to news events with position management
 * Trades aggressively on positive/negative news
 * Manages position by flattening on contrary news
 */
export class InformedTrader extends BaseAgent {
  private baseOrderSize: number;
  private reactionStrength: number;
  private processedNewsIds: Set<string> = new Set();
  private maxPosition: number;
  private entryPrice: number | null = null;

  constructor(config: AgentConfig, rng: () => number) {
    super(config, rng);
    this.baseOrderSize = (config.params.orderSize as number) ?? 100;
    this.reactionStrength = (config.params.reactionStrength as number) ?? 1.0;
    this.maxPosition = (config.params.maxPosition as number) ?? 500;
  }

  tick(timestamp: number, state: MarketState): AgentAction[] {
    const actions: AgentAction[] = [];
    const position = state.position ?? 0;
    const currentPrice = state.midPrice ?? state.lastTradePrice;

    if (currentPrice === null) return actions;

    // Process ALL new news events (not just one)
    for (const news of state.recentNews) {
      // Skip already processed news
      if (this.processedNewsIds.has(news.id)) continue;
      this.processedNewsIds.add(news.id);

      // Skip news without sentiment (forensics tape) or neutral news
      if (!news.sentiment || news.sentiment === 'neutral') continue;

      const isPositive = news.sentiment === 'positive';

      // Determine action based on sentiment AND current position
      let side: 'buy' | 'sell';
      let size: number;
      let thought: string;

      if (isPositive) {
        if (position < 0) {
          // We're short but news is positive - close short first
          side = 'buy';
          size = Math.min(Math.abs(position), this.baseOrderSize * 2);
          thought = `Covering short on positive news: "${news.headline}"`;
        } else if (position < this.maxPosition) {
          // Go long or add to long
          side = 'buy';
          size = Math.round(this.baseOrderSize * this.reactionStrength);
          thought = `Buying on positive news: "${news.headline}"`;
          if (this.entryPrice === null) this.entryPrice = currentPrice;
        } else {
          continue; // At max position
        }
      } else {
        // Negative sentiment
        if (position > 0) {
          // We're long but news is negative - close long first
          side = 'sell';
          size = Math.min(position, this.baseOrderSize * 2);
          thought = `Closing long on negative news: "${news.headline}"`;
        } else if (position > -this.maxPosition) {
          // Go short or add to short
          side = 'sell';
          size = Math.round(this.baseOrderSize * this.reactionStrength);
          thought = `Selling on negative news: "${news.headline}"`;
          if (this.entryPrice === null) this.entryPrice = currentPrice;
        } else {
          continue; // At max position
        }
      }

      // Use aggressive market order for immediate execution
      const orderRequest: OrderRequest = {
        agentId: this.id,
        side,
        type: 'market',
        price: currentPrice,
        quantity: size,
      };

      actions.push({
        type: 'place_order',
        orderRequest,
        thought,
      });
    }

    return actions;
  }
}
