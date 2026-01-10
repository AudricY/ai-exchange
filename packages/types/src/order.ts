export type Side = 'buy' | 'sell';
export type OrderType = 'limit' | 'market';
export type OrderStatus = 'open' | 'partial' | 'filled' | 'cancelled';

export interface OrderRequest {
  agentId: string;
  side: Side;
  type: OrderType;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  sessionId: string;
  agentId: string;
  side: Side;
  type: OrderType;
  price: number;
  quantity: number;
  filledQuantity: number;
  status: OrderStatus;
  timestamp: number;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
  orderCount: number;
}

export interface OrderBookSnapshot {
  sessionId: string;
  timestamp: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  lastTradePrice: number | null;
  lastTradeQuantity: number | null;
}
