import type {
  Order,
  OrderRequest,
  Trade,
  NewsEvent,
  AgentConfig,
} from '@ai-exchange/types';

export interface MarketState {
  midPrice: number | null;
  spread: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  lastTrade: Trade | null;
  lastTradePrice: number | null;
  recentNews: NewsEvent[];
  position: number;
  cash: number;
  openOrders: Order[];
}

export interface AgentAction {
  type: 'place_order' | 'cancel_order';
  orderRequest?: OrderRequest;
  orderId?: string;
  thought?: string;
}

/**
 * Base class for all trading agents
 */
export abstract class BaseAgent {
  protected id: string;
  protected name: string;
  protected config: AgentConfig;
  protected rng: () => number;
  protected position: number = 0;
  protected cash: number = 0;
  protected realizedPnL: number = 0;

  constructor(config: AgentConfig, rng: () => number) {
    this.id = config.id;
    this.name = config.name;
    this.config = config;
    this.rng = rng;
  }

  /**
   * Called each tick to decide on actions
   */
  abstract tick(timestamp: number, state: MarketState): AgentAction[];

  /**
   * Update position after a trade
   */
  onTrade(trade: Trade): void {
    if (trade.buyAgentId === this.id) {
      this.position += trade.quantity;
      this.cash -= trade.price * trade.quantity;
    } else if (trade.sellAgentId === this.id) {
      this.position -= trade.quantity;
      this.cash += trade.price * trade.quantity;
    }
  }

  /**
   * Get agent ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get current position
   */
  getPosition(): number {
    return this.position;
  }

  /**
   * Get current cash
   */
  getCash(): number {
    return this.cash;
  }

  /**
   * Calculate unrealized PnL at current price
   */
  getUnrealizedPnL(currentPrice: number): number {
    return this.position * currentPrice;
  }

  /**
   * Get total PnL (realized + unrealized)
   */
  getTotalPnL(currentPrice: number): number {
    return this.cash + this.position * currentPrice;
  }
}
