'use client';

import { useState } from 'react';
import type { ForensicsReport } from '@ai-exchange/types';

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

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Forensic Investigation</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-white"
        >
          {expanded ? '−' : '+'}
        </button>
      </div>

      {expanded && (
        <>
          {!report && !isInvestigating && (
            <div className="text-center py-6">
              <p className="text-gray-400 mb-4">
                Run the Gemini forensics agent to analyze this market session.
              </p>
              <button
                onClick={onStartInvestigation}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
              >
                Start Investigation
              </button>
            </div>
          )}

          {isInvestigating && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-purple-400">
                <div className="animate-spin h-4 w-4 border-2 border-purple-400 border-t-transparent rounded-full" />
                <span>Investigating...</span>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {steps.map((step, i) => (
                  <div
                    key={i}
                    className={`text-sm p-2 rounded ${
                      step.type === 'tool_call'
                        ? 'bg-blue-900/30 text-blue-300'
                        : step.type === 'hypothesis'
                        ? 'bg-yellow-900/30 text-yellow-300'
                        : step.type === 'evidence'
                        ? 'bg-green-900/30 text-green-300'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    <span className="font-medium capitalize">{step.type}: </span>
                    {step.content}
                  </div>
                ))}
              </div>
            </div>
          )}

          {report && (
            <div className="space-y-4">
              <div className="bg-gray-700 rounded p-3">
                <h4 className="font-medium mb-2">Summary</h4>
                <p className="text-sm text-gray-300">{report.summary}</p>
              </div>

              <div>
                <h4 className="font-medium mb-2">Timeline</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {report.timeline.map((entry, i) => (
                    <div
                      key={i}
                      className={`text-sm p-2 rounded border-l-2 ${
                        entry.significance === 'high'
                          ? 'border-red-500 bg-red-900/20'
                          : entry.significance === 'medium'
                          ? 'border-yellow-500 bg-yellow-900/20'
                          : 'border-gray-500 bg-gray-700'
                      }`}
                    >
                      <div className="text-gray-400 text-xs">
                        {formatTime(entry.timestamp)}
                      </div>
                      {entry.description}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Conclusion</h4>
                <p className="text-sm text-gray-300 bg-gray-700 rounded p-3">
                  {report.conclusion}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
