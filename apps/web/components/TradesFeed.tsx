'use client';

import type { TapeEvent, TradeEvent } from '@ai-exchange/types';

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
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-3">Recent Trades</h3>

      {trades.length === 0 ? (
        <div className="text-gray-400 text-center py-4">No trades yet</div>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          <div className="flex text-xs text-gray-400 pb-1 border-b border-gray-700">
            <span className="flex-1">Price</span>
            <span className="w-16 text-right">Qty</span>
            <span className="w-20 text-right">Time</span>
          </div>
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
              <span className="w-20 text-right text-gray-400">
                {formatTime(trade.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(timestamp: number): string {
  const seconds = Math.floor(timestamp / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
