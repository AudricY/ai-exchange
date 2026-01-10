import { NextResponse } from 'next/server';
import { getSession } from '@ai-exchange/db';
import { SimulationRunner } from '@ai-exchange/simulation';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = getSession(id);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'pending') {
      return NextResponse.json(
        { error: `Session is already ${session.status}` },
        { status: 400 }
      );
    }

    // Run simulation asynchronously
    const runner = new SimulationRunner({
      sessionId: id,
      config: session.config,
    });

    // Start the simulation (don't await - let it run in background)
    runner.run().catch((error) => {
      console.error('Simulation failed:', error);
    });

    return NextResponse.json({
      message: 'Simulation started',
      sessionId: id,
    });
  } catch (error) {
    console.error('Failed to start simulation:', error);
    return NextResponse.json(
      { error: 'Failed to start simulation' },
      { status: 500 }
    );
  }
}
