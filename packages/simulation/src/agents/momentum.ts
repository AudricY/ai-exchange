import type { OrderRequest, AgentConfig } from '@ai-exchange/types';
import { BaseAgent, MarketState, AgentAction } from './base-agent.js';

/**
 * Momentum trader - follows price trends
 * Buys when price is rising, sells when falling
 */
export class MomentumTrader extends BaseAgent {
  private priceHistory: number[] = [];
  private lookbackPeriod: number;
  private threshold: number;
  private orderSize: number;
  private cooldown: number = 0;
  private cooldownPeriod: number;

  constructor(config: AgentConfig, rng: () => number) {
    super(config, rng);
    this.lookbackPeriod = (config.params.lookbackPeriod as number) ?? 10;
    this.threshold = (config.params.threshold as number) ?? 0.02; // 2% price change
    this.orderSize = (config.params.orderSize as number) ?? 20;
    this.cooldownPeriod = (config.params.cooldownPeriod as number) ?? 5;
  }

  tick(timestamp: number, state: MarketState): AgentAction[] {
    const actions: AgentAction[] = [];

    // Decrement cooldown
    if (this.cooldown > 0) {
      this.cooldown--;
      return actions;
    }

    // Need a reference price
    const currentPrice = state.lastTradePrice ?? state.midPrice;
    if (currentPrice === null) return actions;

    // Update price history
    this.priceHistory.push(currentPrice);
    if (this.priceHistory.length > this.lookbackPeriod) {
      this.priceHistory.shift();
    }

    // Need enough history
    if (this.priceHistory.length < this.lookbackPeriod) {
      return actions;
    }

    // Calculate momentum (simple: compare first to last)
    const oldPrice = this.priceHistory[0];
    const priceChange = (currentPrice - oldPrice) / oldPrice;

    // Trade based on momentum
    if (Math.abs(priceChange) >= this.threshold) {
      const side = priceChange > 0 ? 'buy' : 'sell';

      // Use market order to chase momentum
      const orderRequest: OrderRequest = {
        agentId: this.id,
        side,
        type: 'market',
        price: currentPrice, // Price for market orders is just for reference
        quantity: this.orderSize,
      };

      actions.push({
        type: 'place_order',
        orderRequest,
        thought: `Momentum ${side}: ${(priceChange * 100).toFixed(2)}% change over ${this.lookbackPeriod} ticks`,
      });

      // Enter cooldown
      this.cooldown = this.cooldownPeriod;
    }

    return actions;
  }
}
