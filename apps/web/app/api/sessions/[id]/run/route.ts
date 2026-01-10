import { NextResponse } from 'next/server';
import { getSession } from '@ai-exchange/db';
import { SimulationRunner } from '@ai-exchange/simulation';
import type { Storyline } from '@ai-exchange/types';
import { loadStoryline } from '@/lib/storylines.server';

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

    // Load storyline if session has storylineId
    let storyline: Storyline | undefined;
    if (session.config.storylineId) {
      storyline = loadStoryline(session.config.storylineId);
    }

    // Run simulation asynchronously
    const runner = new SimulationRunner({
      sessionId: id,
      config: session.config,
      storyline,
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
