'use client';

import { useState, useEffect } from 'react';
import type { Session } from '@ai-exchange/types';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InvestigationBadge } from '@/components/InvestigationBadge';

type InvestigationStatus = 'idle' | 'running' | 'completed' | 'failed';

interface SessionWithReport extends Session {
  hasReport: boolean;
  reportGeneratedAt?: string;
  investigationStatus: InvestigationStatus;
}

export default function HomePage() {
  const [sessions, setSessions] = useState<SessionWithReport[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Market Sessions</h2>
        <Link href="/session/new">
          <Button>New Session</Button>
        </Link>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-4">No sessions yet.</p>
          <p>Create a new session to start simulating market activity.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <Link key={session.id} href={`/session/${session.id}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="pt-4 pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">{session.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Created: {new Date(session.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={session.status} />
                      <InvestigationBadge
                        status={session.investigationStatus}
                        generatedAt={session.reportGeneratedAt}
                      />
                      {session.status === 'completed' && (
                        <div className="text-sm text-muted-foreground">
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
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Session['status'] }) {
  const variants: Record<Session['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'secondary',
    running: 'default',
    completed: 'default',
    error: 'destructive',
  };

  const colors: Record<Session['status'], string> = {
    pending: 'bg-yellow-600',
    running: 'bg-blue-600',
    completed: 'bg-green-600',
    error: '',
  };

  return (
    <Badge variant={variants[status]} className={colors[status]}>
      {status}
    </Badge>
  );
}
