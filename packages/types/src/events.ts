import type { Order, OrderBookSnapshot } from './order.js';
import type { Trade } from './trade.js';

export type TapeEventType =
  | 'order_placed'
  | 'order_cancelled'
  | 'trade'
  | 'book_snapshot'
  | 'news'
  | 'rumor'
  | 'doc_inject'
  | 'agent_thought';

export interface BaseTapeEvent {
  id: string; // Stable ID for citations (e.g., "EVT-000001")
  sessionId: string;
  type: TapeEventType;
  timestamp: number;
  sequence: number; // Monotonic sequence number
}

export interface OrderPlacedEvent extends BaseTapeEvent {
  type: 'order_placed';
  order: Order;
}

export interface OrderCancelledEvent extends BaseTapeEvent {
  type: 'order_cancelled';
  orderId: string;
  agentId: string;
}

export interface TradeEvent extends BaseTapeEvent {
  type: 'trade';
  trade: Trade;
}

export interface BookSnapshotEvent extends BaseTapeEvent {
  type: 'book_snapshot';
  snapshot: OrderBookSnapshot;
}

export interface NewsEvent extends BaseTapeEvent {
  type: 'news';
  headline: string;
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  source: string;
}

export interface RumorEvent extends BaseTapeEvent {
  type: 'rumor';
  message: string;
  agentId: string;
}

export interface DocInjectEvent extends BaseTapeEvent {
  type: 'doc_inject';
  docId: string;
  title: string;
  chunkCount: number;
}

export interface AgentThoughtEvent extends BaseTapeEvent {
  type: 'agent_thought';
  agentId: string;
  thought: string;
  action?: string;
}

export type TapeEvent =
  | OrderPlacedEvent
  | OrderCancelledEvent
  | TradeEvent
  | BookSnapshotEvent
  | NewsEvent
  | RumorEvent
  | DocInjectEvent
  | AgentThoughtEvent;
