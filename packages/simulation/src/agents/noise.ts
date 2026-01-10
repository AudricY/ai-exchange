import type { OrderRequest, AgentConfig } from '@ai-exchange/types';
import { BaseAgent, MarketState, AgentAction } from './base-agent.js';
import { randFloat, randPick } from '../rng.js';

/**
 * Noise trader - places random orders around the mid price
 * Provides baseline liquidity and randomness to the market
 */
export class NoiseTrader extends BaseAgent {
  private orderProbability: number;
  private priceRange: number;
  private orderSize: number;

  constructor(config: AgentConfig, rng: () => number) {
    super(config, rng);
    this.orderProbability = (config.params.orderProbability as number) ?? 0.3;
    this.priceRange = (config.params.priceRange as number) ?? 5;
    this.orderSize = (config.params.orderSize as number) ?? 10;
  }

  tick(timestamp: number, state: MarketState): AgentAction[] {
    const actions: AgentAction[] = [];

    // Skip if no reference price
    if (state.midPrice === null) return actions;

    // Random chance to place an order
    if (this.rng() > this.orderProbability) {
      return actions;
    }

    const side = randPick(this.rng, ['buy', 'sell'] as const);
    const priceOffset = randFloat(
      this.rng,
      -this.priceRange,
      this.priceRange
    );
    const price = Math.max(1, state.midPrice + priceOffset);

    const orderRequest: OrderRequest = {
      agentId: this.id,
      side,
      type: 'limit',
      price: Math.round(price * 100) / 100,
      quantity: this.orderSize,
    };

    actions.push({
      type: 'place_order',
      orderRequest,
      thought: `Random ${side} order at ${orderRequest.price}`,
    });

    return actions;
  }
}
