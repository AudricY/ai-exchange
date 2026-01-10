import type { OrderRequest, AgentConfig } from '@ai-exchange/types';
import { BaseAgent, MarketState, AgentAction } from './base-agent.js';

/**
 * Market maker - provides two-sided liquidity with a spread
 * Manages inventory by skewing quotes
 */
export class MarketMaker extends BaseAgent {
  private halfSpread: number;
  private orderSize: number;
  private inventorySkew: number;
  private maxPosition: number;

  constructor(config: AgentConfig, rng: () => number) {
    super(config, rng);
    this.halfSpread = ((config.params.spread as number) ?? 2) / 2;
    this.orderSize = (config.params.orderSize as number) ?? 50;
    this.inventorySkew = (config.params.inventorySkew as number) ?? 0.02;
    this.maxPosition = (config.params.maxPosition as number) ?? 500;
  }

  tick(timestamp: number, state: MarketState): AgentAction[] {
    const actions: AgentAction[] = [];

    // Cancel all existing orders first
    for (const order of state.openOrders) {
      actions.push({
        type: 'cancel_order',
        orderId: order.id,
      });
    }

    // Need a reference price to quote
    if (state.midPrice === null) return actions;

    // Calculate inventory-adjusted quotes
    // Negative position = want to buy more, so lower ask to attract sellers
    // Positive position = want to sell more, so lower bid to attract buyers
    const skewAmount = -state.position * this.inventorySkew;

    const bidPrice = state.midPrice - this.halfSpread + skewAmount;
    const askPrice = state.midPrice + this.halfSpread + skewAmount;

    // Determine order sizes based on position limits
    const bidSize =
      state.position < this.maxPosition
        ? this.orderSize
        : Math.max(0, this.maxPosition - state.position);
    const askSize =
      state.position > -this.maxPosition
        ? this.orderSize
        : Math.max(0, state.position + this.maxPosition);

    // Place bid
    if (bidSize > 0 && bidPrice > 0) {
      const bidRequest: OrderRequest = {
        agentId: this.id,
        side: 'buy',
        type: 'limit',
        price: Math.round(bidPrice * 100) / 100,
        quantity: bidSize,
      };
      actions.push({
        type: 'place_order',
        orderRequest: bidRequest,
        thought: `Quote bid ${bidRequest.quantity}@${bidRequest.price} (skew: ${skewAmount.toFixed(2)})`,
      });
    }

    // Place ask
    if (askSize > 0) {
      const askRequest: OrderRequest = {
        agentId: this.id,
        side: 'sell',
        type: 'limit',
        price: Math.round(askPrice * 100) / 100,
        quantity: askSize,
      };
      actions.push({
        type: 'place_order',
        orderRequest: askRequest,
        thought: `Quote ask ${askRequest.quantity}@${askRequest.price} (skew: ${skewAmount.toFixed(2)})`,
      });
    }

    return actions;
  }
}
