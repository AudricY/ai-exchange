'use client';

import { useState } from 'react';
import type { ForensicsReport } from '@ai-exchange/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ActivityFeed, type InvestigationStep } from './investigation/ActivityFeed';
import { InvestigationSelector } from './InvestigationSelector';

export interface InvestigationStats {
  stepCount: number;
  elapsedMs: number;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface Investigation {
  id: string;
  title: string;
  report: ForensicsReport;
  generatedAt: string;
}

interface InvestigationPanelProps {
  sessionId: string;
  investigations: Investigation[];
  selectedReportId: string | null;
  onSelectReport: (id: string) => void;
  isInvestigating: boolean;
  steps: InvestigationStep[];
  onStartInvestigation: () => void;
  hasRunningInvestigation: boolean;
  stats?: InvestigationStats | null;
}

export function InvestigationPanel({
  sessionId,
  investigations,
  selectedReportId,
  onSelectReport,
  isInvestigating,
  steps,
  onStartInvestigation,
  hasRunningInvestigation,
  stats,
}: InvestigationPanelProps) {
  const [activeTab, setActiveTab] = useState<'activity' | 'report'>('activity');

  const selectedReport = investigations.find((i) => i.id === selectedReportId)?.report ?? null;

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
            {(isInvestigating || hasRunningInvestigation) && (
              <div className="animate-spin h-4 w-4 border-2 border-purple-400 border-t-transparent rounded-full" />
            )}
          </CardTitle>
        </div>

        {/* Investigation Selector */}
        <div className="mt-3">
          <InvestigationSelector
            investigations={investigations}
            selectedId={selectedReportId}
            onSelect={onSelectReport}
            onStartNew={onStartInvestigation}
            isStartingNew={isInvestigating}
            hasRunning={hasRunningInvestigation}
          />
        </div>

        {/* Activity/Report tabs - only show when there's content */}
        {(selectedReport || steps.length > 0) && (
          <div className="mt-3">
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
                <TabsTrigger value="report" className="text-xs px-3" disabled={!selectedReport}>
                  Report
                  {selectedReport && <span className="ml-1.5 h-2 w-2 rounded-full bg-green-500 inline-block" />}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        {isInvestigating && uniqueTools.size > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {Array.from(uniqueTools).map((tool) => (
              <Badge key={tool} variant="outline" className="text-xs">
                {tool.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        )}

        {stats && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-foreground">
                  {formatDuration(stats.elapsedMs)}
                </div>
                <div className="text-xs text-muted-foreground">Duration</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-foreground">
                  {stats.stepCount}
                </div>
                <div className="text-xs text-muted-foreground">Steps</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-foreground">
                  {toolCallCount}
                </div>
                <div className="text-xs text-muted-foreground">Tool Calls</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-foreground">
                  {formatTokens(stats.usage.totalTokens)}
                </div>
                <div className="text-xs text-muted-foreground">Tokens</div>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground text-center">
              {stats.usage.promptTokens.toLocaleString()} prompt + {stats.usage.completionTokens.toLocaleString()} completion
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 min-h-0">
        {investigations.length === 0 && !isInvestigating && !hasRunningInvestigation && (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Run the Gemini forensics agent to analyze this market session.
            </p>
          </div>
        )}

        {hasRunningInvestigation && !isInvestigating && (
          <div className="text-center py-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="animate-spin h-5 w-5 border-2 border-purple-400 border-t-transparent rounded-full" />
              <span className="text-purple-400 font-medium">Investigation in Progress</span>
            </div>
            <p className="text-muted-foreground text-sm">
              An investigation is running in another tab/window.
            </p>
          </div>
        )}

        {(isInvestigating || steps.length > 0) && activeTab === 'activity' && (
          <ActivityFeed steps={steps} autoScroll={isInvestigating} />
        )}

        {selectedReport && activeTab === 'report' && (
          <ReportView report={selectedReport} />
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

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatTokens(tokens: number): string {
  if (tokens < 1000) {
    return tokens.toString();
  }
  if (tokens < 1000000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return `${(tokens / 1000000).toFixed(2)}M`;
}
