'use client';

import type { OrderBookSnapshot } from '@ai-exchange/types';

interface OrderBookProps {
  snapshot: OrderBookSnapshot | null;
}

export function OrderBook({ snapshot }: OrderBookProps) {
  if (!snapshot) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3">Order Book</h3>
        <div className="text-gray-400 text-center py-8">
          No order book data available
        </div>
      </div>
    );
  }

  const maxQuantity = Math.max(
    ...snapshot.bids.map((b) => b.quantity),
    ...snapshot.asks.map((a) => a.quantity),
    1
  );

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-3">Order Book</h3>

      {/* Asks (sells) - reversed to show lowest at bottom */}
      <div className="space-y-1 mb-2">
        {[...snapshot.asks].reverse().slice(0, 8).map((level, i) => (
          <div key={`ask-${i}`} className="relative flex items-center text-sm">
            <div
              className="absolute right-0 h-full bg-red-900/30"
              style={{ width: `${(level.quantity / maxQuantity) * 100}%` }}
            />
            <span className="flex-1 text-red-400 relative z-10">
              {level.price.toFixed(2)}
            </span>
            <span className="w-20 text-right relative z-10">
              {level.quantity}
            </span>
            <span className="w-12 text-right text-gray-400 relative z-10">
              {level.orderCount}
            </span>
          </div>
        ))}
      </div>

      {/* Spread indicator */}
      <div className="py-2 border-y border-gray-700 text-center">
        <span className="text-gray-400 text-sm">Spread: </span>
        {snapshot.bids.length > 0 && snapshot.asks.length > 0 ? (
          <span className="text-white">
            {(snapshot.asks[0].price - snapshot.bids[0].price).toFixed(2)}
          </span>
        ) : (
          <span className="text-gray-500">-</span>
        )}
      </div>

      {/* Bids (buys) */}
      <div className="space-y-1 mt-2">
        {snapshot.bids.slice(0, 8).map((level, i) => (
          <div key={`bid-${i}`} className="relative flex items-center text-sm">
            <div
              className="absolute right-0 h-full bg-green-900/30"
              style={{ width: `${(level.quantity / maxQuantity) * 100}%` }}
            />
            <span className="flex-1 text-green-400 relative z-10">
              {level.price.toFixed(2)}
            </span>
            <span className="w-20 text-right relative z-10">
              {level.quantity}
            </span>
            <span className="w-12 text-right text-gray-400 relative z-10">
              {level.orderCount}
            </span>
          </div>
        ))}
      </div>

      {/* Last trade */}
      {snapshot.lastTradePrice && (
        <div className="mt-4 pt-3 border-t border-gray-700 text-sm">
          <span className="text-gray-400">Last: </span>
          <span className="text-white font-medium">
            ${snapshot.lastTradePrice.toFixed(2)}
          </span>
          {snapshot.lastTradeQuantity && (
            <span className="text-gray-400 ml-2">
              ({snapshot.lastTradeQuantity} qty)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
