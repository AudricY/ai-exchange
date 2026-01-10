export type AgentArchetype =
  | 'market_maker'
  | 'momentum'
  | 'noise'
  | 'informed';

export interface AgentConfig {
  id: string;
  name: string;
  archetype: AgentArchetype;
  params: Record<string, number | string | boolean>;
}

export interface AgentStats {
  agentId: string;
  ordersPlaced: number;
  ordersCancelled: number;
  tradesAsBuyer: number;
  tradesAsSeller: number;
  volumeTraded: number;
  pnl: number;
}
