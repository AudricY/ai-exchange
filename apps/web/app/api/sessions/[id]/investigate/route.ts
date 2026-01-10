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
              let stepData: unknown = step;

              // Truncate large tool results for SSE streaming
              if (step.type === 'tool_result' && step.result) {
                const serialized = JSON.stringify(step.result);
                if (serialized.length > 10000) {
                  stepData = {
                    ...step,
                    result: {
                      _truncated: true,
                      _originalLength: serialized.length,
                      _preview: serialized.slice(0, 2000) + '...',
                    },
                  };
                }
              }

              const data = JSON.stringify(stepData);
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
