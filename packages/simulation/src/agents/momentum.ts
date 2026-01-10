import type { OrderRequest, AgentConfig } from '@ai-exchange/types';
import { BaseAgent, MarketState, AgentAction } from './base-agent.js';

/**
 * Momentum trader - follows price trends with risk controls
 * Buys when price is rising, sells when falling
 * Has position limits and mean-reversion dampening to prevent runaway bubbles
 */
export class MomentumTrader extends BaseAgent {
  private priceHistory: number[] = [];
  private lookbackPeriod: number;
  private threshold: number;
  private orderSize: number;
  private cooldown: number = 0;
  private cooldownPeriod: number;
  private maxPosition: number;
  private anchorPrice: number | null = null;
  private maxDeviationFromAnchor: number;

  constructor(config: AgentConfig, rng: () => number) {
    super(config, rng);
    this.lookbackPeriod = (config.params.lookbackPeriod as number) ?? 10;
    this.threshold = (config.params.threshold as number) ?? 0.02; // 2% price change
    this.orderSize = (config.params.orderSize as number) ?? 20;
    this.cooldownPeriod = (config.params.cooldownPeriod as number) ?? 10; // Increased from 5
    this.maxPosition = (config.params.maxPosition as number) ?? 200; // Position limit
    this.maxDeviationFromAnchor = (config.params.maxDeviation as number) ?? 0.5; // 50% max deviation from anchor
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

    // Set anchor price on first observation
    if (this.anchorPrice === null) {
      this.anchorPrice = currentPrice;
    }

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

    // Check deviation from anchor - don't chase if price has moved too far
    const deviationFromAnchor = (currentPrice - this.anchorPrice) / this.anchorPrice;

    // Get current position
    const position = state.position ?? 0;

    // Trade based on momentum with risk controls
    if (Math.abs(priceChange) >= this.threshold) {
      const side = priceChange > 0 ? 'buy' : 'sell';

      // Position limit check
      if (side === 'buy' && position >= this.maxPosition) {
        // At max long position, don't buy more
        return actions;
      }
      if (side === 'sell' && position <= -this.maxPosition) {
        // At max short position, don't sell more
        return actions;
      }

      // Mean reversion check - reduce size or skip if price has deviated too far
      let adjustedSize = this.orderSize;
      if (side === 'buy' && deviationFromAnchor > this.maxDeviationFromAnchor) {
        // Price is way above anchor, reduce or skip buying
        adjustedSize = Math.floor(this.orderSize * 0.25);
        if (adjustedSize < 5) return actions;
      }
      if (side === 'sell' && deviationFromAnchor < -this.maxDeviationFromAnchor) {
        // Price is way below anchor, reduce or skip selling
        adjustedSize = Math.floor(this.orderSize * 0.25);
        if (adjustedSize < 5) return actions;
      }

      // Use market order to chase momentum
      const orderRequest: OrderRequest = {
        agentId: this.id,
        side,
        type: 'market',
        price: currentPrice, // Price for market orders is just for reference
        quantity: adjustedSize,
      };

      actions.push({
        type: 'place_order',
        orderRequest,
        thought: `Momentum ${side}: ${(priceChange * 100).toFixed(2)}% change, pos=${position}, deviation=${(deviationFromAnchor * 100).toFixed(1)}%`,
      });

      // Enter cooldown - longer cooldown when position is larger
      this.cooldown = this.cooldownPeriod + Math.floor(Math.abs(position) / 50);
    }

    return actions;
  }
}
