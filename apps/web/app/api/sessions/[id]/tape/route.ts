import { NextResponse } from 'next/server';
import { fetchTapeEvents, fetchAllTapeEvents } from '@ai-exchange/db';
import type { TapeEventType } from '@ai-exchange/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  const startTime = searchParams.get('startTime');
  const endTime = searchParams.get('endTime');
  const eventTypes = searchParams.get('eventTypes');
  const limit = searchParams.get('limit');
  const all = searchParams.get('all');

  try {
    let events;

    if (all === 'true') {
      events = await fetchAllTapeEvents(id);
    } else {
      events = await fetchTapeEvents({
        sessionId: id,
        startTime: startTime ? parseInt(startTime) : undefined,
        endTime: endTime ? parseInt(endTime) : undefined,
        eventTypes: eventTypes
          ? (eventTypes.split(',') as TapeEventType[])
          : undefined,
        limit: limit ? parseInt(limit) : 100,
      });
    }

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Failed to fetch tape events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tape events' },
      { status: 500 }
    );
  }
}
