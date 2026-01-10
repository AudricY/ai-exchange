'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { SessionConfig } from '@ai-exchange/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { PresetSelector } from '@/components/session/PresetSelector';
import { AgentEditor } from '@/components/session/AgentEditor';
import { NewsScheduleEditor } from '@/components/session/NewsScheduleEditor';
import { PRESETS, type PresetKey } from '@/lib/presets';

export default function NewSessionPage() {
  const router = useRouter();
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('basic');
  const [config, setConfig] = useState<SessionConfig>({ ...PRESETS.basic.config });
  const [sessionName, setSessionName] = useState(`Session ${new Date().toLocaleString()}`);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePresetChange = (key: PresetKey) => {
    setSelectedPreset(key);
    setConfig({
      ...PRESETS[key].config,
      seed: Date.now(), // Fresh seed each time
    });
  };

  const handleCreate = async () => {
    if (config.agents.length === 0) {
      setError('Please add at least one agent');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sessionName,
          config,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create session');
      }

      if (data.session) {
        router.push(`/session/${data.session.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
          ← Back to sessions
        </Link>
        <h2 className="text-2xl font-bold mt-2">Create New Session</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Configure your market simulation settings
        </p>
      </div>

      {/* Session Name */}
      <Card>
        <CardContent className="pt-6">
          <Label>Session Name</Label>
          <Input
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="Enter session name..."
            className="mt-2"
          />
        </CardContent>
      </Card>

      {/* Preset Selector */}
      <div>
        <h3 className="text-lg font-medium mb-4">Choose a Preset</h3>
        <PresetSelector selected={selectedPreset} onSelect={handlePresetChange} />
      </div>

      <Separator />

      {/* Basic Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <Label>Duration (seconds)</Label>
              <Input
                type="number"
                value={config.durationMs / 1000}
                onChange={(e) => setConfig({
                  ...config,
                  durationMs: Math.max(10, parseInt(e.target.value) || 60) * 1000
                })}
                min={10}
                max={300}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Initial Price</Label>
              <Input
                type="number"
                value={config.initialPrice}
                onChange={(e) => setConfig({
                  ...config,
                  initialPrice: Math.max(1, parseFloat(e.target.value) || 100)
                })}
                min={1}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Tick Size</Label>
              <Input
                type="number"
                value={config.tickSize}
                onChange={(e) => setConfig({
                  ...config,
                  tickSize: Math.max(0.01, parseFloat(e.target.value) || 1)
                })}
                min={0.01}
                step={0.01}
                className="mt-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent Editor */}
      <Card>
        <CardContent className="pt-6">
          <AgentEditor
            agents={config.agents}
            onChange={(agents) => setConfig({ ...config, agents })}
          />
        </CardContent>
      </Card>

      {/* News Schedule Editor */}
      <Card>
        <CardContent className="pt-6">
          <NewsScheduleEditor
            newsSchedule={config.newsSchedule}
            durationMs={config.durationMs}
            onChange={(newsSchedule) => setConfig({ ...config, newsSchedule })}
          />
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive rounded-lg p-4">
          {error}
        </div>
      )}

      {/* Create Button */}
      <div className="flex justify-end gap-4">
        <Link href="/">
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button
          onClick={handleCreate}
          disabled={creating}
          className="bg-green-600 hover:bg-green-700"
        >
          {creating ? 'Creating...' : 'Create Session'}
        </Button>
      </div>
    </div>
  );
}
