'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Loader2, Check } from 'lucide-react';

interface ToolCallStep {
  type: 'tool_call';
  id: string;
  name: string;
  input: Record<string, unknown>;
  timestamp: number;
}

interface ToolResultStep {
  type: 'tool_result';
  callId: string;
  name: string;
  result: unknown;
  timestamp: number;
}

interface ToolCallCardProps {
  toolCall: ToolCallStep;
  toolResult?: ToolResultStep;
}

function formatToolSummary(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'get_session_manifest':
      return `Loading session ${input.sessionId}`;
    case 'fetch_tape':
      return `Fetching tape events${input.limit ? ` (limit: ${input.limit})` : ''}`;
    case 'get_ohlcv':
      return `Getting OHLCV data${input.resolution ? ` @ ${input.resolution}ms` : ''}`;
    case 'get_book_snapshots':
      return `Getting order book snapshots`;
    case 'compute_microstructure_metrics':
      return `Computing microstructure metrics`;
    case 'render_chart':
      return `Rendering chart`;
    case 'get_agent_thoughts':
      return `Getting agent thoughts${input.agentId ? ` for ${input.agentId}` : ''}`;
    case 'analyze_agent_correlation':
      return `Analyzing agent correlations`;
    case 'detect_patterns':
      return `Detecting market patterns`;
    case 'emit_report':
      return `Generating final report`;
    default:
      return name.replace(/_/g, ' ');
  }
}

function formatResultPreview(result: unknown): string {
  if (result === null || result === undefined) {
    return 'null';
  }

  if (typeof result === 'object' && '_truncated' in (result as Record<string, unknown>)) {
    const truncated = result as { _truncated: boolean; _originalLength: number; _preview: string };
    return `[Truncated: ${Math.round(truncated._originalLength / 1024)}KB] ${truncated._preview}`;
  }

  // Don't show base64 image data as text
  if (typeof result === 'object' && result !== null) {
    const r = result as Record<string, unknown>;
    if (typeof r.image === 'string' && r.image.length > 100) {
      const { image, ...rest } = r;
      return JSON.stringify({ ...rest, image: `[base64 image, ${Math.round(image.length / 1024)}KB]` }, null, 2);
    }
  }

  return JSON.stringify(result, null, 2);
}

// Detect if result contains a renderable image
function getImageFromResult(result: unknown): { image: string; mimeType: string } | null {
  if (typeof result === 'object' && result !== null) {
    const r = result as Record<string, unknown>;
    if (
      typeof r.image === 'string' &&
      r.image.length > 100 &&
      (r.mimeType === 'image/png' || r.mimeType === 'image/jpeg')
    ) {
      return { image: r.image, mimeType: r.mimeType as string };
    }
  }
  return null;
}

export function ToolCallCard({ toolCall, toolResult }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isPending = !toolResult;

  return (
    <div className="border border-blue-500/30 bg-blue-500/5 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-blue-500/10 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isPending ? (
            <Loader2 className="h-4 w-4 text-blue-400 animate-spin flex-shrink-0" />
          ) : (
            <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
          )}
          <Badge variant="outline" className="border-blue-500/50 text-blue-400 flex-shrink-0">
            {toolCall.name.replace(/_/g, ' ')}
          </Badge>
          <span className="text-sm text-muted-foreground truncate">
            {formatToolSummary(toolCall.name, toolCall.input)}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-blue-500/20 p-3 space-y-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Input</div>
            <pre className="text-xs bg-background/50 p-2 rounded overflow-x-auto">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>

          {toolResult && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Result</div>
              {(() => {
                const imageData = getImageFromResult(toolResult.result);
                if (imageData) {
                  return (
                    <div className="space-y-2">
                      <img
                        src={`data:${imageData.mimeType};base64,${imageData.image}`}
                        alt="Chart visualization"
                        className="max-w-full rounded border border-border"
                      />
                      <pre className="text-xs bg-background/50 p-2 rounded overflow-x-auto">
                        {formatResultPreview(toolResult.result)}
                      </pre>
                    </div>
                  );
                }
                return (
                  <pre className="text-xs bg-background/50 p-2 rounded overflow-x-auto">
                    {formatResultPreview(toolResult.result)}
                  </pre>
                );
              })()}
            </div>
          )}

          {isPending && (
            <div className="text-xs text-muted-foreground italic">
              Waiting for result...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
