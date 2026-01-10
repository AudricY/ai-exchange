import { NextResponse } from 'next/server';
import { getSnapshots, getSnapshotAt } from '@ai-exchange/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  const at = searchParams.get('at');
  const startTime = searchParams.get('startTime');
  const endTime = searchParams.get('endTime');
  const limit = searchParams.get('limit');

  try {
    if (at) {
      // Get snapshot at specific time
      const snapshot = getSnapshotAt(id, parseInt(at));
      return NextResponse.json({ snapshot });
    }

    // Get snapshots in range
    const snapshots = getSnapshots(
      id,
      startTime ? parseInt(startTime) : undefined,
      endTime ? parseInt(endTime) : undefined,
      limit ? parseInt(limit) : undefined
    );

    return NextResponse.json({ snapshots });
  } catch (error) {
    console.error('Failed to fetch snapshots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch snapshots' },
      { status: 500 }
    );
  }
}
