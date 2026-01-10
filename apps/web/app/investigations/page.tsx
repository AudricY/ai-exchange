'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Investigation {
  sessionId: string;
  sessionName: string;
  summary: string;
  conclusion: string;
  generatedAt: string;
  anomalyCount: number;
  hypothesesCount: number;
}

export default function InvestigationsPage() {
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvestigations();
  }, []);

  async function fetchInvestigations() {
    try {
      const res = await fetch('/api/investigations');
      const data = await res.json();
      setInvestigations(data.investigations);
    } catch (error) {
      console.error('Failed to fetch investigations:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Past Investigations</h2>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading investigations...</div>
      ) : investigations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-4">No investigations yet.</p>
          <p>
            Run an investigation on a{' '}
            <Link href="/" className="text-blue-400 hover:underline">
              completed session
            </Link>{' '}
            to see it here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {investigations.map((inv) => (
            <Link key={inv.sessionId} href={`/session/${inv.sessionId}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="pt-4 pb-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg">{inv.sessionName}</h3>
                    <div className="flex items-center gap-2">
                      {inv.anomalyCount > 0 && (
                        <Badge variant="destructive">
                          {inv.anomalyCount} anomal{inv.anomalyCount === 1 ? 'y' : 'ies'}
                        </Badge>
                      )}
                      <Badge variant="secondary">
                        {inv.hypothesesCount} hypothes{inv.hypothesesCount === 1 ? 'is' : 'es'}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Investigated: {new Date(inv.generatedAt).toLocaleString()}
                  </p>
                  <p className="text-sm line-clamp-2">{inv.summary}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
