import type { AgentConfig, AgentStats } from './agent.js';

export type SessionStatus = 'pending' | 'running' | 'completed' | 'error';

export interface NewsScheduleItem {
  timestamp: number;
  headline: string;
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  source: string;
}

export interface DocInjectItem {
  timestamp: number;
  docId: string;
  title: string;
  content: string;
}

export interface SessionConfig {
  seed: number;
  durationMs: number;
  tickSize: number;
  initialPrice: number;
  agents: AgentConfig[];
  newsSchedule: NewsScheduleItem[];
  docInjects: DocInjectItem[];
}

export interface Session {
  id: string;
  name: string;
  status: SessionStatus;
  config: SessionConfig;
  createdAt: string;
  completedAt?: string;
  eventCount: number;
  tradeCount: number;
  finalPrice?: number;
}

export interface SessionManifest {
  session: Session;
  summary: {
    priceRange: { low: number; high: number };
    volumeTotal: number;
    agentStats: Record<string, AgentStats>;
    keyTimestamps: number[];
  };
}
