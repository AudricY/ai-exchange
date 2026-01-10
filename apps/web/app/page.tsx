'use client';

import { useState, useEffect } from 'react';
import type { Session } from '@ai-exchange/types';
import Link from 'next/link';

export default function HomePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      setSessions(data.sessions);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createSession() {
    setCreating(true);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Session ${new Date().toLocaleString()}`,
        }),
      });
      const data = await res.json();
      if (data.session) {
        setSessions((prev) => [data.session, ...prev]);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Market Sessions</h2>
        <button
          onClick={createSession}
          disabled={creating}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 rounded-lg font-medium transition-colors"
        >
          {creating ? 'Creating...' : 'New Session'}
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="mb-4">No sessions yet.</p>
          <p>Create a new session to start simulating market activity.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/session/${session.id}`}
              className="block bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors border border-gray-700"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{session.name}</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Created: {new Date(session.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={session.status} />
                  {session.status === 'completed' && (
                    <div className="text-sm text-gray-400">
                      {session.tradeCount} trades
                    </div>
                  )}
                </div>
              </div>
              {session.finalPrice && (
                <div className="mt-2 text-sm">
                  Final price: <span className="text-green-400">${session.finalPrice.toFixed(2)}</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Session['status'] }) {
  const colors = {
    pending: 'bg-yellow-600',
    running: 'bg-blue-600',
    completed: 'bg-green-600',
    error: 'bg-red-600',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status]}`}>
      {status}
    </span>
  );
}
