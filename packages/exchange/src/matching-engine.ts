import type {
  Order,
  OrderRequest,
  Trade,
  OrderBookSnapshot,
  TapeEvent,
  OrderPlacedEvent,
  OrderCancelledEvent,
  TradeEvent,
  BookSnapshotEvent,
} from '@ai-exchange/types';
import { OrderBook } from './order-book.js';

// Helper type to properly omit from union types
type OmitFromUnion<T, K extends keyof T> = T extends T ? Omit<T, K> : never;
export type TapeEventInput = OmitFromUnion<TapeEvent, 'id' | 'sequence'>;
export type TapeEventCallback = (event: TapeEventInput) => void;

/**
 * MatchingEngine wraps OrderBook and emits tape events for all actions
 */
export class MatchingEngine {
  private orderBook: OrderBook;
  private sessionId: string;
  private onEvent: TapeEventCallback;

  constructor(
    sessionId: string,
    tickSize: number = 1,
    onEvent: TapeEventCallback
  ) {
    this.sessionId = sessionId;
    this.orderBook = new OrderBook(sessionId, tickSize);
    this.onEvent = onEvent;
  }

  /**
   * Place an order and emit events for order placement and any resulting trades
   */
  placeOrder(request: OrderRequest, timestamp: number): { order: Order; trades: Trade[] } {
    const result = this.orderBook.placeOrder(request, timestamp);

    // Emit order placed event
    const orderEvent: Omit<OrderPlacedEvent, 'id' | 'sequence'> = {
      sessionId: this.sessionId,
      type: 'order_placed',
      timestamp,
      order: result.order,
    };
    this.onEvent(orderEvent);

    // Emit trade events
    for (const trade of result.trades) {
      const tradeEvent: Omit<TradeEvent, 'id' | 'sequence'> = {
        sessionId: this.sessionId,
        type: 'trade',
        timestamp,
        trade,
      };
      this.onEvent(tradeEvent);
    }

    return result;
  }

  /**
   * Cancel an order and emit event
   */
  cancelOrder(orderId: string, timestamp: number): Order | null {
    const order = this.orderBook.cancelOrder(orderId);

    if (order) {
      const cancelEvent: Omit<OrderCancelledEvent, 'id' | 'sequence'> = {
        sessionId: this.sessionId,
        type: 'order_cancelled',
        timestamp,
        orderId: order.id,
        agentId: order.agentId,
      };
      this.onEvent(cancelEvent);
    }

    return order;
  }

  /**
   * Get current snapshot (does not emit event, use emitSnapshot for that)
   */
  getSnapshot(depth: number = 10): OrderBookSnapshot {
    return this.orderBook.getSnapshot(depth);
  }

  /**
   * Get and emit a snapshot event
   */
  emitSnapshot(timestamp: number, depth: number = 10): OrderBookSnapshot {
    const snapshot = this.orderBook.getSnapshot(depth);

    const snapshotEvent: Omit<BookSnapshotEvent, 'id' | 'sequence'> = {
      sessionId: this.sessionId,
      type: 'book_snapshot',
      timestamp,
      snapshot,
    };
    this.onEvent(snapshotEvent);

    return snapshot;
  }

  /**
   * Get best bid price
   */
  getBestBid(): number | null {
    return this.orderBook.getBestBid();
  }

  /**
   * Get best ask price
   */
  getBestAsk(): number | null {
    return this.orderBook.getBestAsk();
  }

  /**
   * Get mid price
   */
  getMidPrice(): number | null {
    return this.orderBook.getMidPrice();
  }

  /**
   * Get spread
   */
  getSpread(): number | null {
    return this.orderBook.getSpread();
  }

  /**
   * Get order by ID
   */
  getOrder(orderId: string): Order | undefined {
    return this.orderBook.getOrder(orderId);
  }

  /**
   * Get all open orders for an agent
   */
  getAgentOrders(agentId: string): Order[] {
    return this.orderBook.getAgentOrders(agentId);
  }
}
