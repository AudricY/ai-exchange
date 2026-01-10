import { NextResponse } from 'next/server';
import {
  getSession,
  getSessionReports,
  getRunningInvestigations,
  setInvestigationStatus,
  generateInvestigationId,
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

    // Generate new investigation ID (allows multiple investigations per session)
    const investigationId = generateInvestigationId(id);

    // Set status to running before starting
    setInvestigationStatus(investigationId, id, 'running');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send investigation ID first so client knows which investigation this is
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'started', investigationId })}\n\n`)
          );

          const result = await investigate({
            sessionId: id,
            investigationId,
            onStep: (step: InvestigationStep) => {
              let stepData: unknown = step;

              // Truncate large tool results for SSE streaming
              // but preserve image data for chart rendering
              if (step.type === 'tool_result' && step.result) {
                const result = step.result as Record<string, unknown>;
                const hasImage = typeof result.image === 'string' &&
                                 result.image.length > 100 &&
                                 (result.mimeType === 'image/png' || result.mimeType === 'image/jpeg');

                if (hasImage) {
                  // Preserve image data, only send essential fields
                  stepData = {
                    ...step,
                    result: {
                      image: result.image,
                      mimeType: result.mimeType,
                      barCount: result.barCount,
                    },
                  };
                } else {
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
              }

              const data = JSON.stringify(stepData);
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
          });

          // Set status to completed
          setInvestigationStatus(investigationId, id, 'completed');

          if (result.report) {
            const data = JSON.stringify({
              type: 'report',
              investigationId,
              report: result.report,
            });
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
          setInvestigationStatus(investigationId, id, 'failed');
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
    const reports = getSessionReports(id);
    const runningInvestigations = getRunningInvestigations(id);

    return NextResponse.json({
      reports,
      runningInvestigations,
    });
  } catch (error) {
    console.error('Failed to get investigations:', error);
    return NextResponse.json(
      { error: 'Failed to get investigations' },
      { status: 500 }
    );
  }
}
