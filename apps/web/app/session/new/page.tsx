'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { STORYLINE_OPTIONS, type StorylineOption } from '@/lib/storylines';

export default function NewSessionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStorylineClick = async (storyline: StorylineOption) => {
    if (loading) return;

    setLoading(storyline.id);
    setError(null);

    try {
      // Create session with storyline
      const createRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storylineId: storyline.id }),
      });

      const createData = await createRes.json();

      if (!createRes.ok) {
        throw new Error(createData.error || 'Failed to create session');
      }

      const sessionId = createData.session.id;

      // Run simulation immediately
      const runRes = await fetch(`/api/sessions/${sessionId}/run`, {
        method: 'POST',
      });

      const runData = await runRes.json();

      if (!runRes.ok) {
        throw new Error(runData.error || 'Failed to start simulation');
      }

      // Redirect to session page
      router.push(`/session/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
      setLoading(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
          ← Back to sessions
        </Link>
        <h2 className="text-2xl font-bold mt-2">Choose a Storyline</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Select a market scenario to simulate
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive rounded-lg p-4">
          {error}
        </div>
      )}

      {/* Storyline Cards */}
      <div className="grid gap-4">
        {STORYLINE_OPTIONS.map((storyline) => (
          <Card
            key={storyline.id}
            className={`cursor-pointer transition-all hover:border-primary ${
              loading === storyline.id ? 'opacity-75' : ''
            } ${loading && loading !== storyline.id ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => handleStorylineClick(storyline)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{storyline.name}</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    {storyline.description}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground text-sm">
                    {storyline.duration}
                  </span>
                  {loading === storyline.id && (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
