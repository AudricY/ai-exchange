import { NextResponse } from 'next/server';
import { getSession, getReport } from '@ai-exchange/db';
import { investigate, type InvestigationStep } from '@ai-exchange/forensics';

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

    if (session.status !== 'completed') {
      return NextResponse.json(
        { error: 'Session must be completed to investigate' },
        { status: 400 }
      );
    }

    // Check if report already exists
    const existingReport = getReport(id);
    if (existingReport) {
      return NextResponse.json({ report: existingReport });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const report = await investigate({
            sessionId: id,
            onStep: (step: InvestigationStep) => {
              const data = JSON.stringify({
                type: step.type,
                content: step.content,
                name: step.name,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
          });

          if (report) {
            const data = JSON.stringify({ type: 'report', report });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        } catch (error) {
          console.error('Investigation error:', error);
          const data = JSON.stringify({
            type: 'error',
            content: 'Investigation failed',
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Failed to start investigation:', error);
    return NextResponse.json(
      { error: 'Failed to start investigation' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const report = getReport(id);
    if (!report) {
      return NextResponse.json({ error: 'No report found' }, { status: 404 });
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Failed to get report:', error);
    return NextResponse.json(
      { error: 'Failed to get report' },
      { status: 500 }
    );
  }
}
