import { tool } from 'ai';
import { z } from 'zod';
import { fetchTapeEvents } from '@ai-exchange/db';
import type { TapeEvent } from '@ai-exchange/types';

export const fetchTape = tool({
  description:
    'Fetch tape events within a time window or by event type. Use this to examine specific periods of market activity.',
  parameters: z.object({
    sessionId: z.string().describe('The session ID'),
    startTime: z
      .number()
      .optional()
      .describe('Start timestamp in milliseconds'),
    endTime: z.number().optional().describe('End timestamp in milliseconds'),
    eventTypes: z
      .array(
        z.enum([
          'order_placed',
          'order_cancelled',
          'trade',
          'book_snapshot',
          'news',
          'rumor',
          'doc_inject',
          'agent_thought',
        ])
      )
      .optional()
      .describe('Filter by event types'),
    limit: z.number().default(50).describe('Maximum number of events to return'),
  }),
  execute: async ({
    sessionId,
    startTime,
    endTime,
    eventTypes,
    limit,
  }): Promise<{ events: TapeEvent[] }> => {
    const events = await fetchTapeEvents({
      sessionId,
      startTime,
      endTime,
      eventTypes: eventTypes as import('@ai-exchange/types').TapeEventType[] | undefined,
      limit,
    });

    return { events };
  },
});
