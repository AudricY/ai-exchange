'use client';

import type { TapeEvent, TradeEvent } from '@ai-exchange/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TradesFeedProps {
  events: TapeEvent[];
  maxItems?: number;
}

export function TradesFeed({ events, maxItems = 20 }: TradesFeedProps) {
  const trades = events
    .filter((e): e is TradeEvent => e.type === 'trade')
    .slice(-maxItems)
    .reverse();

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle>Recent Trades</CardTitle>
      </CardHeader>
      <CardContent>
        {trades.length === 0 ? (
          <div className="text-muted-foreground text-center py-4">No trades yet</div>
        ) : (
          <div className="space-y-1">
            <div className="flex text-xs text-muted-foreground pb-1 border-b border-border">
              <span className="flex-1">Price</span>
              <span className="w-16 text-right">Qty</span>
              <span className="w-20 text-right">Time</span>
            </div>
            <ScrollArea className="h-64">
              <div className="space-y-1">
                {trades.map((trade) => (
                  <div
                    key={trade.id}
                    className="flex text-sm items-center"
                  >
                    <span
                      className={`flex-1 ${
                        trade.trade.makerSide === 'sell'
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}
                    >
                      {trade.trade.price.toFixed(2)}
                    </span>
                    <span className="w-16 text-right">
                      {trade.trade.quantity}
                    </span>
                    <span className="w-20 text-right text-muted-foreground">
                      {formatTime(trade.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
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
