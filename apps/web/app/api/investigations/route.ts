import { NextResponse } from 'next/server';
import { listReports, getSession } from '@ai-exchange/db';

export async function GET() {
  try {
    const reports = listReports();

    const investigations = reports.map((item) => {
      const session = getSession(item.sessionId);
      return {
        sessionId: item.sessionId,
        sessionName: session?.name ?? 'Unknown Session',
        summary: item.report.summary,
        conclusion: item.report.conclusion,
        generatedAt: item.generatedAt,
        anomalyCount: item.report.anomalies.length,
        hypothesesCount: item.report.hypotheses.length,
      };
    });

    return NextResponse.json({ investigations });
  } catch (error) {
    console.error('Failed to list investigations:', error);
    return NextResponse.json(
      { error: 'Failed to list investigations' },
      { status: 500 }
    );
  }
}
