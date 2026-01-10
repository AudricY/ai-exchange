'use client';

import { useState } from 'react';
import type { ForensicsReport } from '@ai-exchange/types';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Minus, Plus } from 'lucide-react';

interface InvestigationStep {
  type: 'tool_call' | 'thought' | 'hypothesis' | 'evidence';
  content: string;
  timestamp: number;
}

interface InvestigationPanelProps {
  sessionId: string;
  report: ForensicsReport | null;
  isInvestigating: boolean;
  steps: InvestigationStep[];
  onStartInvestigation: () => void;
}

export function InvestigationPanel({
  sessionId,
  report,
  isInvestigating,
  steps,
  onStartInvestigation,
}: InvestigationPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const getStepBadgeVariant = (type: InvestigationStep['type']) => {
    switch (type) {
      case 'tool_call':
        return 'default';
      case 'hypothesis':
        return 'secondary';
      case 'evidence':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStepClassName = (type: InvestigationStep['type']) => {
    switch (type) {
      case 'tool_call':
        return 'bg-blue-900/30 text-blue-300';
      case 'hypothesis':
        return 'bg-yellow-900/30 text-yellow-300';
      case 'evidence':
        return 'bg-green-900/30 text-green-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getTimelineClassName = (significance: string) => {
    switch (significance) {
      case 'high':
        return 'border-red-500 bg-red-900/20';
      case 'medium':
        return 'border-yellow-500 bg-yellow-900/20';
      default:
        return 'border-muted-foreground/50 bg-muted';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle>Forensic Investigation</CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>
        </CardAction>
      </CardHeader>

      {expanded && (
        <CardContent>
          {!report && !isInvestigating && (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                Run the Gemini forensics agent to analyze this market session.
              </p>
              <Button
                onClick={onStartInvestigation}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Start Investigation
              </Button>
            </div>
          )}

          {isInvestigating && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-purple-400">
                <div className="animate-spin h-4 w-4 border-2 border-purple-400 border-t-transparent rounded-full" />
                <span>Investigating...</span>
              </div>

              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {steps.map((step, i) => (
                    <div
                      key={i}
                      className={`text-sm p-2 rounded ${getStepClassName(step.type)}`}
                    >
                      <Badge variant={getStepBadgeVariant(step.type)} className="mr-2 capitalize">
                        {step.type.replace('_', ' ')}
                      </Badge>
                      {step.content}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {report && (
            <div className="space-y-4">
              <div className="bg-muted rounded p-3">
                <h4 className="font-medium mb-2">Summary</h4>
                <p className="text-sm text-muted-foreground">{report.summary}</p>
              </div>

              <div>
                <h4 className="font-medium mb-2">Timeline</h4>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {report.timeline.map((entry, i) => (
                      <div
                        key={i}
                        className={`text-sm p-2 rounded border-l-2 ${getTimelineClassName(entry.significance)}`}
                      >
                        <div className="text-muted-foreground text-xs">
                          {formatTime(entry.timestamp)}
                        </div>
                        {entry.description}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div>
                <h4 className="font-medium mb-2">Conclusion</h4>
                <p className="text-sm text-muted-foreground bg-muted rounded p-3">
                  {report.conclusion}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
