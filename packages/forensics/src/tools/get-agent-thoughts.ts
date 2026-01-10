import { tool } from 'ai';
import { z } from 'zod';
import { fetchTapeEvents } from '@ai-exchange/db';
import type { AgentThoughtEvent } from '@ai-exchange/types';

interface AgentThought {
  eventId: string;
  timestamp: number;
  agentId: string;
  thought: string;
  action?: string;
}

export const getAgentThoughts = tool({
  description:
    'Retrieve agent thought events to understand trader reasoning and decision-making. Use this to see WHY agents made certain trading decisions.',
  inputSchema: z.object({
    sessionId: z.string().describe('The session ID'),
    agentId: z.string().optional().describe('Filter by specific agent ID'),
    startTime: z
      .number()
      .optional()
      .describe('Start timestamp in milliseconds'),
    endTime: z.number().optional().describe('End timestamp in milliseconds'),
    limit: z
      .number()
      .default(50)
      .describe('Maximum number of thoughts to return'),
  }),
  execute: async ({
    sessionId,
    agentId,
    startTime,
    endTime,
    limit,
  }: {
    sessionId: string;
    agentId?: string;
    startTime?: number;
    endTime?: number;
    limit: number;
  }): Promise<{ thoughts: AgentThought[]; count: number; agentIds: string[] }> => {
    const events = await fetchTapeEvents({
      sessionId,
      eventTypes: ['agent_thought'],
      startTime,
      endTime,
      limit: limit * 2, // Fetch more to account for filtering
    });

    // Type narrow to AgentThoughtEvent
    const thoughtEvents = events.filter(
      (e): e is AgentThoughtEvent => e.type === 'agent_thought'
    );

    // Filter by agentId if specified
    const filteredEvents = agentId
      ? thoughtEvents.filter((e) => e.agentId === agentId)
      : thoughtEvents;

    const thoughts: AgentThought[] = filteredEvents.slice(0, limit).map((e) => ({
      eventId: e.id,
      timestamp: e.timestamp,
      agentId: e.agentId,
      thought: e.thought,
      action: e.action,
    }));

    // Get unique agent IDs
    const agentIds = [...new Set(filteredEvents.map((e) => e.agentId))];

    return {
      thoughts,
      count: thoughts.length,
      agentIds,
    };
  },
});
