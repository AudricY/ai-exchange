import type { Side } from './order.js';

export interface Trade {
  id: string;
  sessionId: string;
  buyOrderId: string;
  sellOrderId: string;
  buyAgentId: string;
  sellAgentId: string;
  price: number;
  quantity: number;
  timestamp: number;
  makerSide: Side;
}
