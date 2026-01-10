import { NextResponse } from 'next/server';
import { getOHLCV } from '@ai-exchange/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  const resolution = searchParams.get('resolution');
  const startTime = searchParams.get('startTime');
  const endTime = searchParams.get('endTime');

  try {
    const bars = getOHLCV(
      id,
      resolution ? parseInt(resolution) : 1000,
      startTime ? parseInt(startTime) : undefined,
      endTime ? parseInt(endTime) : undefined
    );

    return NextResponse.json({ bars });
  } catch (error) {
    console.error('Failed to fetch OHLCV:', error);
    return NextResponse.json(
      { error: 'Failed to fetch OHLCV data' },
      { status: 500 }
    );
  }
}
