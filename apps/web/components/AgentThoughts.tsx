'use client';

import { useState, useMemo } from 'react';
import type { TapeEvent, AgentThoughtEvent, AgentConfig } from '@ai-exchange/types';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface AgentThoughtsProps {
  events: TapeEvent[];
  agents?: AgentConfig[];
  maxItems?: number;
}

function isAgentThoughtEvent(e: TapeEvent): e is AgentThoughtEvent {
  return e.type === 'agent_thought';
}

// Generate consistent color for agent based on ID
function getAgentColor(agentId: string): string {
  const colors = [
    'text-blue-400',
    'text-purple-400',
    'text-cyan-400',
    'text-amber-400',
    'text-emerald-400',
    'text-rose-400',
  ];
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = (hash << 5) - hash + agentId.charCodeAt(i);
    hash |= 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

export function AgentThoughts({ events, agents, maxItems = 50 }: AgentThoughtsProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const thoughtEvents = useMemo(() => {
    return events
      .filter(isAgentThoughtEvent)
      .filter((e) => !selectedAgent || e.agentId === selectedAgent)
      .slice(-maxItems)
      .reverse();
  }, [events, selectedAgent, maxItems]);

  const uniqueAgents = useMemo(() => {
    const agentIds = new Set(
      events.filter(isAgentThoughtEvent).map((e) => e.agentId)
    );
    return Array.from(agentIds);
  }, [events]);

  const getAgentName = (agentId: string) => {
    const agent = agents?.find((a) => a.id === agentId);
    return agent?.name || agentId;
  };

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle>Agent Thoughts</CardTitle>
        <CardAction>
          <select
            value={selectedAgent || ''}
            onChange={(e) => setSelectedAgent(e.target.value || null)}
            className="text-xs bg-background border border-border rounded px-2 py-1"
          >
            <option value="">All Agents</option>
            {uniqueAgents.map((id) => (
              <option key={id} value={id}>
                {getAgentName(id)}
              </option>
            ))}
          </select>
        </CardAction>
      </CardHeader>
      <CardContent>
        {thoughtEvents.length === 0 ? (
          <div className="text-muted-foreground text-center py-4">
            No agent thoughts yet
          </div>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {thoughtEvents.map((event) => (
                <div key={event.id} className="text-sm p-2 rounded bg-muted">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-medium ${getAgentColor(event.agentId)}`}>
                      {getAgentName(event.agentId)}
                    </span>
                    <span className="text-muted-foreground text-xs ml-auto">
                      {formatTime(event.timestamp)}
                    </span>
                  </div>
                  <div className="text-muted-foreground">{event.thought}</div>
                  {event.action && (
                    <div className="mt-1 flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">
                        action
                      </Badge>
                      <span className="text-xs text-blue-400">{event.action}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function formatTime(timestamp: number): string {
  const seconds = Math.floor(timestamp / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
