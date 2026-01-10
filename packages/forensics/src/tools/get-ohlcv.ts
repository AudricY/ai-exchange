import { tool } from 'ai';
import { z } from 'zod';
import { getOHLCV } from '@ai-exchange/db';
import type { OHLCVBar } from '@ai-exchange/types';

export const getOHLCVData = tool({
  description:
    'Get OHLCV (candlestick) data for price analysis. Use to understand price movements over time.',
  parameters: z.object({
    sessionId: z.string().describe('The session ID'),
    resolution: z
      .number()
      .default(1000)
      .describe('Candle resolution in milliseconds (1000 = 1 second)'),
    startTime: z.number().optional().describe('Start timestamp'),
    endTime: z.number().optional().describe('End timestamp'),
  }),
  execute: async ({
    sessionId,
    resolution,
    startTime,
    endTime,
  }): Promise<{ bars: OHLCVBar[] }> => {
    const bars = getOHLCV(sessionId, resolution, startTime, endTime);
    return { bars };
  },
});
