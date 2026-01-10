import type { OrderRequest, AgentConfig } from '@ai-exchange/types';
import { BaseAgent, MarketState, AgentAction } from './base-agent.js';

/**
 * Momentum trader - follows price trends
 * Buys when price is rising, sells when falling
 * Uses trailing anchor that adapts to trends
 */
export class MomentumTrader extends BaseAgent {
  private priceHistory: number[] = [];
  private lookbackPeriod: number;
  private threshold: number;
  private orderSize: number;
  private cooldown: number = 0;
  private cooldownPeriod: number;
  private maxPosition: number;
  private trailingAnchor: number | null = null;
  private anchorDecay: number;
  private maxDeviationFromAnchor: number;

  constructor(config: AgentConfig, rng: () => number) {
    super(config, rng);
    this.lookbackPeriod = (config.params.lookbackPeriod as number) ?? 10;
    this.threshold = (config.params.threshold as number) ?? 0.02; // 2% price change
    this.orderSize = (config.params.orderSize as number) ?? 20;
    this.cooldownPeriod = (config.params.cooldownPeriod as number) ?? 10;
    this.maxPosition = (config.params.maxPosition as number) ?? 200;
    this.anchorDecay = (config.params.anchorDecay as number) ?? 0.05; // 5% adaptation per tick
    this.maxDeviationFromAnchor = (config.params.maxDeviation as number) ?? 1.0; // Effectively no cap
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

    // Set initial trailing anchor on first observation
    if (this.trailingAnchor === null) {
      this.trailingAnchor = currentPrice;
    }

    // Update trailing anchor (exponential moving average toward current price)
    this.trailingAnchor =
      this.trailingAnchor * (1 - this.anchorDecay) +
      currentPrice * this.anchorDecay;

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

    // Check deviation from trailing anchor
    const deviationFromAnchor =
      (currentPrice - this.trailingAnchor) / this.trailingAnchor;

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

      // Reduce size if price deviates significantly from trailing anchor
      let adjustedSize = this.orderSize;
      if (side === 'buy' && deviationFromAnchor > this.maxDeviationFromAnchor) {
        adjustedSize = Math.floor(this.orderSize * 0.25);
        if (adjustedSize < 5) return actions;
      }
      if (side === 'sell' && deviationFromAnchor < -this.maxDeviationFromAnchor) {
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
