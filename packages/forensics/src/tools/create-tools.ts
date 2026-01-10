import { tool } from 'ai';
import { z } from 'zod';
import {
  getSession,
  fetchAllTapeEvents,
  fetchTapeEvents,
  getOHLCV,
  getSnapshots as getBookSnapshotsDb,
  saveReport,
} from '@ai-exchange/db';
import type {
  SessionManifest,
  TradeEvent,
  AgentStats,
  TapeEvent,
  TapeEventType,
  ForensicsReport,
  OrderBookSnapshot,
} from '@ai-exchange/types';
import { createCanvas } from '@napi-rs/canvas';
import { Chart, registerables } from 'chart.js';

// Register all Chart.js components
Chart.register(...registerables);

/**
 * Anonymize agent IDs so forensics can't identify agent types from IDs.
 * Maps real IDs like "informed-1" to anonymous IDs like "participant-A".
 */
function createAgentAnonymizer(agentIds: string[]) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const realToAnon = new Map<string, string>();
  const anonToReal = new Map<string, string>();

  // Sort for deterministic mapping, then assign anonymous IDs
  const sorted = [...agentIds].sort();
  sorted.forEach((realId, index) => {
    const anonId = `participant-${alphabet[index] || index}`;
    realToAnon.set(realId, anonId);
    anonToReal.set(anonId, realId);
  });

  return {
    anonymize: (realId: string) => realToAnon.get(realId) ?? realId,
    deanonymize: (anonId: string) => anonToReal.get(anonId) ?? anonId,
    getParticipantCount: () => realToAnon.size,
  };
}

/**
 * Recursively anonymize agent IDs in any object/array structure.
 */
function anonymizeDeep<T>(obj: T, anonymize: (id: string) => string): T {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => anonymizeDeep(item, anonymize)) as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Anonymize any field that looks like an agent ID
      if (
        (key === 'agentId' || key === 'buyAgentId' || key === 'sellAgentId' ||
         key === 'agent1' || key === 'agent2') &&
        typeof value === 'string'
      ) {
        result[key] = anonymize(value);
      } else if (typeof value === 'object') {
        result[key] = anonymizeDeep(value, anonymize);
      } else {
        result[key] = value;
      }
    }
    return result as T;
  }

  return obj;
}

/**
 * Create session-scoped tools for forensic investigation.
 * The sessionId is bound at creation time, so the agent doesn't need to specify it.
 *
 * IMPORTANT: Agent identities are anonymized to prevent the forensics agent
 * from knowing agent types upfront. It must infer behavior from observable data.
 */
export function createSessionTools(sessionId: string, investigationId: string) {
  // Verify session exists upfront
  const session = getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Build agent ID anonymizer from config
  const agentIds = session.config.agents.map(a => a.id);
  const anonymizer = createAgentAnonymizer(agentIds);

  return {
    get_session_manifest: tool({
      description: 'Get session overview with summary statistics. Call this first to understand what happened.',
      inputSchema: z.object({}),
      execute: async () => {
        const events = await fetchAllTapeEvents(sessionId);
        const trades = events.filter((e): e is TradeEvent => e.type === 'trade');

        const prices = trades.map((t) => t.trade.price);
        const priceRange = {
          low: prices.length > 0 ? Math.min(...prices) : 0,
          high: prices.length > 0 ? Math.max(...prices) : 0,
        };

        const volumeTotal = trades.reduce((sum, t) => sum + t.trade.quantity, 0);

        // Build stats using REAL IDs internally
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

        // Convert to anonymized stats
        const anonymizedStats: Record<string, AgentStats> = {};
        for (const [realId, stats] of Object.entries(agentStats)) {
          const anonId = anonymizer.anonymize(realId);
          anonymizedStats[anonId] = {
            ...stats,
            agentId: anonId,
          };
        }

        const keyTimestamps: number[] = [];
        for (const event of events) {
          if (event.type === 'news') {
            keyTimestamps.push(event.timestamp);
          }
        }

        // Return SANITIZED session info - no config, no agent types
        return {
          session: {
            id: session!.id,
            name: session!.name,
            status: session!.status,
            createdAt: session!.createdAt,
            completedAt: session!.completedAt,
            durationMs: session!.config.durationMs,
            eventCount: session!.eventCount,
            tradeCount: session!.tradeCount,
            finalPrice: session!.finalPrice,
            // NOTE: config is intentionally omitted - forensics shouldn't see agent archetypes
          },
          summary: {
            priceRange,
            volumeTotal,
            participantCount: anonymizer.getParticipantCount(),
            agentStats: anonymizedStats,
            keyTimestamps,
          },
        };
      },
    }),

    fetch_tape: tool({
      description: 'Fetch tape events within a time window or by event type. Examine specific periods of activity.',
      inputSchema: z.object({
        startTime: z.number().optional().describe('Start timestamp in ms'),
        endTime: z.number().optional().describe('End timestamp in ms'),
        eventTypes: z
          .array(z.enum(['order_placed', 'order_cancelled', 'trade', 'book_snapshot', 'news', 'rumor', 'doc_inject']))
          .optional()
          .describe('Filter by event types'),
        limit: z.number().default(50).describe('Max events to return'),
      }),
      execute: async ({ startTime, endTime, eventTypes, limit }) => {
        const events = await fetchTapeEvents({
          sessionId,
          startTime,
          endTime,
          eventTypes: eventTypes as TapeEventType[] | undefined,
          limit,
        });
        // Anonymize all agent IDs in returned events
        const anonymizedEvents = anonymizeDeep(events, anonymizer.anonymize);
        return { events: anonymizedEvents };
      },
    }),

    get_ohlcv: tool({
      description: 'Get OHLCV candlestick data for price analysis. Data is stored at 1000ms resolution and will be aggregated to your requested resolution.',
      inputSchema: z.object({
        resolution: z.number().default(1000).describe('Candle width in ms (will aggregate from 1000ms base)'),
        startTime: z.number().optional().describe('Start timestamp'),
        endTime: z.number().optional().describe('End timestamp'),
      }),
      execute: async ({ resolution, startTime, endTime }) => {
        // Always fetch from base 1000ms resolution and aggregate if needed
        const baseBars = getOHLCV(sessionId, 1000, startTime, endTime);

        if (baseBars.length === 0) {
          return { bars: [], count: 0, note: 'No OHLCV data available for this session' };
        }

        // If requesting base resolution, return as-is
        if (resolution <= 1000) {
          return { bars: baseBars, count: baseBars.length };
        }

        // Aggregate bars to requested resolution
        const aggregatedBars: typeof baseBars = [];
        let currentBucket: typeof baseBars = [];
        let bucketStart = Math.floor(baseBars[0].intervalStart / resolution) * resolution;

        for (const bar of baseBars) {
          const barBucket = Math.floor(bar.intervalStart / resolution) * resolution;

          if (barBucket !== bucketStart && currentBucket.length > 0) {
            // Emit aggregated bar
            aggregatedBars.push({
              sessionId: currentBucket[0].sessionId,
              intervalStart: bucketStart,
              resolution: resolution,
              open: currentBucket[0].open,
              high: Math.max(...currentBucket.map(b => b.high)),
              low: Math.min(...currentBucket.map(b => b.low)),
              close: currentBucket[currentBucket.length - 1].close,
              volume: currentBucket.reduce((sum, b) => sum + b.volume, 0),
              tradeCount: currentBucket.reduce((sum, b) => sum + b.tradeCount, 0),
            });
            currentBucket = [];
            bucketStart = barBucket;
          }

          currentBucket.push(bar);
        }

        // Emit final bucket
        if (currentBucket.length > 0) {
          aggregatedBars.push({
            sessionId: currentBucket[0].sessionId,
            intervalStart: bucketStart,
            resolution: resolution,
            open: currentBucket[0].open,
            high: Math.max(...currentBucket.map(b => b.high)),
            low: Math.min(...currentBucket.map(b => b.low)),
            close: currentBucket[currentBucket.length - 1].close,
            volume: currentBucket.reduce((sum, b) => sum + b.volume, 0),
            tradeCount: currentBucket.reduce((sum, b) => sum + b.tradeCount, 0),
          });
        }

        return { bars: aggregatedBars, count: aggregatedBars.length };
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
      description: 'Render a price chart for visual analysis. Returns a PNG image that you can analyze visually to identify patterns, trends, and anomalies.',
      inputSchema: z.object({
        startTime: z.number().optional().describe('Start timestamp'),
        endTime: z.number().optional().describe('End timestamp'),
        resolution: z.number().default(1000).describe('Candle width in ms'),
        chartType: z.enum(['candlestick', 'line', 'volume']).default('line'),
        width: z.number().default(400).describe('Chart width in pixels (smaller = fewer tokens)'),
        height: z.number().default(200).describe('Chart height in pixels (smaller = fewer tokens)'),
      }),
      execute: async ({ startTime, endTime, resolution, chartType, width, height }) => {
        try {
          // Always fetch from base 1000ms resolution and aggregate if needed
          const baseBars = getOHLCV(sessionId, 1000, startTime, endTime);
          if (baseBars.length === 0) {
            return { error: 'No OHLCV data available for chart', imageBuffer: null };
          }

          // Aggregate bars to requested resolution if needed
          let bars = baseBars;
          if (resolution > 1000) {
            const aggregatedBars: typeof baseBars = [];
            let currentBucket: typeof baseBars = [];
            let bucketStart = Math.floor(baseBars[0].intervalStart / resolution) * resolution;

            for (const bar of baseBars) {
              const barBucket = Math.floor(bar.intervalStart / resolution) * resolution;

              if (barBucket !== bucketStart && currentBucket.length > 0) {
                aggregatedBars.push({
                  sessionId: currentBucket[0].sessionId,
                  intervalStart: bucketStart,
                  resolution: resolution,
                  open: currentBucket[0].open,
                  high: Math.max(...currentBucket.map(b => b.high)),
                  low: Math.min(...currentBucket.map(b => b.low)),
                  close: currentBucket[currentBucket.length - 1].close,
                  volume: currentBucket.reduce((sum, b) => sum + b.volume, 0),
                  tradeCount: currentBucket.reduce((sum, b) => sum + b.tradeCount, 0),
                });
                currentBucket = [];
                bucketStart = barBucket;
              }
              currentBucket.push(bar);
            }

            if (currentBucket.length > 0) {
              aggregatedBars.push({
                sessionId: currentBucket[0].sessionId,
                intervalStart: bucketStart,
                resolution: resolution,
                open: currentBucket[0].open,
                high: Math.max(...currentBucket.map(b => b.high)),
                low: Math.min(...currentBucket.map(b => b.low)),
                close: currentBucket[currentBucket.length - 1].close,
                volume: currentBucket.reduce((sum, b) => sum + b.volume, 0),
                tradeCount: currentBucket.reduce((sum, b) => sum + b.tradeCount, 0),
              });
            }
            bars = aggregatedBars;
          }

          // Create canvas using @napi-rs/canvas (no Cairo dependency)
          const canvas = createCanvas(width, height);
          const ctx = canvas.getContext('2d');

          // Fill white background
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, width, height);

          // Create Chart.js chart
          const labels = bars.map((b) => {
            const seconds = Math.floor(b.intervalStart / 1000);
            return `${seconds}s`;
          });

          let chartConfig: {
            type: 'line' | 'bar';
            data: {
              labels: string[];
              datasets: Array<{
                label: string;
                data: number[];
                borderColor?: string;
                backgroundColor?: string | string[];
                fill?: boolean;
                tension?: number;
              }>;
            };
            options: object;
          };

          if (chartType === 'line') {
            chartConfig = {
              type: 'line',
              data: {
                labels,
                datasets: [{
                  label: 'Close Price',
                  data: bars.map((b) => b.close),
                  borderColor: 'rgb(75, 192, 192)',
                  fill: false,
                  tension: 0.1,
                }],
              },
              options: {
                responsive: false,
                animation: false,
                plugins: {
                  title: { display: true, text: 'Price Chart' },
                },
                scales: {
                  y: { beginAtZero: false },
                },
              },
            };
          } else if (chartType === 'volume') {
            chartConfig = {
              type: 'bar',
              data: {
                labels,
                datasets: [{
                  label: 'Volume',
                  data: bars.map((b) => b.volume),
                  backgroundColor: 'rgba(54, 162, 235, 0.5)',
                }],
              },
              options: {
                responsive: false,
                animation: false,
                plugins: {
                  title: { display: true, text: 'Volume Chart' },
                },
              },
            };
          } else {
            // Candlestick approximation using OHLC data
            // Show as line chart with high/low range shading
            chartConfig = {
              type: 'line',
              data: {
                labels,
                datasets: [
                  {
                    label: 'High',
                    data: bars.map((b) => b.high),
                    borderColor: 'rgba(75, 192, 192, 0.5)',
                    fill: false,
                  },
                  {
                    label: 'Close',
                    data: bars.map((b) => b.close),
                    borderColor: bars.map((b) => b.close >= b.open ? 'green' : 'red').join(',') ? 'rgb(0, 128, 0)' : 'rgb(255, 0, 0)',
                    fill: false,
                    tension: 0,
                  },
                  {
                    label: 'Low',
                    data: bars.map((b) => b.low),
                    borderColor: 'rgba(255, 99, 132, 0.5)',
                    fill: false,
                  },
                ],
              },
              options: {
                responsive: false,
                animation: false,
                plugins: {
                  title: { display: true, text: 'OHLC Chart (High/Close/Low)' },
                },
                scales: {
                  y: { beginAtZero: false },
                },
              },
            };
          }

          // Render chart to canvas
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          new Chart(ctx as any, chartConfig);

          // Export to PNG buffer
          const buffer = canvas.toBuffer('image/png');

          return {
            imageBuffer: buffer,
            barCount: bars.length,
            priceRange: {
              low: Math.min(...bars.map(b => b.low)),
              high: Math.max(...bars.map(b => b.high)),
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            error: `Chart rendering failed: ${errorMessage}`,
            imageBuffer: null,
            suggestion: 'Use get_ohlcv tool for raw price data instead',
          };
        }
      },
      // Convert tool result to multimodal content so the model can "see" the chart
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toModelOutput: ({ output }: { output: any }) => {
        if (!output.imageBuffer) {
          return { type: 'text' as const, value: JSON.stringify({ error: output.error, suggestion: output.suggestion }) };
        }
        return {
          type: 'content' as const,
          value: [
            {
              type: 'text' as const,
              text: `Chart rendered: ${output.barCount} bars, price range $${output.priceRange.low.toFixed(2)} - $${output.priceRange.high.toFixed(2)}`,
            },
            {
              type: 'media' as const,
              data: output.imageBuffer.toString('base64'),
              mediaType: 'image/png' as const,
            },
          ],
        };
      },
    }),

    // NOTE: get_agent_thoughts removed - forensics shouldn't have access to internal reasoning
    // Investigators must infer intent from observable behavior only

    analyze_agent_correlation: tool({
      description: 'Analyze trading correlations between participants to detect coordination.',
      inputSchema: z.object({
        participantIds: z.array(z.string()).optional().describe('Specific participants to compare (e.g., participant-A, participant-B)'),
        windowMs: z.number().default(1000).describe('Time window for correlation'),
      }),
      execute: async ({ participantIds, windowMs }) => {
        // Convert anonymized IDs back to real IDs for querying
        const realIds = participantIds?.map(id => anonymizer.deanonymize(id));

        const events = await fetchTapeEvents({
          sessionId,
          eventTypes: ['trade', 'order_placed'],
          limit: 10000,
        });

        const agentActivity: Record<string, Array<{ timestamp: number; side: 'buy' | 'sell' }>> = {};

        for (const event of events) {
          if (event.type === 'trade') {
            const trade = event.trade;
            if (!realIds || realIds.includes(trade.buyAgentId)) {
              if (!agentActivity[trade.buyAgentId]) agentActivity[trade.buyAgentId] = [];
              agentActivity[trade.buyAgentId].push({ timestamp: event.timestamp, side: 'buy' });
            }
            if (!realIds || realIds.includes(trade.sellAgentId)) {
              if (!agentActivity[trade.sellAgentId]) agentActivity[trade.sellAgentId] = [];
              agentActivity[trade.sellAgentId].push({ timestamp: event.timestamp, side: 'sell' });
            }
          }
        }

        const agents = Object.keys(agentActivity);
        const correlations: Array<{ participant1: string; participant2: string; correlation: number }> = [];

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
                // Return anonymized IDs
                participant1: anonymizer.anonymize(agents[i]),
                participant2: anonymizer.anonymize(agents[j]),
                correlation: (sameDirection - oppositeDirection) / total,
              });
            }
          }
        }

        return { correlations, participantCount: agents.length };
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
        // Save report to database with investigation ID
        saveReport(investigationId, sessionId, report);
        return { success: true, report };
      },
    }),
  };
}

export type SessionTools = ReturnType<typeof createSessionTools>;
