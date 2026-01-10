import { tool } from 'ai';
import { z } from 'zod';
import { fetchTapeEvents, getSnapshots } from '@ai-exchange/db';
import type { TradeEvent, BookSnapshotEvent } from '@ai-exchange/types';

interface MicrostructureMetrics {
  avgSpread: number;
  avgDepthBid: number;
  avgDepthAsk: number;
  orderImbalance: number;
  volatility: number;
  tradeCount: number;
  avgTradeSize: number;
  priceChange: number;
  priceChangePercent: number;
}

export const computeMicrostructureMetrics = tool({
  description:
    'Compute microstructure metrics for a time window: spread, depth, imbalance, volatility, trade statistics.',
  inputSchema: z.object({
    sessionId: z.string().describe('The session ID'),
    startTime: z.number().describe('Start timestamp'),
    endTime: z.number().describe('End timestamp'),
  }),
  execute: async ({
    sessionId,
    startTime,
    endTime,
  }: {
    sessionId: string;
    startTime: number;
    endTime: number;
  }): Promise<MicrostructureMetrics> => {
    // Get trades in window
    const events = await fetchTapeEvents({
      sessionId,
      startTime,
      endTime,
      eventTypes: ['trade'],
      limit: 1000,
    });

    const trades = events as TradeEvent[];

    // Get snapshots in window
    const snapshots = getSnapshots(sessionId, startTime, endTime, 100);

    // Compute spread metrics
    let totalSpread = 0;
    let totalDepthBid = 0;
    let totalDepthAsk = 0;
    let snapshotCount = 0;

    for (const snap of snapshots) {
      if (snap.bids.length > 0 && snap.asks.length > 0) {
        totalSpread += snap.asks[0].price - snap.bids[0].price;
        totalDepthBid += snap.bids.reduce((sum, l) => sum + l.quantity, 0);
        totalDepthAsk += snap.asks.reduce((sum, l) => sum + l.quantity, 0);
        snapshotCount++;
      }
    }

    const avgSpread = snapshotCount > 0 ? totalSpread / snapshotCount : 0;
    const avgDepthBid = snapshotCount > 0 ? totalDepthBid / snapshotCount : 0;
    const avgDepthAsk = snapshotCount > 0 ? totalDepthAsk / snapshotCount : 0;

    // Order imbalance (positive = more buy pressure)
    const orderImbalance =
      avgDepthBid + avgDepthAsk > 0
        ? (avgDepthBid - avgDepthAsk) / (avgDepthBid + avgDepthAsk)
        : 0;

    // Trade statistics
    const tradeCount = trades.length;
    const tradePrices = trades.map((t) => t.trade.price);
    const tradeSizes = trades.map((t) => t.trade.quantity);

    const avgTradeSize =
      tradeSizes.length > 0
        ? tradeSizes.reduce((a, b) => a + b, 0) / tradeSizes.length
        : 0;

    // Volatility (standard deviation of returns)
    let volatility = 0;
    if (tradePrices.length > 1) {
      const returns: number[] = [];
      for (let i = 1; i < tradePrices.length; i++) {
        returns.push(
          (tradePrices[i] - tradePrices[i - 1]) / tradePrices[i - 1]
        );
      }
      const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const squaredDiffs = returns.map((r) => Math.pow(r - meanReturn, 2));
      volatility = Math.sqrt(
        squaredDiffs.reduce((a, b) => a + b, 0) / returns.length
      );
    }

    // Price change
    const priceChange =
      tradePrices.length > 1
        ? tradePrices[tradePrices.length - 1] - tradePrices[0]
        : 0;
    const priceChangePercent =
      tradePrices.length > 1 && tradePrices[0] > 0
        ? (priceChange / tradePrices[0]) * 100
        : 0;

    return {
      avgSpread,
      avgDepthBid,
      avgDepthAsk,
      orderImbalance,
      volatility,
      tradeCount,
      avgTradeSize,
      priceChange,
      priceChangePercent,
    };
  },
});
