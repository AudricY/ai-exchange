import { NextResponse } from 'next/server';
import { getOHLCV } from '@ai-exchange/db';
import type { OHLCVBar } from '@ai-exchange/types';

function aggregateBars(bars: OHLCVBar[], targetResolution: number): OHLCVBar[] {
  if (bars.length === 0) return [];

  const aggregated: OHLCVBar[] = [];
  let currentBucket: OHLCVBar | null = null;

  for (const bar of bars) {
    const bucketStart = Math.floor(bar.intervalStart / targetResolution) * targetResolution;

    if (!currentBucket || currentBucket.intervalStart !== bucketStart) {
      if (currentBucket) aggregated.push(currentBucket);
      currentBucket = {
        sessionId: bar.sessionId,
        intervalStart: bucketStart,
        resolution: targetResolution,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        tradeCount: bar.tradeCount,
      };
    } else {
      currentBucket.high = Math.max(currentBucket.high, bar.high);
      currentBucket.low = Math.min(currentBucket.low, bar.low);
      currentBucket.close = bar.close;
      currentBucket.volume += bar.volume;
      currentBucket.tradeCount += bar.tradeCount;
    }
  }

  if (currentBucket) aggregated.push(currentBucket);
  return aggregated;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  const resolution = parseInt(searchParams.get('resolution') || '5000');
  const startTime = searchParams.get('startTime');
  const endTime = searchParams.get('endTime');

  try {
    // Always fetch 1s bars and aggregate
    const bars = getOHLCV(
      id,
      1000,
      startTime ? parseInt(startTime) : undefined,
      endTime ? parseInt(endTime) : undefined
    );

    const result = resolution > 1000 ? aggregateBars(bars, resolution) : bars;
    return NextResponse.json({ bars: result });
  } catch (error) {
    console.error('Failed to fetch OHLCV:', error);
    return NextResponse.json(
      { error: 'Failed to fetch OHLCV data' },
      { status: 500 }
    );
  }
}
