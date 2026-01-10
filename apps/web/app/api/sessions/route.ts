import { NextResponse } from 'next/server';
import { createSession, listSessions, getReportStatuses } from '@ai-exchange/db';
import type { SessionConfig } from '@ai-exchange/types';

// Default session config for new sessions
const DEFAULT_CONFIG: SessionConfig = {
  seed: Date.now(),
  durationMs: 60000, // 1 minute
  tickSize: 1,
  initialPrice: 100,
  agents: [
    {
      id: 'mm-1',
      name: 'Market Maker 1',
      archetype: 'market_maker',
      params: { spread: 2, orderSize: 50 },
    },
    {
      id: 'noise-1',
      name: 'Noise Trader 1',
      archetype: 'noise',
      params: { orderProbability: 0.3, priceRange: 5, orderSize: 10 },
    },
    {
      id: 'noise-2',
      name: 'Noise Trader 2',
      archetype: 'noise',
      params: { orderProbability: 0.25, priceRange: 3, orderSize: 15 },
    },
    {
      id: 'momentum-1',
      name: 'Momentum Trader',
      archetype: 'momentum',
      params: { lookbackPeriod: 10, threshold: 0.02, orderSize: 20 },
    },
    {
      id: 'informed-1',
      name: 'Informed Trader',
      archetype: 'informed',
      params: { orderSize: 100, reactionStrength: 1.0 },
    },
  ],
  newsSchedule: [
    {
      timestamp: 15000,
      headline: 'Positive earnings report released',
      content: 'Company XYZ reported earnings above expectations.',
      sentiment: 'positive',
      source: 'Financial Times',
    },
    {
      timestamp: 35000,
      headline: 'Market uncertainty increases',
      content: 'Analysts express concerns about upcoming economic data.',
      sentiment: 'negative',
      source: 'Reuters',
    },
  ],
  docInjects: [],
};

export async function GET() {
  try {
    const sessions = listSessions();
    const sessionIds = sessions.map((s) => s.id);
    const reportStatuses = getReportStatuses(sessionIds);

    const sessionsWithReportStatus = sessions.map((session) => {
      const reportInfo = reportStatuses.get(session.id);
      return {
        ...session,
        hasReport: !!reportInfo?.generatedAt,
        reportGeneratedAt: reportInfo?.generatedAt,
        investigationStatus: reportInfo?.status ?? 'idle',
      };
    });

    return NextResponse.json({ sessions: sessionsWithReportStatus });
  } catch (error) {
    console.error('Failed to list sessions:', error);
    return NextResponse.json(
      { error: 'Failed to list sessions' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const name = body.name || `Session ${new Date().toLocaleString()}`;

    // Merge provided config with defaults
    const config: SessionConfig = {
      ...DEFAULT_CONFIG,
      ...body.config,
      seed: body.config?.seed ?? Date.now(),
    };

    const session = createSession(id, name, config);

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Failed to create session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
