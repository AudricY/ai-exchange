import { tool } from 'ai';
import { z } from 'zod';
import { getSession, fetchAllTapeEvents, getOHLCV } from '@ai-exchange/db';
import type { SessionManifest, TradeEvent, AgentStats } from '@ai-exchange/types';

export const getSessionManifest = tool({
  description:
    'Get the session manifest with summary statistics. Call this first to understand the session.',
  parameters: z.object({
    sessionId: z.string().describe('The session ID to get manifest for'),
  }),
  execute: async ({ sessionId }): Promise<SessionManifest | { error: string }> => {
    const session = getSession(sessionId);
    if (!session) {
      return { error: 'Session not found' };
    }

    // Get all events to compute stats
    const events = await fetchAllTapeEvents(sessionId);
    const trades = events.filter((e): e is TradeEvent => e.type === 'trade');

    // Get OHLCV for price range
    const ohlcv = getOHLCV(sessionId, 1000);

    // Compute price range
    const prices = trades.map((t) => t.trade.price);
    const priceRange = {
      low: prices.length > 0 ? Math.min(...prices) : 0,
      high: prices.length > 0 ? Math.max(...prices) : 0,
    };

    // Compute volume
    const volumeTotal = trades.reduce((sum, t) => sum + t.trade.quantity, 0);

    // Compute per-agent stats
    const agentStats: Record<string, AgentStats> = {};

    for (const event of events) {
      if (event.type === 'order_placed') {
        const agentId = event.order.agentId;
        if (!agentStats[agentId]) {
          agentStats[agentId] = {
            agentId,
            ordersPlaced: 0,
            ordersCancelled: 0,
            tradesAsBuyer: 0,
            tradesAsSeller: 0,
            volumeTraded: 0,
            pnl: 0,
          };
        }
        agentStats[agentId].ordersPlaced++;
      } else if (event.type === 'order_cancelled') {
        const agentId = event.agentId;
        if (agentStats[agentId]) {
          agentStats[agentId].ordersCancelled++;
        }
      } else if (event.type === 'trade') {
        const trade = event.trade;

        if (!agentStats[trade.buyAgentId]) {
          agentStats[trade.buyAgentId] = {
            agentId: trade.buyAgentId,
            ordersPlaced: 0,
            ordersCancelled: 0,
            tradesAsBuyer: 0,
            tradesAsSeller: 0,
            volumeTraded: 0,
            pnl: 0,
          };
        }
        if (!agentStats[trade.sellAgentId]) {
          agentStats[trade.sellAgentId] = {
            agentId: trade.sellAgentId,
            ordersPlaced: 0,
            ordersCancelled: 0,
            tradesAsBuyer: 0,
            tradesAsSeller: 0,
            volumeTraded: 0,
            pnl: 0,
          };
        }

        agentStats[trade.buyAgentId].tradesAsBuyer++;
        agentStats[trade.buyAgentId].volumeTraded += trade.quantity;
        agentStats[trade.sellAgentId].tradesAsSeller++;
        agentStats[trade.sellAgentId].volumeTraded += trade.quantity;
      }
    }

    // Find key timestamps (news events, large price moves)
    const keyTimestamps: number[] = [];
    for (const event of events) {
      if (event.type === 'news') {
        keyTimestamps.push(event.timestamp);
      }
    }

    return {
      session,
      summary: {
        priceRange,
        volumeTotal,
        agentStats,
        keyTimestamps,
      },
    };
  },
});
