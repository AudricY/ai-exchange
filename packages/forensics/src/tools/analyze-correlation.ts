import { tool } from 'ai';
import { z } from 'zod';
import { fetchTapeEvents } from '@ai-exchange/db';
import type { TapeEvent, OrderPlacedEvent, OrderCancelledEvent, TradeEvent } from '@ai-exchange/types';

interface AgentActivity {
  agentId: string;
  events: Array<{
    timestamp: number;
    type: 'buy' | 'sell' | 'cancel';
    price?: number;
    quantity?: number;
  }>;
}

interface PairwiseCorrelation {
  agent1: string;
  agent2: string;
  temporalCorrelation: number; // -1 to 1: how often they act at same time
  directionalCorrelation: number; // -1 to 1: same direction vs opposite
  avgResponseLatency: number | null; // ms between agent1 action and agent2 reaction
  followCount: number; // How many times agent2 follows agent1
}

interface LeaderFollowerPattern {
  leader: string;
  follower: string;
  confidence: number;
  avgLatency: number;
  occurrences: number;
}

interface SynchronizedPattern {
  agents: string[];
  windowMs: number;
  occurrences: number;
  timestamps: number[];
}

interface OpposingPattern {
  agent1: string;
  agent2: string;
  buyVsSellRatio: number; // When agent1 buys, agent2 sells
  occurrences: number;
}

function groupByAgent(events: TapeEvent[]): Map<string, AgentActivity> {
  const agentMap = new Map<string, AgentActivity>();

  function addActivity(agentId: string, activity: AgentActivity['events'][0]) {
    if (!agentMap.has(agentId)) {
      agentMap.set(agentId, { agentId, events: [] });
    }
    agentMap.get(agentId)!.events.push(activity);
  }

  for (const event of events) {
    if (event.type === 'order_placed') {
      const orderEvent = event as OrderPlacedEvent;
      const order = orderEvent.order;
      addActivity(order.agentId, {
        timestamp: event.timestamp,
        type: order.side === 'buy' ? 'buy' : 'sell',
        price: order.price,
        quantity: order.quantity,
      });
    } else if (event.type === 'order_cancelled') {
      const cancelEvent = event as OrderCancelledEvent;
      addActivity(cancelEvent.agentId, {
        timestamp: event.timestamp,
        type: 'cancel',
      });
    } else if (event.type === 'trade') {
      const tradeEvent = event as TradeEvent;
      const trade = tradeEvent.trade;
      // Add activity for both buyer and seller
      addActivity(trade.buyAgentId, {
        timestamp: event.timestamp,
        type: 'buy',
        price: trade.price,
        quantity: trade.quantity,
      });
      addActivity(trade.sellAgentId, {
        timestamp: event.timestamp,
        type: 'sell',
        price: trade.price,
        quantity: trade.quantity,
      });
    }
  }

  return agentMap;
}

function computePairwiseCorrelation(
  activity1: AgentActivity,
  activity2: AgentActivity,
  windowMs: number
): PairwiseCorrelation {
  const events1 = activity1.events;
  const events2 = activity2.events;

  let temporalMatches = 0;
  let directionalMatches = 0;
  let directionalTotal = 0;
  let followCount = 0;
  let totalLatency = 0;
  let latencyCount = 0;

  // Check temporal correlation and leader-follower patterns
  for (const e1 of events1) {
    // Find events from agent2 within window AFTER e1
    const followingEvents = events2.filter(
      (e2) => e2.timestamp > e1.timestamp && e2.timestamp <= e1.timestamp + windowMs
    );

    if (followingEvents.length > 0) {
      followCount++;
      const latency = followingEvents[0].timestamp - e1.timestamp;
      totalLatency += latency;
      latencyCount++;
    }

    // Find events from agent2 within window (before or after)
    const nearbyEvents = events2.filter(
      (e2) => Math.abs(e2.timestamp - e1.timestamp) <= windowMs
    );

    if (nearbyEvents.length > 0) {
      temporalMatches++;

      // Check directional correlation
      for (const e2 of nearbyEvents) {
        if (e1.type !== 'cancel' && e2.type !== 'cancel') {
          directionalTotal++;
          if (e1.type === e2.type) {
            directionalMatches++;
          }
        }
      }
    }
  }

  const maxPossible = Math.min(events1.length, events2.length);
  const temporalCorrelation = maxPossible > 0 ? temporalMatches / maxPossible : 0;
  const directionalCorrelation =
    directionalTotal > 0
      ? (directionalMatches / directionalTotal) * 2 - 1 // Scale to -1 to 1
      : 0;

  return {
    agent1: activity1.agentId,
    agent2: activity2.agentId,
    temporalCorrelation,
    directionalCorrelation,
    avgResponseLatency: latencyCount > 0 ? totalLatency / latencyCount : null,
    followCount,
  };
}

function detectLeaderFollower(
  agentMap: Map<string, AgentActivity>,
  windowMs: number
): LeaderFollowerPattern[] {
  const patterns: LeaderFollowerPattern[] = [];
  const agents = Array.from(agentMap.values());

  for (let i = 0; i < agents.length; i++) {
    for (let j = 0; j < agents.length; j++) {
      if (i === j) continue;

      const leader = agents[i];
      const follower = agents[j];

      let followCount = 0;
      let totalLatency = 0;

      for (const leaderEvent of leader.events) {
        const followingEvents = follower.events.filter(
          (e) =>
            e.timestamp > leaderEvent.timestamp &&
            e.timestamp <= leaderEvent.timestamp + windowMs &&
            e.type === leaderEvent.type // Same direction
        );

        if (followingEvents.length > 0) {
          followCount++;
          totalLatency += followingEvents[0].timestamp - leaderEvent.timestamp;
        }
      }

      const confidence = leader.events.length > 0 ? followCount / leader.events.length : 0;

      if (confidence > 0.3 && followCount >= 3) {
        patterns.push({
          leader: leader.agentId,
          follower: follower.agentId,
          confidence,
          avgLatency: followCount > 0 ? totalLatency / followCount : 0,
          occurrences: followCount,
        });
      }
    }
  }

  return patterns.sort((a, b) => b.confidence - a.confidence);
}

function detectSynchronized(
  agentMap: Map<string, AgentActivity>,
  windowMs: number
): SynchronizedPattern[] {
  const agents = Array.from(agentMap.values());
  if (agents.length < 2) return [];

  // Find time windows where multiple agents act together
  const allTimestamps = agents
    .flatMap((a) => a.events.map((e) => e.timestamp))
    .sort((a, b) => a - b);

  const patterns: SynchronizedPattern[] = [];
  const windowCounts = new Map<number, Set<string>>();

  // Bucket timestamps into windows
  for (const agent of agents) {
    for (const event of agent.events) {
      const windowStart = Math.floor(event.timestamp / windowMs) * windowMs;
      if (!windowCounts.has(windowStart)) {
        windowCounts.set(windowStart, new Set());
      }
      windowCounts.get(windowStart)!.add(agent.agentId);
    }
  }

  // Find windows with multiple agents
  const syncWindows: number[] = [];
  for (const [windowStart, agentSet] of windowCounts) {
    if (agentSet.size >= 2) {
      syncWindows.push(windowStart);
    }
  }

  if (syncWindows.length >= 2) {
    patterns.push({
      agents: agents.map((a) => a.agentId),
      windowMs,
      occurrences: syncWindows.length,
      timestamps: syncWindows.slice(0, 10), // Return first 10
    });
  }

  return patterns;
}

function detectOpposing(agentMap: Map<string, AgentActivity>): OpposingPattern[] {
  const patterns: OpposingPattern[] = [];
  const agents = Array.from(agentMap.values());

  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const agent1 = agents[i];
      const agent2 = agents[j];

      // Count buy/sell patterns
      const agent1Buys = agent1.events.filter((e) => e.type === 'buy').length;
      const agent1Sells = agent1.events.filter((e) => e.type === 'sell').length;
      const agent2Buys = agent2.events.filter((e) => e.type === 'buy').length;
      const agent2Sells = agent2.events.filter((e) => e.type === 'sell').length;

      // Check if they're mostly opposite
      const agent1BuyRatio = agent1Buys / (agent1Buys + agent1Sells || 1);
      const agent2BuyRatio = agent2Buys / (agent2Buys + agent2Sells || 1);

      const opposingScore = Math.abs(agent1BuyRatio - agent2BuyRatio);

      if (opposingScore > 0.5) {
        patterns.push({
          agent1: agent1.agentId,
          agent2: agent2.agentId,
          buyVsSellRatio: opposingScore,
          occurrences: Math.min(agent1.events.length, agent2.events.length),
        });
      }
    }
  }

  return patterns.sort((a, b) => b.buyVsSellRatio - a.buyVsSellRatio);
}

export const analyzeAgentCorrelation = tool({
  description:
    'Analyze trading pattern correlations between agents. Detects coordinated behavior, leader-follower patterns, and potential collusion or adversarial strategies.',
  inputSchema: z.object({
    sessionId: z.string().describe('The session ID'),
    agentIds: z
      .array(z.string())
      .optional()
      .describe('Specific agents to compare (default: all agents)'),
    windowMs: z
      .number()
      .default(1000)
      .describe('Time window in ms for correlation analysis'),
  }),
  execute: async ({
    sessionId,
    agentIds,
    windowMs,
  }: {
    sessionId: string;
    agentIds?: string[];
    windowMs: number;
  }): Promise<{
    correlations: PairwiseCorrelation[];
    patterns: {
      leaderFollower: LeaderFollowerPattern[];
      synchronized: SynchronizedPattern[];
      opposing: OpposingPattern[];
    };
    agentSummary: Array<{
      agentId: string;
      totalEvents: number;
      buyCount: number;
      sellCount: number;
      cancelCount: number;
    }>;
  }> => {
    const events = await fetchTapeEvents({
      sessionId,
      eventTypes: ['order_placed', 'order_cancelled', 'trade'],
      limit: 5000,
    });

    // Group events by agent
    let agentMap = groupByAgent(events);

    // Filter to specific agents if requested
    if (agentIds && agentIds.length > 0) {
      const filtered = new Map<string, AgentActivity>();
      for (const id of agentIds) {
        if (agentMap.has(id)) {
          filtered.set(id, agentMap.get(id)!);
        }
      }
      agentMap = filtered;
    }

    const agents = Array.from(agentMap.values());

    // Compute pairwise correlations
    const correlations: PairwiseCorrelation[] = [];
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        correlations.push(computePairwiseCorrelation(agents[i], agents[j], windowMs));
      }
    }

    // Detect patterns
    const patterns = {
      leaderFollower: detectLeaderFollower(agentMap, windowMs),
      synchronized: detectSynchronized(agentMap, windowMs),
      opposing: detectOpposing(agentMap),
    };

    // Generate agent summary
    const agentSummary = agents.map((a) => ({
      agentId: a.agentId,
      totalEvents: a.events.length,
      buyCount: a.events.filter((e) => e.type === 'buy').length,
      sellCount: a.events.filter((e) => e.type === 'sell').length,
      cancelCount: a.events.filter((e) => e.type === 'cancel').length,
    }));

    return {
      correlations,
      patterns,
      agentSummary,
    };
  },
});
