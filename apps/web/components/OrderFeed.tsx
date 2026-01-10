'use client';

import type { TapeEvent, OrderPlacedEvent, OrderCancelledEvent, AgentConfig } from '@ai-exchange/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface OrderFeedProps {
  events: TapeEvent[];
  agents?: AgentConfig[];
  maxItems?: number;
}

type OrderEvent = OrderPlacedEvent | OrderCancelledEvent;

function isOrderEvent(e: TapeEvent): e is OrderEvent {
  return e.type === 'order_placed' || e.type === 'order_cancelled';
}

function isSeedOrder(agentId: string, agents?: AgentConfig[]): boolean {
  if (agentId.startsWith('seed')) return true;
  if (!agents) return false;
  return !agents.some((a) => a.id === agentId);
}

export function OrderFeed({ events, agents, maxItems = 50 }: OrderFeedProps) {
  const orderEvents = events
    .filter(isOrderEvent)
    .slice(-maxItems)
    .reverse();

  const getAgentName = (agentId: string) => {
    const agent = agents?.find((a) => a.id === agentId);
    return agent?.name || agentId;
  };

  if (orderEvents.length === 0) {
    return (
      <div className="text-muted-foreground text-center py-4">No orders yet</div>
    );
  }

  return (
    <ScrollArea className="h-64">
      <div className="space-y-1">
        {orderEvents.map((event) => (
          <div key={event.id} className="text-sm flex items-center gap-2 py-1 px-1">
            {event.type === 'order_placed' && (
              <>
                {isSeedOrder(event.order.agentId, agents) && (
                  <Badge variant="outline" className="text-xs px-1">seed</Badge>
                )}
                <Badge
                  variant={event.order.side === 'buy' ? 'default' : 'destructive'}
                  className={event.order.side === 'buy' ? 'bg-green-600' : ''}
                >
                  {event.order.side}
                </Badge>
                <span className="uppercase text-xs text-muted-foreground">
                  {event.order.type}
                </span>
                <span className={event.order.side === 'buy' ? 'text-green-400' : 'text-red-400'}>
                  {event.order.price.toFixed(2)}
                </span>
                <span className="text-muted-foreground">x{event.order.quantity}</span>
                <span className="text-muted-foreground text-xs ml-auto truncate max-w-[80px]">
                  {getAgentName(event.order.agentId)}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatTime(event.timestamp)}
                </span>
              </>
            )}
            {event.type === 'order_cancelled' && (
              <>
                <Badge variant="secondary">cancelled</Badge>
                <span className="text-muted-foreground text-xs">
                  #{event.orderId.slice(-6)}
                </span>
                <span className="text-muted-foreground text-xs ml-auto">
                  {getAgentName(event.agentId)} - {formatTime(event.timestamp)}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function formatTime(timestamp: number): string {
  const seconds = Math.floor(timestamp / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
