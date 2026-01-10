'use client';

import { useState } from 'react';
import type { ForensicsReport } from '@ai-exchange/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ActivityFeed, type InvestigationStep } from './investigation/ActivityFeed';

export type InvestigationServerStatus = 'idle' | 'running' | 'completed' | 'failed';

interface InvestigationPanelProps {
  sessionId: string;
  report: ForensicsReport | null;
  isInvestigating: boolean;
  steps: InvestigationStep[];
  onStartInvestigation: () => void;
  serverStatus?: InvestigationServerStatus;
  startedAt?: string | null;
}

export function InvestigationPanel({
  sessionId,
  report,
  isInvestigating,
  steps,
  onStartInvestigation,
  serverStatus = 'idle',
  startedAt,
}: InvestigationPanelProps) {
  const [activeTab, setActiveTab] = useState<'activity' | 'report'>('activity');

  // Determine if investigation is running elsewhere (server says running but we're not the one running it)
  const runningElsewhere = serverStatus === 'running' && !isInvestigating;

  // Calculate stats for display
  const toolCallCount = steps.filter((s) => s.type === 'tool_call').length;
  const uniqueTools = new Set(
    steps.filter((s) => s.type === 'tool_call').map((s) => (s as { name: string }).name)
  );

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Forensic Investigation
            {(isInvestigating || runningElsewhere) && (
              <div className="animate-spin h-4 w-4 border-2 border-purple-400 border-t-transparent rounded-full" />
            )}
          </CardTitle>
          {(report || steps.length > 0) && (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'activity' | 'report')}>
              <TabsList className="h-8">
                <TabsTrigger value="activity" className="text-xs px-3">
                  Activity
                  {steps.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-xs">
                      {toolCallCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="report" className="text-xs px-3" disabled={!report}>
                  Report
                  {report && <span className="ml-1.5 h-2 w-2 rounded-full bg-green-500 inline-block" />}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>

        {isInvestigating && uniqueTools.size > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {Array.from(uniqueTools).map((tool) => (
              <Badge key={tool} variant="outline" className="text-xs">
                {tool.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 min-h-0">
        {!report && !isInvestigating && steps.length === 0 && !runningElsewhere && (
          <div className="text-center py-8">
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

        {runningElsewhere && (
          <div className="text-center py-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="animate-spin h-5 w-5 border-2 border-purple-400 border-t-transparent rounded-full" />
              <span className="text-purple-400 font-medium">Investigation in Progress</span>
            </div>
            <p className="text-muted-foreground text-sm mb-2">
              An investigation is already running for this session.
            </p>
            {startedAt && (
              <p className="text-muted-foreground text-xs">
                Started at {new Date(startedAt).toLocaleTimeString()}
              </p>
            )}
            <p className="text-muted-foreground text-xs mt-4">
              Refresh the page to check for updates.
            </p>
          </div>
        )}

        {(isInvestigating || steps.length > 0) && activeTab === 'activity' && (
          <ActivityFeed steps={steps} autoScroll={isInvestigating} />
        )}

        {report && activeTab === 'report' && (
          <ReportView report={report} />
        )}
      </CardContent>
    </Card>
  );
}

function ReportView({ report }: { report: ForensicsReport }) {
  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-4 pr-4">
        <div className="bg-muted rounded p-3">
          <h4 className="font-medium mb-2">Summary</h4>
          <p className="text-sm text-muted-foreground">{report.summary}</p>
        </div>

        {report.anomalies.length > 0 && (
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              Anomalies
              <Badge variant="destructive">{report.anomalies.length}</Badge>
            </h4>
            <div className="space-y-2">
              {report.anomalies.map((anomaly, i) => (
                <div
                  key={i}
                  className="text-sm p-2 rounded bg-red-900/20 border border-red-500/30"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {anomaly.type.replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(anomaly.confidence * 100)}% confidence
                    </span>
                  </div>
                  {anomaly.description}
                </div>
              ))}
            </div>
          </div>
        )}

        {report.hypotheses.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Hypotheses</h4>
            <div className="space-y-2">
              {report.hypotheses.map((hypothesis, i) => (
                <div
                  key={i}
                  className={`text-sm p-2 rounded border-l-2 ${
                    hypothesis.status === 'supported'
                      ? 'border-green-500 bg-green-900/20'
                      : hypothesis.status === 'rejected'
                      ? 'border-red-500 bg-red-900/20'
                      : 'border-yellow-500 bg-yellow-900/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant={
                        hypothesis.status === 'supported'
                          ? 'default'
                          : hypothesis.status === 'rejected'
                          ? 'destructive'
                          : 'secondary'
                      }
                      className="text-xs capitalize"
                    >
                      {hypothesis.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(hypothesis.confidence * 100)}% confidence
                    </span>
                  </div>
                  {hypothesis.description}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="font-medium mb-2">Timeline</h4>
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
        </div>

        <div>
          <h4 className="font-medium mb-2">Conclusion</h4>
          <p className="text-sm text-muted-foreground bg-muted rounded p-3">
            {report.conclusion}
          </p>
        </div>
      </div>
    </ScrollArea>
  );
}

function getTimelineClassName(significance: string) {
  switch (significance) {
    case 'high':
      return 'border-red-500 bg-red-900/20';
    case 'medium':
      return 'border-yellow-500 bg-yellow-900/20';
    default:
      return 'border-muted-foreground/50 bg-muted';
  }
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
