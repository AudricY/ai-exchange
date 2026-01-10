import { tool } from 'ai';
import { z } from 'zod';
import {
  getSession,
  fetchAllTapeEvents,
  fetchTapeEvents,
  getOHLCV,
  getSnapshots as getBookSnapshotsDb,
} from '@ai-exchange/db';
import type {
  SessionManifest,
  TradeEvent,
  AgentStats,
  TapeEvent,
  TapeEventType,
  ForensicsReport,
  AgentThoughtEvent,
  OrderBookSnapshot,
} from '@ai-exchange/types';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import type { ChartConfiguration } from 'chart.js';

/**
 * Create session-scoped tools for forensic investigation.
 * The sessionId is bound at creation time, so the agent doesn't need to specify it.
 */
export function createSessionTools(sessionId: string) {
  // Verify session exists upfront
  const session = getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  return {
    get_session_manifest: tool({
      description: 'Get session overview with summary statistics. Call this first to understand what happened.',
      inputSchema: z.object({}),
      execute: async (): Promise<SessionManifest | { error: string }> => {
        const events = await fetchAllTapeEvents(sessionId);
        const trades = events.filter((e): e is TradeEvent => e.type === 'trade');

        const prices = trades.map((t) => t.trade.price);
        const priceRange = {
          low: prices.length > 0 ? Math.min(...prices) : 0,
          high: prices.length > 0 ? Math.max(...prices) : 0,
        };

        const volumeTotal = trades.reduce((sum, t) => sum + t.trade.quantity, 0);

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

        const keyTimestamps: number[] = [];
        for (const event of events) {
          if (event.type === 'news') {
            keyTimestamps.push(event.timestamp);
          }
        }

        return {
          session: session!,
          summary: { priceRange, volumeTotal, agentStats, keyTimestamps },
        };
      },
    }),

    fetch_tape: tool({
      description: 'Fetch tape events within a time window or by event type. Examine specific periods of activity.',
      inputSchema: z.object({
        startTime: z.number().optional().describe('Start timestamp in ms'),
        endTime: z.number().optional().describe('End timestamp in ms'),
        eventTypes: z
          .array(z.enum(['order_placed', 'order_cancelled', 'trade', 'book_snapshot', 'news', 'rumor', 'doc_inject', 'agent_thought']))
          .optional()
          .describe('Filter by event types'),
        limit: z.number().default(50).describe('Max events to return'),
      }),
      execute: async ({ startTime, endTime, eventTypes, limit }): Promise<{ events: TapeEvent[] }> => {
        const events = await fetchTapeEvents({
          sessionId,
          startTime,
          endTime,
          eventTypes: eventTypes as TapeEventType[] | undefined,
          limit,
        });
        return { events };
      },
    }),

    get_ohlcv: tool({
      description: 'Get OHLCV candlestick data for price analysis.',
      inputSchema: z.object({
        resolution: z.number().default(1000).describe('Candle width in ms'),
        startTime: z.number().optional().describe('Start timestamp'),
        endTime: z.number().optional().describe('End timestamp'),
      }),
      execute: async ({ resolution, startTime, endTime }) => {
        const bars = getOHLCV(sessionId, resolution, startTime, endTime);
        return { bars, count: bars.length };
      },
    }),

    get_book_snapshots: tool({
      description: 'Get order book snapshots to analyze liquidity at specific times.',
      inputSchema: z.object({
        at: z.number().optional().describe('Get snapshot closest to this timestamp'),
        startTime: z.number().optional().describe('Start of range'),
        endTime: z.number().optional().describe('End of range'),
        limit: z.number().default(10).describe('Max snapshots to return'),
      }),
      execute: async ({ at, startTime, endTime, limit }) => {
        const snapshots = getBookSnapshotsDb(sessionId, startTime ?? at, endTime, limit);
        return { snapshots, count: snapshots.length };
      },
    }),

    compute_microstructure_metrics: tool({
      description: 'Compute market microstructure metrics for a time window.',
      inputSchema: z.object({
        startTime: z.number().describe('Start timestamp'),
        endTime: z.number().describe('End timestamp'),
      }),
      execute: async ({ startTime, endTime }) => {
        const events = await fetchTapeEvents({
          sessionId,
          startTime,
          endTime,
          eventTypes: ['trade', 'order_placed', 'order_cancelled'],
          limit: 10000,
        });

        const trades = events.filter((e): e is TradeEvent => e.type === 'trade');
        if (trades.length === 0) {
          return { error: 'No trades in window', metrics: null };
        }

        const prices = trades.map((t) => t.trade.price);
        const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);

        const snapshots = getBookSnapshotsDb(sessionId, startTime, endTime, 100);
        const spreads = snapshots
          .filter((s: OrderBookSnapshot) => s.bids.length > 0 && s.asks.length > 0)
          .map((s: OrderBookSnapshot) => s.asks[0].price - s.bids[0].price);

        return {
          metrics: {
            tradeCount: trades.length,
            avgPrice: prices.reduce((a: number, b: number) => a + b, 0) / prices.length,
            priceVolatility: returns.length > 0
              ? Math.sqrt(returns.map((r) => r * r).reduce((a: number, b: number) => a + b, 0) / returns.length)
              : 0,
            avgSpread: spreads.length > 0 ? spreads.reduce((a: number, b: number) => a + b, 0) / spreads.length : null,
            volumeTotal: trades.reduce((sum, t) => sum + t.trade.quantity, 0),
          },
        };
      },
    }),

    render_chart: tool({
      description: 'Render a price chart for visual analysis. Returns base64 PNG image.',
      inputSchema: z.object({
        startTime: z.number().optional().describe('Start timestamp'),
        endTime: z.number().optional().describe('End timestamp'),
        resolution: z.number().default(1000).describe('Candle width in ms'),
        chartType: z.enum(['candlestick', 'line', 'volume']).default('candlestick'),
        width: z.number().default(800),
        height: z.number().default(400),
      }),
      execute: async ({ startTime, endTime, resolution, chartType, width, height }) => {
        const bars = getOHLCV(sessionId, resolution, startTime, endTime);
        if (bars.length === 0) {
          return { error: 'No data for chart', image: null };
        }

        const chartJSNodeCanvas = new ChartJSNodeCanvas({
          width,
          height,
          backgroundColour: 'white',
        });

        let config: ChartConfiguration;
        if (chartType === 'line') {
          config = {
            type: 'line',
            data: {
              labels: bars.map((b) => `${b.intervalStart}ms`),
              datasets: [{
                label: 'Close Price',
                data: bars.map((b) => b.close),
                borderColor: 'blue',
                fill: false,
              }],
            },
          };
        } else if (chartType === 'volume') {
          config = {
            type: 'bar',
            data: {
              labels: bars.map((b) => `${b.intervalStart}ms`),
              datasets: [{
                label: 'Volume',
                data: bars.map((b) => b.volume),
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
              }],
            },
          };
        } else {
          config = {
            type: 'bar',
            data: {
              labels: bars.map((b) => `${b.intervalStart}ms`),
              datasets: [
                {
                  label: 'Price Range',
                  data: bars.map((b) => [b.low, b.high]),
                  backgroundColor: bars.map((b) => (b.close >= b.open ? 'green' : 'red')),
                },
              ],
            },
          };
        }

        const imageBuffer = await chartJSNodeCanvas.renderToBuffer(config);
        return {
          image: imageBuffer.toString('base64'),
          mimeType: 'image/png',
          barCount: bars.length,
        };
      },
    }),

    get_agent_thoughts: tool({
      description: 'Get agent thought events to understand trader reasoning.',
      inputSchema: z.object({
        agentId: z.string().optional().describe('Filter by agent'),
        startTime: z.number().optional(),
        endTime: z.number().optional(),
        limit: z.number().default(50),
      }),
      execute: async ({ agentId, startTime, endTime, limit }) => {
        const events = await fetchTapeEvents({
          sessionId,
          startTime,
          endTime,
          eventTypes: ['agent_thought'],
          limit: limit * 2,
        });

        const thoughtEvents = events.filter(
          (e): e is AgentThoughtEvent => e.type === 'agent_thought'
        );

        const filtered = agentId
          ? thoughtEvents.filter((e) => e.agentId === agentId)
          : thoughtEvents;

        return {
          thoughts: filtered.slice(0, limit).map((e) => ({
            timestamp: e.timestamp,
            agentId: e.agentId,
            thought: e.thought,
          })),
          count: filtered.length,
        };
      },
    }),

    analyze_agent_correlation: tool({
      description: 'Analyze trading correlations between agents to detect coordination.',
      inputSchema: z.object({
        agentIds: z.array(z.string()).optional().describe('Specific agents to compare'),
        windowMs: z.number().default(1000).describe('Time window for correlation'),
      }),
      execute: async ({ agentIds, windowMs }) => {
        const events = await fetchTapeEvents({
          sessionId,
          eventTypes: ['trade', 'order_placed'],
          limit: 10000,
        });

        const agentActivity: Record<string, Array<{ timestamp: number; side: 'buy' | 'sell' }>> = {};

        for (const event of events) {
          if (event.type === 'trade') {
            const trade = event.trade;
            if (!agentIds || agentIds.includes(trade.buyAgentId)) {
              if (!agentActivity[trade.buyAgentId]) agentActivity[trade.buyAgentId] = [];
              agentActivity[trade.buyAgentId].push({ timestamp: event.timestamp, side: 'buy' });
            }
            if (!agentIds || agentIds.includes(trade.sellAgentId)) {
              if (!agentActivity[trade.sellAgentId]) agentActivity[trade.sellAgentId] = [];
              agentActivity[trade.sellAgentId].push({ timestamp: event.timestamp, side: 'sell' });
            }
          }
        }

        const agents = Object.keys(agentActivity);
        const correlations: Array<{ agent1: string; agent2: string; correlation: number }> = [];

        for (let i = 0; i < agents.length; i++) {
          for (let j = i + 1; j < agents.length; j++) {
            const a1 = agentActivity[agents[i]];
            const a2 = agentActivity[agents[j]];
            let sameDirection = 0;
            let oppositeDirection = 0;

            for (const act1 of a1) {
              for (const act2 of a2) {
                if (Math.abs(act1.timestamp - act2.timestamp) <= windowMs) {
                  if (act1.side === act2.side) sameDirection++;
                  else oppositeDirection++;
                }
              }
            }

            const total = sameDirection + oppositeDirection;
            if (total > 0) {
              correlations.push({
                agent1: agents[i],
                agent2: agents[j],
                correlation: (sameDirection - oppositeDirection) / total,
              });
            }
          }
        }

        return { correlations, agentCount: agents.length };
      },
    }),

    detect_patterns: tool({
      description: 'Run pattern detection algorithms on price and volume data.',
      inputSchema: z.object({
        patterns: z
          .array(z.enum(['momentum_shift', 'volume_spike', 'price_gap', 'consolidation']))
          .optional()
          .describe('Patterns to detect (default: all)'),
        sensitivity: z.enum(['low', 'medium', 'high']).default('medium'),
      }),
      execute: async ({ patterns, sensitivity }) => {
        const bars = getOHLCV(sessionId, 1000);
        const detected: Array<{
          type: string;
          timestamp: number;
          description: string;
          confidence: number;
        }> = [];

        const threshold = sensitivity === 'high' ? 0.01 : sensitivity === 'medium' ? 0.02 : 0.03;

        if (!patterns || patterns.includes('momentum_shift')) {
          for (let i = 2; i < bars.length; i++) {
            const prev = (bars[i - 1].close - bars[i - 2].close) / bars[i - 2].close;
            const curr = (bars[i].close - bars[i - 1].close) / bars[i - 1].close;
            if (prev > threshold && curr < -threshold) {
              detected.push({
                type: 'momentum_shift',
                timestamp: bars[i].intervalStart,
                description: 'Bullish to bearish reversal',
                confidence: Math.min(1, (Math.abs(prev) + Math.abs(curr)) / (threshold * 4)),
              });
            } else if (prev < -threshold && curr > threshold) {
              detected.push({
                type: 'momentum_shift',
                timestamp: bars[i].intervalStart,
                description: 'Bearish to bullish reversal',
                confidence: Math.min(1, (Math.abs(prev) + Math.abs(curr)) / (threshold * 4)),
              });
            }
          }
        }

        if (!patterns || patterns.includes('volume_spike')) {
          const avgVolume = bars.reduce((s, b) => s + b.volume, 0) / bars.length;
          for (const bar of bars) {
            if (bar.volume > avgVolume * 3) {
              detected.push({
                type: 'volume_spike',
                timestamp: bar.intervalStart,
                description: `Volume ${(bar.volume / avgVolume).toFixed(1)}x average`,
                confidence: Math.min(1, bar.volume / (avgVolume * 5)),
              });
            }
          }
        }

        if (!patterns || patterns.includes('price_gap')) {
          for (let i = 1; i < bars.length; i++) {
            const gap = Math.abs(bars[i].open - bars[i - 1].close) / bars[i - 1].close;
            if (gap > threshold * 2) {
              detected.push({
                type: 'price_gap',
                timestamp: bars[i].intervalStart,
                description: `${(gap * 100).toFixed(2)}% gap`,
                confidence: Math.min(1, gap / (threshold * 4)),
              });
            }
          }
        }

        return { patterns: detected.sort((a, b) => a.timestamp - b.timestamp), count: detected.length };
      },
    }),

    emit_report: tool({
      description: 'Emit the final forensic investigation report. Call this when your investigation is complete.',
      inputSchema: z.object({
        summary: z.string().describe('2-3 sentence executive summary'),
        timeline: z.array(z.object({
          timestamp: z.number(),
          description: z.string(),
          significance: z.enum(['low', 'medium', 'high']),
          evidenceRefs: z.array(z.object({
            eventId: z.string().optional(),
            timestamp: z.number().optional(),
            description: z.string(),
          })).default([]),
        })),
        hypotheses: z.array(z.object({
          id: z.string().describe('Unique identifier for this hypothesis'),
          description: z.string(),
          status: z.enum(['investigating', 'supported', 'rejected']),
          confidence: z.number().min(0).max(1),
          supportingEvidence: z.array(z.object({
            eventId: z.string().optional(),
            description: z.string(),
            timestamp: z.number().optional(),
          })).default([]),
          contradictingEvidence: z.array(z.object({
            eventId: z.string().optional(),
            description: z.string(),
            timestamp: z.number().optional(),
          })).default([]),
        })),
        causalChain: z.array(z.object({
          cause: z.object({
            eventId: z.string().optional(),
            description: z.string(),
            timestamp: z.number().optional(),
          }),
          effect: z.object({
            eventId: z.string().optional(),
            description: z.string(),
            timestamp: z.number().optional(),
          }),
          explanation: z.string(),
        })).default([]),
        anomalies: z.array(z.object({
          type: z.enum(['spoofing', 'momentum_ignition', 'wash_trading', 'rumor_cascade', 'other']),
          description: z.string(),
          confidence: z.number().min(0).max(1),
          evidence: z.array(z.object({
            eventId: z.string().optional(),
            description: z.string(),
            timestamp: z.number().optional(),
          })).default([]),
        })).default([]),
        conclusion: z.string().describe('Final conclusion with key findings'),
      }),
      execute: async (reportData): Promise<{ success: boolean; report: ForensicsReport }> => {
        const report: ForensicsReport = {
          sessionId,
          generatedAt: new Date().toISOString(),
          ...reportData,
        };
        return { success: true, report };
      },
    }),
  };
}

export type SessionTools = ReturnType<typeof createSessionTools>;
