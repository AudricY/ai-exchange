import { NextResponse } from 'next/server';
import {
  getSession,
  getReport,
  getInvestigationStatus,
  setInvestigationStatus,
} from '@ai-exchange/db';
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

    // Check if investigation is already running (lock mechanism)
    const currentStatus = getInvestigationStatus(id);
    if (currentStatus?.status === 'running') {
      return NextResponse.json({
        status: 'already_running',
        startedAt: currentStatus.startedAt,
      });
    }

    // Set status to running before starting
    setInvestigationStatus(id, 'running');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await investigate({
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

          // Set status to completed
          setInvestigationStatus(id, 'completed');

          if (result.report) {
            const data = JSON.stringify({ type: 'report', report: result.report });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }

          // Send stats at the end
          const statsData = JSON.stringify({
            type: 'stats',
            stats: {
              stepCount: result.stepCount,
              elapsedMs: result.elapsedMs,
              usage: result.usage,
            },
          });
          controller.enqueue(encoder.encode(`data: ${statsData}\n\n`));
        } catch (error) {
          console.error('Investigation error:', error);
          // Set status to failed
          setInvestigationStatus(id, 'failed');
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
    const statusInfo = getInvestigationStatus(id);
    const status = statusInfo?.status ?? 'idle';

    if (report) {
      return NextResponse.json({ report, status: 'completed' });
    }

    if (status === 'running') {
      return NextResponse.json({
        status: 'running',
        startedAt: statusInfo?.startedAt,
      });
    }

    if (status === 'failed') {
      return NextResponse.json({ status: 'failed' });
    }

    return NextResponse.json({ status: 'idle' });
  } catch (error) {
    console.error('Failed to get report:', error);
    return NextResponse.json(
      { error: 'Failed to get report' },
      { status: 500 }
    );
  }
}
