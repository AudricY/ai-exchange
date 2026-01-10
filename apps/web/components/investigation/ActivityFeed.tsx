'use client';

import { useMemo, useRef, useEffect } from 'react';
import { ToolCallCard } from './ToolCallCard';
import { ThinkingBlock } from './ThinkingBlock';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ToolCallStep {
  type: 'tool_call';
  id: string;
  name: string;
  input: Record<string, unknown>;
  timestamp: number;
}

interface ToolResultStep {
  type: 'tool_result';
  callId: string;
  name: string;
  result: unknown;
  timestamp: number;
}

interface ThinkingStep {
  type: 'thinking';
  content: string;
  timestamp: number;
}

export type InvestigationStep = ToolCallStep | ToolResultStep | ThinkingStep;

interface ActivityItem {
  id: string;
  type: 'tool' | 'thinking';
  timestamp: number;
  toolCall?: ToolCallStep;
  toolResult?: ToolResultStep;
  content?: string;
}

interface ActivityFeedProps {
  steps: InvestigationStep[];
  autoScroll?: boolean;
}

export function ActivityFeed({ steps, autoScroll = true }: ActivityFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Group steps into activity items
  const activityItems = useMemo(() => {
    const items: ActivityItem[] = [];
    const toolCallMap = new Map<string, number>(); // callId -> index in items

    for (const step of steps) {
      if (step.type === 'tool_call') {
        const item: ActivityItem = {
          id: step.id,
          type: 'tool',
          timestamp: step.timestamp,
          toolCall: step,
        };
        toolCallMap.set(step.id, items.length);
        items.push(item);
      } else if (step.type === 'tool_result') {
        const callIndex = toolCallMap.get(step.callId);
        if (callIndex !== undefined) {
          // Attach result to existing tool call
          items[callIndex].toolResult = step;
        } else {
          // Orphan result - create standalone item
          items.push({
            id: `result-${step.callId}`,
            type: 'tool',
            timestamp: step.timestamp,
            toolResult: step,
          });
        }
      } else if (step.type === 'thinking') {
        items.push({
          id: `thinking-${step.timestamp}`,
          type: 'thinking',
          timestamp: step.timestamp,
          content: step.content,
        });
      }
    }

    return items;
  }, [steps]);

  // Auto-scroll to bottom when new items are added
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activityItems.length, autoScroll]);

  if (activityItems.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No activity yet
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3 pr-4">
        {activityItems.map((item) => {
          if (item.type === 'tool' && item.toolCall) {
            return (
              <ToolCallCard
                key={item.id}
                toolCall={item.toolCall}
                toolResult={item.toolResult}
              />
            );
          }

          if (item.type === 'thinking' && item.content) {
            return (
              <ThinkingBlock
                key={item.id}
                content={item.content}
                timestamp={item.timestamp}
              />
            );
          }

          return null;
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
