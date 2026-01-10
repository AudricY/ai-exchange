import type {
  Order,
  OrderRequest,
  OrderBookLevel,
  OrderBookSnapshot,
  Side,
  Trade,
} from '@ai-exchange/types';

interface OrderNode {
  order: Order;
  next: OrderNode | null;
}

interface PriceLevel {
  price: number;
  head: OrderNode | null;
  tail: OrderNode | null;
  totalQuantity: number;
  orderCount: number;
}

/**
 * Limit Order Book with price-time priority matching
 */
export class OrderBook {
  private sessionId: string;
  private bids: Map<number, PriceLevel> = new Map(); // price -> level
  private asks: Map<number, PriceLevel> = new Map();
  private orders: Map<string, Order> = new Map(); // orderId -> order
  private lastTradePrice: number | null = null;
  private lastTradeQuantity: number | null = null;
  private nextOrderId = 1;
  private nextTradeId = 1;
  private tickSize: number;

  constructor(sessionId: string, tickSize: number = 1) {
    this.sessionId = sessionId;
    this.tickSize = tickSize;
  }

  /**
   * Place a new order and attempt to match
   * Returns the order and any resulting trades
   */
  placeOrder(
    request: OrderRequest,
    timestamp: number
  ): { order: Order; trades: Trade[] } {
    const order: Order = {
      id: `ORD-${this.nextOrderId++}`,
      sessionId: this.sessionId,
      agentId: request.agentId,
      side: request.side,
      type: request.type,
      price: this.roundToTick(request.price),
      quantity: request.quantity,
      filledQuantity: 0,
      status: 'open',
      timestamp,
    };

    const trades: Trade[] = [];

    // Try to match against the opposite book
    if (order.type === 'market' || this.canMatch(order)) {
      const matchResult = this.match(order, timestamp);
      trades.push(...matchResult);
    }

    // If order still has remaining quantity, add to book
    if (order.quantity > order.filledQuantity && order.type === 'limit') {
      this.addToBook(order);
    } else if (order.filledQuantity === order.quantity) {
      order.status = 'filled';
    } else if (order.filledQuantity > 0) {
      order.status = 'partial';
    }

    this.orders.set(order.id, order);
    return { order, trades };
  }

  /**
   * Cancel an existing order
   */
  cancelOrder(orderId: string): Order | null {
    const order = this.orders.get(orderId);
    if (!order || order.status === 'filled' || order.status === 'cancelled') {
      return null;
    }

    this.removeFromBook(order);
    order.status = 'cancelled';
    return order;
  }

  /**
   * Get current order book snapshot
   */
  getSnapshot(depth: number = 10): OrderBookSnapshot {
    return {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      bids: this.getLevels(this.bids, 'buy', depth),
      asks: this.getLevels(this.asks, 'sell', depth),
      lastTradePrice: this.lastTradePrice,
      lastTradeQuantity: this.lastTradeQuantity,
    };
  }

  /**
   * Get best bid price
   */
  getBestBid(): number | null {
    const prices = Array.from(this.bids.keys()).sort((a, b) => b - a);
    return prices.length > 0 ? prices[0] : null;
  }

  /**
   * Get best ask price
   */
  getBestAsk(): number | null {
    const prices = Array.from(this.asks.keys()).sort((a, b) => a - b);
    return prices.length > 0 ? prices[0] : null;
  }

  /**
   * Get mid price
   */
  getMidPrice(): number | null {
    const bid = this.getBestBid();
    const ask = this.getBestAsk();
    if (bid === null || ask === null) return null;
    return (bid + ask) / 2;
  }

  /**
   * Get spread
   */
  getSpread(): number | null {
    const bid = this.getBestBid();
    const ask = this.getBestAsk();
    if (bid === null || ask === null) return null;
    return ask - bid;
  }

  /**
   * Get an order by ID
   */
  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  /**
   * Get all open orders for an agent
   */
  getAgentOrders(agentId: string): Order[] {
    return Array.from(this.orders.values()).filter(
      (o) => o.agentId === agentId && (o.status === 'open' || o.status === 'partial')
    );
  }

  // Private methods

  private roundToTick(price: number): number {
    return Math.round(price / this.tickSize) * this.tickSize;
  }

  private canMatch(order: Order): boolean {
    if (order.side === 'buy') {
      const bestAsk = this.getBestAsk();
      return bestAsk !== null && order.price >= bestAsk;
    } else {
      const bestBid = this.getBestBid();
      return bestBid !== null && order.price <= bestBid;
    }
  }

  private match(order: Order, timestamp: number): Trade[] {
    const trades: Trade[] = [];
    const oppositeBook = order.side === 'buy' ? this.asks : this.bids;
    const prices = Array.from(oppositeBook.keys()).sort((a, b) =>
      order.side === 'buy' ? a - b : b - a
    );

    for (const price of prices) {
      if (order.filledQuantity >= order.quantity) break;

      // Check price compatibility
      if (order.type === 'limit') {
        if (order.side === 'buy' && price > order.price) break;
        if (order.side === 'sell' && price < order.price) break;
      }

      const level = oppositeBook.get(price)!;
      let node = level.head;

      while (node && order.filledQuantity < order.quantity) {
        const restingOrder = node.order;
        const remainingIncoming = order.quantity - order.filledQuantity;
        const remainingResting =
          restingOrder.quantity - restingOrder.filledQuantity;
        const matchQty = Math.min(remainingIncoming, remainingResting);

        // Execute trade
        const trade: Trade = {
          id: `TRD-${this.nextTradeId++}`,
          sessionId: this.sessionId,
          buyOrderId: order.side === 'buy' ? order.id : restingOrder.id,
          sellOrderId: order.side === 'sell' ? order.id : restingOrder.id,
          buyAgentId: order.side === 'buy' ? order.agentId : restingOrder.agentId,
          sellAgentId: order.side === 'sell' ? order.agentId : restingOrder.agentId,
          price: restingOrder.price, // Trade at resting order's price
          quantity: matchQty,
          timestamp,
          makerSide: restingOrder.side,
        };
        trades.push(trade);

        // Update quantities
        order.filledQuantity += matchQty;
        restingOrder.filledQuantity += matchQty;
        level.totalQuantity -= matchQty;

        // Update last trade info
        this.lastTradePrice = trade.price;
        this.lastTradeQuantity = trade.quantity;

        // Update resting order status
        if (restingOrder.filledQuantity === restingOrder.quantity) {
          restingOrder.status = 'filled';
          // Remove from level
          level.head = node.next;
          if (!level.head) level.tail = null;
          level.orderCount--;
        } else {
          restingOrder.status = 'partial';
        }

        node = node.next;
      }

      // Clean up empty levels
      if (level.totalQuantity === 0) {
        oppositeBook.delete(price);
      }
    }

    return trades;
  }

  private addToBook(order: Order): void {
    const book = order.side === 'buy' ? this.bids : this.asks;
    let level = book.get(order.price);

    if (!level) {
      level = {
        price: order.price,
        head: null,
        tail: null,
        totalQuantity: 0,
        orderCount: 0,
      };
      book.set(order.price, level);
    }

    const node: OrderNode = { order, next: null };
    if (level.tail) {
      level.tail.next = node;
    } else {
      level.head = node;
    }
    level.tail = node;
    level.totalQuantity += order.quantity - order.filledQuantity;
    level.orderCount++;
  }

  private removeFromBook(order: Order): void {
    const book = order.side === 'buy' ? this.bids : this.asks;
    const level = book.get(order.price);
    if (!level) return;

    let prev: OrderNode | null = null;
    let node = level.head;

    while (node) {
      if (node.order.id === order.id) {
        if (prev) {
          prev.next = node.next;
        } else {
          level.head = node.next;
        }
        if (!node.next) {
          level.tail = prev;
        }
        level.totalQuantity -= order.quantity - order.filledQuantity;
        level.orderCount--;
        break;
      }
      prev = node;
      node = node.next;
    }

    if (level.totalQuantity === 0) {
      book.delete(order.price);
    }
  }

  private getLevels(
    book: Map<number, PriceLevel>,
    side: Side,
    depth: number
  ): OrderBookLevel[] {
    const prices = Array.from(book.keys()).sort((a, b) =>
      side === 'buy' ? b - a : a - b
    );

    return prices.slice(0, depth).map((price) => {
      const level = book.get(price)!;
      return {
        price: level.price,
        quantity: level.totalQuantity,
        orderCount: level.orderCount,
      };
    });
  }
}
