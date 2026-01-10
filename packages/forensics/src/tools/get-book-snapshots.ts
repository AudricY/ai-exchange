import { tool } from 'ai';
import { z } from 'zod';
import { getSnapshots, getSnapshotAt } from '@ai-exchange/db';
import type { OrderBookSnapshot } from '@ai-exchange/types';

export const getBookSnapshots = tool({
  description:
    'Get order book snapshots to analyze market depth and liquidity at specific times.',
  inputSchema: z.object({
    sessionId: z.string().describe('The session ID'),
    at: z
      .number()
      .optional()
      .describe('Get snapshot at or before this timestamp'),
    startTime: z.number().optional().describe('Start of time range'),
    endTime: z.number().optional().describe('End of time range'),
    limit: z.number().default(10).describe('Maximum snapshots to return'),
  }),
  execute: async ({
    sessionId,
    at,
    startTime,
    endTime,
    limit,
  }: {
    sessionId: string;
    at?: number;
    startTime?: number;
    endTime?: number;
    limit: number;
  }): Promise<{ snapshots: OrderBookSnapshot[] }> => {
    if (at !== undefined) {
      const snapshot = getSnapshotAt(sessionId, at);
      return { snapshots: snapshot ? [snapshot] : [] };
    }

    const snapshots = getSnapshots(sessionId, startTime, endTime, limit);
    return { snapshots };
  },
});
