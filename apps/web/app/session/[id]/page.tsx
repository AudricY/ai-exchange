'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import type {
  Session,
  OHLCVBar,
  OrderBookSnapshot,
  TapeEvent,
  ForensicsReport,
} from '@ai-exchange/types';
import { Chart } from '@/components/Chart';
import { OrderBook } from '@/components/OrderBook';
import { TradesFeed } from '@/components/TradesFeed';
import { ReplayScrubber } from '@/components/ReplayScrubber';
import { InvestigationPanel } from '@/components/InvestigationPanel';

interface InvestigationStep {
  type: 'tool_call' | 'thought' | 'hypothesis' | 'evidence';
  content: string;
  timestamp: number;
}

export default function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [session, setSession] = useState<Session | null>(null);
  const [ohlcv, setOhlcv] = useState<OHLCVBar[]>([]);
  const [events, setEvents] = useState<TapeEvent[]>([]);
  const [snapshot, setSnapshot] = useState<OrderBookSnapshot | null>(null);
  const [report, setReport] = useState<ForensicsReport | null>(null);

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [investigating, setInvestigating] = useState(false);
  const [investigationSteps, setInvestigationSteps] = useState<InvestigationStep[]>([]);

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Fetch session data
  useEffect(() => {
    fetchSession();
  }, [id]);

  // Polling for running sessions
  useEffect(() => {
    if (session?.status === 'running') {
      const interval = setInterval(fetchSession, 1000);
      return () => clearInterval(interval);
    }
  }, [session?.status]);

  // Load data when session is completed
  useEffect(() => {
    if (session?.status === 'completed') {
      fetchOHLCV();
      fetchEvents();
      fetchLatestSnapshot();
    }
  }, [session?.status]);

  // Playback timer
  useEffect(() => {
    if (!isPlaying || !session?.config?.durationMs) return;

    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 100;
        if (next >= session.config.durationMs) {
          setIsPlaying(false);
          return session.config.durationMs;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, session?.config?.durationMs]);

  // Update snapshot based on current time
  useEffect(() => {
    if (session?.status === 'completed' && currentTime > 0) {
      fetchSnapshotAt(currentTime);
    }
  }, [currentTime, session?.status]);

  async function fetchSession() {
    try {
      const res = await fetch(`/api/sessions/${id}`);
      const data = await res.json();
      setSession(data.session);
    } catch (error) {
      console.error('Failed to fetch session:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchOHLCV() {
    try {
      const res = await fetch(`/api/sessions/${id}/ohlcv?resolution=1000`);
      const data = await res.json();
      setOhlcv(data.bars || []);
    } catch (error) {
      console.error('Failed to fetch OHLCV:', error);
    }
  }

  async function fetchEvents() {
    try {
      const res = await fetch(`/api/sessions/${id}/tape?all=true`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  }

  async function fetchLatestSnapshot() {
    try {
      const res = await fetch(`/api/sessions/${id}/snapshots?limit=1`);
      const data = await res.json();
      if (data.snapshots?.length > 0) {
        setSnapshot(data.snapshots[data.snapshots.length - 1]);
      }
    } catch (error) {
      console.error('Failed to fetch snapshot:', error);
    }
  }

  async function fetchSnapshotAt(time: number) {
    try {
      const res = await fetch(`/api/sessions/${id}/snapshots?at=${time}`);
      const data = await res.json();
      if (data.snapshot) {
        setSnapshot(data.snapshot);
      }
    } catch (error) {
      console.error('Failed to fetch snapshot:', error);
    }
  }

  async function runSimulation() {
    setRunning(true);
    try {
      await fetch(`/api/sessions/${id}/run`, { method: 'POST' });
      // Polling will handle status updates
    } catch (error) {
      console.error('Failed to run simulation:', error);
    } finally {
      setRunning(false);
    }
  }

  const startInvestigation = useCallback(async () => {
    setInvestigating(true);
    setInvestigationSteps([]);

    try {
      const res = await fetch(`/api/sessions/${id}/investigate`, {
        method: 'POST',
      });

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n').filter((l) => l.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'report') {
              setReport(data.report);
            } else {
              setInvestigationSteps((prev) => [
                ...prev,
                {
                  type: data.type,
                  content: data.content,
                  timestamp: Date.now(),
                },
              ]);
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch (error) {
      console.error('Investigation failed:', error);
    } finally {
      setInvestigating(false);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading session...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-gray-400">Session not found</div>
        <Link href="/" className="text-blue-400 hover:underline">
          Back to sessions
        </Link>
      </div>
    );
  }

  const duration = session.config?.durationMs || 60000;
  const visibleEvents = events.filter((e) => e.timestamp <= currentTime);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-gray-400 hover:text-white text-sm">
            ← Back to sessions
          </Link>
          <h2 className="text-2xl font-bold mt-2">{session.name}</h2>
          <p className="text-gray-400 text-sm">
            Status: {session.status} | Events: {session.eventCount} | Trades:{' '}
            {session.tradeCount}
          </p>
        </div>

        {session.status === 'pending' && (
          <button
            onClick={runSimulation}
            disabled={running}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 rounded-lg font-medium transition-colors"
          >
            {running ? 'Starting...' : 'Run Simulation'}
          </button>
        )}
      </div>

      {session.status === 'running' && (
        <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-4 flex items-center gap-3">
          <div className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full" />
          <span>Simulation is running...</span>
        </div>
      )}

      {session.status === 'completed' && (
        <>
          {/* Replay controls */}
          <ReplayScrubber
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            onTimeChange={setCurrentTime}
            onPlayPause={() => setIsPlaying(!isPlaying)}
            onReset={() => {
              setCurrentTime(0);
              setIsPlaying(false);
            }}
          />

          {/* Main content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column - Chart */}
            <div className="lg:col-span-2">
              <Chart data={ohlcv} currentTime={currentTime} />
            </div>

            {/* Right column - Order book and trades */}
            <div className="space-y-6">
              <OrderBook snapshot={snapshot} />
              <TradesFeed events={visibleEvents} />
            </div>
          </div>

          {/* Investigation panel */}
          <InvestigationPanel
            sessionId={id}
            report={report}
            isInvestigating={investigating}
            steps={investigationSteps}
            onStartInvestigation={startInvestigation}
          />
        </>
      )}
    </div>
  );
}
